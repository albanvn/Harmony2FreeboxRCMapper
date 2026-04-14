/**
 * Harmony2FreeboxRCMapper - SSDP Manager
 *
 * Copyright (c) 2025
 * Licensed under the MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const dgram = require('dgram');
const os = require('os');

const { DEFAULT_PORT, SSDP_NAME_DEFAULT, SSDP_MULTICAST_ADDR, SSDP_MULTICAST_PORT } = require('./constants');
const { Logger } = require('./logger');

let userProvidedEndpoint = '';

class SSDPManager {
  constructor(instanceId, port, deviceName, userEndpoint = '') {
    this.instanceId = instanceId || 'default';
    this.port = port || DEFAULT_PORT;
    this.deviceName = deviceName || SSDP_NAME_DEFAULT;
    this.userEndpoint = userEndpoint;
    this.ssdpMessages = new SSDPMessages(this);
    this.udpServer = null;
    this.udpClient = null;
  }

  static setUserProvidedEndpoint(endpoint) {
    userProvidedEndpoint = endpoint;
  }

  startSSDP() {
    try {
      this.udpServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      this.udpClient = dgram.createSocket({ type: 'udp4' });

      this.udpServer.on('error', (err) => {
        Logger.log(Logger.LogSeverity.error, `[${this.instanceId}] Server error: ${err.message}`);
        this.udpServer.close();
      });

      this.udpClient.on('error', (err) => {
        Logger.log(Logger.LogSeverity.error, `[${this.instanceId}] Client error: ${err.message}`);
      });

      this.udpServer.on('message', (msg, rinfo) => {
        const message = msg.toString('ascii');

        if (message.includes('M-SEARCH')) {
          if (message.includes('ssdp:all') || message.includes('upnp:rootdevice')) {
            setTimeout(() => {
              const notifyMessage = this.ssdpMessages.getEcpDeviceNotifyMessage();
              const okMessage = this.ssdpMessages.getEcpDeviceOKMessage();

              this.udpClient.send(notifyMessage, SSDP_MULTICAST_PORT, SSDP_MULTICAST_ADDR, (err) => {
                if (err) Logger.log(Logger.LogSeverity.error, `[${this.instanceId}] Error sending NOTIFY: ${err.message}`);
              });

              this.udpServer.send(okMessage, rinfo.port, rinfo.address, (err) => {
                if (err) Logger.log(Logger.LogSeverity.error, `[${this.instanceId}] Error sending OK: ${err.message}`);
              });
            }, 100);
          }
        }
      });

      this.udpServer.on('listening', () => {
        const address = this.udpServer.address();
        Logger.log(
          Logger.LogSeverity.info,
          `[${this.instanceId}] SSDP Server listening on ${address.address}:${address.port}`
        );

        this.udpServer.addMembership(SSDP_MULTICAST_ADDR);

        Logger.log(
          Logger.LogSeverity.warn,
          `[${this.instanceId}] SSDP Multicasting with address ${this.getLocalIPAddress()} on port ${this.port} - Device: ${this.deviceName}`
        );
      });

      this.udpServer.bind(SSDP_MULTICAST_PORT);
    } catch (ex) {
      Logger.log(Logger.LogSeverity.error, `[${this.instanceId}] ${ex.message}`);
    }
  }

  getLocalIPAddress() {
    if (this.userEndpoint !== '') {
      return this.userEndpoint;
    }

    if (userProvidedEndpoint !== '') {
      return userProvidedEndpoint;
    }

    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('127.0.')) {
          return iface.address;
        }
      }
    }

    throw new Error('No network adapters with an IPv4 address available!');
  }

  getDeviceRootResponse() {
    return this.ssdpMessages.getEcpDeviceRootResponse();
  }

  stopSSDP() {
    try {
      if (this.udpServer) {
        this.udpServer.close();
        this.udpServer = null;
        Logger.log(Logger.LogSeverity.info, `[${this.instanceId}] SSDP Server stopped`);
      }
      if (this.udpClient) {
        this.udpClient.close();
        this.udpClient = null;
      }
    } catch (ex) {
      Logger.log(Logger.LogSeverity.error, `[${this.instanceId}] Error stopping SSDP: ${ex.message}`);
    }
  }
}

class SSDPMessages {
  constructor(ssdpManager) {
    this.ssdpManager = ssdpManager;
  }

  getSSDPName() {
    return this.ssdpManager.deviceName;
  }

  getEcpDeviceNotifyMessage() {
    const localIP = this.ssdpManager.getLocalIPAddress();
    const instanceId = this.ssdpManager.instanceId;

    const message =
      `NOTIFY * HTTP/1.1\r\n` +
      `Host: 239.255.255.250:1900\r\n` +
      `Cache-Control: max-age=3600\r\n` +
      `NT: roku:ecp\r\n` +
      `NTS: ssdp:alive\r\n` +
      `Location: http://${localIP}:${this.ssdpManager.port}/device-desc.xml\r\n` +
      `USN: uuid:roku:ecp:${instanceId}\r\n\r\n`;

    return Buffer.from(message, 'ascii');
  }

  getEcpDeviceOKMessage() {
    const localIP = this.ssdpManager.getLocalIPAddress();
    const instanceId = this.ssdpManager.instanceId;

    const message =
      `HTTP/1.1 200 OK\r\n` +
      `ST: roku:ecp\r\n` +
      `USN: uuid:roku:ecp:${instanceId}::roku:ecp\r\n` +
      `Cache-Control: max-age=3600\r\n` +
      `SERVER: Server: Roku/9.3.0 UPnP/1.0 Roku/9.3.0\r\n` +
      `Location: http://${localIP}:${this.ssdpManager.port}/device-desc.xml\r\n\r\n`;

    return Buffer.from(message, 'ascii');
  }

  getEcpDeviceRootResponse() {
    const instanceId = this.ssdpManager.instanceId;
    const deviceName = this.getSSDPName();

    const info =
      `<root>` +
      `<device>` +
      `<friendlyName>${deviceName}</friendlyName>` +
      `<manufacturer>TCL</manufacturer>` +
      `<manufacturerURL>http://www.github.com/albanvn75/VirtualFreeboxRC</manufacturerURL>` +
      `<modelName>7108X</modelName>` +
      `<serialNumber>${instanceId}</serialNumber>` +
      `<UDN>uuid:${instanceId}</UDN>` +
      `</device>` +
      `</root>`;
    Logger.log(Logger.LogSeverity.info, `[${instanceId}] Generated SSDP Root Response XML`);
    return info;
  }
}

module.exports = { SSDPManager, SSDPMessages };

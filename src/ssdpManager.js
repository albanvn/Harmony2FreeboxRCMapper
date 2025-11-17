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
  static setUserProvidedEndpoint(endpoint) {
    userProvidedEndpoint = endpoint;
  }

  static startSSDP() {
    try {
      const udpServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      const udpClient = dgram.createSocket({ type: 'udp4' });

      udpServer.on('error', (err) => {
        Logger.log(Logger.LogSeverity.error, `Server error: ${err.message}`);
        udpServer.close();
      });

      udpClient.on('error', (err) => {
        Logger.log(Logger.LogSeverity.error, `Client error: ${err.message}`);
      });

      udpServer.on('message', (msg, rinfo) => {
        const message = msg.toString('ascii');

        if (message.includes('M-SEARCH')) {
          if (message.includes('ssdp:all') || message.includes('upnp:rootdevice')) {
            Logger.log(Logger.LogSeverity.info, `Received M-SEARCH from ${rinfo.address}:${rinfo.port}, responding...`);

            setTimeout(() => {
              const notifyMessage = SSDPMessages.getEcpDeviceNotifyMessage();
              const okMessage = SSDPMessages.getEcpDeviceOKMessage();

              udpClient.send(notifyMessage, SSDP_MULTICAST_PORT, SSDP_MULTICAST_ADDR, (err) => {
                if (err) {
                  Logger.log(Logger.LogSeverity.error, `Error sending NOTIFY: ${err.message}`);
                } else {
                  Logger.log(Logger.LogSeverity.info, `Sent NOTIFY to multicast`);
                }
              });

              udpServer.send(okMessage, rinfo.port, rinfo.address, (err) => {
                if (err) {
                  Logger.log(Logger.LogSeverity.error, `Error sending OK: ${err.message}`);
                } else {
                  Logger.log(Logger.LogSeverity.info, `Sent OK response to ${rinfo.address}:${rinfo.port}`);
                }
              });
            }, 100);
          }
        }
      });

      udpServer.on('listening', () => {
        const address = udpServer.address();
        Logger.log(
          Logger.LogSeverity.info,
          `SSDP Server listening on ${address.address}:${address.port}`
        );

        udpServer.addMembership(SSDP_MULTICAST_ADDR);

        Logger.log(
          Logger.LogSeverity.warn,
          `SSDP Multicasting with address ${SSDPManager.getLocalIPAddress()} ` +
            `(if this is not your preferred interface, provide an IPv4 address as first arg)`
        );
      });

      udpServer.bind(SSDP_MULTICAST_PORT);
    } catch (ex) {
      Logger.log(Logger.LogSeverity.error, ex.message);
    }
  }

  static getLocalIPAddress() {
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
}

class SSDPMessages {
  static getSSDPName() {
    return SSDP_NAME_DEFAULT;
  }

  static getEcpDeviceNotifyMessage() {
    const localIP = SSDPManager.getLocalIPAddress();
    const hostname = os.hostname();

    const message =
      `NOTIFY * HTTP/1.1\r\n` +
      `Host: 239.255.255.250:1900\r\n` +
      `Cache-Control: max-age=3600\r\n` +
      `NT: roku:ecp\r\n` +
      `NTS: ssdp:alive\r\n` +
      `Location: http://${localIP}:${DEFAULT_PORT}/device-desc.xml\r\n` +
      `USN: uuid:roku:ecp:${hostname}\r\n\r\n`;

    return Buffer.from(message, 'ascii');
  }

  static getEcpDeviceOKMessage() {
    const localIP = SSDPManager.getLocalIPAddress();
    const hostname = os.hostname();

    const message =
      `HTTP/1.1 200 OK\r\n` +
      `ST: roku:ecp\r\n` +
      `USN: uuid:roku:ecp:${hostname}::roku:ecp\r\n` +
      `Cache-Control: max-age=3600\r\n` +
      `SERVER: Server: Roku/9.3.0 UPnP/1.0 Roku/9.3.0\r\n` +
      `Location: http://${localIP}:${DEFAULT_PORT}/device-desc.xml\r\n\r\n`;

    return Buffer.from(message, 'ascii');
  }

  static getEcpDeviceRootResponse() {
    const hostname = os.hostname();
    const deviceName = SSDPMessages.getSSDPName();

    const info =
      `<root>` +
      `<device>` +
      `<friendlyName>${deviceName}</friendlyName>` +
      `<manufacturer>TCL</manufacturer>` +
      `<manufacturerURL>http://www.github.com/albanvn75/VirtualFreeboxRC</manufacturerURL>` +
      `<modelName>7108X</modelName>` +
      `<serialNumber>${hostname}</serialNumber>` +
      `<UDN>uuid:${hostname}</UDN>` +
      `</device>` +
      `</root>`;
    console.log('Generated SSDP Root Response XML', info);
    return info;
  }
}

module.exports = { SSDPManager, SSDPMessages };

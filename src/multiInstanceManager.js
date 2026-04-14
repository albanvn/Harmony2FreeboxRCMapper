/**
 * Harmony2FreeboxRCMapper - Multi-Instance Manager
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

const express = require('express');
const path = require('path');
const fs = require('fs');
const { SSDPManager } = require('./ssdpManager');
const { Logger, logBuffer } = require('./logger');
const { RuleManager } = require('./ruleManager');
const { FREEBOX_KEYS, ROKU_BUTTONS } = require('./constants');
const { generateHelpPage } = require('./markdownConverter');

class MultiInstanceManager {
  constructor() {
    this.instances = [];
    this.servers = [];
  }

  /**
   * Ajoute une nouvelle instance Roku virtuelle
   * @param {string} instanceId - ID unique de l'instance (ex: "roku1", "roku2")
   * @param {number} port - Port HTTP pour cette instance
   * @param {string} deviceName - Nom du périphérique visible sur Harmony
   * @param {string} userEndpoint - Adresse IP optionnelle
   */
  addInstance(instanceId, port, deviceName, userEndpoint = '') {
    const instance = {
      instanceId,
      port,
      deviceName,
      userEndpoint,
      ssdpManager: new SSDPManager(instanceId, port, deviceName, userEndpoint),
      ruleManager: new RuleManager(),
      isRuleExecutionEnabled: true,
      app: null,
      server: null,
      serverStartTime: Date.now()
    };

    this.instances.push(instance);
    this.setupExpressApp(instance);

    return instance;
  }

  setupExpressApp(instance) {
    const app = express();
    app.use(express.json());

    app.use(
      express.static(path.join(__dirname, '..', 'public'), {
        setHeaders: (res, filePath) => {
          res.set('Accept-Ranges', 'bytes');
        },
      })
    );

    // API pour obtenir la liste de toutes les instances
    app.get('/api/instances', (req, res) => {
      res.json({ success: true, instances: this.getInstanceStatus(), currentInstanceId: instance.instanceId });
    });

    // API pour arrêter une instance
    app.post('/api/instances/:id/stop', (req, res) => {
      const result = this.stopInstance(req.params.id);
      res.json(result);
    });

    // API pour démarrer une instance
    app.post('/api/instances/:id/start', (req, res) => {
      const result = this.restartInstance(req.params.id, this.managementHost || '0.0.0.0');
      res.json(result);
    });

    // Page de gestion des instances
    app.get('/manage', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'public', 'manage.html'));
    });

    app.get('/', (req, res) => {
      Logger.log(Logger.LogSeverity.info, `[${instance.instanceId}] Client requested root page from ${req.ip}`);
      res.sendFile(path.join(__dirname, '..', 'templates', 'main.html'));
    });

    app.get('/device-desc.xml', (req, res) => {
      Logger.log(Logger.LogSeverity.info, `[${instance.instanceId}] Client requested device-desc.xml from ${req.ip}`);
      res.set('Content-Type', 'application/xml');
      res.send(instance.ssdpManager.getDeviceRootResponse());
    });

    app.get('/query/apps', (req, res) => {
      Logger.log(Logger.LogSeverity.info, `[${instance.instanceId}] Client requested /query/apps`);
      res.set('Content-Type', 'application/xml');
      res.send('<apps></apps>');
    });

    app.post('/keypress/:btn', async (req, res) => {
      const btn = req.params.btn;

      if (!/^[a-zA-Z]+$/.test(btn)) {
        return res.status(400).send('Invalid button name');
      }

      Logger.log(Logger.LogSeverity.info, `[${instance.instanceId}] Got button press ${btn}`);

      if (instance.isRuleExecutionEnabled) {
        await instance.ruleManager.execute(btn);
      } else {
        Logger.log(Logger.LogSeverity.warn, `[${instance.instanceId}] Rule execution is disabled, ignoring button ${btn}`);
      }

      res.status(200).send('OK');
    });

    app.get('/api/rules', (req, res) => {
      const rulesPath = path.join(__dirname, '..', `rules_${instance.instanceId}.json`);
      const defaultRulesPath = path.join(__dirname, '..', 'rules_default.json');

      let fileToRead = rulesPath;

      if (!fs.existsSync(rulesPath)) {
        if (fs.existsSync(defaultRulesPath)) {
          Logger.log(Logger.LogSeverity.warn, `[${instance.instanceId}] rules file not found, using rules_default.json`);
          fileToRead = defaultRulesPath;
        } else {
          return res.json({ success: false, error: 'No configuration file found' });
        }
      }

      try {
        const jsonContent = fs.readFileSync(fileToRead, 'utf8');
        const data = JSON.parse(jsonContent);

        const rules = data.rules || [];
        const remoteControlId = data.remoteControlId || '';
        const freeboxHost = data.freeboxHost || 'hd1.freebox.fr';

        res.json({ success: true, rules, remoteControlId, freeboxHost, instanceId: instance.instanceId });
      } catch (err) {
        Logger.error(`[${instance.instanceId}] Error reading rules: ${err.message}`);
        res.json({ success: false, error: err.message });
      }
    });

    app.get('/api/freebox-keys', (req, res) => {
      res.json({ success: true, keys: FREEBOX_KEYS });
    });

    app.get('/api/roku-buttons', (req, res) => {
      res.json({ success: true, buttons: ROKU_BUTTONS });
    });

    app.get('/api/ping', (req, res) => {
      const uptimeSeconds = Math.floor((Date.now() - instance.serverStartTime) / 1000);
      res.json({ success: true, message: 'pong', uptime: uptimeSeconds, instanceId: instance.instanceId });
    });

    app.post('/api/rules', (req, res) => {
      Logger.log(Logger.LogSeverity.info, `[${instance.instanceId}] Client saving rules to /api/rules`);

      const { rules, remoteControlId, freeboxHost } = req.body;
      const rulesPath = path.join(__dirname, '..', `rules_${instance.instanceId}.json`);

      try {
        const jsonObj = {
          remoteControlId: remoteControlId || '',
          freeboxHost: freeboxHost || 'hd1.freebox.fr',
          rules: rules || [],
        };

        const json = JSON.stringify(jsonObj, null, 2);

        fs.writeFileSync(rulesPath, json, 'utf8');

        Logger.log(Logger.LogSeverity.info, `[${instance.instanceId}] Rules saved successfully`);

        instance.ruleManager = new RuleManager();

        res.json({ success: true });
      } catch (err) {
        Logger.log(Logger.LogSeverity.error, `[${instance.instanceId}] Error saving rules: ${err.message}`);
        res.json({ success: false, error: err.message });
      }
    });

    app.get('/edit', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'public', 'edit.html'));
    });

    app.get('/help', (req, res) => {
      try {
        const readmePath = path.join(__dirname, '..', 'README.md');
        const html = generateHelpPage(readmePath);
        res.set('Content-Type', 'text/html');
        res.send(html);
      } catch (err) {
        Logger.error(`[${instance.instanceId}] Error generating help page: ${err.message}`);
        res.status(500).send('Error loading help page');
      }
    });

    app.get('/api/logs', (req, res) => {
      res.json({
        success: true,
        logs: logBuffer,
        enabled: instance.isRuleExecutionEnabled,
        instanceId: instance.instanceId
      });
    });

    app.post('/api/toggle', (req, res) => {
      instance.isRuleExecutionEnabled = !instance.isRuleExecutionEnabled;
      Logger.log(
        Logger.LogSeverity.info,
        `[${instance.instanceId}] Rule execution ${instance.isRuleExecutionEnabled ? 'enabled' : 'disabled'}`
      );
      res.json({ success: true, enabled: instance.isRuleExecutionEnabled });
    });

    app.post('/api/kill', (req, res) => {
      Logger.log(Logger.LogSeverity.info, `[${instance.instanceId}] Server shutdown requested`);
      res.json({ success: true, message: 'Server shutting down' });
      setTimeout(() => {
        process.exit(0);
      }, 500);
    });

    app.post('/api/clear-logs', (req, res) => {
      logBuffer.length = 0;
      Logger.log(Logger.LogSeverity.info, `[${instance.instanceId}] Logs cleared`);
      res.json({ success: true });
    });

    app.post('/api/reset-rules', (req, res) => {
      Logger.log(Logger.LogSeverity.info, `[${instance.instanceId}] Client requesting reset to default rules`);

      const defaultRulesPath = path.join(__dirname, '..', 'rules_default.json');
      const rulesPath = path.join(__dirname, '..', `rules_${instance.instanceId}.json`);

      try {
        if (!fs.existsSync(defaultRulesPath)) {
          Logger.error(`[${instance.instanceId}] rules_default.json not found`);
          return res.json({ success: false, error: 'rules_default.json not found' });
        }

        const defaultContent = fs.readFileSync(defaultRulesPath, 'utf8');
        const defaultData = JSON.parse(defaultContent);

        if (!defaultData.freeboxHost) {
          defaultData.freeboxHost = 'hd1.freebox.fr';
        }

        fs.writeFileSync(rulesPath, JSON.stringify(defaultData, null, 2), 'utf8');

        Logger.log(Logger.LogSeverity.success, `[${instance.instanceId}] Rules reset to default`);

        instance.ruleManager = new RuleManager();

        res.json({
          success: true,
          rules: defaultData.rules,
          remoteControlId: defaultData.remoteControlId,
          freeboxHost: defaultData.freeboxHost,
        });
      } catch (err) {
        Logger.error(`[${instance.instanceId}] Error resetting rules: ${err.message}`);
        res.json({ success: false, error: err.message });
      }
    });

    app.post('/api/test-rule', async (req, res) => {
      const { remoteControlId, key, freeboxHost } = req.body;

      if (!key) {
        return res.json({ success: false, error: 'Key is required' });
      }

      let host = freeboxHost;
      if (!host) {
        try {
          const rulesPath = path.join(__dirname, '..', `rules_${instance.instanceId}.json`);
          if (fs.existsSync(rulesPath)) {
            const jsonContent = fs.readFileSync(rulesPath, 'utf8');
            const data = JSON.parse(jsonContent);
            host = data.freeboxHost || 'hd1.freebox.fr';
          } else {
            host = 'hd1.freebox.fr';
          }
        } catch {
          host = 'hd1.freebox.fr';
        }
      }
      const { getFreeboxRemoteUrl } = require('./constants');
      const url = `${getFreeboxRemoteUrl(host)}?code=${remoteControlId || ''}&key=${key}`;

      try {
        Logger.log(Logger.LogSeverity.info, `[${instance.instanceId}] Testing rule: ${url}`);
        const fetch = (await import('node-fetch')).default;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal
        });

        clearTimeout(timeout);
        const status = response.status;

        Logger.log(Logger.LogSeverity.success, `[${instance.instanceId}] Test successful: ${status} from ${url}`);
        res.json({ success: true, status, message: `HTTP ${status}` });
      } catch (err) {
        const errorMessage = err.name === 'AbortError'
          ? 'Request timeout - Cannot reach Freebox'
          : err.message;
        Logger.log(Logger.LogSeverity.error, `[${instance.instanceId}] Test failed: ${errorMessage}`);
        res.json({ success: false, error: errorMessage });
      }
    });

    app.get('/api/version', (req, res) => {
      try {
        const packagePath = path.join(__dirname, '..', 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        res.json({ success: true, version: packageJson.version, instanceId: instance.instanceId });
      } catch (err) {
        Logger.error(`[${instance.instanceId}] Error reading version: ${err.message}`);
        res.json({ success: false, error: err.message });
      }
    });

    instance.app = app;
  }

  startInstance(instance, host = '0.0.0.0') {
    instance.server = instance.app.listen(instance.port, host, () => {
      Logger.log(
        Logger.LogSeverity.info,
        `[${instance.instanceId}] Button API running on http://${host}:${instance.port} - Device: ${instance.deviceName}`
      );
    });

    setImmediate(() => {
      instance.ssdpManager.startSSDP();
    });

    this.servers.push(instance.server);
  }

  startAllInstances(host = '0.0.0.0') {
    this.instances.forEach(instance => {
      this.startInstance(instance, host);
    });
  }

  stopInstance(instanceId) {
    const instance = this.instances.find(i => i.instanceId === instanceId);
    if (!instance) {
      return { success: false, error: 'Instance not found' };
    }

    if (!instance.server) {
      return { success: false, error: 'Instance is not running' };
    }

    try {
      instance.server.close();
      instance.server = null;
      instance.ssdpManager.stopSSDP();
      Logger.log(Logger.LogSeverity.info, `[${instanceId}] Instance stopped`);
      return { success: true };
    } catch (err) {
      Logger.log(Logger.LogSeverity.error, `[${instanceId}] Error stopping instance: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  restartInstance(instanceId, host = '0.0.0.0') {
    const instance = this.instances.find(i => i.instanceId === instanceId);
    if (!instance) {
      return { success: false, error: 'Instance not found' };
    }

    if (instance.server) {
      this.stopInstance(instanceId);
      // Wait a bit before restart
      setTimeout(() => {
        this.startInstance(instance, host);
      }, 500);
    } else {
      this.startInstance(instance, host);
    }

    return { success: true };
  }

  getInstanceStatus() {
    return this.instances.map(instance => ({
      instanceId: instance.instanceId,
      port: instance.port,
      deviceName: instance.deviceName,
      isRunning: instance.server !== null,
      uptime: instance.server ? Math.floor((Date.now() - instance.serverStartTime) / 1000) : 0
    }));
  }

  shutdown() {
    Logger.log(Logger.LogSeverity.info, 'Shutting down all instances...');
    this.instances.forEach(instance => {
      if (instance.server) {
        instance.server.close(() => {
          Logger.log(Logger.LogSeverity.info, `[${instance.instanceId}] Instance closed`);
        });
        instance.ssdpManager.stopSSDP();
      }
    });
  }
}

module.exports = { MultiInstanceManager };

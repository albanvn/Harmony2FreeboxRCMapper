/**
 * Harmony2FreeboxRCMapper - Unified Multi-Instance Manager
 *
 * Copyright (c) 2025
 * Licensed under the MIT License
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { SSDPManager } = require('./ssdpManager');
const { Logger, logBuffer } = require('./logger');
const { RuleManager } = require('./ruleManager');
const { FREEBOX_KEYS, ROKU_BUTTONS } = require('./constants');
const { generateHelpPage } = require('./markdownConverter');

class UnifiedMultiInstanceManager {
  constructor(serverPort) {
    this.serverPort = serverPort;
    this.instances = new Map();
    this.app = null;
    this.server = null;
    this.serverStartTime = Date.now();
    this.isGlobalExecutionEnabled = true; // Toggle global pour toutes les instances
  }

  /**
   * Ajoute une instance SSDP virtuelle
   * @param {string} instanceId - ID unique de l'instance
   * @param {number} ssdpPort - Port annoncé dans SSDP (mais tout arrive sur serverPort)
   * @param {string} deviceName - Nom du périphérique
   * @param {string} userEndpoint - Adresse IP optionnelle
   * @param {boolean} initialEnabled - Etat initial d'activation des règles
   */
  addInstance(instanceId, ssdpPort, deviceName, userEndpoint = '', initialEnabled = true) {
    const instance = {
      instanceId,
      ssdpPort,
      deviceName,
      userEndpoint,
      ssdpManager: new SSDPManager(instanceId, ssdpPort, deviceName, userEndpoint),
      ruleManager: new RuleManager(instanceId), // RuleManager avec instanceId
      isRuleExecutionEnabled: initialEnabled,
      isRunning: false
    };

    this.instances.set(instanceId, instance);
    return instance;
  }

  createUnifiedServer() {
    const app = express();
    app.use(express.json());

    app.use(
      express.static(path.join(__dirname, '..', 'public'), {
        setHeaders: (res, filePath) => {
          res.set('Accept-Ranges', 'bytes');
        },
      })
    );

    // ============ Pages principales ============

    app.get('/', (req, res) => {
      Logger.log(Logger.LogSeverity.info, 'Client requested root page');
      res.sendFile(path.join(__dirname, '..', 'templates', 'main.html'));
    });

    app.get('/edit', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'public', 'edit_unified.html'));
    });

    app.get('/help', (req, res) => {
      try {
        const readmePath = path.join(__dirname, '..', 'README.md');
        const html = generateHelpPage(readmePath);
        res.set('Content-Type', 'text/html');
        res.send(html);
      } catch (err) {
        Logger.error(`Error generating help page: ${err.message}`);
        res.status(500).send('Error loading help page');
      }
    });

    // ============ API Roku (commandes) ============

    app.get('/device-desc.xml', (req, res) => {
      // Retourner le premier actif ou roku1 par défaut
      const activeInstance = Array.from(this.instances.values()).find(i => i.isRunning) ||
                             this.instances.get('roku1');

      if (activeInstance) {
        Logger.log(Logger.LogSeverity.info, `[${activeInstance.instanceId}] Client requested device-desc.xml`);
        res.set('Content-Type', 'application/xml');
        res.send(activeInstance.ssdpManager.getDeviceRootResponse());
      } else {
        res.status(404).send('No active instance');
      }
    });

    app.get('/query/apps', (req, res) => {
      Logger.log(Logger.LogSeverity.info, 'Client requested /query/apps');
      res.set('Content-Type', 'application/xml');
      res.send('<apps></apps>');
    });

    app.post('/keypress/:btn', async (req, res) => {
      const btn = req.params.btn;

      if (!/^[a-zA-Z]+$/.test(btn)) {
        return res.status(400).send('Invalid button name');
      }

      // Vérifier le toggle global
      if (!this.isGlobalExecutionEnabled) {
        Logger.log(Logger.LogSeverity.info, `Button press ${btn} ignored (global execution disabled)`);
        return res.status(200).send('OK (disabled)');
      }

      // Exécuter la commande sur TOUTES les instances actives
      for (const instance of this.instances.values()) {
        if (instance.isRunning && instance.isRuleExecutionEnabled) {
          Logger.log(Logger.LogSeverity.info, `[${instance.instanceId}] Got button press ${btn}`);
          await instance.ruleManager.execute(btn);
        }
      }

      res.status(200).send('OK');
    });

    // ============ API de gestion des instances ============

    app.get('/api/instances', (req, res) => {
      const instancesArray = Array.from(this.instances.values()).map(instance => ({
        instanceId: instance.instanceId,
        ssdpPort: instance.ssdpPort,
        deviceName: instance.deviceName,
        isRunning: instance.isRunning,
        isEnabled: instance.isRuleExecutionEnabled
      }));

      res.json({
        success: true,
        instances: instancesArray,
        serverPort: this.serverPort
      });
    });

    app.post('/api/instances/:id/stop', (req, res) => {
      const result = this.stopInstance(req.params.id);
      res.json(result);
    });

    app.post('/api/instances/:id/start', (req, res) => {
      const result = this.startInstance(req.params.id);
      res.json(result);
    });

    app.post('/api/instances/:id/toggle', (req, res) => {
      const instance = this.instances.get(req.params.id);
      if (!instance) {
        return res.json({ success: false, error: 'Instance not found' });
      }

      const previousEnabled = instance.isRuleExecutionEnabled;

      // Si un état spécifique est fourni dans le body, l'utiliser, sinon inverser
      if (req.body && typeof req.body.enabled === 'boolean') {
        instance.isRuleExecutionEnabled = req.body.enabled;
      } else {
        instance.isRuleExecutionEnabled = !instance.isRuleExecutionEnabled;
      }

      const persistResult = this.persistInstanceEnabledState(instance.instanceId, instance.isRuleExecutionEnabled);
      if (!persistResult.success) {
        instance.isRuleExecutionEnabled = previousEnabled;
        Logger.log(
          Logger.LogSeverity.error,
          `[${instance.instanceId}] Unable to persist enabled state: ${persistResult.error}`
        );
        return res.json({ success: false, error: persistResult.error, enabled: previousEnabled });
      }

      Logger.log(
        Logger.LogSeverity.info,
        `[${instance.instanceId}] Rule execution ${instance.isRuleExecutionEnabled ? 'enabled' : 'disabled'}`
      );
      res.json({ success: true, enabled: instance.isRuleExecutionEnabled });
    });

    // ============ API des règles (multi-instance) ============

    // Endpoint pour compatibilité avec la page principale (retourne roku1 par défaut)
    app.get('/api/rules', (req, res) => {
      const defaultInstanceId = 'roku1';
      const rulesPath = path.join(__dirname, '..', 'rules.json');

      try {
        if (fs.existsSync(rulesPath)) {
          const jsonContent = fs.readFileSync(rulesPath, 'utf8');
          const data = JSON.parse(jsonContent);
          
          // Lire depuis la section roku1
          const instanceRules = data[defaultInstanceId] || { rules: [] };
          
          res.json({
            success: true,
            rules: instanceRules.rules || [],
            remoteControlId: data.remoteControlId || '',
            freeboxHost: data.freeboxHost || 'hd1.freebox.fr'
          });
        } else {
          res.json({
            success: true,
            rules: [],
            remoteControlId: '',
            freeboxHost: 'hd1.freebox.fr'
          });
        }
      } catch (err) {
        Logger.log(Logger.LogSeverity.error, `Error reading rules: ${err.message}`);
        res.json({ success: false, error: err.message });
      }
    });

    app.get('/api/rules/all', (req, res) => {
      const allRules = {};
      const rulesPath = path.join(__dirname, '..', 'rules.json');

      try {
        if (fs.existsSync(rulesPath)) {
          const jsonContent = fs.readFileSync(rulesPath, 'utf8');
          const data = JSON.parse(jsonContent);
          
          // Lire les sections roku1 et roku2
          for (const [instanceId, instance] of this.instances) {
            if (data[instanceId] && data[instanceId].rules) {
              allRules[instanceId] = {
                rules: data[instanceId].rules || [],
                remoteControlId: data.remoteControlId || '',
                freeboxHost: data.freeboxHost || 'hd1.freebox.fr'
              };
            } else {
              allRules[instanceId] = {
                rules: [],
                remoteControlId: data.remoteControlId || '',
                freeboxHost: data.freeboxHost || 'hd1.freebox.fr'
              };
            }
          }
        }
      } catch (err) {
        Logger.error(`Error reading rules: ${err.message}`);
      }

      res.json({ success: true, allRules });
    });

    app.post('/api/rules/save', (req, res) => {
      const { instanceId, rules, remoteControlId, freeboxHost } = req.body;

      if (!instanceId || !this.instances.has(instanceId)) {
        return res.json({ success: false, error: 'Invalid instance ID' });
      }

      const rulesPath = path.join(__dirname, '..', 'rules.json');

      try {
        // Lire le fichier existant
        let data = {};
        if (fs.existsSync(rulesPath)) {
          const jsonContent = fs.readFileSync(rulesPath, 'utf8');
          data = JSON.parse(jsonContent);
        }

        // Mettre à jour les données communes
        data.remoteControlId = remoteControlId || '';
        data.freeboxHost = freeboxHost || 'hd1.freebox.fr';
        
        // Mettre à jour la section de l'instance
        if (!data[instanceId]) {
          data[instanceId] = {};
        }
        data[instanceId].rules = rules || [];

        fs.writeFileSync(rulesPath, JSON.stringify(data, null, 2), 'utf8');
        Logger.log(Logger.LogSeverity.info, `[${instanceId}] Rules saved successfully`);

        // Recharger le RuleManager
        const instance = this.instances.get(instanceId);
        instance.ruleManager = new RuleManager(instanceId);

        res.json({ success: true });
      } catch (err) {
        Logger.log(Logger.LogSeverity.error, `[${instanceId}] Error saving rules: ${err.message}`);
        res.json({ success: false, error: err.message });
      }
    });

    // Endpoint POST /api/rules pour compatibilité (sauvegarde roku1 par défaut)
    app.post('/api/rules', (req, res) => {
      const { rules, remoteControlId, freeboxHost } = req.body;
      const defaultInstanceId = 'roku1';

      if (!this.instances.has(defaultInstanceId)) {
        return res.json({ success: false, error: 'Default instance not found' });
      }

      const rulesPath = path.join(__dirname, '..', 'rules.json');

      try {
        // Lire le fichier existant
        let data = {};
        if (fs.existsSync(rulesPath)) {
          const jsonContent = fs.readFileSync(rulesPath, 'utf8');
          data = JSON.parse(jsonContent);
        }

        // Mettre à jour les données communes
        data.remoteControlId = remoteControlId || '';
        data.freeboxHost = freeboxHost || 'hd1.freebox.fr';
        
        // Mettre à jour la section roku1
        if (!data[defaultInstanceId]) {
          data[defaultInstanceId] = {};
        }
        data[defaultInstanceId].rules = rules || [];

        fs.writeFileSync(rulesPath, JSON.stringify(data, null, 2), 'utf8');
        Logger.log(Logger.LogSeverity.info, `[${defaultInstanceId}] Rules saved successfully`);

        // Recharger le RuleManager
        const instance = this.instances.get(defaultInstanceId);
        instance.ruleManager = new RuleManager(defaultInstanceId);

        res.json({ success: true });
      } catch (err) {
        Logger.log(Logger.LogSeverity.error, `[${defaultInstanceId}] Error saving rules: ${err.message}`);
        res.json({ success: false, error: err.message });
      }
    });

    // Endpoint pour réinitialiser aux règles par défaut (roku1)
    app.post('/api/reset-rules', (req, res) => {
      const defaultInstanceId = 'roku1';
      
      if (!this.instances.has(defaultInstanceId)) {
        return res.json({ success: false, error: 'Default instance not found' });
      }

      const rulesPath = path.join(__dirname, '..', 'rules.json');
      const defaultRulesPath = path.join(__dirname, '..', 'rules_default.json');

      try {
        if (fs.existsSync(defaultRulesPath)) {
          const defaultContent = fs.readFileSync(defaultRulesPath, 'utf8');
          const defaultData = JSON.parse(defaultContent);
          
          // Lire le fichier existant pour préserver les autres sections
          let data = {};
          if (fs.existsSync(rulesPath)) {
            const jsonContent = fs.readFileSync(rulesPath, 'utf8');
            data = JSON.parse(jsonContent);
          }
          
          // Réinitialiser la section roku1
          data[defaultInstanceId] = { rules: defaultData.rules || [] };
          data.remoteControlId = defaultData.remoteControlId || '';
          data.freeboxHost = defaultData.freeboxHost || 'hd1.freebox.fr';
          
          fs.writeFileSync(rulesPath, JSON.stringify(data, null, 2), 'utf8');
          
          // Recharger le RuleManager
          const instance = this.instances.get(defaultInstanceId);
          instance.ruleManager = new RuleManager(defaultInstanceId);

          Logger.log(Logger.LogSeverity.info, `[${defaultInstanceId}] Rules reset to default`);
          
          res.json({
            success: true,
            rules: defaultData.rules || [],
            remoteControlId: data.remoteControlId || '',
            freeboxHost: data.freeboxHost || 'hd1.freebox.fr'
          });
        } else {
          res.json({ success: false, error: 'Default rules file not found' });
        }
      } catch (err) {
        Logger.log(Logger.LogSeverity.error, `[${defaultInstanceId}] Error resetting rules: ${err.message}`);
        res.json({ success: false, error: err.message });
      }
    });

    app.get('/api/freebox-keys', (req, res) => {
      res.json({ success: true, keys: FREEBOX_KEYS });
    });

    app.get('/api/roku-buttons', (req, res) => {
      res.json({ success: true, buttons: ROKU_BUTTONS });
    });

    // ============ API divers ============

    app.get('/api/ping', (req, res) => {
      const uptimeSeconds = Math.floor((Date.now() - this.serverStartTime) / 1000);
      res.json({ success: true, message: 'pong', uptime: uptimeSeconds });
    });

    app.get('/api/logs', (req, res) => {
      res.json({
        success: true,
        logs: logBuffer,
        enabled: this.isGlobalExecutionEnabled !== false // Par défaut true
      });
    });

    app.post('/api/toggle', (req, res) => {
      // Toggle global pour toutes les instances
      this.isGlobalExecutionEnabled = !this.isGlobalExecutionEnabled;
      Logger.log(
        Logger.LogSeverity.info,
        `Global rule execution ${this.isGlobalExecutionEnabled ? 'enabled' : 'disabled'}`
      );
      res.json({ success: true, enabled: this.isGlobalExecutionEnabled });
    });

    app.post('/api/clear-logs', (req, res) => {
      logBuffer.length = 0;
      Logger.log(Logger.LogSeverity.info, 'Logs cleared');
      res.json({ success: true });
    });

    app.post('/api/kill', (req, res) => {
      Logger.log(Logger.LogSeverity.info, 'Server shutdown requested');
      res.json({ success: true, message: 'Server shutting down' });
      setTimeout(() => {
        process.exit(0);
      }, 500);
    });

    app.post('/api/test-rule', async (req, res) => {
      const { instanceId, remoteControlId, key, freeboxHost } = req.body;

      if (!key) {
        return res.json({ success: false, error: 'Key is required' });
      }

      const { getFreeboxRemoteUrl } = require('./constants');
      const url = `${getFreeboxRemoteUrl(freeboxHost || 'hd1.freebox.fr')}?code=${remoteControlId || ''}&key=${key}`;

      try {
        Logger.log(Logger.LogSeverity.info, `[${instanceId}] Testing rule: ${url}`);
        const fetch = (await import('node-fetch')).default;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal
        });

        clearTimeout(timeout);
        const status = response.status;

        Logger.log(Logger.LogSeverity.success, `[${instanceId}] Test successful: ${status}`);
        res.json({ success: true, status, message: `HTTP ${status}` });
      } catch (err) {
        const errorMessage = err.name === 'AbortError'
          ? 'Request timeout - Cannot reach Freebox'
          : err.message;
        Logger.log(Logger.LogSeverity.error, `[${instanceId}] Test failed: ${errorMessage}`);
        res.json({ success: false, error: errorMessage });
      }
    });

    app.get('/api/version', (req, res) => {
      try {
        const packagePath = path.join(__dirname, '..', 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        res.json({ success: true, version: packageJson.version });
      } catch (err) {
        Logger.error(`Error reading version: ${err.message}`);
        res.json({ success: false, error: err.message });
      }
    });

    this.app = app;
    return app;
  }

  persistInstanceEnabledState(instanceId, enabled) {
    const instancesConfigPath = path.join(__dirname, '..', 'instances.json');

    try {
      if (!fs.existsSync(instancesConfigPath)) {
        return { success: false, error: 'instances.json not found' };
      }

      const instancesConfig = JSON.parse(fs.readFileSync(instancesConfigPath, 'utf8'));
      if (!instancesConfig.instances || !Array.isArray(instancesConfig.instances)) {
        return { success: false, error: 'Invalid instances.json format' };
      }

      const configInstance = instancesConfig.instances.find(i => i.instanceId === instanceId);
      if (!configInstance) {
        return { success: false, error: `Instance ${instanceId} not found in instances.json` };
      }

      configInstance.enabled = !!enabled;
      fs.writeFileSync(instancesConfigPath, JSON.stringify(instancesConfig, null, 2), 'utf8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  startInstance(instanceId) {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return { success: false, error: 'Instance not found' };
    }

    if (instance.isRunning) {
      return { success: false, error: 'Instance is already running' };
    }

    try {
      instance.ssdpManager.startSSDP();
      instance.isRunning = true;
      Logger.log(Logger.LogSeverity.info, `[${instanceId}] Instance started`);
      return { success: true };
    } catch (err) {
      Logger.log(Logger.LogSeverity.error, `[${instanceId}] Error starting instance: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  stopInstance(instanceId) {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return { success: false, error: 'Instance not found' };
    }

    if (!instance.isRunning) {
      return { success: false, error: 'Instance is not running' };
    }

    try {
      instance.ssdpManager.stopSSDP();
      instance.isRunning = false;
      Logger.log(Logger.LogSeverity.info, `[${instanceId}] Instance stopped`);
      return { success: true };
    } catch (err) {
      Logger.log(Logger.LogSeverity.error, `[${instanceId}] Error stopping instance: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  startServer(host = '0.0.0.0') {
    if (!this.app) {
      this.createUnifiedServer();
    }

    this.server = this.app.listen(this.serverPort, host, () => {
      Logger.log(
        Logger.LogSeverity.success,
        `Unified server running on http://${host}:${this.serverPort}`
      );
    });

    // Démarrer toutes les instances SSDP
    for (const [instanceId, instance] of this.instances) {
      if (instance.isRuleExecutionEnabled) {
        this.startInstance(instanceId);
      }
    }

    return this.server;
  }

  shutdown() {
    Logger.log(Logger.LogSeverity.info, 'Shutting down server...');

    // Arrêter toutes les instances SSDP
    for (const [instanceId, instance] of this.instances) {
      if (instance.isRunning) {
        this.stopInstance(instanceId);
      }
    }

    // Arrêter le serveur HTTP
    if (this.server) {
      this.server.close(() => {
        Logger.log(Logger.LogSeverity.info, 'Server closed');
      });
    }
  }
}

module.exports = { UnifiedMultiInstanceManager };

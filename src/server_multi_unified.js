/**
 * Harmony2FreeboxRCMapper - Unified Multi-Instance Server
 *
 * Copyright (c) 2025
 * Licensed under the MIT License
 */

const fs = require('fs');
const path = require('path');
const { UnifiedMultiInstanceManager } = require('./unifiedMultiInstanceManager');
const { Logger } = require('./logger');
const { SSDPManager } = require('./ssdpManager');

Logger.log(
  Logger.LogSeverity.info,
  'Harmony2FreeboxRCMapper Unified Multi-Instance started (press CTRL+C to terminate)'
);

const args = process.argv.slice(2);
let userProvidedEndpoint = '';
let host = '0.0.0.0';

if (args.length > 0) {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipRegex.test(args[0])) {
    host = args[0];
    userProvidedEndpoint = args[0];
    SSDPManager.setUserProvidedEndpoint(args[0]);
  }
}

// Charger la configuration des instances
const instancesConfigPath = path.join(__dirname, '..', 'instances.json');

if (!fs.existsSync(instancesConfigPath)) {
  Logger.log(
    Logger.LogSeverity.error,
    'instances.json not found! Please create this file to define your Roku instances.'
  );
  process.exit(1);
}

let instancesConfig;
try {
  instancesConfig = JSON.parse(fs.readFileSync(instancesConfigPath, 'utf8'));
} catch (err) {
  Logger.log(Logger.LogSeverity.error, `Error reading instances.json: ${err.message}`);
  process.exit(1);
}

if (!instancesConfig.instances || instancesConfig.instances.length === 0) {
  Logger.log(Logger.LogSeverity.error, 'No instances defined in instances.json');
  process.exit(1);
}

const serverPort = instancesConfig.serverPort || 8042;
const manager = new UnifiedMultiInstanceManager(serverPort);

// Créer toutes les instances SSDP (même celles désactivées pour permettre le re-enable via UI)
instancesConfig.instances.forEach(config => {
  const isEnabledByDefault = config.enabled !== false;
  Logger.log(
    isEnabledByDefault ? Logger.LogSeverity.info : Logger.LogSeverity.warn,
    `Creating instance: ${config.instanceId} (SSDP port ${config.ssdpPort}) - ${config.deviceName} [enabled=${isEnabledByDefault}]`
  );
  manager.addInstance(
    config.instanceId,
    config.ssdpPort,
    config.deviceName,
    userProvidedEndpoint,
    isEnabledByDefault
  );
});

// Démarrer le serveur unifié
manager.startServer(host);

Logger.log(
  Logger.LogSeverity.success,
  `✨ Unified server with ${manager.instances.size} Roku virtual instance(s)`
);

Logger.log(
  Logger.LogSeverity.info,
  '📋 Configuration:'
);
Logger.log(
  Logger.LogSeverity.info,
  `   Main interface: http://localhost:${serverPort}`
);
Logger.log(
  Logger.LogSeverity.info,
  `   Management: http://localhost:${serverPort}/manage`
);
Logger.log(
  Logger.LogSeverity.info,
  `   Editor: http://localhost:${serverPort}/edit`
);
Logger.log(
  Logger.LogSeverity.info,
  ''
);
Logger.log(
  Logger.LogSeverity.info,
  '🎮 Instances configured:'
);
for (const [instanceId, instance] of manager.instances) {
  Logger.log(
    Logger.LogSeverity.info,
    `   - ${instance.deviceName} (${instanceId}) - SSDP announces port ${instance.ssdpPort}`
  );
}
Logger.log(
  Logger.LogSeverity.info,
  ''
);
Logger.log(
  Logger.LogSeverity.info,
  '💡 Tips:'
);
Logger.log(
  Logger.LogSeverity.info,
  '   1. Open /manage to stop/start instances for Harmony pairing'
);
Logger.log(
  Logger.LogSeverity.info,
  '   2. Open /edit to configure rules for both instances side-by-side'
);
Logger.log(
  Logger.LogSeverity.info,
  '   3. Check logs with [instanceId] prefix to identify command sources'
);

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  manager.shutdown();
  setTimeout(() => {
    console.log('Server closed');
    process.exit(0);
  }, 1000);
});

module.exports = { manager, userProvidedEndpoint };

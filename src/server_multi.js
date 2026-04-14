/**
 * Harmony2FreeboxRCMapper - Multi-Instance Server
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

const fs = require('fs');
const path = require('path');
const { MultiInstanceManager } = require('./multiInstanceManager');
const { Logger } = require('./logger');
const { SSDPManager } = require('./ssdpManager');

Logger.log(
  Logger.LogSeverity.info,
  'Harmony2FreeboxRCMapper Multi-Instance started (press CTRL+C to terminate)'
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

const manager = new MultiInstanceManager();

// Créer et démarrer toutes les instances
instancesConfig.instances.forEach(config => {
  if (config.enabled !== false) {
    Logger.log(
      Logger.LogSeverity.info,
      `Creating instance: ${config.instanceId} on port ${config.port} - ${config.deviceName}`
    );
    const instance = manager.addInstance(
      config.instanceId,
      config.port,
      config.deviceName,
      userProvidedEndpoint
    );
  } else {
    Logger.log(Logger.LogSeverity.warn, `Instance ${config.instanceId} is disabled, skipping`);
  }
});

// Démarrer toutes les instances
manager.startAllInstances(host);

Logger.log(
  Logger.LogSeverity.success,
  `Started ${manager.instances.length} Roku virtual instance(s)`
);

Logger.log(
  Logger.LogSeverity.info,
  'Configuration tips:'
);
Logger.log(
  Logger.LogSeverity.info,
  `1. roku1: http://localhost:8042/manage - roku2: http://localhost:8043/manage`
);
Logger.log(
  Logger.LogSeverity.info,
  '2. Stop one instance before pairing with Harmony (via /manage page)'
);
Logger.log(
  Logger.LogSeverity.info,
  '3. Each instance has its own rules file: rules_roku1.json, rules_roku2.json'
);
Logger.log(
  Logger.LogSeverity.info,
  '4. Check logs with [instanceId] prefix to identify which instance received commands'
);

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  manager.shutdown();
  setTimeout(() => {
    console.log('All instances closed');
    process.exit(0);
  }, 1000);
});

module.exports = { manager, userProvidedEndpoint };

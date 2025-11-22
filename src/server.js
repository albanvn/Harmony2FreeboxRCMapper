/**
 * Harmony2FreeboxRCMapper - Server
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

const { Logger, logBuffer } = require('./logger');
const { SSDPManager, SSDPMessages } = require('./ssdpManager');
const { RuleManager } = require('./ruleManager');
const { FBX_RC_URL, FREEBOX_KEYS, DEFAULT_HOST, DEFAULT_PORT, ROKU_BUTTONS } = require('./constants');
const { generateHelpPage } = require('./markdownConverter');

let userProvidedEndpoint = '';
let isRuleExecutionEnabled = true;
let ruleManager = new RuleManager();

Logger.log(
  Logger.LogSeverity.info,
  'Harmony2FreeboxRCMapper started (press CTRL+C twice to terminate)'
);
const app = express();

app.use(express.json());

const args = process.argv.slice(2);
let host = DEFAULT_HOST;
const port = DEFAULT_PORT;

if (args.length > 0) {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipRegex.test(args[0])) {
    host = args[0];
    userProvidedEndpoint = args[0];
    SSDPManager.setUserProvidedEndpoint(args[0]);
  }
}

app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    setHeaders: (res, filePath) => {
      res.set('Accept-Ranges', 'bytes');
    },
  })
);

app.get('/', (req, res) => {
  Logger.log(Logger.LogSeverity.info, `Client requested root page from ${req.ip} - User-Agent: ${req.get('User-Agent') || 'unknown'}`);
  res.sendFile(path.join(__dirname, '..', 'templates', 'main.html'));
});

app.get('/device-desc.xml', (req, res) => {
  Logger.log(Logger.LogSeverity.info, `Client requested device-desc.xml from ${req.ip} - User-Agent: ${req.get('User-Agent') || 'unknown'}`);
  res.set('Content-Type', 'application/xml');
  res.send(SSDPMessages.getEcpDeviceRootResponse());
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

  Logger.log(Logger.LogSeverity.info, `Got button press ${btn}`);

  if (isRuleExecutionEnabled) {
    await ruleManager.execute(btn);
  } else {
    Logger.log(Logger.LogSeverity.warn, `Rule execution is disabled, ignoring button ${btn}`);
  }

  res.status(200).send('OK');
});

app.get('/api/rules', (req, res) => {
  const rulesPath = path.join(__dirname, '..', 'rules.json');
  const defaultRulesPath = path.join(__dirname, '..', 'rules_default.json');

  let fileToRead = rulesPath;

  if (!fs.existsSync(rulesPath)) {
    if (fs.existsSync(defaultRulesPath)) {
      Logger.log(Logger.LogSeverity.warn, 'rules.json not found, using rules_default.json');
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

    res.json({ success: true, rules, remoteControlId });
  } catch (err) {
    Logger.error(`Error reading rules: ${err.message}`);
    res.json({ success: false, error: err.message });
  }
});

app.get('/api/freebox-keys', (req, res) => {
  res.json({ success: true, keys: FREEBOX_KEYS });
});

app.get('/api/roku-buttons', (req, res) => {
  res.json({ success: true, buttons: ROKU_BUTTONS });
});

app.post('/api/rules', (req, res) => {
  Logger.log(Logger.LogSeverity.info, 'Client saving rules to /api/rules');

  const { rules, remoteControlId } = req.body;
  const rulesPath = path.join(__dirname, '..', 'rules.json');

  try {
    const jsonObj = {
      remoteControlId: remoteControlId || '',
      rules: rules || [],
    };

    const json = JSON.stringify(jsonObj, null, 2);

    fs.writeFileSync(rulesPath, json, 'utf8');

    Logger.log(Logger.LogSeverity.info, 'Rules saved successfully');

    ruleManager = new RuleManager();

    res.json({ success: true });
  } catch (err) {
    Logger.log(Logger.LogSeverity.error, `Error saving rules: ${err.message}`);
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
    Logger.error(`Error generating help page: ${err.message}`);
    res.status(500).send('Error loading help page');
  }
});

app.get('/api/logs', (req, res) => {
  res.json({
    success: true,
    logs: logBuffer,
    enabled: isRuleExecutionEnabled,
  });
});

app.post('/api/toggle', (req, res) => {
  isRuleExecutionEnabled = !isRuleExecutionEnabled;
  Logger.log(
    Logger.LogSeverity.info,
    `Rule execution ${isRuleExecutionEnabled ? 'enabled' : 'disabled'}`
  );
  res.json({ success: true, enabled: isRuleExecutionEnabled });
});

app.post('/api/kill', (req, res) => {
  Logger.log(Logger.LogSeverity.info, 'Server shutdown requested');
  res.json({ success: true, message: 'Server shutting down' });
  setTimeout(() => {
    process.exit(0);
  }, 500);
});

app.post('/api/clear-logs', (req, res) => {
  logBuffer.length = 0;
  Logger.log(Logger.LogSeverity.info, 'Logs cleared');
  res.json({ success: true });
});

app.post('/api/reset-rules', (req, res) => {
  Logger.log(Logger.LogSeverity.info, 'Client requesting reset to default rules');

  const defaultRulesPath = path.join(__dirname, '..', 'rules_default.json');
  const rulesPath = path.join(__dirname, '..', 'rules.json');

  try {
    if (!fs.existsSync(defaultRulesPath)) {
      Logger.error('rules_default.json not found');
      return res.json({ success: false, error: 'rules_default.json not found' });
    }

    const defaultContent = fs.readFileSync(defaultRulesPath, 'utf8');
    const defaultData = JSON.parse(defaultContent);

    fs.writeFileSync(rulesPath, JSON.stringify(defaultData, null, 2), 'utf8');

    Logger.log(Logger.LogSeverity.success, 'Rules reset to default');

    ruleManager = new RuleManager();

    res.json({
      success: true,
      rules: defaultData.rules,
      remoteControlId: defaultData.remoteControlId,
    });
  } catch (err) {
    Logger.error(`Error resetting rules: ${err.message}`);
    res.json({ success: false, error: err.message });
  }
});

app.post('/api/test-rule', async (req, res) => {
  const { remoteControlId, key } = req.body;

  if (!key) {
    return res.json({ success: false, error: 'Key is required' });
  }

  const url = `${FBX_RC_URL}?code=${remoteControlId || ''}&key=${key}`;

  try {
    Logger.log(Logger.LogSeverity.info, `Testing rule: ${url}`);
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, { method: 'GET' });
    const status = response.status;

    Logger.log(Logger.LogSeverity.success, `Test successful: ${status} from ${url}`);
    res.json({ success: true, status, message: `HTTP ${status}` });
  } catch (err) {
    Logger.log(Logger.LogSeverity.error, `Test failed: ${err.message}`);
    res.json({ success: false, error: err.message });
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

const server = app.listen(port, host, () => {
  Logger.log(Logger.LogSeverity.info, `Button API running on http://${host}:${port}`);
});

setImmediate(() => {
  SSDPManager.startSSDP();
});

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, userProvidedEndpoint };

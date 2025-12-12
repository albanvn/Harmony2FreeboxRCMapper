/**
 * Harmony2FreeboxRCMapper - Rule Manager
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

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const { Logger } = require('./logger');
const { getFreeboxRemoteUrl, DEFAULT_FBX_HOST, RuleAction } = require('./constants');

class Rule {
  constructor() {
    this.Name = '';
    this.Button = '';
    this.Action = RuleAction.HttpGET;
    this.EndPoint = '';
    this.ExData = '';
  }
}

class RuleList {
  constructor() {
    this.ruleList = [];
  }

  addRule(rule) {
    this.ruleList.push(rule);
  }
}

class RuleManager {
  constructor() {
    this.rules = new RuleList();

    Logger.log(Logger.LogSeverity.info, 'RuleManager running, loading rules...');

    const rulesPath = path.join(process.cwd(), 'rules.json');

    if (!fs.existsSync(rulesPath)) {
      const defaultRulesPath = path.join(__dirname, '..', 'rules_default.json');

      if (fs.existsSync(defaultRulesPath)) {
        Logger.log(Logger.LogSeverity.warn, 'rules.json not found, copying from rules_default.json');

        try {
          const defaultContent = fs.readFileSync(defaultRulesPath, 'utf8');
          fs.writeFileSync(rulesPath, defaultContent, 'utf8');
          Logger.log(
            Logger.LogSeverity.info,
            'Generated new rules.json from default configuration'
          );
        } catch (err) {
          Logger.error(`Error copying rules_default.json: ${err.message}`);
        }
      } else {
        Logger.log(Logger.LogSeverity.warn, 'rules.json and rules_default.json not found, generating blank...');

        const defaultJson = {
          remoteControlId: '',
          rules: [
            {
              Button: 'Home',
              Key: '',
            },
          ],
        };

        try {
          fs.writeFileSync(rulesPath, JSON.stringify(defaultJson, null, 2), 'utf8');
          Logger.log(
            Logger.LogSeverity.info,
            'Generated new blank rules.json, please configure Harmony2FreeboxRCMapper rules'
          );
        } catch (err) {
          Logger.error(`Error creating rules.json: ${err.message}`);
        }
      }
    }

    this.loadRules(rulesPath);
  }

  loadRules(rulesPath) {
    try {
      const jsonContent = fs.readFileSync(rulesPath, 'utf8');
      const data = JSON.parse(jsonContent);

      const remoteControlId = data.remoteControlId || '';
      const rulesData = data.rules || [];
      const freeboxHost = data.freeboxHost || DEFAULT_FBX_HOST;

      if (!remoteControlId || remoteControlId.trim() === '') {
        Logger.log(
          Logger.LogSeverity.warn,
          'Freebox remote control code is empty! Please configure it in the web interface at /edit'
        );
      }

      for (const ruleData of rulesData) {
        if (ruleData.Key) {
          const rule = new Rule();
          rule.Name = ruleData.Button || '';
          rule.Button = ruleData.Button || '';
          rule.Action = RuleAction.HttpGET;
          rule.EndPoint = `${getFreeboxRemoteUrl(freeboxHost)}?code=${remoteControlId}&key=${ruleData.Key}`;
          rule.ExData = '';

          this.rules.addRule(rule);
          Logger.log(
            Logger.LogSeverity.success,
            `Loaded ${rule.Action} rule "${rule.Name}" from rules.json for button "${rule.Button}"`
          );
        }
      }
    } catch (err) {
      Logger.error(`Error loading rules: ${err.message}`);
    }
  }

  async execute(button) {
    try {
      for (const rule of this.rules.ruleList) {
        if (rule.Button === button) {
          let statusCode = 'Unused';

          switch (rule.Action) {
            case RuleAction.HttpGET:
              statusCode = await this.executeHttpGet(rule);
              break;

            case RuleAction.Debug:
              statusCode = 'Unused';
              break;

            default:
              break;
          }

          if (statusCode === 'Unused') {
            Logger.log(Logger.LogSeverity.info, `Rule "${rule.Name}" ran`);
          } else {
            Logger.log(
              Logger.LogSeverity.info,
              `Rule "${rule.Name}" ran, got ${statusCode} from ${rule.EndPoint}`
            );
          }
        }
      }
    } catch (ex) {
      Logger.error(ex.message);
    }
  }

  async executeHttpGet(rule) {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(rule.EndPoint, { method: 'GET' });
      return response.status;
    } catch (err) {
      Logger.error(`HTTP GET error: ${err.message}`);
      return 'Error';
    }
  }

  async executeHttpPost(rule) {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(rule.EndPoint, {
        method: 'POST',
        body: rule.ExData,
        headers: { 'Content-Type': 'text/plain' },
      });
      return response.status;
    } catch (err) {
      Logger.error(`HTTP POST error: ${err.message}`);
      return 'Error';
    }
  }

  executeProcess(rule) {
    return new Promise((resolve, reject) => {
      try {
        const execPath = rule.EndPoint;
        const workingDir = path.dirname(path.resolve(execPath));
        const args = rule.ExData ? rule.ExData.split(' ') : [];

        const proc = spawn(execPath, args, {
          cwd: workingDir,
          shell: false,
        });

        proc.stdout.on('data', (data) => {
          Logger.log(Logger.LogSeverity.info, data.toString());
        });

        proc.stderr.on('data', (data) => {
          Logger.error(data.toString());
        });

        proc.on('close', (code) => {
          resolve(code);
        });

        proc.on('error', (err) => {
          Logger.error(`Process execution error: ${err.message}`);
          reject(err);
        });
      } catch (err) {
        Logger.error(`Process spawn error: ${err.message}`);
        reject(err);
      }
    });
  }

  async executeAutoHotKey(rule) {
    try {
      const ahkPath = 'AutoHotkey.exe';

      return new Promise((resolve, reject) => {
        const proc = spawn(ahkPath, ['/ErrorStdOut', '*'], {
          shell: true,
        });

        proc.stdin.write(rule.ExData);
        proc.stdin.end();

        proc.on('close', (code) => {
          resolve(code);
        });

        proc.on('error', (err) => {
          Logger.error(`AutoHotKey error: ${err.message}`);
          reject(err);
        });
      });
    } catch (err) {
      Logger.error(`AutoHotKey execution error: ${err.message}`);
    }
  }
}

module.exports = { RuleManager, Rule, RuleList, RuleAction };

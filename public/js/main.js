/**
 * Harmony2FreeboxRCMapper - Main JavaScript
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

let enabled = true;
let allLogs = [];
let currentFilter = 'all';

async function loadLogs() {
  try {
    const response = await fetch('/api/logs');
    const data = await response.json();
    allLogs = data.logs;
    
    renderLogs();

    enabled = data.enabled;
    updateStatus();
  } catch (err) {
    console.error('Error loading logs:', err);
  }
}

function renderLogs() {
  const container = document.getElementById('logsContainer');
  container.innerHTML = '';

  const filteredLogs = currentFilter === 'all' 
    ? allLogs 
    : allLogs.filter(log => log.severity.toLowerCase() === currentFilter.toLowerCase());

  filteredLogs.forEach((log) => {
    const div = document.createElement('div');
    div.className = 'log-entry ' + log.severity;
    const time = new Date(log.timestamp).toLocaleTimeString();
    div.innerHTML =
      '<span class="timestamp">' +
      time +
      '</span>' +
      '<span class="severity ' +
      log.severity +
      '">[' +
      log.severity +
      ']</span>' +
      '<span>' +
      log.message +
      '</span>';
    container.appendChild(div);
  });

  container.scrollTop = container.scrollHeight;
}

function filterLogs() {
  const select = document.getElementById('logFilter');
  currentFilter = select.value;
  renderLogs();
}

function copyLogs() {
  const filteredLogs = currentFilter === 'all' 
    ? allLogs 
    : allLogs.filter(log => log.severity.toLowerCase() === currentFilter.toLowerCase());
  
  const logsText = filteredLogs.map(log => {
    const time = new Date(log.timestamp).toLocaleTimeString();
    return `${time} [${log.severity}] ${log.message}`;
  }).join('\n');
  
  navigator.clipboard.writeText(logsText)
    .then(() => {
      console.log('Logs copied to clipboard!');
    })
    .catch((err) => {
      console.error('Error copying logs: ' + err.message);
    });
}

async function loadConfig() {
  try {
    const response = await fetch('/api/rules');
    const data = await response.json();
    const configContent = document.getElementById('configContent');

    if (data.success) {
      const config = {
        remoteControlId: data.remoteControlId,
        rules: data.rules,
      };
      configContent.textContent = JSON.stringify(config, null, 2);
    } else {
      configContent.textContent = 'Error loading config: ' + data.error;
    }
  } catch (err) {
    document.getElementById('configContent').textContent = 'Error: ' + err.message;
  }
}

function updateStatus() {
  const btn = document.getElementById('toggleBtn');

  if (enabled) {
    btn.textContent = '⏸️ Disable';
    btn.className = '';
  } else {
    btn.textContent = '▶️ Enable';
    btn.className = 'success';
  }
}

async function toggleExecution() {
  try {
    const response = await fetch('/api/toggle', { method: 'POST' });
    const data = await response.json();
    enabled = data.enabled;
    updateStatus();
  } catch (err) {
    console.error('Error toggling execution: ' + err.message);
  }
}

async function clearLogs() {
  try {
    await fetch('/api/clear-logs', { method: 'POST' });
    loadLogs();
  } catch (err) {
    console.error('Error clearing logs: ' + err.message);
  }
}

function copyConfig() {
  const content = document.getElementById('configContent').textContent;
  navigator.clipboard.writeText(content)
    .then(() => {
      console.log('Configuration copied to clipboard!');
    })
    .catch((err) => {
      console.error('Error copying to clipboard: ' + err.message);
    });
}

function exportConfig() {
  const content = document.getElementById('configContent').textContent;
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rules.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('Configuration exported as rules.json');
}

function importConfig() {
  document.getElementById('importFile').click();
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const config = JSON.parse(text);

    const response = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    const result = await response.json();
    if (result.success) {
      console.log('Configuration imported successfully!');
      loadConfig();
    } else {
      console.error('Error importing: ' + result.error);
    }
  } catch (err) {
    console.error('Error reading file: ' + err.message);
  }

  event.target.value = '';
}

loadLogs();
loadConfig();

setInterval(() => {
  loadLogs();
  loadConfig();
}, 2000);

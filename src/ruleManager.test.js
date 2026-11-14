/*
 * Tests de RuleManager : correspondance des boutons et chargement des règles.
 * Le constructeur n'est pas appelé (il crée rules.json dans le projet s'il est absent).
 */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { RuleManager, Rule, RuleList, RuleAction } = require('./ruleManager');
const { logBuffer } = require('./logger');

function createManager(buttons) {
  const manager = Object.create(RuleManager.prototype);
  manager.rules = new RuleList();
  for (const button of buttons) {
    const rule = new Rule();
    rule.Name = button;
    rule.Button = button;
    rule.Action = RuleAction.Debug;
    manager.rules.addRule(rule);
  }
  return manager;
}

function messages() {
  return logBuffer.map((entry) => entry.message);
}

beforeEach(() => {
  logBuffer.length = 0;
});

test('exécute la règle quelle que soit la casse ou les espaces du bouton reçu', async () => {
  const manager = createManager(['Select']);

  await manager.execute('  select ');

  assert.ok(messages().includes('Rule "Select" ran'));
  assert.ok(!messages().some((m) => m.startsWith('No rule matched')));
});

test('signale un bouton sans règle', async () => {
  const manager = createManager(['Home']);

  await manager.execute('Play');

  assert.ok(messages().includes('No rule matched button "Play"'));
});

test('ne plante pas sur un bouton absent', async () => {
  const manager = createManager(['Home']);

  await manager.execute(undefined);

  assert.ok(messages().includes('No rule matched button "undefined"'));
});

test('loadRules ignore les boutons sans touche et journalise le nombre de règles', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-manager-'));
  try {
    const rulesPath = path.join(tmpDir, 'rules.json');
    fs.writeFileSync(
      rulesPath,
      JSON.stringify({
        remoteControlId: '12345678',
        rules: [
          { Button: 'Home', Key: 'home' },
          { Button: 'Back', Key: '' },
        ],
      })
    );
    const manager = createManager([]);

    manager.loadRules(rulesPath);

    assert.deepStrictEqual(manager.rules.ruleList.map((r) => r.Button), ['Home']);
    assert.ok(messages().includes('Loaded 1 active rules'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

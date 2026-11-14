/*
 * Tests de scripts/jeedom-remote-update.sh sur des dépôts git temporaires :
 * un dépôt nu « origin », un clone « serveur » (le Jeedom) et un clone « dev » qui pousse.
 */
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.join(__dirname, 'jeedom-remote-update.sh');
const EXIT_UP_TO_DATE = 10;

// Isole les tests de la configuration git de la machine.
const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

let tmpDir;
let serverDir;
let devDir;

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' }).trim();
}

function commitFile(dir, file, content, message) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), content);
  git(dir, 'add', file);
  git(dir, 'commit', '--quiet', '-m', message);
}

function runUpdate(...args) {
  return spawnSync('bash', [SCRIPT, '--dir', serverDir, ...args], { env: GIT_ENV, encoding: 'utf8' });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeedom-update-'));
  const originDir = path.join(tmpDir, 'origin.git');
  serverDir = path.join(tmpDir, 'server');
  devDir = path.join(tmpDir, 'dev');

  git(tmpDir, 'init', '--quiet', '--bare', '--initial-branch=main', originDir);
  git(tmpDir, 'clone', '--quiet', originDir, devDir);
  git(devDir, 'checkout', '--quiet', '-b', 'main');
  commitFile(devDir, 'src/server.js', 'const a = 1;\n', 'init');
  git(devDir, 'push', '--quiet', '-u', 'origin', 'main');
  git(tmpDir, 'clone', '--quiet', originDir, serverDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('sort avec le code « déjà à jour » quand il n\'y a rien de nouveau', () => {
  const result = runUpdate();
  assert.strictEqual(result.status, EXIT_UP_TO_DATE, result.stderr);
  assert.match(result.stdout, /Déjà à jour/);
});

test('applique les nouveaux commits en fast-forward', () => {
  commitFile(devDir, 'src/server.js', 'const a = 2;\n', 'evolution');
  git(devDir, 'push', '--quiet');

  const result = runUpdate();

  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(git(serverDir, 'rev-parse', 'HEAD'), git(devDir, 'rev-parse', 'HEAD'));
  assert.match(result.stdout, /evolution/);
});

test('conserve les fichiers non suivis (rules.json)', () => {
  fs.writeFileSync(path.join(serverDir, 'rules.json'), '{"perso":true}');
  commitFile(devDir, 'src/server.js', 'const a = 2;\n', 'evolution');
  git(devDir, 'push', '--quiet');

  const result = runUpdate();

  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(fs.readFileSync(path.join(serverDir, 'rules.json'), 'utf8'), '{"perso":true}');
});

test('la simulation n\'applique rien', () => {
  const before = git(serverDir, 'rev-parse', 'HEAD');
  commitFile(devDir, 'src/server.js', 'const a = 2;\n', 'evolution');
  git(devDir, 'push', '--quiet');

  const result = runUpdate('--dry-run');

  assert.strictEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /evolution/);
  assert.strictEqual(git(serverDir, 'rev-parse', 'HEAD'), before);
});

test('refuse de travailler si un fichier suivi est modifié sur le serveur', () => {
  fs.writeFileSync(path.join(serverDir, 'src/server.js'), 'const hotfix = true;\n');
  commitFile(devDir, 'src/server.js', 'const a = 2;\n', 'evolution');
  git(devDir, 'push', '--quiet');

  const result = runUpdate();

  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /modifications locales/);
  assert.strictEqual(fs.readFileSync(path.join(serverDir, 'src/server.js'), 'utf8'), 'const hotfix = true;\n');
});

test('annule si le fichier lancé par le service n\'existe pas sur la révision cible', () => {
  const before = git(serverDir, 'rev-parse', 'HEAD');
  commitFile(devDir, 'src/other.js', 'const b = 1;\n', 'evolution');
  git(devDir, 'push', '--quiet');

  const result = runUpdate('--entry', './src/server_multi_unified.js');

  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /server_multi_unified\.js, absent de origin\/main/);
  assert.strictEqual(git(serverDir, 'rev-parse', 'HEAD'), before);
});

test('signale une erreur de syntaxe et indique comment revenir en arrière', () => {
  const before = git(serverDir, 'rev-parse', 'HEAD');
  commitFile(devDir, 'src/server.js', 'const = ;\n', 'casse');
  git(devDir, 'push', '--quiet');

  const result = runUpdate();

  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /erreur de syntaxe dans src\/server\.js/);
  assert.match(result.stderr, new RegExp(`reset --hard ${before.slice(0, 7)}`));
});

test('bascule sur une autre branche distante avec --branch', () => {
  git(devDir, 'checkout', '--quiet', '-b', 'multi-roky');
  commitFile(devDir, 'src/server_multi_unified.js', 'const m = 1;\n', 'multi');
  git(devDir, 'push', '--quiet', '-u', 'origin', 'multi-roky');

  const result = runUpdate('--branch', 'multi-roky', '--entry', 'src/server_multi_unified.js');

  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(git(serverDir, 'symbolic-ref', '--short', 'HEAD'), 'multi-roky');
  assert.match(result.stdout, /checkout main/);
});

test('refuse une branche locale qui a divergé', () => {
  commitFile(serverDir, 'local.txt', 'local\n', 'commit local');
  commitFile(devDir, 'src/server.js', 'const a = 2;\n', 'evolution');
  git(devDir, 'push', '--quiet');

  const result = runUpdate();

  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /a divergé/);
});

test('rejette un nom de branche invalide', () => {
  const result = runUpdate('--branch', 'bad..name');
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /nom de branche invalide/);
});

test('rejette une branche distante inexistante', () => {
  const result = runUpdate('--branch', 'inexistante');
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /branche distante introuvable/);
});

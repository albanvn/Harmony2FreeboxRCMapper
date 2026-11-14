/*
 * Tests du changelog : cohérence de CHANGELOG.md avec package.json et rendu HTML
 * servi par GET /api/changelog.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { renderMarkdownFile } = require('./markdownConverter');

const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('CHANGELOG.md a une section pour la version de package.json', () => {
  const markdown = fs.readFileSync(changelogPath, 'utf8');
  const heading = new RegExp(`^## \\[${escapeRegExp(packageJson.version)}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm');
  assert.match(markdown, heading);
});

test('le changelog est rendu en HTML : une section <h2> par version, listes <ul>', () => {
  const html = renderMarkdownFile(changelogPath);
  assert.ok(html.includes(`<h2>[${packageJson.version}]`));
  assert.match(html, /<h3>Ajouté<\/h3>/);
  assert.match(html, /<ul><li>/);
  assert.doesNotMatch(html, /^## /m);
});

test('renderMarkdownFile signale un fichier absent', () => {
  assert.throws(() => renderMarkdownFile(path.join(__dirname, 'absent.md')), { code: 'ENOENT' });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('frontend production build artifacts exist', () => {
  const distDir = path.resolve(__dirname, '../dist');
  assert.ok(fs.existsSync(distDir), 'dist directory must exist after build');
  assert.ok(fs.existsSync(path.join(distDir, 'index.html')), 'dist/index.html must exist');
});

test('frontend index.html contains root mount node', () => {
  const htmlPath = path.resolve(__dirname, '../index.html');
  const content = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(content.includes('<div id="root"></div>'), 'Root div must exist in template');
});

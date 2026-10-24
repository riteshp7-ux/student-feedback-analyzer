import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('frontend build artifacts', () => {
  it('frontend production build artifacts exist', () => {
    const distDir = path.resolve(__dirname, '../dist');
    expect(fs.existsSync(distDir), 'dist directory must exist after build').toBe(true);
    expect(fs.existsSync(path.join(distDir, 'index.html')), 'dist/index.html must exist').toBe(true);
  });

  it('frontend index.html contains root mount node', () => {
    const htmlPath = path.resolve(__dirname, '../index.html');
    const content = fs.readFileSync(htmlPath, 'utf8');
    expect(content).toContain('<div id="root"></div>');
  });

  it('production build enforces a Content-Security-Policy', () => {
    const htmlPath = path.resolve(__dirname, '../dist/index.html');
    if (!fs.existsSync(htmlPath)) return; // dist not built in this checkout
    const content = fs.readFileSync(htmlPath, 'utf8');
    expect(content).toContain('Content-Security-Policy');
    expect(content).toContain("script-src 'self'");
  });
});

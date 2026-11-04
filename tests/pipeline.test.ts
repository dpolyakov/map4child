import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { normalizeSheets } from '../scripts/normalize';
import { demoSheet } from './fixtures';

const directories: string[] = [];
function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'map4child-test-'));
  directories.push(directory);
  mkdirSync(join(directory, '.generated'));
  return directory;
}
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function run(name: string, directory: string) {
  return spawnSync(process.execPath, [
    '--import', import.meta.resolve('tsx'), fileURLToPath(new URL(`../scripts/${name}.ts`, import.meta.url)),
  ], {
    cwd: directory, encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, GOOGLE_SHEET_URL: '', GOOGLE_SERVICE_ACCOUNT_JSON: '',
      GOOGLE_APPLICATION_CREDENTIALS: '', VITE_YANDEX_MAPS_API_KEY: '', MAP4CHILD_ALLOW_DEMO: '' },
  });
}

describe('publication gates', () => {
  it('rejects demo data in the ordinary build', () => {
    const directory = workspace();
    writeFileSync(join(directory, '.generated/catalog.json'), JSON.stringify(normalizeSheets([demoSheet], 'demo').catalog));
    const result = run('verify-catalog', directory);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Демонстрационный каталог нельзя публиковать');
  });
  it('allows a live catalog without a Yandex key because OSM is the default', () => {
    const directory = workspace();
    writeFileSync(join(directory, '.generated/catalog.json'), JSON.stringify(normalizeSheets([demoSheet], 'live').catalog));
    const result = run('verify-catalog', directory);
    expect(result.status).toBe(0);
  });
  it('removes a stale catalog if a later source import fails', () => {
    const directory = workspace();
    const catalogFile = join(directory, '.generated/catalog.json');
    writeFileSync(catalogFile, 'previous catalog');
    const result = run('sync-data', directory);
    expect(result.status).toBe(1);
    expect(existsSync(catalogFile)).toBe(false);
  });
  it('rejects accidental intermediate files in the site output', () => {
    const directory = workspace();
    mkdirSync(join(directory, 'dist'));
    writeFileSync(join(directory, 'dist/raw.json'), '{}');
    expect(run('check-dist', directory).status).toBe(1);
  });
});

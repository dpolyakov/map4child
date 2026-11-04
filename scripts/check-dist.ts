import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spreadsheetIdFromUrl } from './google-sheets';

const forbidden = ['-----BEGIN PRIVATE KEY-----', '"private_key_id"', 'GOOGLE_SERVICE_ACCOUNT_JSON'];
if (process.env.GOOGLE_SHEET_URL) forbidden.push(spreadsheetIdFromUrl(process.env.GOOGLE_SHEET_URL));
async function inspect(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('В dist обнаружена символическая ссылка.');
    if (entry.isDirectory()) { await inspect(path); continue; }
    if (/^(raw|report)\./.test(entry.name) || entry.name.startsWith('.env')) throw new Error('В dist обнаружены промежуточные данные.');
    const content = await readFile(path, 'utf8');
    if (forbidden.some(value => content.includes(value))) throw new Error('В dist обнаружена конфигурация закрытого источника.');
  }
}
await inspect('dist');
console.log('Состав dist проверен: промежуточных данных и конфигурации Google нет.');

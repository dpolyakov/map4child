import { readFile } from 'node:fs/promises';
import { catalogSchema } from '../shared/catalog';

try {
  const catalog = catalogSchema.parse(JSON.parse(await readFile('.generated/catalog.json', 'utf8')));
  if (catalog.mode === 'demo' && process.env.MAP4CHILD_ALLOW_DEMO !== '1') {
    throw new Error('Демонстрационный каталог нельзя публиковать. Выполните npm run data:sync.');
  }
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  console.error(message.startsWith('Демонстрационный') ? message :
    'Нет корректного каталога. Сначала выполните data:sync или data:demo для локальной проверки.');
  process.exitCode = 1;
}

import { mkdir, writeFile } from 'node:fs/promises';
import { normalizeSheets } from './normalize';
import { demoSheet } from '../tests/fixtures';

const { catalog } = normalizeSheets([demoSheet], 'demo');
await mkdir('.generated', { recursive: true });
await writeFile('.generated/catalog.json', JSON.stringify(catalog));
console.log('Создан демонстрационный каталог с вымышленными точками. Публикация demo обычной командой build запрещена.');

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { normalizeSheets } from './normalize';
import { demoSheet } from '../tests/fixtures';
import { demoVenues } from './demo-venues';
import { editorHeaders } from '../shared/marketplace-model';

const detailed = { ...demoSheet, rows: [
  [...demoSheet.rows[0], editorHeaders.ready, editorHeaders.isNew],
  ...demoVenues.map(data => [...Array(demoSheet.rows[0].length).fill(''), JSON.stringify({ schemaVersion: 1, revision: 'demo-v1', archived: false, data }), 'true']),
] };
const { catalog } = normalizeSheets([demoSheet, detailed], 'demo');
await mkdir('.generated', { recursive: true });
await rm('.generated/public', { recursive: true, force: true });
await mkdir('.generated/public', { recursive: true });
await writeFile('.generated/catalog.json', JSON.stringify(catalog));
await writeFile('.generated/public/publication.json', JSON.stringify({ generatedAt: catalog.generatedAt, revisions: catalog.revisions }));
console.log('Создан демонстрационный каталог с вымышленными точками. Публикация demo обычной командой build запрещена.');

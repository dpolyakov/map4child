import { mkdir, writeFile, rm } from 'node:fs/promises';
import { normalizeSheets } from './normalize';
import { demoSheet } from '../tests/fixtures';
import { copyRepositoryPhotos, loadRepositoryVenues } from './repository-venues';

const venues = await loadRepositoryVenues();
const { catalog } = normalizeSheets([demoSheet], 'demo', new Date().toISOString(), venues);
await mkdir('.generated', { recursive: true });
await rm('.generated/public', { recursive: true, force: true });
await mkdir('.generated/public', { recursive: true });
await copyRepositoryPhotos(venues);
await writeFile('.generated/raw.json', JSON.stringify([demoSheet]));
await writeFile('.generated/catalog.json', JSON.stringify(catalog));
await writeFile('.generated/public/publication.json', JSON.stringify({ generatedAt: catalog.generatedAt, revisions: catalog.revisions }));
console.log(`Создан демонстрационный каталог: ${venues.length} подробных карточек и справочные примеры. Публикация demo обычной командой build запрещена.`);

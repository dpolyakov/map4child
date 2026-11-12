import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { catalogSchema } from '../shared/catalog';
import { normalizeSheets, type SheetData } from './normalize';
import { copyRepositoryPhotos, loadRepositoryVenues } from './repository-venues';

try {
  const catalog = catalogSchema.parse(JSON.parse(await readFile('.generated/catalog.json', 'utf8')));
  if (catalog.mode === 'demo' && process.env.MAP4CHILD_ALLOW_DEMO !== '1') {
    throw new Error('Демонстрационный каталог нельзя публиковать. Выполните npm run data:sync.');
  }
  const raw: SheetData[] = JSON.parse(await readFile('.generated/raw.json', 'utf8'));
  const venues = await loadRepositoryVenues();
  const prepared = normalizeSheets(raw, catalog.mode, catalog.generatedAt, venues).catalog;
  await mkdir('.generated/public', { recursive: true });
  await copyRepositoryPhotos(venues);
  await writeFile('.generated/catalog.json', JSON.stringify(prepared));
  await writeFile('.generated/public/publication.json', JSON.stringify({ generatedAt: prepared.generatedAt, revisions: prepared.revisions }));
  console.log(`Подготовлено ${venues.length} карточек из репозитория без обращения к Google.`);
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  console.error('Не удалось подготовить каталог: ' + message);
  console.error('Проверьте content и выполните data:sync или data:demo, если исходный снимок отсутствует.');
  process.exitCode = 1;
}

import { mkdir, writeFile, appendFile, rm } from 'node:fs/promises';
import { fetchSheets } from './google-sheets';
import { ImportError, normalizeSheets, type ImportReport } from './normalize';
import { copyRepositoryPhotos, loadRepositoryVenues } from './repository-venues';

async function saveReport(report: ImportReport) {
  await writeFile('.generated/report.json', JSON.stringify(report, null, 2));
  const safe = (value: string) => value.replace(/[|<>\r\n]/g, ' ');
  const markdown = [
    '## Импорт map4child', '',
    `Строк: ${report.inputRows}. Пропущено: ${report.skippedRows}. ` +
      `Объединено: ${report.mergedPoints}. Итоговых точек: ${report.publishedPoints}.`, '',
    '| Лист | Строка | Причина |', '|---|---:|---|',
    ...report.issues.map(issue => `| ${safe(issue.sheet)} | ${issue.row} | ${safe(issue.reason)} |`), '',
  ].join('\n');
  await writeFile('.generated/report.md', markdown);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
}

await mkdir('.generated', { recursive: true });
// A failed sync must not leave yesterday's catalog available to a subsequent local build.
await rm('.generated/catalog.json', { force: true });
await rm('.generated/public', { recursive: true, force: true });
await mkdir('.generated/public', { recursive: true });
try {
  const raw = await fetchSheets();
  await writeFile('.generated/raw.json', JSON.stringify(raw));
  const venues = await loadRepositoryVenues();
  const { catalog, report } = normalizeSheets(raw, 'live', new Date().toISOString(), venues);
  await copyRepositoryPhotos(venues);
  await saveReport(report);
  await writeFile('.generated/catalog.json', JSON.stringify(catalog));
  await writeFile('.generated/public/publication.json', JSON.stringify({ generatedAt: catalog.generatedAt, revisions: catalog.revisions }));
  console.log(`Подготовлено точек: ${catalog.points.length}. Отчёт: .generated/report.md`);
} catch (error) {
  if (error instanceof ImportError) await saveReport(error.report);
  console.error(error instanceof Error ? error.message : 'Импорт не выполнен.');
  process.exitCode = 1;
}

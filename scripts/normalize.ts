import { createHash } from 'node:crypto';
import type { SheetConfig } from '../config/sheets';
import { catalogSchema, NO_DATA, scaleValues, type Catalog, type MapPoint } from '../shared/catalog';
import { editorHeaders, readySchema, type ReadyVenue } from '../shared/marketplace-model';

export interface SheetData {
  config: SheetConfig;
  title: string;
  rows: unknown[][];
}

export interface ImportIssue { sheet: string; row: number; reason: string }
export interface ImportReport {
  inputRows: number;
  skippedRows: number;
  rejectedCoordinates: number;
  mergedPoints: number;
  publishedPoints: number;
  issues: ImportIssue[];
}

export class ImportError extends Error {
  constructor(message: string, readonly report: ImportReport) { super(message); }
}

const text = (value: unknown) => value == null ? '' : String(value).trim();
const header = (value: unknown) => text(value).toLocaleLowerCase('ru').replace(/\s+/g, ' ');
const specialties: Record<string, string> = {
  'спорт': 'Спорт', 'ит/инженеры': 'ИТ и инженерия', 'ит': 'ИТ и инженерия',
  'творчество/искусство': 'Творчество и искусство',
  'творчество/исскуство': 'Творчество и искусство',
  'творчество и искусство': 'Творчество и искусство',
  'наука': 'Наука', 'иностранные языки': 'Иностранные языки', 'мульти': 'Мульти',
};
const partnerTypes: Record<string, string> = {
  'нужно ходить регулярно': 'Регулярные занятия', 'регулярные занятия': 'Регулярные занятия',
  'разовые занятия': 'Разовые занятия',
  'развлекательный цент/детская комната': 'Развлекательные центры и детские комнаты',
  'развлекательный центр/детская комната': 'Развлекательные центры и детские комнаты',
  'развлекательный центр': 'Развлекательные центры и детские комнаты',
};
const ownerships: Record<string, string> = {
  'частная': 'Частная', 'частный': 'Частная',
  'государственная': 'Государственная', 'государственный': 'Государственная',
};

function unique(values: string[]): string[] {
  const all = [...new Set(values)];
  const known = all.filter(value => value !== NO_DATA);
  return (known.length ? known : [NO_DATA]).sort((a, b) => a.localeCompare(b, 'ru'));
}

function categories(value: unknown, aliases: Record<string, string>): string[] {
  const items = text(value).split(/[,;\n]/).map(value => value.trim()).filter(Boolean);
  return unique(items.map(value => aliases[value.toLocaleLowerCase('ru')] ?? value));
}

export function parseCoordinates(value: unknown): {
  coordinates: { latitude: number; longitude: number }[]; rejected: number;
} {
  const coordinates: { latitude: number; longitude: number }[] = [];
  let rejected = 0;
  for (const pair of text(value).split(';').map(value => value.trim()).filter(Boolean)) {
    const parts = pair.split(',').map(value => value.trim());
    if (parts.length !== 2 || !parts.every(value => /^[+-]?\d+(?:\.\d+)?$/.test(value))) {
      rejected++;
      continue;
    }
    const [latitude, longitude] = parts.map(Number);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      rejected++;
      continue;
    }
    coordinates.push({ latitude, longitude });
  }
  return { coordinates, rejected };
}

export function extractSources(value: unknown): string[] {
  const urls = text(value).match(/https?:\/\/[^\s<>"'`]+/gi) ?? [];
  return [...new Set(urls.flatMap(raw => {
    try {
      const url = new URL(raw.replace(/[),.;]+$/, ''));
      return url.hostname && !url.username && !url.password ? [url.href] : [];
    } catch { return []; }
  }))].sort();
}

function columns(sheet: SheetData) {
  const headings = sheet.rows[0]?.map(header) ?? [];
  const required = (name: string) => {
    const index = headings.indexOf(name);
    if (index === -1) throw new Error(`Не найден обязательный столбец «${name}».`);
    return index;
  };
  const optional = (names: string[], legacyIndex?: number) => {
    const index = headings.findIndex(value => names.includes(value));
    if (index !== -1) return index;
    if (legacyIndex !== undefined) {
      if (headings[legacyIndex]) throw new Error('Изменилась структура безымянных столбцов.');
      return legacyIndex;
    }
    return -1;
  };
  return {
    name: required('название студии'), district: required('район'),
    address: optional(['адрес']),
    type: required('тип партнера'), scale: required('массовость'),
    ownership: required('частный или гос'), specialty: required('специальность'),
    coordinates: optional(['координаты'], sheet.config.legacyColumns?.coordinates),
    sources: optional(['источник', 'источники'], sheet.config.legacyColumns?.sources),
  };
}

export function normalizeSheets(
  sheets: SheetData[], mode: Catalog['mode'] = 'live', generatedAt = new Date().toISOString(),
  repositoryVenues: ReadyVenue[] = [],
): { catalog: Catalog; report: ImportReport } {
  const points = new Map<string, MapPoint>();
  const prepared: ReadyVenue[] = [...repositoryVenues];
  const repositoryIds = new Set(repositoryVenues.map(venue => venue.data.id));
  const revisions: Record<string, string> = {};
  const report: ImportReport = {
    inputRows: 0, skippedRows: 0, rejectedCoordinates: 0,
    mergedPoints: 0, publishedPoints: 0, issues: [],
  };
  for (const sheet of sheets) {
    let c: ReturnType<typeof columns>;
    try { c = columns(sheet); }
    catch (error) {
      report.issues.push({ sheet: sheet.title, row: 1, reason: (error as Error).message });
      throw new ImportError('Структура листа не распознана. Публикация остановлена.', report);
    }
    for (const [index, row] of sheet.rows.entries()) {
      if (!index || row.every(value => !text(value))) continue;
      report.inputRows++;
      const issue = (reason: string) => report.issues.push({ sheet: sheet.title, row: index + 1, reason });
      const headings = sheet.rows[0].map(text);
      const ready = text(row[headings.indexOf(editorHeaders.ready)]);
      if (ready) {
        try {
          const value = JSON.parse(ready);
          if (!repositoryIds.has(value?.data?.id)) prepared.push(readySchema.parse(value));
        }
        catch { issue('Некорректная подготовленная карточка. Откройте её в редакторе и подготовьте заново.'); throw new ImportError('Ошибка подготовленного каталога. Публикация остановлена.', report); }
      }
      if (text(row[headings.indexOf(editorHeaders.isNew)]).toLowerCase() === 'true') continue;
      const name = text(row[c.name]);
      if (!name) { issue('Нет названия.'); report.skippedRows++; continue; }
      const { coordinates, rejected } = parseCoordinates(row[c.coordinates]);
      report.rejectedCoordinates += rejected;
      if (rejected) issue(`Некорректных пар координат: ${rejected}.`);
      if (!coordinates.length) {
        if (!rejected) issue('Нет координат.');
        report.skippedRows++;
        continue;
      }
      const rawScale = text(row[c.scale]);
      const scale = scaleValues.find(value => value === rawScale) ?? NO_DATA;
      const attributes = {
        specialties: categories(row[c.specialty], specialties),
        partnerTypes: categories(row[c.type], partnerTypes),
        scales: [scale],
        ownerships: [ownerships[header(row[c.ownership])] ?? NO_DATA],
        districts: [text(row[c.district]) || NO_DATA],
        sources: extractSources(row[c.sources]),
      };
      for (const { latitude, longitude } of coordinates) {
        // Numeric values equate 55.0 with 55; no coordinate rounding or fuzzy name matching.
        const id = createHash('sha256').update(JSON.stringify([name, latitude, longitude])).digest('hex');
        const existing = points.get(id);
        if (existing) {
          existing.specialties = unique([...existing.specialties, ...attributes.specialties]);
          existing.partnerTypes = unique([...existing.partnerTypes, ...attributes.partnerTypes]);
          existing.scales = unique([...existing.scales, ...attributes.scales]) as MapPoint['scales'];
          existing.ownerships = unique([...existing.ownerships, ...attributes.ownerships]);
          existing.districts = unique([...existing.districts, ...attributes.districts]);
          existing.sources = [...new Set([...existing.sources, ...attributes.sources])].sort();
          report.mergedPoints++;
        } else {
          // Independent arrays: merging one branch must not mutate another branch of the same row.
          points.set(id, structuredClone({ id, name, latitude, longitude, address: text(row[c.address]), ...attributes }));
        }
      }
    }
  }
  const identifiers = new Set<string>();
  const claimedAliases = new Set<string>();
  for (const ready of prepared) {
    const { data, revision, archived } = ready;
    const ids = [data.id, ...data.activities.flatMap(activity => [activity.id, ...activity.groups.map(group => group.id)]), ...data.reviews.map(review => review.id), ...data.trainers.map(trainer => trainer.id)];
    if (ids.some(id => identifiers.has(id))) throw new ImportError('Повторяющиеся ID в подготовленных карточках.', report);
    ids.forEach(id => identifiers.add(id));
    revisions[data.id] = revision;
    const currentAlias = createHash('sha256').update(JSON.stringify([data.name, data.latitude, data.longitude])).digest('hex');
    const aliases = [...new Set([...data.legacyIds, currentAlias])];
    if (aliases.some(id => claimedAliases.has(id))) throw new ImportError('Две карточки ссылаются на один филиал.', report);
    const previous = aliases.map(id => points.get(id)).find(Boolean) ?? points.get(data.id);
    aliases.forEach(id => { claimedAliases.add(id); points.delete(id); });
    points.delete(data.id);
    if (archived) continue;
    const photos = data.photos.map(photo => ({ url: photo.url, alt: photo.alt }));
    points.set(data.id, {
      id: data.id, name: data.name, address: data.address, latitude: data.latitude, longitude: data.longitude,
      specialties: categories(data.specialties.join(', '), specialties), districts: [data.district || NO_DATA],
      partnerTypes: data.partnerTypes.length ? categories(data.partnerTypes.join(', '), partnerTypes) : previous?.partnerTypes ?? [NO_DATA],
      scales: data.scales.length ? data.scales : previous?.scales ?? [NO_DATA],
      ownerships: data.ownerships.length ? categories(data.ownerships.join(', '), ownerships) : previous?.ownerships ?? [NO_DATA],
      sources: data.sources.length ? data.sources : previous?.sources ?? [],
      details: { demo: data.demo, description: data.description, activities: data.activities, reviews: data.reviews, photos, revision,
        trainers: data.trainers, sourceCheckedAt: data.sourceCheckedAt },
    });
  }
  report.publishedPoints = points.size;
  if (!points.size) throw new ImportError('Нет пригодных точек. Предыдущая публикация сохраняется.', report);
  const catalog = catalogSchema.parse({
    mode, generatedAt, revisions, points: [...points.values()].sort((a, b) => a.id.localeCompare(b.id)),
  });
  return { catalog, report };
}

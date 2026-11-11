// Apps Script V8 omits the URL API used by the shared validation contract.
import 'core-js/actual/url/index.js';
import { editorHeaders, readySchema, type VenueInput } from '../shared/marketplace-model';
import { sheetConfigs } from '../config/sheets';
import { demoVenues } from '../scripts/demo-venues';

declare const SpreadsheetApp: any, HtmlService: any, PropertiesService: any, LockService: any, Utilities: any, UrlFetchApp: any;
const publicationUrl = 'https://dpolyakov.github.io/map4child/publication.json';
const headings = Object.values(editorHeaders);
const text = (value: unknown) => value == null ? '' : String(value).trim();
const uuid = () => Utilities.getUuid();
function hash(value: unknown) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(value), Utilities.Charset.UTF_8).map((byte: number) => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
}
function sheetFor(id: number) {
  if (!sheetConfigs.some(config => config.sheetId === id)) throw new Error('Выберите один из пяти региональных листов каталога.');
  const sheet = SpreadsheetApp.getActive().getSheetById(id);
  if (!sheet) throw new Error('Региональный лист не найден.');
  return sheet;
}
function readRow(sheet: any, row: number): { headers: string[]; values: unknown[]; token: string } {
  const width = Math.max(sheet.getLastColumn(), 10);
  const headers = sheet.getRange(1, 1, 1, width).getValues()[0].map(text);
  const values = row > 1 ? sheet.getRange(row, 1, 1, width).getValues()[0] : Array(width).fill('');
  return { headers, values, token: hash(values) };
}
function field(row: ReturnType<typeof readRow>, heading: string) { return text(row.values[row.headers.indexOf(heading)]); }
function initialData(sheet: any, row: ReturnType<typeof readRow>) {
  const columns = row.headers.map((value: string) => value.toLocaleLowerCase('ru'));
  const value = (heading: string) => text(row.values[columns.indexOf(heading)]);
  const name = value('название студии');
  const config = sheetConfigs.find(config => config.sheetId === sheet.getSheetId())!;
  const coordIndex = columns.indexOf('координаты');
  const coordinates = text(row.values[coordIndex >= 0 ? coordIndex : config.legacyColumns?.coordinates ?? -1]);
  const branches = coordinates.split(';').flatMap(pair => {
    const parts = pair.trim().split(',').map(Number);
    return parts.length === 2 && parts.every(Number.isFinite) && Math.abs(parts[0]) <= 90 && Math.abs(parts[1]) <= 180 ? [{ latitude: parts[0], longitude: parts[1], legacyId: hash([name, parts[0], parts[1]]) }] : [];
  });
  const first = branches[0];
  const data = {
    id: field(row, editorHeaders.id) || uuid(), name, address: value('адрес'), latitude: first?.latitude ?? null, longitude: first?.longitude ?? null,
    district: value('район') || sheet.getName(), specialties: value('специальность').split(/[,;\n]/).map(text).filter(Boolean),
    partnerTypes: value('тип партнера').split(/[,;\n]/).map(text).filter(Boolean),
    scales: ['Сеть','Франшиза','Частная'].includes(value('массовость')) ? [value('массовость')] : ['Нет данных'],
    ownerships: [value('частный или гос') || 'Нет данных'], sources: [],
    legacyIds: first ? [first.legacyId] : [], demo: false, description: '', photos: [], activities: [], reviews: [],
  };
  return { data, branches };
}
function publication() {
  try {
    const response = UrlFetchApp.fetch(publicationUrl + '?t=' + Date.now(), { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return null;
    const data = JSON.parse(response.getContentText());
    return data.revisions && typeof data.revisions === 'object' ? data : null;
  } catch { return null; }
}
export function menu() {
  SpreadsheetApp.getUi().createMenu('map4child').addItem('Редактировать площадку', 'editVenue').addItem('Добавить площадку', 'newVenue').addSeparator().addItem('Добавить демонстрационные площадки', 'seedDemo').addToUi();
}
export function openEditor(isNew: boolean) {
  PropertiesService.getUserProperties().setProperty('M4C_NEW_EDITOR', String(isNew));
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('Editor').setWidth(1100).setHeight(780), isNew ? 'Новая площадка · map4child' : 'Редактор площадки · map4child');
}
export function loadEditor() {
  const active = SpreadsheetApp.getActiveSheet(); const sheet = sheetFor(active.getSheetId());
  const isNew = PropertiesService.getUserProperties().getProperty('M4C_NEW_EDITOR') === 'true';
  const rowNumber = isNew ? 0 : sheet.getActiveRange().getRow();
  if (!isNew && rowNumber < 2) throw new Error('Выберите строку площадки под заголовком и откройте редактор снова.');
  return loadRecord(sheet.getSheetId(), rowNumber);
}
export function loadRecord(sheetId: number, rowNumber: number) {
  const sheet = sheetFor(sheetId); const row = readRow(sheet, rowNumber);
  const saved = field(row, editorHeaders.draft) || field(row, editorHeaders.ready);
  const initial = initialData(sheet, row);
  let draft;
  try { draft = saved ? JSON.parse(saved) : { data: initial.data, archived: false }; }
  catch { throw new Error('Сохранённая карточка повреждена. Данные оставлены без изменений.'); }
  const ready = field(row, editorHeaders.ready);
  const published = publication();
  return {
    sheetId, rowNumber, token: row.token, data: draft.data, archived: draft.archived,
    branches: saved ? [] : initial.branches, sheetName: sheet.getName(),
    readyRevision: ready ? JSON.parse(ready).revision : null,
    liveRevision: published?.revisions?.[draft.data.id] ?? null,
    publicationChecked: published !== null,
  };
}
function ensureColumns(sheet: any) {
  let headers = readRow(sheet, 0).headers;
  const missing = headings.filter(heading => !headers.includes(heading));
  if (missing.length) {
    const start = headers.length + 1;
    if (sheet.getMaxColumns() < start + missing.length - 1) sheet.insertColumnsAfter(sheet.getMaxColumns(), start + missing.length - 1 - sheet.getMaxColumns());
    sheet.getRange(1, start, 1, missing.length).setValues([missing]);
    sheet.hideColumns(start, missing.length);
    headers = readRow(sheet, 0).headers;
  }
  return headers;
}
function put(sheet: any, rowNumber: number, headers: string[], heading: string, value: unknown) {
  sheet.getRange(rowNumber, headers.indexOf(heading) + 1).setValue(value);
}
export function validateReady(data: unknown, archived: boolean, revision: string) {
  const parsed = readySchema.safeParse({ schemaVersion: 1, revision, archived, data });
  if (!parsed.success) throw new Error(parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('\n'));
  return parsed.data;
}
export function saveRecord(input: { sheetId: number; rowNumber: number; token: string; data: VenueInput; archived: boolean; prepare: boolean; branches: unknown[] }) {
  const lock = LockService.getDocumentLock(); lock.waitLock(15000);
  let rowNumber = input.rowNumber;
  try {
    const sheet = sheetFor(input.sheetId);
    const current = readRow(sheet, rowNumber);
    if (rowNumber > 1 && current.token !== input.token) throw new Error('КОНФЛИКТ: другой сотрудник изменил строку. Ваши поля сохранены в открытом окне. Загрузите актуальную версию, чтобы продолжить.');
    const previousId = field(current, editorHeaders.id);
    if (previousId && previousId !== input.data.id) throw new Error('ID площадки нельзя менять.');
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(input.data.id)) throw new Error('Некорректный ID площадки.');
    const revision = uuid();
    const envelope = input.prepare ? validateReady(input.data, input.archived, revision) : { schemaVersion: 1, archived: input.archived, data: input.data };
    const json = JSON.stringify(envelope);
    if (json.length > 49000) throw new Error('Карточка превышает 49 000 символов. Сократите описания или количество начальных отзывов.');
    const multiBranch = !previousId && initialData(sheet, current).branches.length > 1;
    const headers = ensureColumns(sheet);
    const isNew = rowNumber < 2 || multiBranch;
    if (isNew) rowNumber = sheet.getLastRow() + 1;
    put(sheet, rowNumber, headers, editorHeaders.id, input.data.id);
    put(sheet, rowNumber, headers, editorHeaders.draft, json);
    put(sheet, rowNumber, headers, editorHeaders.revision, revision);
    if (isNew) {
      put(sheet, rowNumber, headers, editorHeaders.isNew, true);
      const nameIndex = headers.findIndex(value => value.toLowerCase() === 'название студии');
      if (nameIndex >= 0) sheet.getRange(rowNumber, nameIndex + 1).setValue(input.data.name || 'Новая площадка');
    }
    if (input.prepare) {
      put(sheet, rowNumber, headers, editorHeaders.ready, json);
      const visible: Record<string, string> = { 'название студии': input.data.name, 'адрес': input.data.address, 'район': input.data.district,
        'специальность': input.data.specialties.join(', '), 'координаты': `${input.data.latitude}, ${input.data.longitude}` };
      Object.entries(visible).forEach(([heading,value]) => {
        const index = headers.findIndex(header => header.toLowerCase() === heading);
        if (index >= 0) sheet.getRange(rowNumber,index+1).setValue(value);
      });
    }
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  return loadRecord(input.sheetId, rowNumber);
}
export function seedDemonstration() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Демонстрационный каталог', 'Добавить восемь вымышленных площадок в Пресненский лист и подготовить к ручной публикации? Существующие строки не изменятся.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const sheet = sheetFor(0); const lock = LockService.getDocumentLock(); lock.waitLock(15000);
  try {
    const headers = ensureColumns(sheet); const idColumn = headers.indexOf(editorHeaders.id);
    const all = sheet.getDataRange().getValues(); const ids = new Set(all.slice(1).map((row: unknown[]) => text(row[idColumn])));
    for (const data of demoVenues) {
      if (ids.has(data.id)) continue;
      const row = sheet.getLastRow() + 1; const revision = uuid();
      const json = JSON.stringify(validateReady(data, false, revision));
      put(sheet, row, headers, editorHeaders.id, data.id); put(sheet, row, headers, editorHeaders.draft, json);
      put(sheet, row, headers, editorHeaders.ready, json); put(sheet, row, headers, editorHeaders.revision, revision); put(sheet, row, headers, editorHeaders.isNew, true);
      const index = headers.findIndex(value => value.toLowerCase() === 'название студии'); if (index >= 0) sheet.getRange(row,index+1).setValue(data.name + ' · ДЕМО');
    }
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  ui.alert('Демонстрационные площадки подготовлены. Сайт обновится после ручного запуска GitHub Actions.');
}

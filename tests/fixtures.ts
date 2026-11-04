import type { SheetData } from '../scripts/normalize';

export const headings = ['Название студии', 'Район', 'Адрес', 'Тип партнера', 'Массовость', 'Частный или гос', 'Специальность', 'Координаты', 'Источник'];
export function makeSheet(rows: unknown[][], title = 'Тестовый район'): SheetData {
  return { config: { sheetId: 123, label: title }, title, rows: [headings, ...rows] };
}
export function makeRow(overrides: { name?: string; coordinates?: string; specialty?: string; scale?: string; district?: string; sources?: string } = {}): unknown[] {
  return [overrides.name ?? 'Тестовая студия', overrides.district ?? 'Пресненский', 'Синтетический адрес',
    'Нужно ходить регулярно', overrides.scale ?? 'Частная', 'Частная', overrides.specialty ?? 'Спорт',
    overrides.coordinates ?? '55.75, 37.60', overrides.sources ?? 'https://example.com/studio'];
}

// Invented records only. Never substitute this fixture for the actual source table.
export const demoSheet = makeSheet([
  makeRow({ name: 'Демо: студия «Комета»', specialty: 'Творчество/искусство', scale: 'Частная' }),
  makeRow({ name: 'Демо: лаборатория «Почему»', specialty: 'Наука', scale: 'Сеть', coordinates: '55.755, 37.61' }),
  makeRow({ name: 'Демо: лаборатория «Почему»', specialty: 'ИТ/инженеры', scale: 'Сеть', coordinates: '55.755, 37.61', sources: 'https://example.com/science' }),
  makeRow({ name: 'Демо: спортивный клуб «Старт»', coordinates: '55.76, 37.58; 55.735, 37.57', district: 'Хамовники', scale: 'Франшиза' }),
  makeRow({ name: 'Демо: центр «Открытие»', specialty: 'Мульти', coordinates: '55.76, 37.58', scale: '' }),
  makeRow({ name: 'Демо: языковая студия «Диалог»', specialty: 'Иностранные языки', coordinates: '55.745, 37.63', district: 'Хамовники' }),
]);

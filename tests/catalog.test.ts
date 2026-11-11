import { describe, expect, it } from 'vitest';
import { catalogSchema } from '../shared/catalog';
import { ImportError, extractSources, normalizeSheets, parseCoordinates } from '../scripts/normalize';
import { spreadsheetIdFromUrl } from '../scripts/google-sheets';
import { headings, makeRow, makeSheet } from './fixtures';

describe('sheet → public catalog', () => {
  it('expands coordinate pairs and merges by name + numeric coordinates across sheets', () => {
    const first = makeSheet([makeRow({ coordinates: '55.75, 37.60; 55.76, 37.61' })]);
    const second = makeSheet([makeRow({ coordinates: '55.7500, 37.600', specialty: 'Наука', district: 'Хамовники', sources: 'https://example.com/second' })], 'Другой лист');
    const { catalog, report } = normalizeSheets([first, second]);
    expect(catalog.points).toHaveLength(2);
    const merged = catalog.points.find(point => point.latitude === 55.75)!;
    expect(merged.specialties).toEqual(['Наука', 'Спорт']);
    expect(merged.districts).toEqual(['Пресненский', 'Хамовники']);
    expect(merged.sources).toHaveLength(2);
    expect(catalog.points.find(point => point.latitude === 55.76)!.specialties).toEqual(['Спорт']);
    expect(report.mergedPoints).toBe(1);
  });

  it('keeps different names at the same location and does not round nearby coordinates', () => {
    const { catalog } = normalizeSheets([makeSheet([
      makeRow({ name: 'Первый центр' }), makeRow({ name: 'Второй центр' }),
      makeRow({ name: 'Первый центр', coordinates: '55.7500001, 37.60' }),
    ])]);
    expect(catalog.points).toHaveLength(3);
  });

  it('uses stable IDs independent of sheet order and source row position', () => {
    const rows = [makeRow({ name: 'А' }), makeRow({ name: 'Б' })];
    expect(normalizeSheets([makeSheet(rows)]).catalog.points.map(point => point.id))
      .toEqual(normalizeSheets([makeSheet([...rows].reverse())]).catalog.points.map(point => point.id));
  });

  it.each(['', 'сеть', 'частная студия', 'одиночное учреждение', 'Не известно'])('maps invalid mass enum %j to Нет данных', scale => {
    expect(normalizeSheets([makeSheet([makeRow({ scale })])]).catalog.points[0].scales).toEqual(['Нет данных']);
  });

  it.each(['Сеть', 'Франшиза', 'Частная'])('preserves exact mass enum %s', scale => {
    expect(normalizeSheets([makeSheet([makeRow({ scale })])]).catalog.points[0].scales).toEqual([scale]);
  });

  it('normalizes known specialties, keeps Мульти independent, and retains unknown categories', () => {
    const { catalog } = normalizeSheets([makeSheet([
      makeRow({ name: 'А', specialty: 'мульти' }),
      makeRow({ name: 'Б', specialty: 'Творчество/исскуство' }),
      makeRow({ name: 'В', specialty: 'Новая категория' }),
    ])]);
    expect(catalog.points.find(point => point.name === 'А')!.specialties).toEqual(['Мульти']);
    expect(catalog.points.find(point => point.name === 'Б')!.specialties).toEqual(['Творчество и искусство']);
    expect(catalog.points.find(point => point.name === 'В')!.specialties).toEqual(['Новая категория']);
  });

  it('skips malformed pairs and nameless/missing-coordinate rows, retaining valid pairs', () => {
    const { catalog, report } = normalizeSheets([makeSheet([
      makeRow({ coordinates: '91, 37; nonsense; 55.75, 37.60' }),
      makeRow({ name: '' }), makeRow({ coordinates: '' }),
    ])]);
    expect(catalog.points).toHaveLength(1);
    expect(report).toMatchObject({ inputRows: 3, skippedRows: 2, rejectedCoordinates: 2, publishedPoints: 1 });
    expect(report.issues.map(issue => issue.row)).toEqual([2, 3, 4]);
  });

  it('reads the known unnamed source/coordinate columns of ЮЗАО', () => {
    const sheet = makeSheet([]);
    sheet.config.legacyColumns = { coordinates: 9, sources: 8 };
    sheet.rows = [ [...headings.slice(0, 7), 'Кто проверяет'], [...makeRow().slice(0, 7), 'PRIVATE REVIEWER', 'https://example.com/a', '55.75, 37.6'] ];
    const { catalog } = normalizeSheets([sheet]);
    expect(catalog.points[0].longitude).toBe(37.6);
    expect(catalog.points[0].sources).toEqual(['https://example.com/a']);
    expect(JSON.stringify(catalog)).not.toContain('PRIVATE REVIEWER');
    expect(catalog.points[0].address).toBe('Синтетический адрес');
  });

  it('recognizes added coordinate headers and skips a known sheet without them', () => {
    const without = makeSheet([]);
    without.rows = [headings.slice(0, 7), makeRow().slice(0, 7)];
    const moved = makeSheet([]);
    moved.rows = [[...headings.slice(0, 7), 'Кто проверяет', 'Источник', 'Координаты'], [...makeRow().slice(0, 7), '', '', '55.75, 37.6']];
    const { catalog, report } = normalizeSheets([without, moved]);
    expect(catalog.points).toHaveLength(1);
    expect(report.skippedRows).toBe(1);
  });

  it('stops on a changed required header and on an entirely empty result', () => {
    const broken = makeSheet([makeRow()]);
    broken.rows[0] = ['Неизвестная схема'];
    expect(() => normalizeSheets([makeSheet([makeRow()]), broken])).toThrow(ImportError);
    expect(() => normalizeSheets([makeSheet([makeRow({ coordinates: '' })])])).toThrow('Нет пригодных точек');
  });

  it('rejects extra private fields in the final publication schema', () => {
    const { catalog } = normalizeSheets([makeSheet([makeRow()])]);
    expect(() => catalogSchema.parse({ ...catalog, points: [{ ...catalog.points[0], checker: 'private' }] })).toThrow();
  });
});

describe('input parsing', () => {
  it('accepts latitude/longitude limits and rejects partial numbers and NaN', () => {
    expect(parseCoordinates('0, 0; -90, 180; 55junk, 37; NaN, 37').coordinates)
      .toEqual([{ latitude: 0, longitude: 0 }, { latitude: -90, longitude: 180 }]);
    expect(parseCoordinates('0, 0; -90, 180; 55junk, 37; NaN, 37').rejected).toBe(2);
  });
  it('extracts safe unique links from multiple lines without executable protocols', () => {
    expect(extractSources('https://example.com/a\n https://example.com/a\nhttp://example.org/b\njavascript:alert(1) https://user:password@example.org'))
      .toEqual(['http://example.org/b', 'https://example.com/a']);
  });
  it('accepts only the Google Sheets host when extracting the CI document ID', () => {
    expect(spreadsheetIdFromUrl('https://docs.google.com/spreadsheets/d/TEST_ID/edit#gid=0')).toBe('TEST_ID');
    expect(() => spreadsheetIdFromUrl('https://evil.example/spreadsheets/d/TEST_ID')).toThrow();
  });
});

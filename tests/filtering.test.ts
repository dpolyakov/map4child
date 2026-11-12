import { describe, expect, it } from 'vitest';
import { normalizeSheets } from '../scripts/normalize';
import { emptyFilters, facetOptions, filterPoints } from '../src/filtering';
import { mapCoordinates } from '../src/map-geometry';
import { markerBackground, specialtyColor } from '../src/palette';
import { demoSheet } from './fixtures';

const points = normalizeSheets([demoSheet], 'demo').catalog.points;
describe('catalog filtering and map contract', () => {
  it('combines values with OR and groups with AND; empty selection includes all', () => {
    expect(filterPoints(points, emptyFilters(), '')).toHaveLength(points.length);
    const filters = { ...emptyFilters(), specialties: ['Спорт', 'Иностранные языки'], scales: ['Франшиза'] };
    expect(filterPoints(points, filters, '')).toHaveLength(2);
    expect(filterPoints(points, filters, '  СТАРТ ')).toHaveLength(2);
  });
  it('counts expanded points and matches any specialty of a merged point', () => {
    expect(filterPoints(points, { ...emptyFilters(), specialties: ['Наука'] }, '')).toHaveLength(1);
    expect(filterPoints(points, { ...emptyFilters(), specialties: ['Наука', 'ИТ и инженерия'] }, '')).toHaveLength(1);
    expect(facetOptions(points).specialties.find(option => option.value === 'Спорт')?.count).toBe(2);
  });
  it('treats Мульти as one category, with its own single color', () => {
    expect(filterPoints(points, { ...emptyFilters(), specialties: ['Мульти'] }, '')).toHaveLength(1);
    expect(markerBackground(['Мульти'])).toBe(specialtyColor('Мульти'));
    expect(markerBackground(['Спорт', 'Мульти'])).toContain('conic-gradient');
  });
  it('passes longitude first to Yandex without changing the source latitude/longitude model', () => {
    expect(mapCoordinates({ ...points[0], latitude: 55.75, longitude: 37.6 })).toEqual([37.6, 55.75]);
  });
});

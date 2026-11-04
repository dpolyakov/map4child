import type { MapPoint } from '../shared/catalog';

export const facets = [
  { key: 'specialties', label: 'Специальность' },
  { key: 'partnerTypes', label: 'Тип партнёра' },
  { key: 'scales', label: 'Массовость' },
  { key: 'ownerships', label: 'Частный / государственный' },
  { key: 'districts', label: 'Район' },
] as const;
export type Facet = typeof facets[number]['key'];
export type Filters = Record<Facet, string[]>;
export const emptyFilters = (): Filters => ({ specialties: [], partnerTypes: [], scales: [], ownerships: [], districts: [] });

export function filterPoints(points: MapPoint[], filters: Filters, query: string): MapPoint[] {
  const search = query.trim().toLocaleLowerCase('ru');
  return points.filter(point =>
    point.name.toLocaleLowerCase('ru').includes(search) &&
    facets.every(({ key }) => !filters[key].length || filters[key].some(value => (point[key] as readonly string[]).includes(value))),
  );
}

export function facetOptions(points: MapPoint[]): Record<Facet, { value: string; count: number }[]> {
  return Object.fromEntries(facets.map(({ key }) => {
    const counts = new Map<string, number>();
    for (const point of points) for (const value of new Set(point[key])) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [key, [...counts].sort(([a], [b]) => a.localeCompare(b, 'ru')).map(([value, count]) => ({ value, count }))];
  })) as Record<Facet, { value: string; count: number }[]>;
}

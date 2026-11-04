import type { MapPoint } from '../shared/catalog';
import type { Theme } from './theme';

export type MapProvider = 'osm' | 'yandex';
export const providerStorageKey = 'map4child.map-provider';

export function savedMapProvider(): MapProvider {
  try { return localStorage.getItem(providerStorageKey) === 'yandex' ? 'yandex' : 'osm'; }
  catch { return 'osm'; }
}

export interface MapProps {
  points: MapPoint[];
  allPoints: MapPoint[];
  theme: Theme;
  selectedId?: string;
  onSelect: (id: string) => void;
  onGroup: (ids: string[]) => void;
  onError: (error: unknown) => void;
}

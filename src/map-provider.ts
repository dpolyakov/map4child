import type { MapPoint } from '../shared/catalog';
import type { Theme } from './theme';
import type { Origin } from '../shared/marketplace';

export type MapProvider = 'osm' | 'yandex';
export const providerStorageKey = 'map4child.map-provider';

export function savedMapProvider(): MapProvider {
  try { return localStorage.getItem(providerStorageKey) === 'osm' ? 'osm' : 'yandex'; }
  catch { return 'yandex'; }
}

export interface MapProps {
  points: MapPoint[];
  allPoints: MapPoint[];
  theme: Theme;
  selectedId?: string;
  origin?: Origin;
  picking?: boolean;
  onPick?: (latitude: number, longitude: number) => void;
  onSelect: (id: string) => void;
  onGroup: (ids: string[]) => void;
  onError: (error: unknown) => void;
}

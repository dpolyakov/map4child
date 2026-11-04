import type { LngLat, YMapLocationRequest } from '@yandex/ymaps3-types';
import type { MapPoint } from '../shared/catalog';

export const mapCoordinates = (point: MapPoint): LngLat => [point.longitude, point.latitude];
export function initialLocation(points: MapPoint[]): YMapLocationRequest {
  if (points.length === 1 || points.every(point => point.latitude === points[0].latitude && point.longitude === points[0].longitude)) {
    return { center: mapCoordinates(points[0]), zoom: 14 };
  }
  return { bounds: [
    [Math.min(...points.map(point => point.longitude)) - 0.015, Math.min(...points.map(point => point.latitude)) - 0.01],
    [Math.max(...points.map(point => point.longitude)) + 0.015, Math.max(...points.map(point => point.latitude)) + 0.01],
  ] };
}

import type { Origin } from '../shared/marketplace';

export type AddressResult = Origin & { display: string };
export async function findAddress(query: string, signal: AbortSignal): Promise<AddressResult[]> {
  const key = import.meta.env.VITE_YANDEX_GEOCODER_API_KEY || import.meta.env.VITE_YANDEX_MAPS_API_KEY;
  if (!key) throw new Error('Поиск адреса пока не настроен. Выберите точку на карте.');
  const url = new URL('https://geocode-maps.yandex.ru/v1/');
  url.search = new URLSearchParams({ apikey: key, geocode: query, format: 'json', lang: 'ru_RU', results: '5', ll: '37.62,55.75', spn: '1,1' }).toString();
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Поиск адреса недоступен. Выберите точку на карте.');
  const json = await response.json();
  const features = json.response?.GeoObjectCollection?.featureMember;
  if (!Array.isArray(features)) throw new Error('Не удалось распознать ответ поиска. Выберите точку на карте.');
  return features.flatMap((item: { GeoObject?: { Point?: { pos?: string }; name?: string; description?: string } }) => {
    const object = item.GeoObject;
    const [longitude, latitude] = object?.Point?.pos?.split(' ').map(Number) ?? [];
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    // Keep the parent's label; do not persist the geocoder's address database.
    return [{ latitude, longitude, label: query.trim(), source: 'yandex-geocoder' as const, acquiredAt: Date.now(), display: [object?.name, object?.description].filter(Boolean).join(', ') }];
  });
}

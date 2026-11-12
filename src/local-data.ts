import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { Booking, Origin } from '../shared/marketplace';

const bookingSchema = z.object({
  id: z.string(), slotId: z.string(), venueId: z.string(), activityId: z.string(), groupId: z.string(),
  venueName: z.string(), address: z.string(), latitude: z.number(), longitude: z.number(),
  activityName: z.string(), groupName: z.string(), startsAt: z.number(), endsAt: z.number(), price: z.number().nonnegative(),
  parentName: z.string(), phone: z.string(), childAge: z.number().min(1).max(17), createdAt: z.number(),
  status: z.enum(['confirmed', 'cancelled', 'attended']), demoFixture: z.boolean(),
});
const originSchema = z.object({ latitude: z.number(), longitude: z.number(), label: z.string(), source: z.enum(['yandex-geocoder', 'yandex-click', 'osm-click']), acquiredAt: z.number() });
const reviewSchema = z.object({ bookingId: z.string(), rating: z.number().int().min(1).max(5), text: z.string(), updatedAt: z.number() });
const stateSchema = z.object({
  version: z.literal(1), bookings: z.array(bookingSchema), reviews: z.array(reviewSchema),
  parent: z.object({ name: z.string(), phone: z.string(), age: z.string() }),
  saved: z.object({ home: originSchema.optional(), school: originSchema.optional() }),
  savedLabels: z.object({ home: z.string().optional(), school: z.string().optional() }).default({}),
});
export type LocalData = z.infer<typeof stateSchema>;
export type LocalReview = LocalData['reviews'][number];
export const storageKey = 'map4child.marketplace.v1';
export const emptyData = (): LocalData => ({ version: 1, bookings: [], reviews: [], parent: { name: '', phone: '', age: '' }, saved: {}, savedLabels: {} });
export function parseLocalData(raw: string | null): LocalData {
  if (!raw) return emptyData();
  const data = stateSchema.parse(JSON.parse(raw));
  if (new Set(data.bookings.map(value => value.id)).size !== data.bookings.length ||
      new Set(data.reviews.map(value => value.bookingId)).size !== data.reviews.length ||
      data.reviews.some(review => !data.bookings.some(booking => booking.id === review.bookingId && booking.status === 'attended'))) throw new Error('Invalid local history');
  for (const key of ['home', 'school'] as const) {
    const origin = data.saved[key];
    if (origin) data.savedLabels[key] = origin.label;
    if (origin?.source === 'yandex-geocoder' && Date.now() - origin.acquiredAt >= 30 * 86400000) delete data.saved[key];
  }
  return data;
}
export function readLocalData() {
  try {
    const raw = localStorage.getItem(storageKey);
    const data = parseLocalData(raw);
    // Remove expired geocoder coordinates from disk as well as from the current view.
    if (raw && JSON.stringify(data) !== raw) localStorage.setItem(storageKey, JSON.stringify(data));
    return { data, error: '' };
  }
  catch { return { data: emptyData(), error: 'Не удалось прочитать сохранённые данные. Они не перезаписаны. Разрешите хранение данных браузеру или восстановите резервную копию.' }; }
}
export function saveReview(data: LocalData, bookingId: string, rating: number, text: string, now: number): LocalData {
  if (!data.bookings.some(booking => booking.id === bookingId && booking.status === 'attended' && booking.endsAt <= now)) throw new Error('Сначала подтвердите посещение.');
  const review = reviewSchema.parse({ bookingId, rating, text: text.trim(), updatedAt: now });
  return { ...data, reviews: [...data.reviews.filter(value => value.bookingId !== bookingId), review] };
}
export async function updateLocalData(change: (data: LocalData) => LocalData) {
  const apply = () => {
    const current = readLocalData();
    if (current.error) throw new Error(current.error);
    const data = stateSchema.parse(change(current.data));
    try { localStorage.setItem(storageKey, JSON.stringify(data)); }
    catch { throw new Error('Браузер не сохранил данные. Освободите место или разрешите LocalStorage. Запись не создана.'); }
    window.dispatchEvent(new Event('map4child:storage'));
  };
  if (navigator.locks) await navigator.locks.request(storageKey, apply);
  else apply();
}
export function useLocalData() {
  const [state, setState] = useState(readLocalData);
  useEffect(() => {
    const refresh = () => setState(readLocalData());
    window.addEventListener('storage', refresh);
    window.addEventListener('map4child:storage', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('map4child:storage', refresh); };
  }, []);
  return state;
}
export function ratingFor(venueId: string, seeded: { rating: number }[], data: LocalData) {
  const local = data.reviews.filter(review => data.bookings.find(booking => booking.id === review.bookingId)?.venueId === venueId);
  const all = [...seeded, ...local];
  return { rating: all.length ? (all.reduce((sum, review) => sum + review.rating, 0) / all.length).toFixed(1) : null, count: all.length };
}
export function routeUrl(point: Pick<Booking, 'latitude' | 'longitude'> | Origin) {
  return `https://yandex.ru/maps/?rtext=~${point.latitude},${point.longitude}&rtt=mt`;
}

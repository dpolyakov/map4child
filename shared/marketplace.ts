import type { MapPoint } from './catalog';
import type { Activity, Group } from './marketplace-model';

export const DAY = 86_400_000;
const MOSCOW_OFFSET = 3 * 60 * 60 * 1000;
export const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export type Origin = { latitude: number; longitude: number; label: string; source: 'yandex-geocoder' | 'yandex-click' | 'osm-click'; acquiredAt: number };
export type Booking = {
  id: string; slotId: string; venueId: string; activityId: string; groupId: string;
  venueName: string; address: string; latitude: number; longitude: number;
  activityName: string; groupName: string; startsAt: number; endsAt: number; price: number;
  parentName: string; phone: string; childAge: number; createdAt: number;
  status: 'confirmed' | 'cancelled' | 'attended'; demoFixture: boolean;
};
export type Session = {
  id: string; venueId: string; activity: Activity; group: Group;
  date: string; weekday: number; startMinutes: number; endMinutes: number;
  startsAt: number; endsAt: number; remaining: number;
};
export type SearchFilters = {
  age: string; days: number[]; start: string; end: string;
  minPrice: string; maxPrice: string; bookableOnly: boolean; radiusKm: number | null;
};
export const initialSearch = (): SearchFilters => ({
  age: '', days: [], start: '', end: '', minPrice: '', maxPrice: '',
  bookableOnly: false, radiusKm: 3,
});
export const minutes = (time: string) => time.split(':').reduce((hour, minute) => hour * 60 + Number(minute), 0);
export const moscowDate = (timestamp: number) => new Date(timestamp + MOSCOW_OFFSET).toISOString().slice(0, 10);
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = Math.PI / 180;
  const lat = (b.latitude - a.latitude) * rad;
  const lon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(lon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function sessionsFor(point: MapPoint, bookings: Booking[] = [], now = Date.now(), horizon = 28): Session[] {
  const dayStart = Date.parse(moscowDate(now) + 'T00:00:00+03:00');
  const sessions = new Map<string, Session>();
  for (const activity of point.details?.activities ?? []) {
    if (!activity.active) continue;
    for (const group of activity.groups) {
      if (!group.active || group.trialPrice === null) continue;
      for (let day = 0; day < horizon; day++) {
        const timestamp = dayStart + day * DAY;
        const date = moscowDate(timestamp);
        const weekday = (new Date(timestamp + MOSCOW_OFFSET).getUTCDay() + 6) % 7 + 1;
        for (const schedule of group.schedule) {
          if (!schedule.days.includes(weekday)) continue;
          const startMinutes = minutes(schedule.start);
          const startsAt = timestamp + startMinutes * 60_000;
          if (startsAt <= now) continue;
          const id = [point.id, activity.id, group.id, date, schedule.start].join('/');
          const taken = bookings.filter(booking => booking.slotId === id && booking.status !== 'cancelled').length;
          sessions.set(id, {
            id, venueId: point.id, activity, group, date, weekday, startsAt,
            endsAt: startsAt + schedule.durationMinutes * 60_000,
            startMinutes, endMinutes: startMinutes + schedule.durationMinutes,
            remaining: Math.max(0, group.trialCapacity - taken),
          });
        }
      }
    }
  }
  return [...sessions.values()].sort((a, b) => a.startsAt - b.startsAt || a.id.localeCompare(b.id));
}
export function sessionMatches(session: Session, filters: SearchFilters) {
  const { group } = session;
  return session.remaining > 0 &&
    (!filters.age || (Number(filters.age) >= group.minAge && Number(filters.age) <= group.maxAge)) &&
    (!filters.days.length || filters.days.includes(session.weekday)) &&
    (!filters.start || session.startMinutes >= minutes(filters.start)) &&
    (!filters.end || session.endMinutes <= minutes(filters.end)) &&
    (filters.minPrice === '' || (group.trialPrice !== null && group.trialPrice >= Number(filters.minPrice))) &&
    (filters.maxPrice === '' || (group.trialPrice !== null && group.trialPrice <= Number(filters.maxPrice)));
}
export function matchingSessions(point: MapPoint, filters: SearchFilters, bookings: Booking[], now: number) {
  return sessionsFor(point, bookings, now).filter(session => sessionMatches(session, filters));
}
export function searchPoints(points: MapPoint[], filters: SearchFilters, query: string, bookings: Booking[], now: number, origin?: Origin) {
  const search = query.trim().toLocaleLowerCase('ru');
  const needsGroup = filters.bookableOnly || !!filters.age ||
    filters.days.length > 0 || !!filters.start || !!filters.end || filters.minPrice !== '' || filters.maxPrice !== '';
  return points.filter(point => {
    const searchable = [point.name, point.address ?? '', ...point.specialties,
      ...(point.details?.activities ?? []).flatMap(activity => [activity.name, activity.direction])].join(' ').toLocaleLowerCase('ru');
    if (search && !searchable.includes(search)) return false;
    if (origin && filters.radiusKm !== null && distanceKm(origin, point) > filters.radiusKm) return false;
    return !needsGroup || matchingSessions(point, filters, bookings, now).length > 0;
  }).sort((a, b) => origin ? distanceKm(origin, a) - distanceKm(origin, b) : a.name.localeCompare(b.name, 'ru'));
}
export function createBooking(point: MapPoint, slotId: string, parent: { name: string; phone: string; age: number }, bookings: Booking[], now: number, id: string): Booking {
  const session = sessionsFor(point, bookings, now).find(value => value.id === slotId);
  if (!session || !session.remaining) throw new Error('Это время уже недоступно. Выберите другое занятие.');
  if (bookings.some(value => value.slotId === slotId && value.status !== 'cancelled')) throw new Error('У вас уже есть запись на это занятие.');
  if (!parent.name.trim()) throw new Error('Укажите имя родителя.');
  const phone = parent.phone.replace(/\D/g, '');
  if (phone.length < 7 || phone.length > 15) throw new Error('Проверьте номер телефона.');
  if (!Number.isInteger(parent.age) || parent.age < session.group.minAge || parent.age > session.group.maxAge) throw new Error('Возраст ребёнка не подходит этой группе.');
  return {
    id, slotId, venueId: point.id, activityId: session.activity.id, groupId: session.group.id,
    venueName: point.name, address: point.address ?? '', latitude: point.latitude, longitude: point.longitude,
    activityName: session.activity.name, groupName: session.group.name,
    startsAt: session.startsAt, endsAt: session.endsAt, price: session.group.trialPrice!,
    parentName: parent.name.trim(), phone: parent.phone.trim(), childAge: parent.age,
    createdAt: now, status: 'confirmed', demoFixture: false,
  };
}
export function cancelBooking(booking: Booking, now: number): Booking {
  if (booking.status !== 'confirmed' || booking.startsAt <= now) throw new Error('Отмена доступна до начала занятия.');
  return { ...booking, status: 'cancelled' };
}
export function confirmAttendance(booking: Booking, now: number): Booking {
  if (booking.status !== 'confirmed' || booking.endsAt > now) throw new Error('Можно подтвердить только завершившееся посещение.');
  return { ...booking, status: 'attended' };
}
export function createPastExample(point: MapPoint, bookings: Booking[], now: number, id: string): Booking {
  const session = sessionsFor(point, bookings, now - 14 * DAY, 14).filter(value =>
    value.endsAt < now && value.remaining > 0 && !bookings.some(booking => booking.slotId === value.id && booking.status !== 'cancelled')).at(-1);
  if (!session) throw new Error('Для этой площадки нет подходящего примера прошедшего занятия.');
  return {
    ...createBooking(point, session.id, { name: 'Демо-родитель', phone: '+7 000 000-00-00', age: session.group.minAge },
      bookings, session.startsAt - 60_000, id),
    demoFixture: true, createdAt: now,
  };
}

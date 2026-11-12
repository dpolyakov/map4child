import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { copyRepositoryPhotos, loadRepositoryVenues } from '../scripts/repository-venues';
import { normalizeSheets } from '../scripts/normalize';
import { editorHeaders, venueInputSchema } from '../shared/marketplace-model';
import { cancelBooking, createBooking, sessionsFor } from '../shared/marketplace';
import { emptyData, parseLocalData } from '../src/local-data';
import { headings, makeRow, makeSheet } from './fixtures';

const venues = await loadRepositoryVenues();
const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

describe('repository venue catalog', () => {
  it('keeps eight fictional identities and two separate sourced teams', () => {
    expect(venues).toHaveLength(10);
    expect(venues.filter(venue => venue.data.demo).map(venue => venue.data.id)).toEqual(Array.from({ length: 8 }, (_, i) => `demo-${i + 1}`));
    const gym = venues.find(venue => venue.data.id === 'gymkids-profsoyuznaya')!.data;
    const parkour = venues.find(venue => venue.data.id === 'fly-zone-profsoyuznaya')!.data;
    expect(gym.activities).toHaveLength(5); expect(gym.trainers).toHaveLength(10);
    expect(parkour.activities).toHaveLength(4); expect(parkour.trainers).toHaveLength(5);
    for (const venue of [gym, parkour]) {
      expect(venue.reviews).toEqual([]);
      for (const activity of venue.activities) {
        expect(activity.teacher.name).toBe('');
        expect(activity.trainerIds).toEqual(venue.trainers.map(trainer => trainer.id));
        expect(activity.groups.every(group => group.trialPrice === 0 && !group.subscriptions.length)).toBe(true);
      }
    }
  });

  it('replaces only the two matching branches and gives repository copies priority over Sheets', () => {
    const gym = venues.find(venue => venue.data.id === 'gymkids-profsoyuznaya')!.data;
    const parkour = venues.find(venue => venue.data.id === 'fly-zone-profsoyuznaya')!.data;
    const sheet = makeSheet([
      makeRow({ name: gym.name, coordinates: `${gym.latitude},${gym.longitude}` }),
      makeRow({ name: parkour.name, coordinates: `${parkour.latitude},${parkour.longitude}` }),
      makeRow({ name: gym.name, coordinates: '55.75,37.6' }),
    ]);
    sheet.rows[0].push(editorHeaders.ready, editorHeaders.isNew);
    const old = structuredClone(venues[0]); old.data.description = 'Старая копия Sheets';
    sheet.rows.push([...Array(headings.length).fill(''), JSON.stringify(old), 'true']);
    const catalog = normalizeSheets([sheet], 'live', new Date().toISOString(), venues).catalog;
    expect(catalog.points).toHaveLength(11);
    expect(catalog.points.filter(point => point.latitude === gym.latitude)).toHaveLength(2);
    expect(catalog.points.find(point => point.latitude === 55.75)?.details).toBeUndefined();
    expect(catalog.points.find(point => point.id === 'demo-1')?.details?.description).toBe(venues[0].data.description);
  });

  it('rejects broken team references and unsafe local image paths', () => {
    const data = structuredClone(venues.find(venue => venue.data.id === 'gymkids-profsoyuznaya')!.data);
    data.activities[0].trainerIds = ['missing'];
    expect(venueInputSchema.safeParse(data).success).toBe(false);
    data.activities[0].trainerIds = [data.trainers[0].id];
    data.photos[0].url = 'venue-media/../../secret.jpg';
    expect(venueInputSchema.safeParse(data).success).toBe(false);
  });

  it('copies every referenced photo locally and fails on a missing photo', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'map4child-media-')); directories.push(directory);
    await copyRepositoryPhotos(venues, directory);
    const photos = venues.flatMap(({ data }) => [...data.photos, ...data.trainers.map(trainer => trainer.photo)]);
    expect(photos).toHaveLength(31);
    for (const photo of photos) expect((await readFile(join(directory, photo.url))).length).toBeGreaterThan(100);
    const missing = structuredClone(venues[0]); missing.data.photos[0].url = 'venue-media/demo-1/missing.jpg';
    await expect(copyRepositoryPhotos([missing], directory)).rejects.toThrow();
  });

  it('books, persists and cancels a trial from age 1.5 without changing its identity', () => {
    const point = normalizeSheets([makeSheet([])], 'demo', new Date().toISOString(), venues).catalog.points.find(point => point.id === 'gymkids-profsoyuznaya')!;
    const now = Date.parse('2026-11-12T12:00:00+03:00');
    const slot = sessionsFor(point, [], now).find(slot => slot.group.minAge === 1.5)!;
    const booking = createBooking(point, slot.id, { name: 'Демо', phone: '+7 000 000-00-00', age: 1.5 }, [], now, 'fractional-age');
    const saved = parseLocalData(JSON.stringify({ ...emptyData(), bookings: [booking] })).bookings[0];
    expect(saved.childAge).toBe(1.5); expect(saved.price).toBe(0);
    expect(sessionsFor(point, [saved], now).find(value => value.id === slot.id)?.remaining).toBe(slot.remaining - 1);
    const cancelled = cancelBooking(saved, now);
    expect(sessionsFor(point, [cancelled], now).find(value => value.id === slot.id)?.remaining).toBe(slot.remaining);
  });
});

import { z } from 'zod';

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const money = z.number().finite().min(0);
export const httpUrl = z.string().url().refine(value => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}, 'Нужна ссылка http(s) без логина и пароля');
export const imageSourceSchema = z.object({ kind: z.literal('url'), url: httpUrl, alt: z.string().default('') }).strict();
export const photoSchema = z.object({
  url: httpUrl,
  alt: z.string(),
}).strict();
export const scheduleSchema = z.object({
  days: z.array(z.number().int().min(1).max(7)).min(1),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().min(1).max(720),
}).strict().refine(value => {
  const [hour, minute] = value.start.split(':').map(Number);
  return hour * 60 + minute + value.durationMinutes <= 1440;
}, 'Занятие должно закончиться в тот же день');
export const groupSchema = z.object({
  id, name: z.string().min(1), minAge: z.number().int().min(1).max(17),
  maxAge: z.number().int().min(1).max(17), active: z.boolean(),
  schedule: z.array(scheduleSchema),
  trialPrice: money.nullable(), trialCapacity: z.number().int().min(0).max(1000),
  subscriptions: z.array(z.object({
    name: z.string().min(1), lessons: z.number().int().positive(),
    validDays: z.number().int().positive(), price: money,
  }).strict()),
}).strict().superRefine((group, context) => {
  if (group.minAge > group.maxAge) context.addIssue({ code: 'custom', path: ['maxAge'], message: 'Возраст «до» меньше возраста «от»' });
  if (group.active && !group.schedule.length) context.addIssue({ code: 'custom', path: ['schedule'], message: 'Укажите расписание' });
  if (group.active && group.trialPrice === null) context.addIssue({ code: 'custom', path: ['trialPrice'], message: 'Укажите цену пробного, включая 0 ₽' });
  const starts = group.schedule.flatMap(rule => rule.days.map(day => `${day}/${rule.start}`));
  if (new Set(starts).size !== starts.length) context.addIssue({ code: 'custom', path: ['schedule'], message: 'Одно время в один день недели указано несколько раз' });
});
export const activitySchema = z.object({
  id, name: z.string().min(1), direction: z.string().min(1), active: z.boolean(),
  description: z.string(), format: z.string(),
  teacher: z.object({ name: z.string(), bio: z.string() }).strict(),
  groups: z.array(groupSchema),
}).strict().superRefine((activity, context) => {
  if (!activity.active) return;
  for (const [path, value] of [
    [['description'], activity.description], [['format'], activity.format],
    [['teacher', 'name'], activity.teacher.name], [['teacher', 'bio'], activity.teacher.bio],
  ] as const) {
    if (!value.trim()) context.addIssue({ code: 'custom', path: [...path], message: 'Заполните описание активного занятия и преподавателя' });
  }
});
export const catalogReviewSchema = z.object({
  id, author: z.string().min(1), rating: z.number().int().min(1).max(5),
  text: z.string(), activityName: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();
const detailFields = {
  demo: z.boolean(), description: z.string(), activities: z.array(activitySchema),
  reviews: z.array(catalogReviewSchema),
};
export const venueInputSchema = z.object({
  id, name: z.string().min(1), address: z.string().min(1),
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  district: z.string(), specialties: z.array(z.string().min(1)).min(1),
  partnerTypes: z.array(z.string().min(1)).default([]),
  scales: z.array(z.enum(['Сеть', 'Франшиза', 'Частная', 'Нет данных'])).default([]),
  ownerships: z.array(z.string().min(1)).default([]), sources: z.array(httpUrl).default([]),
  legacyIds: z.array(id), ...detailFields, photos: z.array(imageSourceSchema),
}).strict().superRefine((venue, context) => {
  const identifiers = [venue.id, ...venue.activities.flatMap(activity => [activity.id, ...activity.groups.map(group => group.id)]), ...venue.reviews.map(review => review.id)];
  if (new Set(identifiers).size !== identifiers.length) context.addIssue({ code: 'custom', message: 'ID объектов должны быть уникальны' });
  const canBook = venue.activities.some(activity => activity.active && activity.groups.some(group => group.active));
  if (canBook && (!venue.description.trim() || !venue.photos.length)) context.addIssue({ code: 'custom', message: 'Для карточки с записью нужны описание площадки и фотография' });
});
export const readySchema = z.object({
  schemaVersion: z.literal(1), revision: id, archived: z.boolean(), data: venueInputSchema,
}).strict();
export const venueDetailsSchema = z.object({
  ...detailFields, photos: z.array(photoSchema), revision: id,
}).strict();

export const editorHeaders = {
  id: 'M4C_ID', draft: 'M4C_DRAFT', ready: 'M4C_READY', revision: 'M4C_REVISION', isNew: 'M4C_NEW',
} as const;
export type VenueInput = z.infer<typeof venueInputSchema>;
export type ReadyVenue = z.infer<typeof readySchema>;
export type Activity = z.infer<typeof activitySchema>;
export type Group = z.infer<typeof groupSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type CatalogReview = z.infer<typeof catalogReviewSchema>;

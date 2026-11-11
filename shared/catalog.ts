import { z } from 'zod';
import { venueDetailsSchema } from './marketplace-model';

export const NO_DATA = 'Нет данных';
export const scaleValues = ['Сеть', 'Франшиза', 'Частная', NO_DATA] as const;

export const pointSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  specialties: z.array(z.string().min(1)).min(1),
  partnerTypes: z.array(z.string().min(1)).min(1),
  scales: z.array(z.enum(scaleValues)).min(1),
  ownerships: z.array(z.string().min(1)).min(1),
  districts: z.array(z.string().min(1)).min(1),
  sources: z.array(z.string().url().refine(value => /^https?:\/\//.test(value))),
  address: z.string().optional(),
  details: venueDetailsSchema.optional(),
}).strict();

export const catalogSchema = z.object({
  mode: z.enum(['live', 'demo']),
  generatedAt: z.string().datetime(),
  revisions: z.record(z.string(), z.string()).optional(),
  points: z.array(pointSchema).min(1),
}).strict();

export type MapPoint = z.infer<typeof pointSchema>;
export type Catalog = z.infer<typeof catalogSchema>;

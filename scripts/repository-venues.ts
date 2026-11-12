import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, realpath } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localImagePath, readySchema, venueInputSchema, type ReadyVenue } from '../shared/marketplace-model';

const contentRoot = fileURLToPath(new URL('../content/', import.meta.url));

export async function loadRepositoryVenues(): Promise<ReadyVenue[]> {
  const files = (await readdir(resolve(contentRoot, 'venues'))).filter(file => file.endsWith('.json')).sort();
  return Promise.all(files.map(async file => {
    const data = venueInputSchema.parse(JSON.parse(await readFile(resolve(contentRoot, 'venues', file), 'utf8')));
    if (file !== `${data.id}.json`) throw new Error(`Имя файла ${file} должно совпадать с ID ${data.id}.`);
    const revision = 'repo-' + createHash('sha256').update(JSON.stringify(data)).digest('hex');
    return readySchema.parse({ schemaVersion: 1, revision, archived: false, data });
  }));
}

export async function copyRepositoryPhotos(venues: ReadyVenue[], destination = '.generated/public'): Promise<void> {
  const root = await realpath(contentRoot);
  const paths = new Set(venues.flatMap(({ data }) => [
    ...data.photos.map(photo => photo.url), ...data.trainers.map(trainer => trainer.photo.url),
  ]));
  for (const path of paths) {
    if (!localImagePath.safeParse(path).success) throw new Error(`Фотография карточки должна храниться в content: ${path}`);
    const source = await realpath(resolve(root, path));
    if (!source.startsWith(root + sep)) throw new Error(`Изображение вне content: ${path}`);
    const target = resolve(destination, path);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }
}

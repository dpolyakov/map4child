import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { editorHeaders, readySchema } from '../shared/marketplace-model';
import type { SheetData } from './normalize';
import { googleAuth } from './google-sheets';

export async function preparePhotos(sheets: SheetData[]): Promise<Record<string, string>> {
  const ids = new Set<string>();
  for (const sheet of sheets) {
    const column = sheet.rows[0]?.indexOf(editorHeaders.ready) ?? -1;
    for (const row of sheet.rows.slice(1)) {
      if (!row[column]) continue;
      const ready = readySchema.parse(JSON.parse(String(row[column])));
      if (!ready.archived) ready.data.photos.forEach(photo => { if (photo.kind === 'drive') ids.add(photo.fileId); });
    }
  }
  const urls: Record<string, string> = {};
  if (!ids.size) return urls;
  const client = await googleAuth(['https://www.googleapis.com/auth/drive.readonly']).getClient();
  await mkdir('.generated/public/media', { recursive: true });
  for (const fileId of ids) {
    try {
      const response = await client.request<ArrayBuffer>({
        url: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, responseType: 'arraybuffer',
      });
      const data = Buffer.from(response.data);
      const mime = response.headers.get('content-type')?.split(';')[0];
      const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[mime ?? ''];
      if (!extension || !data.length || data.length > 10 * 1024 * 1024) throw new Error('INVALID_IMAGE');
      const path = `media/${createHash('sha256').update(data).digest('hex')}.${extension}`;
      await writeFile(`.generated/public/${path}`, data);
      urls[fileId] = path;
    } catch { throw new Error('Не удалось прочитать опубликованное фото Drive. Проверьте права сервисного аккаунта, формат и размер до 10 МБ.'); }
  }
  return urls;
}

import { auth, sheets } from '@googleapis/sheets';
import { sheetConfigs } from '../config/sheets';
import type { SheetData } from './normalize';

export function spreadsheetIdFromUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error('GOOGLE_SHEET_URL должен содержать URL Google Sheets.'); }
  const id = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1];
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || !id) {
    throw new Error('GOOGLE_SHEET_URL должен содержать URL Google Sheets.');
  }
  return id;
}

export async function fetchSheets(): Promise<SheetData[]> {
  const spreadsheetId = spreadsheetIdFromUrl(process.env.GOOGLE_SHEET_URL ?? '');
  let credentials: object | undefined;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try { credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON); }
    catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON содержит некорректный JSON.'); }
  }
  const googleAuth = new auth.GoogleAuth({
    credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = sheets({ version: 'v4', auth: googleAuth });
  try {
    const metadata = await client.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(sheetId,title))' });
    const selected = sheetConfigs.map(config => {
      const title = metadata.data.sheets?.find(sheet => sheet.properties?.sheetId === config.sheetId)?.properties?.title;
      if (!title) throw new Error('MISSING_SHEET');
      return { config, title };
    });
    const response = await client.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: selected.map(({ title }) => `'${title.replace(/'/g, "''")}'!A:AZ`),
      valueRenderOption: 'FORMATTED_VALUE',
    });
    if (response.data.valueRanges?.length !== selected.length) throw new Error('INCOMPLETE_RESPONSE');
    return selected.map((sheet, index) => ({ ...sheet, rows: response.data.valueRanges![index].values ?? [] }));
  } catch (error) {
    // Google errors may contain request URLs or credential configuration. Do not log the raw error.
    if (error instanceof Error && error.message === 'MISSING_SHEET') {
      throw new Error('В таблице отсутствует один из согласованных листов. Проверьте config/sheets.ts.');
    }
    throw new Error('Не удалось полностью прочитать Google Sheets. Проверьте доступ сервисного аккаунта и настройки API.');
  }
}

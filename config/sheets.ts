export interface SheetConfig {
  sheetId: number;
  label: string;
  // These two source columns currently have no headers. Named headers win.
  legacyColumns?: { coordinates: number; sources: number };
}

// Stable tab IDs keep the allowlist intact when a tab is renamed.
// The spreadsheet URL itself is supplied by GOOGLE_SHEET_URL in CI.
export const sheetConfigs: SheetConfig[] = [
  { sheetId: 0, label: 'Пресненский' },
  { sheetId: 257254986, label: 'Хамовники' },
  { sheetId: 1824584401, label: 'Хорошево-Мневники' },
  { sheetId: 1622611904, label: 'ЮЗАО', legacyColumns: { coordinates: 9, sources: 8 } },
  { sheetId: 1989348901, label: 'Коммунарка' },
];

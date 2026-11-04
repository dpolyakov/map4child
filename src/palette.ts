const colors: Record<string, string> = {
  'Спорт': '#a6d86e', 'ИТ и инженерия': '#72a9ff', 'Творчество и искусство': '#edab81',
  'Наука': '#c1a0f4', 'Иностранные языки': '#f0cd6b', 'Мульти': '#74ceca',
};
export const specialtyColor = (value: string) => colors[value] ?? '#a6b0bf';
export function markerBackground(specialties: string[]): string {
  const unique = [...new Set(specialties)];
  if (unique.length < 2) return specialtyColor(unique[0]);
  return `conic-gradient(${unique.map((value, i) => `${specialtyColor(value)} ${i / unique.length * 100}% ${(i + 1) / unique.length * 100}%`).join(',')})`;
}

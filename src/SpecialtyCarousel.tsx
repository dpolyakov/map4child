import { useRef } from 'react';
import { Button } from '@gravity-ui/uikit';
const icons: Record<string, string> = { 'Спорт': '⚽', 'ИТ и инженерия': '🤖', 'Творчество и искусство': '🎨', 'Наука': '🔬', 'Иностранные языки': '🌍', 'Мульти': '🧩' };
export function SpecialtyCarousel({ values, selected, onToggle, onClear }: { values: string[]; selected: string[]; onToggle: (value: string) => void; onClear: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const ordered = [...Object.keys(icons).filter(value => values.includes(value)), ...values.filter(value => !(value in icons))];
  return <div className="specialty-carousel">
    <Button className="carousel-arrow previous" view="raised" size="s" aria-label="Предыдущие специальности" onClick={() => ref.current?.scrollBy({ left: -176, behavior: 'smooth' })}>‹</Button>
    <div className="specialty-items" ref={ref} aria-label="Специальности">
      <button className="specialty-item" aria-pressed={!selected.length} onClick={onClear}><span className="specialty-icon" aria-hidden="true">✳</span><span>Все</span></button>
      {ordered.map(value => <button key={value} className="specialty-item" aria-pressed={selected.includes(value)} onClick={() => onToggle(value)}><span className="specialty-icon" aria-hidden="true">{icons[value] ?? '✨'}</span><span>{value}</span></button>)}
    </div>
    <Button className="carousel-arrow next" view="raised" size="s" aria-label="Следующие специальности" onClick={() => ref.current?.scrollBy({ left: 176, behavior: 'smooth' })}>›</Button>
  </div>;
}

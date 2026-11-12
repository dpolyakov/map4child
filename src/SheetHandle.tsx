import { useRef, type PointerEvent } from 'react';
import { Button } from '@gravity-ui/uikit';
export type SheetState = 'compact' | 'half' | 'expanded';
const states: SheetState[] = ['compact', 'half', 'expanded'];
export function SheetHandle({ state, title, onChange }: { state: SheetState; title: string; onChange: (state: SheetState) => void }) {
  const drag = useRef<{ y: number; delta: number }>();
  const moved = useRef(false);
  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const { delta } = drag.current;
    event.currentTarget.releasePointerCapture(event.pointerId);
    event.currentTarget.closest<HTMLElement>('.sheet-panel')?.style.removeProperty('--sheet-shift');
    if (Math.abs(delta) > 35) { onChange(states[Math.max(0, Math.min(2, states.indexOf(state) + (delta > 0 ? -1 : 1)))]); moved.current = true; }
    drag.current = undefined;
  };
  return <div className="sheet-handle">
    <button className="sheet-grip" aria-label="Изменить высоту панели" onClick={() => { if (!moved.current) onChange(states[(states.indexOf(state) + 1) % states.length]); moved.current = false; }}
      onPointerDown={event => { drag.current = { y: event.clientY, delta: 0 }; moved.current = false; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (drag.current) { drag.current.delta = event.clientY - drag.current.y; event.currentTarget.closest<HTMLElement>('.sheet-panel')?.style.setProperty('--sheet-shift', `${Math.max(-120, Math.min(160, drag.current.delta))}px`); } }}
      onPointerUp={finish} onPointerCancel={finish}><span /></button>
    <div className="sheet-heading"><strong>{title}</strong><Button size="s" view="flat" onClick={() => onChange(state === 'expanded' ? 'compact' : 'expanded')}>{state === 'expanded' ? 'Показать карту ↓' : 'Развернуть ↑'}</Button></div>
  </div>;
}

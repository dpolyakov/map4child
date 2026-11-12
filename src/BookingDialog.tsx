import { useEffect, useRef, useState } from 'react';
import { Button, TextInput } from '@gravity-ui/uikit';
import type { MapPoint } from '../shared/catalog';
import { createBooking, sessionsFor, moscowDate, DAY, type Session } from '../shared/marketplace';
import { updateLocalData, type LocalData } from './local-data';
import { Modal, DemoNotice, money, dateTime, time } from './marketplace-ui';

export type BookingDraft = {
  venueId: string; activityId: string; groupId: string; slotId: string;
  date: string; parent: LocalData['parent']; step: number;
};
export function newBookingDraft(point: MapPoint, parent: LocalData['parent'], initial?: Session): BookingDraft {
  return { venueId: point.id, activityId: initial?.activity.id ?? '', groupId: initial?.group.id ?? '',
    slotId: initial?.id ?? '', date: initial?.date ?? '', parent: { ...parent }, step: initial ? 2 : 0 };
}
const steps = ['Выберите занятие', 'Выберите группу', 'Дата и время', 'Данные родителя', 'Проверьте запись'];
const dayLabel = (date: string) => new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', weekday: 'short', timeZone: 'Europe/Moscow' }).format(new Date(date + 'T12:00:00+03:00'));

export function BookingDialog({ point, draft, onChange, data, now, onClose, onSuccess }: {
  point: MapPoint; draft: BookingDraft; onChange: (draft: BookingDraft) => void; data: LocalData;
  now: number; onClose: () => void; onSuccess: () => void;
}) {
  const { activityId, groupId, slotId, parent, step } = draft;
  const activities = point.details!.activities.filter(activity => activity.active && activity.groups.some(group => group.active));
  const activity = activities.find(value => value.id === activityId);
  const groups = activity?.groups.filter(group => group.active) ?? [];
  const group = groups.find(value => value.id === groupId);
  const allSessions = sessionsFor(point, data.bookings, now);
  const sessions = allSessions.filter(session => session.activity.id === activityId && session.group.id === groupId && session.remaining > 0);
  const slot = sessions.find(value => value.id === slotId);
  const selectedDate = draft.date || sessions[0]?.date || moscowDate(now);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const body = useRef<HTMLDivElement>(null);
  const dates = useRef<HTMLDivElement>(null);
  useEffect(() => { body.current?.closest('dialog')?.scrollTo(0, 0); }, [step]);
  useEffect(() => { if (step === 2) dates.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [step]);
  const change = (patch: Partial<BookingDraft>) => { onChange({ ...draft, ...patch }); setError(''); };
  const check = () => {
    try { createBooking(point, slotId, { ...parent, age: Number(parent.age) }, data.bookings, Date.now(), 'preview'); change({ step: 4 }); }
    catch (error) { setError((error as Error).message); }
  };
  const submit = async () => {
    setBusy(true); setError('');
    try {
      await updateLocalData(current => ({ ...current, parent, bookings: [...current.bookings,
        createBooking(point, slotId, { ...parent, age: Number(parent.age) }, current.bookings, Date.now(), crypto.randomUUID())] }));
      onSuccess();
    } catch (error) { setError((error as Error).message); onChange({ ...draft, step: 3 }); }
    finally { setBusy(false); }
  };
  const today = Date.parse(moscowDate(now) + 'T00:00:00+03:00');
  return <Modal title={steps[step]} onClose={onClose} className="booking-dialog" dismissible={!busy}>
    <div className="dialog-body booking-flow" ref={body}>
      <div className="booking-progress"><span>{point.name}</span><span>Шаг {step + 1} из 5</span></div>
      <DemoNotice />
      {step === 0 && <div className="choice-list">{activities.map(value => {
        const available = allSessions.some(session => session.activity.id === value.id && session.remaining > 0);
        return <Button key={value.id} className="booking-choice" width="max" size="xl" view="outlined" disabled={!available}
          onClick={() => change({ activityId: value.id, groupId: '', slotId: '', date: '', step: 1 })}>
          <span className="choice-title">{value.name} <span aria-hidden="true">→</span></span><span className="choice-description">{value.direction} · {value.description}</span>
          {!available && <span className="choice-description">Нет свободных мест на ближайшие 28 дней</span>}
        </Button>;
      })}</div>}
      {step === 1 && <><p className="flow-context">{activity?.name}</p><div className="choice-list">{groups.map(value => {
        const next = allSessions.find(session => session.activity.id === activityId && session.group.id === value.id && session.remaining > 0);
        return <Button key={value.id} className="booking-choice" width="max" size="xl" view="outlined" disabled={!next}
          onClick={() => change({ groupId: value.id, slotId: '', date: next?.date ?? '', step: 2 })}>
          <span className="choice-title">{value.name} <span>{value.minAge}–{value.maxAge} лет</span></span>
          <span className="choice-description">{activity?.teacher.name}</span><span className="choice-title">{value.trialPrice === null ? 'Цена не указана' : money(value.trialPrice)}</span>
          <span className="choice-description">{next ? `Ближайшее: ${dateTime(next.startsAt)}` : 'Нет свободных мест на ближайшие 28 дней'}</span>
        </Button>;
      })}</div></>}
      {step === 2 && <><p className="flow-context">{activity?.name} · {group?.name}</p><p className="muted small">{group?.minAge}–{group?.maxAge} лет · {group?.trialPrice != null && money(group.trialPrice)} · Время московское</p>
        <div className="date-carousel" aria-label="Даты на ближайшие 28 дней" ref={dates}>{Array.from({ length: 28 }, (_, index) => moscowDate(today + index * DAY)).map(date =>
          <Button key={date} size="xl" className="date-choice" view={selectedDate === date ? 'action' : 'normal'} aria-label={dayLabel(date)} selected={selectedDate === date}
            disabled={!sessions.some(value => value.date === date)} onClick={() => change({ date, slotId: '' })}>
            <span>{dayLabel(date).split(',')[0]}</span><strong>{Number(date.slice(-2))}</strong>
          </Button>)}</div>
        <h3 className="selected-date">{dayLabel(selectedDate)}</h3><div className="time-grid" aria-label="Доступное время">{sessions.filter(value => value.date === selectedDate).map(value =>
          <Button key={value.id} className="time-choice" size="xl" view={slotId === value.id ? 'action' : 'outlined'} selected={slotId === value.id} onClick={() => change({ slotId: value.id, date: value.date })}>
            <strong>{time(value.startsAt)}–{time(value.endsAt)}</strong><span>{value.remaining} мест</span>
          </Button>)}</div>
        {!sessions.length && <p className="notice">В этой группе нет свободных дат на ближайшие 28 дней. Вернитесь к выбору группы.</p>}
        <div className="flow-actions"><Button view="action" size="xl" width="max" disabled={!slot} onClick={() => change({ step: 3 })}>Продолжить · {group?.trialPrice != null && money(group.trialPrice)}</Button></div>
      </>}
      {step === 3 && <form className="form-grid" onSubmit={event => { event.preventDefault(); check(); }}>
        <p className="flow-context">{activity?.name} · {group?.name}{slot && <><br />{dateTime(slot.startsAt)}–{time(slot.endsAt)}</>}</p>
        {!slot && <p className="notice">Выбранное время уже недоступно. Вернитесь к выбору даты.</p>}
        <label htmlFor="booking-name">Имя родителя<TextInput id="booking-name" size="xl" autoComplete="given-name" value={parent.name} onUpdate={name => change({ parent: { ...parent, name } })} controlProps={{ required: true }} /></label>
        <label htmlFor="booking-phone">Телефон<TextInput id="booking-phone" size="xl" type="tel" autoComplete="tel" placeholder="+7 999 123-45-67" value={parent.phone} onUpdate={phone => change({ parent: { ...parent, phone } })} controlProps={{ required: true }} /></label>
        <label htmlFor="booking-age">Возраст ребёнка<TextInput id="booking-age" size="xl" type="number" value={parent.age} onUpdate={age => change({ parent: { ...parent, age } })} controlProps={{ required: true, min: group?.minAge ?? 1, max: group?.maxAge ?? 17 }} /></label>
        <Button view="action" size="xl" width="max" type="submit" disabled={!slot}>Проверить запись</Button>
      </form>}
      {step === 4 && slot && <>
        <div className="booking-summary"><h3>{activity?.name}</h3><p>{group?.name} · {group?.minAge}–{group?.maxAge} лет</p><strong>{dateTime(slot.startsAt)}–{time(slot.endsAt)}</strong><p>Время московское</p><p>{point.address}</p><p>{parent.name} · {parent.phone}</p><p>Возраст ребёнка: {parent.age} лет</p><strong>{money(slot.group.trialPrice!)}</strong><p>Оплата в центре. Отмена бесплатна до начала занятия.</p></div>
        <Button view="action" size="xl" width="max" loading={busy} disabled={busy} onClick={submit}>{busy ? 'Сохраняем…' : 'Подтвердить запись'}</Button>
      </>}
      {step === 4 && !slot && <p className="notice">Выбранное время уже недоступно. Вернитесь к выбору даты.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {step > 0 && <Button className="flow-back" view="flat" size="l" width="max" disabled={busy} onClick={() => change({ step: step - 1 })}>{step === 4 ? 'Изменить данные' : '← Назад'}</Button>}
    </div>
  </Modal>;
}

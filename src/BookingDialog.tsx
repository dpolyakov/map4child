import { useState } from 'react';
import type { MapPoint } from '../shared/catalog';
import { createBooking, sessionsFor, type Session } from '../shared/marketplace';
import { updateLocalData, type LocalData } from './local-data';
import { Modal, DemoNotice, money, dateTime, time } from './marketplace-ui';

export function BookingDialog({ point, initial, data, onClose, onSuccess }: {
  point: MapPoint; initial?: Session; data: LocalData; onClose: () => void; onSuccess: () => void;
}) {
  const activities = point.details!.activities.filter(activity => activity.active && activity.groups.some(group => group.active));
  const [activityId, setActivity] = useState(initial?.activity.id ?? activities[0]?.id ?? '');
  const activity = activities.find(value => value.id === activityId);
  const groups = activity?.groups.filter(group => group.active) ?? [];
  const [groupId, setGroup] = useState(initial?.group.id ?? groups[0]?.id ?? '');
  const group = groups.find(value => value.id === groupId);
  const sessions = sessionsFor(point, data.bookings).filter(session => session.activity.id === activityId && session.group.id === groupId && session.remaining > 0);
  const [slotId, setSlot] = useState(initial?.id ?? '');
  const slot = sessions.find(value => value.id === slotId);
  const [parent, setParent] = useState(data.parent);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const check = () => {
    try { createBooking(point, slotId, { ...parent, age: Number(parent.age) }, data.bookings, Date.now(), 'preview'); setReview(true); setError(''); }
    catch (error) { setError((error as Error).message); }
  };
  const submit = async () => {
    setBusy(true); setError('');
    try {
      await updateLocalData(current => ({ ...current, parent, bookings: [...current.bookings,
        createBooking(point, slotId, { ...parent, age: Number(parent.age) }, current.bookings, Date.now(), crypto.randomUUID())] }));
      onSuccess();
    } catch (error) { setError((error as Error).message); setReview(false); }
    finally { setBusy(false); }
  };
  return <Modal title={review ? 'Проверьте запись' : 'Запись на пробное занятие'} onClose={onClose}>
    <div className="dialog-body"><p className="eyebrow">{point.name}</p><DemoNotice />
      {review && slot ? <>
        <div className="booking-summary"><h3>{activity?.name}</h3><p>{group?.name} · {group?.minAge}–{group?.maxAge} лет</p><strong>{dateTime(slot.startsAt)}–{time(slot.endsAt)}</strong><p>Время московское</p><p>{point.address}</p><p>{parent.name} · {parent.phone}</p><p>Возраст ребёнка: {parent.age} лет</p><strong>{money(slot.group.trialPrice!)}</strong><p>Оплата в центре. Отмена бесплатна до начала занятия.</p></div>
        <button className="primary full" disabled={busy} onClick={submit}>{busy ? 'Сохраняем…' : 'Подтвердить запись'}</button><button className="text-button full" disabled={busy} onClick={() => setReview(false)}>Изменить данные</button>
      </> : <form onSubmit={event => { event.preventDefault(); check(); }} className="form-grid">
        <label>Занятие<select value={activityId} onChange={event => { const next = activities.find(value => value.id === event.target.value)!; setActivity(next.id); setGroup(next.groups.find(value => value.active)?.id ?? ''); setSlot(''); }}>
          {activities.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}
        </select></label>
        <label>Группа<select value={groupId} onChange={event => { setGroup(event.target.value); setSlot(''); }}>{groups.map(value => <option key={value.id} value={value.id}>{value.name} · {value.minAge}–{value.maxAge} лет</option>)}</select></label>
        <label>Дата и время · Москва<select required value={slotId} onChange={event => setSlot(event.target.value)}><option value="">Выберите удобное время</option>{sessions.map(value => <option key={value.id} value={value.id}>{dateTime(value.startsAt)}–{time(value.endsAt)} · {value.remaining} мест</option>)}</select></label>
        {!sessions.length && <p className="notice">В этой группе нет свободных дат на ближайшие 28 дней.</p>}
        <div className="form-row"><label>Имя родителя<input required autoComplete="given-name" value={parent.name} onChange={event => setParent({ ...parent, name: event.target.value })} /></label><label>Телефон<input required type="tel" autoComplete="tel" placeholder="+7 999 123-45-67" value={parent.phone} onChange={event => setParent({ ...parent, phone: event.target.value })} /></label></div>
        <label>Возраст ребёнка<input required type="number" min={group?.minAge ?? 1} max={group?.maxAge ?? 17} value={parent.age} onChange={event => setParent({ ...parent, age: event.target.value })} /></label>
        <button className="primary full" type="submit" disabled={!slot}>Проверить условия · {group?.trialPrice != null ? money(group.trialPrice) : 'Цена не указана'}</button>
      </form>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  </Modal>;
}

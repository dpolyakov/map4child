import { useState } from 'react';
import type { MapPoint } from '../shared/catalog';
import { cancelBooking, confirmAttendance, createPastExample, type Booking } from '../shared/marketplace';
import { updateLocalData, saveReview, routeUrl, type LocalData } from './local-data';
import { Modal, DemoNotice, money, dateTime, time } from './marketplace-ui';

export function MyBookings({ data, points, onClose, notify }: { data: LocalData; points: MapPoint[]; onClose: () => void; notify: (message: string) => void }) {
  const [tab, setTab] = useState('upcoming');
  const [cancel, setCancel] = useState<string>();
  const [editing, setEditing] = useState<Booking>();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (change: (value: LocalData) => LocalData, message: string) => {
    setBusy(true); setError('');
    try { await updateLocalData(change); notify(message); setCancel(undefined); setEditing(undefined); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  const now = Date.now();
  const bookings = data.bookings.filter(booking => tab === 'cancelled' ? booking.status === 'cancelled' :
    booking.status !== 'cancelled' && (tab === 'upcoming' ? booking.endsAt > now : booking.endsAt <= now)).sort((a, b) => tab === 'upcoming' ? a.startsAt - b.startsAt : b.startsAt - a.startsAt);
  return <Modal title="Мои записи" onClose={onClose}>
    <div className="dialog-body"><DemoNotice /><div className="segmented" role="group" aria-label="Статус записи">
      {[['upcoming', 'Предстоящие'], ['past', 'Прошедшие'], ['cancelled', 'Отменённые']].map(([value, label]) => <button key={value} className={tab === value ? 'active' : ''} aria-pressed={tab === value} onClick={() => { setTab(value); setCancel(undefined); setEditing(undefined); }}>{label}</button>)}
    </div>
    {!bookings.length && <div className="empty-bookings"><span aria-hidden="true">◷</span><h3>{tab === 'upcoming' ? 'Здесь появятся ваши планы' : 'Пока нет записей'}</h3><p>Выберите занятие на карте и запишитесь на пробное.</p></div>}
    {bookings.map(booking => {
      const review = data.reviews.find(value => value.bookingId === booking.id);
      return <article className="booking-item" key={booking.id}>
        <div className="card-top"><span className="badge">{booking.status === 'cancelled' ? 'Отменена' : booking.status === 'attended' ? 'Посещение подтверждено' : booking.endsAt <= now ? 'Ожидает отметки о посещении' : 'Запись подтверждена'}</span><strong>{money(booking.price)}</strong></div>
        <h3>{booking.activityName}</h3><p>{booking.venueName} · {booking.groupName}</p><strong>{dateTime(booking.startsAt)}–{time(booking.endsAt)}</strong><p>{booking.address}</p><p className="muted">Ребёнку {booking.childAge} лет · оплата в центре</p>
        <a className="text-button" href={routeUrl(booking)} target="_blank" rel="noreferrer">Маршрут ↗</a>
        {booking.status === 'confirmed' && booking.startsAt > now && (cancel === booking.id ? <div className="notice"><p>Отменить запись? Место снова станет доступным. Отмена бесплатна.</p><button disabled={busy} className="danger" onClick={() => run(current => ({ ...current, bookings: current.bookings.map(value => value.id === booking.id ? cancelBooking(value, Date.now()) : value) }), 'Запись отменена, место снова доступно.')}>Да, отменить</button><button className="text-button" onClick={() => setCancel(undefined)}>Сохранить запись</button></div> : <button className="text-button" onClick={() => setCancel(booking.id)}>Отменить запись</button>)}
        {booking.status === 'confirmed' && booking.endsAt <= now && <div className="demo-control"><p>Демо: подтвердите факт посещения отдельным действием.</p><button disabled={busy} onClick={() => run(current => ({ ...current, bookings: current.bookings.map(value => value.id === booking.id ? confirmAttendance(value, Date.now()) : value) }), 'Посещение подтверждено. Теперь можно оставить отзыв.')}>Подтвердить посещение</button></div>}
        {booking.status === 'attended' && editing?.id !== booking.id && <div className="review-prompt"><p>{review ? `${'★'.repeat(review.rating)} ${review.text}` : 'Как прошло занятие? Поделитесь впечатлением.'}</p><button onClick={() => { setEditing(booking); setRating(review?.rating ?? 5); setText(review?.text ?? ''); }}>{review ? 'Изменить отзыв' : 'Оставить отзыв'}</button>{review && <button disabled={busy} className="text-button" onClick={() => run(current => ({ ...current, reviews: current.reviews.filter(value => value.bookingId !== booking.id) }), 'Отзыв удалён.')}>Удалить отзыв</button>}</div>}
        {editing?.id === booking.id && <form className="review-form" onSubmit={event => { event.preventDefault(); void run(current => saveReview(current, booking.id, rating, text, Date.now()), 'Отзыв сохранён. Рейтинг обновлён в этом браузере.'); }}>
          <label>Оценка<select value={rating} onChange={event => setRating(Number(event.target.value))}>{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} {'★'.repeat(value)}</option>)}</select></label><label>Отзыв · необязательно<textarea rows={3} maxLength={3000} value={text} onChange={event => setText(event.target.value)} /></label><button className="primary" disabled={busy}>Сохранить отзыв</button><button type="button" className="text-button" onClick={() => setEditing(undefined)}>Отмена</button>
        </form>}
      </article>;
    })}
    {error && <p className="error" role="alert">{error}</p>}
    <details className="demo-tools"><summary>Демо-инструменты</summary><p>Создайте прошедшую запись, затем подтвердите посещение и проверьте отзыв.</p><button disabled={busy} onClick={() => {
      const point = points.find(value => value.details?.demo && value.details.activities.some(activity => activity.active));
      if (!point) { setError('В каталоге нет демонстрационных занятий.'); return; }
      void run(current => ({ ...current, bookings: [...current.bookings, createPastExample(point, current.bookings, Date.now(), crypto.randomUUID())] }), 'Пример создан. Посещение ещё не подтверждено.'); setTab('past');
    }}>Создать прошедшую запись</button></details>
    </div>
  </Modal>;
}

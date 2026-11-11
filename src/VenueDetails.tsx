import { useState } from 'react';
import type { MapPoint } from '../shared/catalog';
import { matchingSessions, sessionsFor, weekdays, type SearchFilters, type Session } from '../shared/marketplace';
import { ratingFor, routeUrl, type LocalData } from './local-data';
import { Modal, PhotoView, money, dateTime } from './marketplace-ui';

export function VenueDetails({ point, filters, data, onClose, onBook }: { point: MapPoint; filters: SearchFilters; data: LocalData; onClose: () => void; onBook: (slot?: Session) => void }) {
  const details = point.details;
  const [photoIndex, setPhotoIndex] = useState(0);
  const matches = matchingSessions(point, filters, data.bookings, Date.now());
  const available = sessionsFor(point, data.bookings).filter(value => value.remaining > 0);
  const rating = ratingFor(point.id, details?.reviews ?? [], data);
  const activities = [...(details?.activities ?? [])].filter(value => value.active).sort((a,b) => Number(matches.some(value => value.activity.id === b.id)) - Number(matches.some(value => value.activity.id === a.id)));
  const localReviews = data.reviews.flatMap(review => {
    const booking = data.bookings.find(value => value.id === review.bookingId && value.venueId === point.id);
    return booking ? [{ ...review, author: booking.parentName, activityName: booking.activityName }] : [];
  });
  return <Modal title={point.name} onClose={onClose} wide>
    {details?.photos[photoIndex] && <PhotoView photo={details.photos[photoIndex]} className="venue-hero" />}
    {details && details.photos.length > 1 && <div className="photo-thumbnails" aria-label="Фотографии площадки">{details.photos.map((photo,index) => <button key={index} aria-label={`Показать фотографию ${index+1}`} aria-pressed={index===photoIndex} onClick={()=>setPhotoIndex(index)}><PhotoView photo={photo}/></button>)}</div>}
    <div className="dialog-body venue-body"><div className="card-top"><span className="badge">{details?.demo ? 'Демонстрационная площадка' : details ? 'Площадка' : 'Справочная карточка'}</span><span className="rating">★ {rating.rating ?? 'Нет оценок'}{rating.count > 0 && ` · ${rating.count} отзыв(а)`}</span></div>
      {details?.demo && <p className="muted small">Площадка и отзывы вымышлены. Фото — иллюстрация.</p>}
      <p>{point.address || 'Адрес не указан'} · {point.districts.join(', ')}</p><a className="text-button" href={routeUrl(point)} target="_blank" rel="noreferrer">Построить маршрут ↗</a>
      <p>{details?.description || 'Подробная информация о занятиях пока не добавлена. Запись через прототип для этой площадки недоступна.'}</p>
      <a className="section-link" href="#venue-activities">Занятия и группы ↓</a>
      <section id="venue-activities"><h2>Занятия и группы</h2>{activities.length === 0 && <p className="muted">Возраст, расписание и цены пока не указаны.</p>}
      {activities.map(activity => <article className="activity" key={activity.id}>
        <div className="card-top"><span className="eyebrow">{activity.direction}</span>{matches.some(value => value.activity.id === activity.id) && <span className="badge green">Подходит вам</span>}</div><h3>{activity.name}</h3><p>{activity.description}</p><p><strong>Формат:</strong> {activity.format}</p>
        <div className="teacher"><span className="teacher-avatar" aria-hidden="true">{activity.teacher.name[0]}</span><div><strong>{activity.teacher.name}</strong><p>{activity.teacher.bio}</p></div></div>
        {activity.groups.filter(value => value.active).map(group => {
          const next = matches.find(value => value.group.id === group.id) ?? available.find(value => value.group.id === group.id);
          return <div className="group" key={group.id}><div className="card-top"><h4>{group.name}</h4><span>{group.minAge}–{group.maxAge} лет</span></div>
            {group.schedule.map((schedule,index) => <p key={index}>{schedule.days.map(day => weekdays[day-1]).join(', ')} · {schedule.start} · {schedule.durationMinutes} мин</p>)}
            <p><strong>{group.trialPrice === null ? 'Цена не указана' : money(group.trialPrice)}</strong> · пробное занятие</p>
            {group.subscriptions.map((subscription,index) => <p className="muted" key={index}>{subscription.name}: {subscription.lessons} занятий, {subscription.validDays} дней — {money(subscription.price)}</p>)}
            {next ? <><p className="muted small">Ближайшее: {dateTime(next.startsAt)} · {next.remaining} мест</p><button className="primary" onClick={() => onBook(next)}>Записаться на занятие</button></> : <p className="muted">Свободных дат на ближайшие 28 дней нет.</p>}
          </div>;
        })}
      </article>)}
      </section>
      <section className="reviews"><h2>Отзывы о месте <span className="rating">{rating.rating && `★ ${rating.rating}`}</span></h2>
        {!rating.count && <p className="muted">Пока нет отзывов.</p>}
        {localReviews.map(review => <article key={review.bookingId}><strong>{review.author} · {'★'.repeat(review.rating)}</strong><p className="muted small">{review.activityName} · ваш отзыв, хранится в браузере</p>{review.text && <p>{review.text}</p>}</article>)}
        {details?.reviews.map(review => <article key={review.id}><strong>{review.author} · {'★'.repeat(review.rating)}</strong><p className="muted small">{review.activityName}{details.demo ? ' · демонстрационный отзыв' : ''}</p>{review.text && <p>{review.text}</p>}</article>)}
      </section>
      {!!point.sources.length && <details><summary>Источники справочной информации</summary>{point.sources.map((url,index) => <p key={url}><a href={url} target="_blank" rel="noreferrer">Источник {index+1} ↗</a></p>)}</details>}
    </div>
  </Modal>;
}

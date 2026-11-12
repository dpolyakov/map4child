import { useEffect, useRef, useState } from 'react';
import { Button, TabProvider, TabList, Tab, TabPanel } from '@gravity-ui/uikit';
import type { MapPoint } from '../shared/catalog';
import { matchingSessions, sessionsFor, weekdays, type SearchFilters, type Session } from '../shared/marketplace';
import { ratingFor, routeUrl, type LocalData } from './local-data';
import { PhotoView, money, dateTime } from './marketplace-ui';

export function VenueDetails({ point, filters, data, onClose, onBook }: { point: MapPoint; filters: SearchFilters; data: LocalData; onClose: () => void; onBook: (slot?: Session) => void }) {
  const details = point.details;
  const [tab, setTab] = useState('overview');
  const scroll = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const bookingAction = useRef<HTMLDivElement>(null);
  const [bookingVisible, setBookingVisible] = useState(true);
  useEffect(() => {
    if (!heading.current) return;
    const observer = new ResizeObserver(([entry]) => scroll.current?.style.setProperty('--place-heading-height', `${entry.target.getBoundingClientRect().height}px`));
    observer.observe(heading.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!bookingAction.current) return;
    const observer = new IntersectionObserver(([entry]) => setBookingVisible(entry.isIntersecting), { root: scroll.current });
    observer.observe(bookingAction.current);
    return () => observer.disconnect();
  }, []);
  const [photoIndex, setPhotoIndex] = useState(0);
  const matches = matchingSessions(point, filters, data.bookings, Date.now());
  const available = sessionsFor(point, data.bookings).filter(value => value.remaining > 0);
  const rating = ratingFor(point.id, details?.reviews ?? [], data);
  const activities = [...(details?.activities ?? [])].filter(value => value.active).sort((a,b) => Number(matches.some(value => value.activity.id === b.id)) - Number(matches.some(value => value.activity.id === a.id)));
  const localReviews = data.reviews.flatMap(review => {
    const booking = data.bookings.find(value => value.id === review.bookingId && value.venueId === point.id);
    return booking ? [{ ...review, author: booking.parentName, activityName: booking.activityName }] : [];
  });
  return <>
    <div className="place-scroll" ref={scroll}>
      {!!details?.photos.length && <div className="place-gallery"><PhotoView photo={details.photos[photoIndex]} className="venue-hero" /><span className="photo-counter">Фото · {details.photos.length}</span></div>}
      <div className="place-heading" ref={heading}><h1>{point.name}</h1><Button view="flat" size="l" aria-label="Закрыть карточку" onClick={onClose}>×</Button></div>
      <div className="place-summary">
        <p className="muted">{point.specialties.join(' · ')}</p>
        {rating.rating && <p className="rating"><span className="rating-star">★</span> {rating.rating} <span className="muted">· {rating.count} отзыв(а)</span></p>}
        <p className="place-address">{point.address || point.districts.join(', ')}</p>
        {details && <p className="muted small">{details.demo ? 'Вымышленная площадка · фото-иллюстрация' : 'Реальная площадка · демонстрационная запись'}</p>}
        <div className="place-actions"><Button href={routeUrl(point)} target="_blank" rel="noreferrer" view="normal" size="l">Маршрут ↗</Button><Button view="flat" size="l" onClick={onClose}>К списку</Button></div>
        <div ref={bookingAction}>{available.length > 0 ? <Button view="action" size="xl" width="max" onClick={() => onBook()}>Записаться на пробное</Button> : <p className="muted small">{details ? 'Нет свободных мест на ближайшие 28 дней' : 'Запись пока недоступна'}</p>}</div>
      </div>
      <TabProvider value={tab} onUpdate={setTab}>
        <TabList className="place-tabs" size="l" contentOverflow="scroll" aria-label="Разделы карточки">
          <Tab value="overview">Обзор</Tab>{!!activities.length && <Tab value="activities">Занятия</Tab>}{!!details?.photos.length && <Tab value="photos">Фото</Tab>}{rating.count > 0 && <Tab value="reviews">Отзывы</Tab>}
        </TabList>
        <div className="venue-body">
          <TabPanel value="overview"><h2>О площадке</h2><p>{details?.description || 'Подробная информация о занятиях пока не добавлена. Запись через прототип для этой площадки недоступна.'}</p>
            <h2>Адрес</h2><p>{point.address || 'Адрес не указан'}</p>
            {!!activities.length && <Button view="outlined" size="l" width="max" onClick={() => setTab('activities')}>Занятия и группы →</Button>}
            {!!point.sources.length && <details><summary>Источники справочной информации</summary>{details?.sourceCheckedAt && <p className="muted small">Проверено {details.sourceCheckedAt.split('-').reverse().join('.')}</p>}{point.sources.filter(url => !/\.(jpe?g|png|webp|avif)(?:\?|$)/i.test(url)).map((url,index) => <p key={url}><a href={url} target="_blank" rel="noreferrer">Источник {index+1} ↗</a></p>)}</details>}
          </TabPanel>
          <TabPanel value="activities"><h2>Занятия и группы</h2>
      <p className="demo-note">Расписание и число свободных мест демонстрационные. Центр не получает запись из прототипа.</p>
      {activities.map(activity => <article className="activity" key={activity.id}>
        <div className="card-top"><span className="eyebrow">{activity.direction}</span>{matches.some(value => value.activity.id === activity.id) && <span className="badge green">Подходит вам</span>}</div><h3>{activity.name}</h3><p>{activity.description}</p><p><strong>Формат:</strong> {activity.format}</p>
        {activity.teacher.name && <div className="teacher"><span className="teacher-avatar" aria-hidden="true">{activity.teacher.name[0]}</span><div><strong>{activity.teacher.name}</strong><p>{activity.teacher.bio}</p></div></div>}
        {!!activity.trainerIds.length && <section className="activity-team" aria-label={`Команда: ${activity.name}`}>
          <h4>Команда направления · {activity.trainerIds.length} тренеров</h4>
          <p className="muted small">Тренеры центра. Кто проведёт конкретное занятие, уточняют при записи в центре.</p>
          <div className="trainer-list">{details?.trainers.filter(trainer => activity.trainerIds.includes(trainer.id)).map(trainer =>
            <article className="trainer-card" key={trainer.id}><PhotoView photo={trainer.photo} className="trainer-photo" /><strong>{trainer.name}</strong><p>{trainer.bio}</p></article>
          )}</div>
        </section>}
        {activity.groups.filter(value => value.active).map(group => {
          const next = matches.find(value => value.group.id === group.id) ?? available.find(value => value.group.id === group.id);
          return <div className="group" key={group.id}><div className="card-top"><h4>{group.name}</h4><span>{group.minAge}–{group.maxAge} лет</span></div>
            {group.schedule.map((schedule,index) => <p key={index}>{schedule.days.map(day => weekdays[day-1]).join(', ')} · {schedule.start} · {schedule.durationMinutes} мин</p>)}
            <p><strong>{group.trialPrice === null ? 'Цена не указана' : money(group.trialPrice)}</strong> · пробное занятие</p>
            {group.subscriptions.map((subscription,index) => <p className="muted" key={index}>{subscription.name}: {subscription.lessons} занятий, {subscription.validDays} дней — {money(subscription.price)}</p>)}
            {next ? <><p className="muted small">Ближайшее: {dateTime(next.startsAt)} · {next.remaining} мест</p><Button view="action" size="l" width="max" onClick={() => onBook(next)}>Записаться на занятие</Button></> : <p className="muted">Свободных дат на ближайшие 28 дней нет.</p>}
          </div>;
        })}
      </article>)}
      </TabPanel>
      <TabPanel value="photos"><h2>Фотографии</h2><div className="place-photos">{details?.photos.map((photo,index) => <button key={index} aria-label={`Показать фотографию ${index+1}`} onClick={() => { setPhotoIndex(index); scroll.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}><PhotoView photo={photo} /></button>)}</div></TabPanel>
      <TabPanel value="reviews" className="reviews"><h2>Отзывы о месте <span className="rating">{rating.rating && `★ ${rating.rating}`}</span></h2>
        {!rating.count && <p className="muted">Пока нет отзывов.</p>}
        {localReviews.map(review => <article key={review.bookingId}><strong>{review.author} · {'★'.repeat(review.rating)}</strong><p className="muted small">{review.activityName} · ваш отзыв, хранится в браузере</p>{review.text && <p>{review.text}</p>}</article>)}
        {details?.reviews.map(review => <article key={review.id}><strong>{review.author} · {'★'.repeat(review.rating)}</strong><p className="muted small">{review.activityName}{details.demo ? ' · демонстрационный отзыв' : ''}</p>{review.text && <p>{review.text}</p>}</article>)}
      </TabPanel>
        </div>
      </TabProvider>
    </div>
    {available.length > 0 && !bookingVisible && <div className="place-book-sticky"><Button view="action" size="xl" width="max" onClick={() => onBook()}>Записаться на пробное</Button></div>}
  </>;
}

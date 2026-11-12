import { Button } from '@gravity-ui/uikit';
import type { MapPoint } from '../shared/catalog';
import { matchingSessions, distanceKm, type SearchFilters, type Origin } from '../shared/marketplace';
import { ratingFor, type LocalData } from './local-data';
import { PhotoView, money, dateTime } from './marketplace-ui';
export function VenueSnippet({ point, filters, data, now, origin, selected, onOpen, onBook }: {
  point: MapPoint; filters: SearchFilters; data: LocalData; now: number; origin?: Origin; selected: boolean; onOpen: () => void; onBook: () => void;
}) {
  const first = matchingSessions(point, filters, data.bookings, now)[0];
  const rating = ratingFor(point.id, point.details?.reviews ?? [], data);
  return <article className={`venue-card ${selected ? 'selected' : ''}`}>
    <button className="card-open" onClick={onOpen} aria-label={`Открыть ${point.name}`}>
      <h2>{point.name}</h2>
      {rating.rating && <p className="rating"><span className="rating-star">★</span> {rating.rating} <span className="muted">({rating.count})</span></p>}
      <p className="venue-category">{point.specialties.join(' · ')}</p>
      <p className="card-address">{point.address || point.districts.join(', ')}{origin && ` · ${distanceKm(origin, point).toFixed(1)} км по прямой`}</p>
      {first && <><p className="snippet-facts"><span>{first.group.minAge}–{first.group.maxAge} лет</span><strong>{money(first.group.trialPrice!)} <small>пробное</small></strong></p><p className="next-session">{dateTime(first.startsAt)}</p></>}
    </button>
    {!!point.details?.photos.length && <div className="snippet-photos" aria-label={`Фотографии ${point.name}`}>{point.details.photos.map((photo, index) => <button key={index} onClick={onOpen} aria-label={`Фото ${point.name}, ${index + 1}`}><PhotoView photo={photo} /></button>)}</div>}
    {(point.details || first) && <div className="venue-footer"><span className="demo-label">{point.details?.demo ? 'Демо · фото-иллюстрация' : 'Занятия и группы'}</span>{first && <Button size="m" view="outlined-action" onClick={onBook}>Записаться</Button>}</div>}
  </article>;
}

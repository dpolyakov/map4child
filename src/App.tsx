import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Provider } from '@gravity-ui/uikit';
import { catalogSchema, type Catalog, type MapPoint } from '../shared/catalog';
import { initialSearch, searchPoints, matchingSessions, distanceKm, weekdays, type Origin, type SearchFilters, type Session } from '../shared/marketplace';
import catalogUrl from '../.generated/catalog.json?url';
import { MapView } from './MapView';
import { providerStorageKey, savedMapProvider, type MapProvider } from './map-provider';
import { useTheme } from './theme';
import { useLocalData, updateLocalData, ratingFor } from './local-data';
import { Modal, PhotoView, money, dateTime } from './marketplace-ui';
import { VenueDetails } from './VenueDetails';
import { BookingDialog } from './BookingDialog';
import { MyBookings } from './MyBookings';
import { findAddress, type AddressResult } from './geocoder';
import { emptyFilters, facetOptions, filterPoints, type Facet } from './filtering';
import { Filters } from './Filters';

export function App() {
  const appearance = useTheme();
  const [catalog, setCatalog] = useState<Catalog>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(catalogUrl, { signal: controller.signal }).then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(json => setCatalog(catalogSchema.parse(json))).catch(error => { if (error.name !== 'AbortError') setFailed(true); });
    return () => controller.abort();
  }, []);
  return <Provider theme={appearance.theme} lang="ru">{catalog ? <Explorer catalog={catalog} appearance={appearance} /> : <main className="app-message"><h1>{failed ? 'Не удалось загрузить каталог' : 'Загружаем занятия…'}</h1>{failed && <button onClick={() => location.reload()}>Повторить</button>}</main>}</Provider>;
}

function Explorer({ catalog, appearance }: { catalog: Catalog; appearance: ReturnType<typeof useTheme> }) {
  const { data, error: storageError } = useLocalData();
  const [filters, setFilters] = useState(initialSearch);
  const [facets, setFacets] = useState(emptyFilters);
  const [query, setQuery] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [selectedId, setSelected] = useState<string>();
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nearOpen, setNearOpen] = useState(false);
  const [bookingsOpen, setBookingsOpen] = useState(false);
  const [booking, setBooking] = useState<{ point: MapPoint; slot?: Session }>();
  const [provider, setProvider] = useState(savedMapProvider);
  const [origin, setOrigin] = useState<Origin>();
  const [picking, setPicking] = useState(false);
  const [mapMobile, setMapMobile] = useState(() => matchMedia("(max-width: 760px)").matches);
  const [notice, setNotice] = useState('');
  const [limit, setLimit] = useState(40);
  const [now, setNow] = useState(Date.now());
  const [address, setAddress] = useState('');
  const [addressResults, setAddressResults] = useState<AddressResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addressMessage, setAddressMessage] = useState('');
  const addressRequest = useRef<AbortController>();
  const providerRef = useRef(provider); providerRef.current = provider;
  const notify = useCallback((message: string) => setNotice(message), []);
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(interval); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 7000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => () => addressRequest.current?.abort(), []);
  const options = useMemo(() => facetOptions(catalog.points), [catalog]);
  const visible = useMemo(() => searchPoints(filterPoints(catalog.points, facets, query), filters, '', data.bookings, now, origin), [catalog, facets, filters, query, data.bookings, now, origin]);
  const selected = visible.find(point => point.id === selectedId);
  const changeProvider = useCallback((value: MapProvider) => {
    setProvider(value); addressRequest.current?.abort(); setAddressResults([]); setSearching(false);
    if (value === 'osm') setOrigin(current => current?.source === 'yandex-geocoder' ? undefined : current);
    try { localStorage.setItem(providerStorageKey, value); } catch { /* Session choice remains usable. */ }
  }, []);
  const fallback = useCallback(() => { changeProvider('osm'); notify('Яндекс Карты недоступны. Открыта OSM; для поиска рядом выберите точку на карте.'); }, [changeProvider, notify]);
  const select = useCallback((id: string) => { setSelected(id); setGroupIds([]); }, []);
  const selectGroup = useCallback((ids: string[]) => setGroupIds(ids), []);
  const pickPoint = useCallback((latitude: number, longitude: number) => {
    setOrigin({ latitude, longitude, label: 'Точка на карте', source: providerRef.current === 'yandex' ? 'yandex-click' : 'osm-click', acquiredAt: Date.now() });
    setPicking(false); setMapMobile(false); notify('Ищем занятия рядом с выбранной точкой.');
  }, [notify]);
  const changeFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => { setFilters(current => ({ ...current, [key]: value })); setLimit(40); };
  const toggleFacet = (key: Facet, value: string) => {
    setFacets(current => ({ ...current, [key]: current[key].includes(value) ? current[key].filter(item => item !== value) : [...current[key], value] }));
    setLimit(40);
  };
  const reset = () => { setFilters(initialSearch()); setFacets(emptyFilters()); setQuery(''); setQueryInput(''); setOrigin(undefined); setLimit(40); };
  const find = async () => {
    if (!address.trim() || provider !== 'yandex') return;
    addressRequest.current?.abort(); const controller = new AbortController(); addressRequest.current = controller;
    setSearching(true); setAddressResults([]); setAddressMessage('');
    try { const results = await findAddress(address, controller.signal); if (controller.signal.aborted || providerRef.current !== 'yandex') return; setAddressResults(results); if (!results.length) setAddressMessage('Адрес не найден. Уточните запрос или выберите точку на карте.'); }
    catch { if (!controller.signal.aborted) setAddressMessage('Поиск адреса недоступен. Выберите точку на карте или повторите позже.'); }
    finally { if (!controller.signal.aborted) setSearching(false); }
  };
  const useSaved = (key: 'home' | 'school') => {
    const point = data.saved[key]; if (!point) { setAddress(data.savedLabels[key] ?? ''); setNearOpen(true); return; }
    if (provider === 'osm' && point.source === 'yandex-geocoder') { notify('Для сохранённого адреса включите Яндекс Карты или выберите точку на OSM.'); return; }
    setOrigin(point); setNearOpen(false);
  };
  const saveOrigin = async (key: 'home' | 'school') => {
    if (!origin) return;
    try { await updateLocalData(current => ({ ...current, saved: { ...current.saved, [key]: origin }, savedLabels: { ...current.savedLabels, [key]: origin.label } })); setAddressMessage(key === 'home' ? 'Дом сохранён.' : 'Школа сохранена.'); }
    catch (error) { setAddressMessage((error as Error).message); }
  };
  const filterCount = [filters.age, ...filters.days, filters.start, filters.end, filters.minPrice, filters.maxPrice].filter(value => value !== '').length + Object.values(facets).reduce((sum, values) => sum + values.length, 0);
  return <div className={`marketplace ${mapMobile ? 'mobile-map' : ''}`}>
    <header className="market-header"><a className="brand" href={import.meta.env.BASE_URL}><span className="brand-mark">✳</span>map<span>4</span>child</a><span className="header-caption">Большие увлечения начинаются рядом</span><div className="header-actions"><label className="sr-only" htmlFor="theme">Тема оформления</label><select id="theme" className="compact" value={appearance.preference} onChange={event => appearance.changePreference(event.target.value as 'light'|'dark'|'system')}><option value="system">◐ Авто</option><option value="light">☀ Светлая</option><option value="dark">☾ Тёмная</option></select><button className="profile-button" onClick={() => setBookingsOpen(true)}>Мои записи <span>{data.bookings.filter(value => value.status === 'confirmed' && value.endsAt > now).length || '↗'}</span></button></div></header>
    <main className="market-workspace">
      <section className="results-panel" aria-label="Поиск и список площадок">
        <div className="search-panel"><form className="search-field" onSubmit={event => { event.preventDefault(); setQuery(queryInput); setLimit(40); }}><span aria-hidden="true">⌕</span><input aria-label="Поиск по названию" placeholder="Название студии" value={queryInput} onChange={event => setQueryInput(event.target.value)} /><button aria-label="Найти занятия" type="submit">→</button></form>
          {queryInput !== query && queryInput.trim() && <button className="search-suggestion" onClick={() => { setQuery(queryInput); setLimit(40); }}>Найти «{queryInput}» в детских занятиях →</button>}
          <div className="quick-categories"><button className="category-pill chosen" onClick={reset}><span>✳</span> Детские занятия</button><button className="category-pill" onClick={() => setNearOpen(true)}>⌖ Рядом со мной</button></div>
          <div className="search-heading"><div><p className="eyebrow">ДЛЯ МАЛЕНЬКИХ БОЛЬШИХ ПЛАНОВ</p><h1>Найдите своё увлечение</h1><p className="muted">Пробуйте, выбирайте, открывайте новое.</p></div></div>
          <div className="filter-toolbar"><button className={filterCount ? 'filter-button has-filters' : 'filter-button'} onClick={() => setFiltersOpen(true)}>☷ Фильтры {filterCount > 0 && <span>{filterCount}</span>}</button><label className="switch-label"><input type="checkbox" checked={filters.bookableOnly} onChange={event => changeFilter('bookableOnly', event.target.checked)} /><span>Можно записаться</span></label></div>
          {origin && <div className="origin-bar"><button className="text-button" onClick={() => setNearOpen(true)}>⌖ {origin.label}</button><select aria-label="Радиус поиска" value={filters.radiusKm ?? 'all'} onChange={event => changeFilter('radiusKm', event.target.value === 'all' ? null : Number(event.target.value))}><option value="1">1 км</option><option value="3">3 км</option><option value="5">5 км</option><option value="all">Вся карта</option></select><button className="icon-button" aria-label="Убрать точку поиска" onClick={() => setOrigin(undefined)}>×</button></div>}
          <div className="result-heading"><strong>{visible.length} {visible.length === 1 ? 'площадка' : 'площадок'}</strong><span>{origin ? 'По расстоянию по прямой' : 'Москва · каталог площадок'}</span></div>
        </div>
        <div className="results-list">{visible.slice(0, limit).map(point => {
          const slots = matchingSessions(point, filters, data.bookings, now); const first = slots[0]; const rating = ratingFor(point.id, point.details?.reviews ?? [], data);
          const price = first?.group.trialPrice ?? null;
          return <article className="venue-card" key={point.id}><button className="card-open" onClick={() => select(point.id)} aria-label={`Открыть ${point.name}`}><PhotoView photo={point.details?.photos[0]} /><div className="venue-info"><div className="card-top"><span className="venue-category">{point.specialties.join(', ')}</span>{rating.rating && <span className="rating">★ {rating.rating}</span>}</div><h2>{point.name}</h2><p className="muted small card-address">{point.address || point.districts.join(', ')}{origin && ` · ${distanceKm(origin,point).toFixed(1)} км`}</p><div className="card-tags"><span>{first ? `${first.group.minAge}–${first.group.maxAge} лет` : 'Возраст не указан'}</span><span>{price !== null ? money(price) : 'Цена не указана'}</span></div><p className="next-session">{first ? dateTime(first.startsAt) : 'Расписание не указано'}</p></div></button><div className="venue-footer"><span className="demo-label">{point.details?.demo ? 'Демо · фото-иллюстрация' : point.details ? 'Занятия и группы' : 'Справочная информация'}</span><button className="text-button" onClick={() => select(point.id)}>Подробнее →</button></div></article>;
        })}
        {!visible.length && <div className="empty-bookings"><span aria-hidden="true">⌕</span><h2>Пока ничего не нашлось</h2><p>Измените название, выбранные фильтры или радиус поиска.</p><button onClick={reset}>Сбросить фильтры</button></div>}
        {visible.length > limit && <button className="full load-more" onClick={() => setLimit(value => value + 40)}>Показать ещё · осталось {visible.length-limit}</button>}
        <p className="list-disclaimer">Прототип: записи и отзывы сохраняются в вашем браузере. Демонстрационные площадки вымышлены.</p>
        </div>
      </section>
      <section className={`map-panel ${picking ? 'picking' : ''}`} aria-label="Карта занятий"><MapView key={provider} provider={provider} onYandexFailure={fallback} points={visible} allPoints={catalog.points} theme={appearance.theme} selectedId={selected?.id} onSelect={select} onGroup={selectGroup} origin={origin} picking={picking} onPick={pickPoint} />
        <div className="map-tools"><select aria-label="Карта" value={provider} onChange={event => { if (event.target.value === "osm" && origin?.source === "yandex-geocoder") notify("Поиск по радиусу ждёт новую точку. Выберите её на OpenStreetMap."); changeProvider(event.target.value as MapProvider); }}><option value="yandex">Яндекс Карты</option><option value="osm">OpenStreetMap</option></select><button onClick={() => { setPicking(value => !value); setMapMobile(true); }}>{picking ? 'Отменить выбор' : '⌖ Выбрать точку'}</button></div>
        {picking && <div className="pick-hint" role="status">Нажмите на карту, чтобы искать рядом</div>}
        <div className="map-caption"><strong>Ближе к дому. Ближе к интересам.</strong><span>Найдите место для нового увлечения</span></div>
      </section>
    </main>
    <button className="mobile-view-toggle" onClick={() => setMapMobile(value => !value)}>{mapMobile ? `☷ Список · ${visible.length}` : `⌖ На карте · ${visible.length}`}</button>
    {(notice || storageError) && <div className="toast" role="status">{storageError || notice}<button aria-label="Закрыть уведомление" onClick={() => setNotice('')}>×</button></div>}
    {filtersOpen && <Modal title="Фильтры занятий" onClose={() => setFiltersOpen(false)}><div className="dialog-body filters-form">
      <Filters filters={facets} options={options} query={query} onQuery={value=>{setQuery(value);setQueryInput(value);setLimit(40);}} onToggle={toggleFacet} onReset={reset} />
      <details className="booking-filters"><summary>Возраст, расписание и стоимость</summary><div className="form-grid"><p className="muted small">Эти условия учитывают только площадки с заполненными группами и доступным временем для записи.</p><label>Возраст ребёнка<select value={filters.age} onChange={event => changeFilter('age', event.target.value)}><option value="">Любой</option>{Array.from({length:17},(_,i)=>i+1).map(value => <option key={value} value={value}>{value} лет</option>)}</select></label><fieldset><legend>Дни занятий</legend><div className="day-buttons">{weekdays.map((value,index) => <button key={value} className={filters.days.includes(index+1) ? 'chosen' : ''} aria-pressed={filters.days.includes(index+1)} onClick={() => changeFilter('days', filters.days.includes(index+1) ? filters.days.filter(item=>item!==index+1) : [...filters.days,index+1])}>{value}</button>)}</div></fieldset><div className="form-row"><label>Начало не раньше<input type="time" value={filters.start} onChange={event=>changeFilter('start',event.target.value)} /></label><label>Конец не позже<input type="time" value={filters.end} onChange={event=>changeFilter('end',event.target.value)} /></label></div><p className="muted small">Всё занятие должно помещаться в выбранное время · Москва</p><fieldset><legend>Цена пробного · ₽</legend><div className="form-row"><label>От<input type="number" min="0" placeholder="0" value={filters.minPrice} onChange={event=>changeFilter('minPrice',event.target.value)} /></label><label>До<input type="number" min="0" placeholder="Любая" value={filters.maxPrice} onChange={event=>changeFilter('maxPrice',event.target.value)} /></label></div></fieldset></div></details>
      <div className="sticky-actions"><button className="primary full" onClick={()=>setFiltersOpen(false)}>Показать {visible.length} площадок</button><button className="text-button full" onClick={reset}>Сбросить фильтры</button></div>
    </div></Modal>}
    {nearOpen && <Modal title="Где искать занятия?" onClose={()=>setNearOpen(false)}><div className="dialog-body form-grid"><p className="muted">Выберите дом, школу или другую точку. Расстояние считаем по прямой.</p><div className="form-row"><button onClick={()=>useSaved('home')}>⌂ Дом{data.saved.home ? ' ✓' : ''}</button><button onClick={()=>useSaved('school')}>▦ Школа{data.saved.school ? ' ✓' : ''}</button></div><form className="form-grid" onSubmit={event=>{event.preventDefault();void find();}}><label>Адрес<input value={address} disabled={provider==='osm'} onChange={event=>setAddress(event.target.value)} placeholder="Москва, улица и номер дома" /></label><button className="primary" disabled={searching || provider==='osm' || !address.trim()}>{searching?'Ищем…':'Найти адрес'}</button></form>{addressMessage && <p className="notice" role="status">{addressMessage}</p>}{provider==='osm' && <p className="notice">Поиск адреса доступен на Яндекс Картах. На OSM выберите точку нажатием.</p>}{addressResults.map((result,index)=><button key={index} onClick={()=>{const {display: _display,...point}=result;setOrigin(point);setNearOpen(false);setAddressResults([]);}}>{result.display}</button>)}<button onClick={()=>{setNearOpen(false);setPicking(true);setMapMobile(true);}}>Выбрать точку на карте</button>{origin && <div className="notice"><strong>Выбрано: {origin.label}</strong><div className="form-row"><button onClick={()=>saveOrigin('home')}>Сохранить как дом</button><button onClick={()=>saveOrigin('school')}>Сохранить как школу</button></div></div>}</div></Modal>}
    {selected && !booking && <VenueDetails point={selected} filters={filters} data={data} onClose={()=>setSelected(undefined)} onBook={slot=>setBooking({point:selected,slot})} />}
    {booking && <BookingDialog point={booking.point} initial={booking.slot} data={data} onClose={()=>setBooking(undefined)} onSuccess={()=>{setBooking(undefined);setSelected(undefined);setBookingsOpen(true);notify('Вы записаны! Условия сохранены в «Моих записях».');}} />}
    {bookingsOpen && <MyBookings data={data} points={catalog.points} onClose={()=>setBookingsOpen(false)} notify={notify} />}
    {groupIds.length>0 && <Modal title="Выберите площадку" onClose={()=>setGroupIds([])}><div className="dialog-body form-grid">{visible.filter(point=>groupIds.includes(point.id)).map(point=><button key={point.id} onClick={()=>select(point.id)}>{point.name}</button>)}</div></Modal>}
  </div>;
}

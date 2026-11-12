import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Provider, Button, Select, TextInput } from '@gravity-ui/uikit';
import { catalogSchema, type Catalog, type MapPoint } from '../shared/catalog';
import { initialSearch, searchPoints, weekdays, type Origin, type SearchFilters, type Session } from '../shared/marketplace';
import catalogUrl from '../.generated/catalog.json?url';
import { MapView } from './MapView';
import { providerStorageKey, savedMapProvider, type MapProvider } from './map-provider';
import { useTheme } from './theme';
import { useLocalData, updateLocalData } from './local-data';
import { Modal } from './marketplace-ui';
import { VenueDetails } from './VenueDetails';
import { BookingDialog, newBookingDraft, type BookingDraft } from './BookingDialog';
import { MyBookings } from './MyBookings';
import { findAddress, type AddressResult } from './geocoder';
import { emptyFilters, facetOptions, filterPoints, type Facet } from './filtering';
import { Filters } from './Filters';
import { SpecialtyCarousel } from './SpecialtyCarousel';
import { VenueSnippet } from './VenueSnippet';
import { SheetHandle, type SheetState } from './SheetHandle';

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
  const [sheet, setSheet] = useState<SheetState>('half');
  const previousSheet = useRef<SheetState>('half');
  const [draft, setDraft] = useState<BookingDraft>();
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
  useEffect(() => {
    if (selectedId && !selected && !booking) { setSelected(undefined); setSheet(previousSheet.current); }
  }, [selectedId, selected, booking]);
  const changeProvider = useCallback((value: MapProvider) => {
    setProvider(value); addressRequest.current?.abort(); setAddressResults([]); setSearching(false);
    if (value === 'osm') setOrigin(current => current?.source === 'yandex-geocoder' ? undefined : current);
    try { localStorage.setItem(providerStorageKey, value); } catch { /* Session choice remains usable. */ }
  }, []);
  const fallback = useCallback(() => { changeProvider('osm'); notify('Яндекс Карты недоступны. Открыта OSM; для поиска рядом выберите точку на карте.'); }, [changeProvider, notify]);
  const select = useCallback((id: string) => { if (!selectedId) previousSheet.current = sheet; setSelected(id); setGroupIds([]); setSheet('compact'); }, [selectedId, sheet]);
  const openDetails = (id: string) => { if (!selectedId) previousSheet.current = sheet; setSelected(id); setGroupIds([]); setSheet('expanded'); };
  const closeDetails = () => { setSelected(undefined); setSheet(previousSheet.current); };
  const startBooking = (point: MapPoint, slot?: Session) => {
    if (!selectedId) previousSheet.current = sheet;
    setSelected(point.id);
    setDraft(current => current?.venueId === point.id && !slot ? current : newBookingDraft(point, current?.venueId === point.id ? current.parent : data.parent, slot));
    setBooking({ point });
  };
  const selectGroup = useCallback((ids: string[]) => setGroupIds(ids), []);
  const pickPoint = useCallback((latitude: number, longitude: number) => {
    setOrigin({ latitude, longitude, label: 'Точка на карте', source: providerRef.current === 'yandex' ? 'yandex-click' : 'osm-click', acquiredAt: Date.now() });
    setPicking(false); setSheet('half'); notify('Ищем занятия рядом с выбранной точкой.');
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
  const filterCount = [filters.age, ...filters.days, filters.start, filters.end, filters.minPrice, filters.maxPrice].filter(value => value !== '').length + Object.values(facets).reduce((sum, values) => sum + values.length, 0) + Number(filters.bookableOnly);
  const filterToolbar = <div className="filter-toolbar"><Button size="l" view="raised" onClick={() => setFiltersOpen(true)}>☷ Фильтры{filterCount > 0 ? ` · ${filterCount}` : ''}</Button><Button size="l" view="raised" selected={filters.bookableOnly} aria-pressed={filters.bookableOnly} onClick={() => changeFilter('bookableOnly', !filters.bookableOnly)}>✓ Можно записаться</Button></div>;
  const searchForm = <form className="search-field" onSubmit={event => { event.preventDefault(); setQuery(queryInput); setLimit(40); setSheet('expanded'); }}><TextInput size="xl" type="search" hasClear controlProps={{ "aria-label": "Поиск по названию" }} placeholder="Название студии" value={queryInput} onUpdate={setQueryInput} /><Button view="flat" size="xl" aria-label="Найти занятия" type="submit">→</Button></form>;
  return <div className={`marketplace sheet-${sheet} ${selected ? 'has-place' : ''} ${picking ? 'is-picking' : ''}`}>
    <header className="market-header"><a className="brand" href={import.meta.env.BASE_URL}><span className="brand-mark">✳</span>map<span>4</span>child</a><div className="header-actions">
      <Select className="provider-select" aria-label="Карта" size="l" value={[provider]} onUpdate={([value]) => { if (value === 'osm' && origin?.source === 'yandex-geocoder') notify('Для поиска рядом выберите точку на OpenStreetMap.'); changeProvider(value as MapProvider); }} options={[{ value: 'yandex', content: 'Яндекс' }, { value: 'osm', content: 'OSM' }]} />
      <details className="theme-menu"><summary aria-label="Тема оформления" title="Тема оформления">◐</summary><div>{([['system','Авто'],['light','Светлая'],['dark','Тёмная']] as const).map(([value,label])=><Button key={value} view="flat" size="m" selected={appearance.preference===value} onClick={()=>appearance.changePreference(value)}>{label}</Button>)}</div></details>
      <Button className="profile-button" view="normal" size="l" aria-label="Мои записи" onClick={() => setBookingsOpen(true)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18m-13 5h3"/></svg><span className="profile-label">Мои записи</span>{data.bookings.some(value=>value.status==='confirmed' && value.endsAt>now) && <span className="booking-count">{data.bookings.filter(value=>value.status==='confirmed' && value.endsAt>now).length}</span>}</Button>
    </div></header>
    <main className="market-workspace">
      <div className="map-search">{searchForm}</div>
      <section className="results-panel sheet-panel" aria-label="Поиск и список площадок">
        <SheetHandle state={sheet} title={`Площадки · ${visible.length}`} onChange={setSheet} />
        <div className="search-panel"><div className="panel-search">{searchForm}</div><div className="list-filters">{filterToolbar}</div>
          <SpecialtyCarousel values={options.specialties.map(option=>option.value)} selected={facets.specialties} onToggle={value=>toggleFacet('specialties',value)} onClear={()=>{setFacets(current=>({...current,specialties:[]}));setLimit(40);}} />
          {origin && <div className="origin-bar"><Button view="flat" size="s" onClick={() => setNearOpen(true)}>⌖ {origin.label}</Button><select aria-label="Радиус поиска" value={filters.radiusKm ?? 'all'} onChange={event => changeFilter('radiusKm', event.target.value === 'all' ? null : Number(event.target.value))}><option value="1">1 км</option><option value="3">3 км</option><option value="5">5 км</option><option value="all">Вся карта</option></select><Button view="flat" size="s" aria-label="Убрать точку поиска" onClick={() => setOrigin(undefined)}>×</Button></div>}
          <div className="result-heading"><strong>{visible.length} площадок</strong><span>{origin ? 'По расстоянию по прямой' : 'Москва'}</span></div>
        </div>
        <div className="results-list">{visible.slice(0, limit).map(point => <VenueSnippet key={point.id} point={point} filters={filters} data={data} now={now} origin={origin} selected={point.id===selectedId} onOpen={()=>openDetails(point.id)} onBook={()=>startBooking(point)} />)}
          {!visible.length && <div className="empty-bookings"><h2>Пока ничего не нашлось</h2><p>Измените название, выбранные фильтры или радиус поиска.</p><Button view="outlined" onClick={reset}>Сбросить фильтры</Button></div>}
          {visible.length > limit && <Button className="load-more" width="max" size="l" onClick={() => setLimit(value => value + 40)}>Показать ещё · {visible.length-limit}</Button>}
          <p className="list-disclaimer">Прототип: записи и отзывы сохраняются в вашем браузере. Демонстрационные площадки вымышлены.</p>
        </div>
      </section>
      <section className={`map-panel ${picking ? 'picking' : ''}`} aria-label="Карта занятий"><MapView key={provider} provider={provider} onYandexFailure={fallback} points={visible} allPoints={catalog.points} theme={appearance.theme} selectedId={selected?.id} onSelect={select} onGroup={selectGroup} origin={origin} picking={picking} onPick={pickPoint} />
        <div className="map-filters">{filterToolbar}</div>
        <div className="map-tools"><Button view="raised" size="l" onClick={() => setNearOpen(true)}>⌖ Рядом со мной</Button><Button view="raised" size="l" selected={picking} onClick={() => { setPicking(value => !value); setSheet('compact'); }}>{picking ? 'Отменить выбор' : 'Выбрать точку'}</Button></div>
        {picking && <div className="pick-hint" role="status">Нажмите на карту, чтобы искать рядом</div>}
      </section>
      {selected && <section className="place-panel sheet-panel" aria-label="Карточка площадки"><SheetHandle state={sheet} title="Карточка места" onChange={setSheet}/><VenueDetails key={selected.id} point={selected} filters={filters} data={data} onClose={closeDetails} onBook={slot=>startBooking(selected,slot)} /></section>}
    </main>
    {(notice || storageError) && <div className="toast" role="status">{storageError || notice}<button aria-label="Закрыть уведомление" onClick={() => setNotice('')}>×</button></div>}
    {filtersOpen && <Modal title="Фильтры занятий" onClose={() => setFiltersOpen(false)}><div className="dialog-body filters-form">
      <Filters filters={facets} options={options} query={query} onQuery={value=>{setQuery(value);setQueryInput(value);setLimit(40);}} onToggle={toggleFacet} onReset={reset} />
      <details className="booking-filters"><summary>Возраст, расписание и стоимость</summary><div className="form-grid"><p className="muted small">Эти условия учитывают только площадки с заполненными группами и доступным временем для записи.</p><label>Возраст ребёнка<select value={filters.age} onChange={event => changeFilter('age', event.target.value)}><option value="">Любой</option>{Array.from({length:17},(_,i)=>i+1).map(value => <option key={value} value={value}>{value} лет</option>)}</select></label><fieldset><legend>Дни занятий</legend><div className="day-buttons">{weekdays.map((value,index) => <button key={value} className={filters.days.includes(index+1) ? 'chosen' : ''} aria-pressed={filters.days.includes(index+1)} onClick={() => changeFilter('days', filters.days.includes(index+1) ? filters.days.filter(item=>item!==index+1) : [...filters.days,index+1])}>{value}</button>)}</div></fieldset><div className="form-row"><label>Начало не раньше<input type="time" value={filters.start} onChange={event=>changeFilter('start',event.target.value)} /></label><label>Конец не позже<input type="time" value={filters.end} onChange={event=>changeFilter('end',event.target.value)} /></label></div><p className="muted small">Всё занятие должно помещаться в выбранное время · Москва</p><fieldset><legend>Цена пробного · ₽</legend><div className="form-row"><label>От<input type="number" min="0" placeholder="0" value={filters.minPrice} onChange={event=>changeFilter('minPrice',event.target.value)} /></label><label>До<input type="number" min="0" placeholder="Любая" value={filters.maxPrice} onChange={event=>changeFilter('maxPrice',event.target.value)} /></label></div></fieldset></div></details>
      <div className="sticky-actions"><button className="primary full" onClick={()=>setFiltersOpen(false)}>Показать {visible.length} площадок</button><button className="text-button full" onClick={reset}>Сбросить фильтры</button></div>
    </div></Modal>}
    {nearOpen && <Modal title="Где искать занятия?" onClose={()=>setNearOpen(false)}><div className="dialog-body form-grid"><p className="muted">Выберите дом, школу или другую точку. Расстояние считаем по прямой.</p><div className="form-row"><button onClick={()=>useSaved('home')}>⌂ Дом{data.saved.home ? ' ✓' : ''}</button><button onClick={()=>useSaved('school')}>▦ Школа{data.saved.school ? ' ✓' : ''}</button></div><form className="form-grid" onSubmit={event=>{event.preventDefault();void find();}}><label>Адрес<input value={address} disabled={provider==='osm'} onChange={event=>setAddress(event.target.value)} placeholder="Москва, улица и номер дома" /></label><button className="primary" disabled={searching || provider==='osm' || !address.trim()}>{searching?'Ищем…':'Найти адрес'}</button></form>{addressMessage && <p className="notice" role="status">{addressMessage}</p>}{provider==='osm' && <p className="notice">Поиск адреса доступен на Яндекс Картах. На OSM выберите точку нажатием.</p>}{addressResults.map((result,index)=><button key={index} onClick={()=>{const {display: _display,...point}=result;setOrigin(point);setNearOpen(false);setAddressResults([]);}}>{result.display}</button>)}<button onClick={()=>{setNearOpen(false);setPicking(true);setSheet('compact');}}>Выбрать точку на карте</button>{origin && <div className="notice"><strong>Выбрано: {origin.label}</strong><div className="form-row"><button onClick={()=>saveOrigin('home')}>Сохранить как дом</button><button onClick={()=>saveOrigin('school')}>Сохранить как школу</button></div></div>}</div></Modal>}
    {booking && draft && <BookingDialog point={booking.point} draft={draft} onChange={setDraft} now={now} data={data} onClose={()=>setBooking(undefined)} onSuccess={()=>{setBooking(undefined);setDraft(undefined);setSelected(undefined);setSheet(previousSheet.current);setBookingsOpen(true);notify('Вы записаны! Условия сохранены в «Моих записях».');}} />}
    {bookingsOpen && <MyBookings data={data} points={catalog.points} onClose={()=>setBookingsOpen(false)} notify={notify} />}
    {groupIds.length>0 && <Modal title="Выберите площадку" onClose={()=>setGroupIds([])}><div className="dialog-body form-grid">{visible.filter(point=>groupIds.includes(point.id)).map(point=><button key={point.id} onClick={()=>select(point.id)}>{point.name}</button>)}</div></Modal>}
  </div>;
}

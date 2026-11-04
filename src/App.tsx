import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Dialog, Flex, Label, Link, Loader, Provider, Select, Text, Tooltip } from '@gravity-ui/uikit';
import type { Catalog } from '../shared/catalog';
import catalogUrl from '../.generated/catalog.json?url';
import { Filters } from './Filters';
import { PointCard } from './PointCard';
import { MapView } from './MapView';
import { providerStorageKey, savedMapProvider, type MapProvider } from './map-provider';
import { emptyFilters, facetOptions, filterPoints, type Facet } from './filtering';
import { useTheme } from './theme';

export function App() {
  const appearance = useTheme();
  const [catalog, setCatalog] = useState<Catalog>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(catalogUrl, { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Catalog unavailable');
      return response.json() as Promise<Catalog>;
    }).then(setCatalog).catch(error => { if (error.name !== 'AbortError') setFailed(true); });
    return () => controller.abort();
  }, []);
  return <Provider theme={appearance.theme} lang="ru">
    {failed ? <Flex as="main" className="app-message" direction="column" alignItems="center" justifyContent="center" gap="spacing-4">
      <Text as="h1" variant="header-2">Не удалось загрузить каталог</Text><Text color="secondary">Попробуйте открыть страницу ещё раз.</Text>
      <Button onClick={() => location.reload()}>Повторить</Button>
    </Flex> : catalog ? <Explorer catalog={catalog} appearance={appearance} /> :
      <Flex as="main" className="app-message" direction="column" alignItems="center" justifyContent="center" gap="spacing-4" role="status"><Loader size="m" /><Text>Загружаем занятия…</Text></Flex>}
  </Provider>;
}

function Explorer({ catalog, appearance }: { catalog: Catalog; appearance: ReturnType<typeof useTheme> }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [provider, setProvider] = useState(savedMapProvider);
  const [yandexFailed, setYandexFailed] = useState(false);
  const options = useMemo(() => facetOptions(catalog.points), [catalog.points]);
  const visible = useMemo(() => filterPoints(catalog.points, filters, query), [catalog.points, filters, query]);
  const selected = visible.find(point => point.id === selectedId);
  const group = visible.filter(point => groupIds.includes(point.id));
  const activeCount = Object.values(filters).reduce((count, values) => count + values.length, 0);
  const toggle = (key: Facet, value: string) => setFilters(current => ({
    ...current, [key]: current[key].includes(value) ? current[key].filter(item => item !== value) : [...current[key], value],
  }));
  const reset = () => { setFilters(emptyFilters()); setQuery(''); };
  const select = useCallback((id: string) => { setSelectedId(id); setGroupIds([]); }, []);
  const selectGroup = useCallback((ids: string[]) => { setGroupIds(ids); setSelectedId(undefined); }, []);
  const chooseProvider = (value: MapProvider) => {
    setProvider(value);
    setYandexFailed(false);
    try { localStorage.setItem(providerStorageKey, value); } catch { /* Keep the choice for this session. */ }
  };
  const fallbackToOsm = useCallback(() => {
    setProvider('osm');
    setYandexFailed(true);
    try { localStorage.setItem(providerStorageKey, 'osm'); } catch { /* Keep OSM for this session. */ }
  }, []);
  useEffect(() => {
    if (selectedId && !visible.some(point => point.id === selectedId)) setSelectedId(undefined);
    setGroupIds(ids => ids.filter(id => visible.some(point => point.id === id)));
  }, [visible, selectedId]);
  const filterProps = { filters, options, query, onQuery: setQuery, onToggle: toggle, onReset: reset };

  return <Flex className="app" direction="column">
    <Flex as="header" className="app-header" alignItems="center" gap="spacing-6">
      <Link className="brand" view="primary" href={import.meta.env.BASE_URL} aria-label="map4child — на главную"><span className="brand-icon" aria-hidden="true">✳</span>map4child</Link>
      <Text className="header-caption" color="secondary">Большие увлечения начинаются рядом</Text>
      <Flex className="header-actions" alignItems="center" gap="spacing-3">
        <Select className="map-provider-select" aria-label="Карта" size="l" value={[provider]}
          options={[{ value: 'osm', content: 'OpenStreetMap' }, { value: 'yandex', content: 'Яндекс Карты' }]}
          onUpdate={values => { if (values[0] === 'osm' || values[0] === 'yandex') chooseProvider(values[0]); }} />
        <Flex className="theme-switcher" role="group" aria-label="Тема оформления" gap="spacing-1">
          {([['system', '🖥️', 'Как в системе'], ['light', '☀️', 'Светлая тема'], ['dark', '🌙', 'Тёмная тема']] as const).map(([value, emoji, label]) =>
            <Tooltip key={value} content={label}><Button size="l" view="flat" selected={appearance.preference === value} aria-label={label} aria-pressed={appearance.preference === value}
              onClick={() => appearance.changePreference(value)}><span className="theme-emoji" aria-hidden="true">{emoji}</span></Button></Tooltip>,
          )}
        </Flex>
      </Flex>
    </Flex>
    <Flex className="workspace">
      <aside className="sidebar"><Filters {...filterProps} /><Text as="p" variant="caption-2" color="secondary" className="sidebar-note">Выберите интересы и район. Откройте точку, чтобы узнать больше.</Text></aside>
      <main className="map-panel" aria-label="Карта занятий">
        <Flex className="map-toolbar" alignItems="center" wrap gap="spacing-3">
          <Card className="result-counter" view="raised" aria-live="polite"><Text variant="subheader-3">{visible.length}</Text><Text variant="caption-2" color="secondary">точек из {catalog.points.length}</Text></Card>
          <Button className="mobile-filter-button" size="l" view="action" onClick={() => setFiltersOpen(true)}>Фильтры{activeCount > 0 ? ` · ${activeCount}` : ''}</Button>
          {catalog.mode === 'demo' && <Label theme="warning">Демо · вымышленные точки</Label>}
        </Flex>
        {yandexFailed && <Card className="map-notice" view="raised" role="status"><Alert theme="warning" title="Яндекс Карты недоступны" message="Показана OpenStreetMap. Можно выбрать Яндекс ещё раз вверху страницы." onClose={() => setYandexFailed(false)} /></Card>}
        <MapView key={provider} provider={provider} onYandexFailure={fallbackToOsm} points={visible} allPoints={catalog.points} theme={appearance.theme} selectedId={selected?.id} onSelect={select} onGroup={selectGroup} />
        {!visible.length && <Card className="empty-results" view="raised"><Text as="h2" variant="header-1">Ничего не нашлось</Text><Text as="p" color="secondary">Попробуйте другое название или измените фильтры.</Text><Button onClick={reset}>Сбросить фильтры</Button></Card>}
        {selected && <PointCard point={selected} onClose={() => setSelectedId(undefined)} />}
        {group.length > 0 && <Card className="point-card group-card" view="raised" role="region" aria-label="Выбор площадки">
          <Flex alignItems="center" justifyContent="space-between" gap="spacing-3"><Text as="h2" variant="subheader-3">Выберите площадку</Text><Button view="flat" aria-label="Закрыть список" onClick={() => setGroupIds([])}>×</Button></Flex>
          <Flex direction="column" gap="spacing-2" className="group-options">{group.map(point => <Button className="group-option" width="max" key={point.id} onClick={() => select(point.id)}>{point.name}</Button>)}</Flex>
        </Card>}
        <Text className="updated-label" variant="caption-1" color="secondary">Обновлено {new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }).format(new Date(catalog.generatedAt))}</Text>
      </main>
    </Flex>
    <Dialog open={filtersOpen} onOpenChange={setFiltersOpen} aria-label="Фильтры занятий" maxWidth="m" className="filter-dialog" hasCloseButton>
      <Dialog.Header caption="Фильтры занятий" />
      <Dialog.Body><Filters {...filterProps} /></Dialog.Body>
      <Dialog.Footer textButtonApply={`Показать точки · ${visible.length}`} onClickButtonApply={() => setFiltersOpen(false)} />
    </Dialog>
  </Flex>;
}

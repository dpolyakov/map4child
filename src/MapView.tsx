import { Component, lazy, Suspense, useCallback, useState, type ReactNode } from 'react';
import { Button, Card, Flex, Loader, Text } from '@gravity-ui/uikit';
import type { MapProps, MapProvider } from './map-provider';
import { markerBackground } from './palette';

const OsmMap = lazy(() => import('./OsmMap').then(module => ({ default: module.OsmMap })));
const YandexMap = lazy(() => import('./YandexMap').then(module => ({ default: module.YandexMap })));

export function MapLoading() {
  return <Flex className="map-loading" direction="column" alignItems="center" justifyContent="center" gap="spacing-4" role="status">
    <Loader size="m" /><Text color="secondary">Загружаем карту…</Text>
  </Flex>;
}

class MapBoundary extends Component<{ children: ReactNode; onError: (error: unknown) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function MapView({ provider, onYandexFailure, ...props }: Omit<MapProps, 'onError'> & {
  provider: MapProvider; onYandexFailure: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const onError = useCallback((error: unknown) => {
    if (provider === 'yandex') onYandexFailure();
    else {
      console.error('[map4child] Ошибка загрузки OpenStreetMap:', error);
      setFailed(true);
    }
  }, [provider, onYandexFailure]);
  if (failed) return <div className="map-fallback">
    <Flex className="fallback-heading" direction="column" alignItems="center" gap="spacing-4">
      <Text as="h2" variant="header-2">Карта временно недоступна</Text>
      <Text color="secondary">Можно продолжить поиск и открыть карточку из списка.</Text>
      <Button onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Повторить загрузку карты</Button>
    </Flex>
    <div className="fallback-list" aria-label="Найденные площадки">{props.points.map(point =>
      <Card key={point.id} type="action" className="fallback-point" onClick={() => props.onSelect(point.id)} aria-label={point.name}>
        <span className="category-dot" style={{ background: markerBackground(point.specialties) }} />
        <Flex direction="column" gap="spacing-1"><Text>{point.name}</Text><Text variant="caption-2" color="secondary">{point.specialties.join(' · ')}</Text></Flex>
      </Card>,
    )}</div>
  </div>;
  const MapComponent = provider === 'osm' ? OsmMap : YandexMap;
  return <MapBoundary key={attempt} onError={onError}><Suspense fallback={<MapLoading />}>
    <MapComponent {...props} onError={onError} />
  </Suspense></MapBoundary>;
}

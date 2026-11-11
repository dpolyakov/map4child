import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LngLat, YMap as MapInstance, YMapLocationRequest } from '@yandex/ymaps3-types';
import type { Feature } from '@yandex/ymaps3-clusterer';
import { initialLocation, mapCoordinates } from './map-geometry';
import { markerBackground } from './palette';
import { loadMap, type MapModules } from './yandex-maps';
import type { MapProps } from './map-provider';
import { MapLoading } from './MapView';

function ReadyMap({ modules, points, allPoints, theme, selectedId, origin, picking, onPick, onSelect, onGroup }: MapProps & { modules: MapModules }) {
  const { YMap, YMapDefaultSchemeLayer, YMapFeatureDataSource, YMapLayer, YMapMarker, YMapClusterer, YMapListener, clusterByGrid } = modules;
  const map = useRef<MapInstance | null>(null);
  const [location, setLocation] = useState<YMapLocationRequest>(() => initialLocation(allPoints));
  useEffect(() => { if (origin) setLocation({ center: [origin.longitude, origin.latitude], zoom: 14, duration: 300 }); }, [origin]);
  const byId = useMemo(() => new Map(points.map(point => [point.id, point])), [points]);
  const features = useMemo<Feature[]>(() => points.map(point => ({
    type: 'Feature', id: point.id, geometry: { type: 'Point', coordinates: mapCoordinates(point) }, properties: {},
  })), [points]);
  const method = useMemo(() => clusterByGrid({ gridSize: 64 }), [clusterByGrid]);
  const marker = useCallback((feature: Feature) => {
    const point = byId.get(String(feature.id))!;
    return <YMapMarker key={point.id} coordinates={feature.geometry.coordinates} source="points">
      <button className={`map-marker ${selectedId === point.id ? 'selected' : ''}`} title={point.name}
        aria-label={point.name} aria-pressed={selectedId === point.id} onClick={() => onSelect(point.id)}
        style={{ background: markerBackground(point.specialties) }}><span /></button>
    </YMapMarker>;
  }, [YMapMarker, byId, onSelect, selectedId]);
  const cluster = useCallback((coordinates: LngLat, items: Feature[]) => {
    const coincident = items.every(item => item.geometry.coordinates[0] === items[0].geometry.coordinates[0] &&
      item.geometry.coordinates[1] === items[0].geometry.coordinates[1]);
    return <YMapMarker key={items.map(item => item.id).join('-')} coordinates={coordinates} source="points">
      <button className="map-cluster" aria-label={`Группа: ${items.length} точек`} onClick={() => {
        const zoom = map.current?.zoom ?? 10;
        if (coincident || zoom >= 20) onGroup(items.map(item => String(item.id)));
        else setLocation({ center: coordinates, zoom: Math.min(zoom + 2, 20), duration: 300 });
      }}>{items.length}</button>
    </YMapMarker>;
  }, [YMapMarker, onGroup]);
  return <YMap ref={map} location={location} theme={theme}>
    <YMapDefaultSchemeLayer />
    <YMapFeatureDataSource id="points" />
    <YMapLayer source="points" type="markers" zIndex={1800} />
    <YMapClusterer features={features} method={method} marker={marker} cluster={cluster} />
    <YMapListener layer="any" onClick={(_object, event) => { if (picking) onPick?.(event.coordinates[1], event.coordinates[0]); }} />
    {origin && <YMapMarker coordinates={[origin.longitude, origin.latitude]} source="points"><span className="origin-marker" aria-label="Точка поиска" /></YMapMarker>}
  </YMap>;
}

export function YandexMap(props: MapProps) {
  const [modules, setModules] = useState<MapModules>();
  const { onError } = props;
  useEffect(() => {
    let active = true;
    loadMap().then(value => { if (active) setModules(value); }, error => { if (active) onError(error); });
    return () => { active = false; };
  }, [onError]);
  if (!modules) return <MapLoading />;
  return <ReadyMap modules={modules} {...props} />;
}

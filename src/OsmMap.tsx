import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { MapProps } from './map-provider';
import type { MapPoint } from '../shared/catalog';
import { markerBackground } from './palette';

type PointMarker = L.Marker & { point: MapPoint };

function pointIcon(point: MapPoint) {
  const dot = document.createElement('span');
  dot.className = 'point-symbol';
  dot.style.background = markerBackground(point.specialties);
  dot.setAttribute('aria-hidden', 'true');
  return L.divIcon({ html: dot, className: 'osm-point-icon', iconSize: [30, 30], iconAnchor: [15, 15] });
}

export function OsmMap({ points, allPoints, selectedId, onSelect, onGroup, onError }: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const group = useRef<L.MarkerClusterGroup>();
  const markers = useRef(new Map<string, PointMarker>());
  const selection = useRef(selectedId);
  selection.current = selectedId;
  const callbacks = useRef({ onSelect, onGroup, onError });
  callbacks.current = { onSelect, onGroup, onError };

  useEffect(() => {
    const instance = L.map(container.current!, { zoomControl: false, maxZoom: 19 });
    const bounds = L.latLngBounds(allPoints.map(point => [point.latitude, point.longitude]));
    if (bounds.getSouthWest().equals(bounds.getNorthEast())) instance.setView(bounds.getCenter(), 14);
    else instance.fitBounds(bounds, { padding: [48, 80], maxZoom: 14 });
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Приблизить', zoomOutTitle: 'Отдалить' }).addTo(instance);
    instance.attributionControl.setPrefix(false);

    let loadedTiles = 0;
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      callbacks.current.onError(new Error('Не удалось загрузить подложку OpenStreetMap'));
    };
    const timeout = setTimeout(fail, 20_000);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
    });
    tiles.on('tileload', () => { loadedTiles++; });
    tiles.on('load', () => {
      if (settled) return;
      clearTimeout(timeout);
      if (loadedTiles === 0) fail();
      else settled = true;
    });
    tiles.addTo(instance);

    const clusters = L.markerClusterGroup({
      maxClusterRadius: 64, showCoverageOnHover: false,
      spiderfyOnMaxZoom: false, zoomToBoundsOnClick: false,
      iconCreateFunction: cluster => {
        const label = document.createElement('span');
        label.textContent = String(cluster.getChildCount());
        label.setAttribute('aria-label', `Группа: ${cluster.getChildCount()} точек`);
        return L.divIcon({ html: label, className: 'osm-cluster-icon', iconSize: [44, 44], iconAnchor: [22, 22] });
      },
    });
    clusters.on('clusterclick', event => {
      const cluster = event.layer as L.MarkerCluster;
      const children = cluster.getAllChildMarkers() as PointMarker[];
      const first = children[0].getLatLng();
      const coincident = children.every(marker => {
        const coordinates = marker.getLatLng();
        return coordinates.lat === first.lat && coordinates.lng === first.lng;
      });
      if (coincident || instance.getZoom() >= 19) callbacks.current.onGroup(children.map(marker => marker.point.id));
      else cluster.zoomToBounds({ padding: [40, 80], maxZoom: Math.min(instance.getZoom() + 2, 19) });
    });
    instance.addLayer(clusters);
    group.current = clusters;
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(container.current!);
    return () => {
      settled = true;
      clearTimeout(timeout);
      resize.disconnect();
      instance.remove();
      markers.current.clear();
      group.current = undefined;
    };
  }, [allPoints]);

  useEffect(() => {
    const clusters = group.current;
    if (!clusters) return;
    clusters.clearLayers();
    markers.current.clear();
    for (const point of points) {
      const marker = Object.assign(L.marker([point.latitude, point.longitude], { icon: pointIcon(point), title: point.name }), { point });
      marker.on('click', () => callbacks.current.onSelect(point.id));
      marker.on('add', () => {
        marker.getElement()?.setAttribute('aria-label', point.name);
        marker.getElement()?.classList.toggle('is-selected', point.id === selection.current);
        marker.getElement()?.setAttribute('aria-pressed', String(point.id === selection.current));
      });
      markers.current.set(point.id, marker);
    }
    clusters.addLayers([...markers.current.values()]);
  }, [points]);

  useEffect(() => {
    for (const [id, marker] of markers.current) {
      marker.getElement()?.classList.toggle('is-selected', id === selectedId);
      marker.getElement()?.setAttribute('aria-pressed', String(id === selectedId));
    }
  }, [selectedId, points]);

  return <div className="osm-map" ref={container} aria-label="Карта OpenStreetMap" />;
}

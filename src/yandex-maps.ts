import React from 'react';
import * as ReactDOM from 'react-dom';

class MapLoadError extends Error {
  constructor(readonly stage: string, cause: unknown) {
    super(`Яндекс Карты: ${stage}`, { cause });
    this.name = 'MapLoadError';
  }
}

async function stage<T>(name: string, task: () => PromiseLike<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Превышено время ожидания (20 с)')), 20_000);
      }),
    ]);
  } catch (error) {
    throw new MapLoadError(name, error);
  } finally {
    clearTimeout(timeout);
  }
}

async function loadSdk(key: string) {
  if (typeof ymaps3 !== 'undefined') return;
  const script = document.createElement('script');
  script.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
  script.async = true;
  try {
    await stage('загрузка SDK', () => new Promise<void>((resolve, reject) => {
      script.onload = () => typeof ymaps3 !== 'undefined' ? resolve() : reject(new Error('SDK не создал ymaps3'));
      script.onerror = () => reject(new Error('Не удалось загрузить api-maps.yandex.ru/v3/. Проверьте сеть, API-ключ и HTTP Referer в кабинете Яндекса; HTTP-ответ доступен во вкладке Network.'));
      document.head.append(script);
    }));
  } catch (error) {
    script.remove();
    throw error;
  } finally {
    script.onload = null;
    script.onerror = null;
  }
}

async function initialize() {
  const key = import.meta.env.VITE_YANDEX_MAPS_API_KEY?.trim();
  if (!key) throw new MapLoadError('настройка ключа', new Error('Не задан VITE_YANDEX_MAPS_API_KEY'));
  await loadSdk(key);
  await stage('готовность SDK', () => ymaps3.ready);
  const [binding, clusterer] = await Promise.all([
    stage('модуль @yandex/ymaps3-reactify', () => ymaps3.import('@yandex/ymaps3-reactify')),
    stage('модуль @yandex/ymaps3-clusterer', () => import('@yandex/ymaps3-clusterer')),
  ]);
  return stage('инициализация React-компонентов', async () => {
    const reactify = binding.reactify.bindTo(React, ReactDOM);
    return {
      ...reactify.module(ymaps3),
      YMapClusterer: reactify.module(clusterer).YMapClusterer,
      clusterByGrid: clusterer.clusterByGrid,
    };
  });
}

function reportError(error: unknown) {
  const key = import.meta.env.VITE_YANDEX_MAPS_API_KEY?.trim();
  const details = (value: unknown): string => value instanceof Error
    ? `${value.stack ?? value.message}${value.cause ? `\nПричина: ${details(value.cause)}` : ''}`
    : String(value);
  let message = details(error);
  if (key) message = message.replaceAll(key, '[redacted]').replaceAll(encodeURIComponent(key), '[redacted]');
  message = message.replace(/([?&](?:apikey|key|token)=)[^&\s)]+/gi, '$1[redacted]');
  console.error('[map4child] Ошибка загрузки Яндекс Карт:', message);
}

export type MapModules = Awaited<ReturnType<typeof initialize>>;
let pending: Promise<MapModules> | undefined;

export function loadMap() {
  if (!pending) pending = initialize().catch(error => {
    pending = undefined;
    reportError(error);
    throw error;
  });
  return pending;
}

import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@gravity-ui/uikit';
import type { Photo } from '../shared/marketplace-model';
export const money = (value: number) => value === 0 ? 'Бесплатно' : new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
export const dateTime = (value: number) => new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(value);
export const time = (value: number) => new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(value);
export function Modal({ title, onClose, children, wide = false, className = '', dismissible = true }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; className?: string; dismissible?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className={`m-dialog ${wide ? 'wide' : ''} ${className}`} onCancel={event => { event.preventDefault(); if (dismissible) onClose(); }} aria-label={title}>
    <div className="dialog-heading"><h2>{title}</h2><Button view="flat" size="l" aria-label="Закрыть" disabled={!dismissible} onClick={onClose}>×</Button></div>
    {children}
  </dialog>;
}
export function PhotoView({ photo, className = '' }: { photo?: Photo; className?: string }) {
  return <div className={`photo ${className}`}>
    {photo && <img src={photo.url.startsWith('venue-media/') || photo.url.startsWith('media/') ? import.meta.env.BASE_URL + photo.url : photo.url} alt={photo.alt} loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
    <span className="photo-fallback" aria-hidden="true">✳</span>
  </div>;
}
export function DemoNotice() { return <p className="demo-note">Демонстрация: запись сохраняется только в этом браузере. Центр её не получает, оплата не списывается.</p>; }

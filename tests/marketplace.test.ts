import { describe, it, expect } from 'vitest';
import { demoVenues } from '../scripts/demo-venues';
import { normalizeSheets } from '../scripts/normalize';
import { headings, makeRow, makeSheet } from './fixtures';
import { editorHeaders, readySchema } from '../shared/marketplace-model';
import { cancelBooking, confirmAttendance, createBooking, createPastExample, initialSearch, matchingSessions, moscowDate, searchPoints, sessionsFor, DAY } from '../shared/marketplace';
import { emptyData, parseLocalData, ratingFor, saveReview } from '../src/local-data';
import { emptyFilters, filterPoints } from '../src/filtering';
const now = Date.parse('2026-11-11T15:00:00+03:00');
const venue = () => structuredClone(demoVenues[0]);
function prepared(data = venue(), extra: Record<string,unknown> = {}) { return JSON.stringify({schemaVersion:1,revision:'v1',archived:false,data,...extra}); }
function detailed(data = venue(), extra: Record<string,unknown> = {}) {
  const sheet = makeSheet([]); sheet.rows = [[...headings,...Object.values(editorHeaders)],
    [...makeRow(),data.id,'private draft',prepared(data,extra),'rev','true']]; return sheet;
}
const point = () => normalizeSheets([detailed()]).catalog.points[0];
const parent = {name:'Тест',phone:'+7 000 000-00-00',age:9};

describe('prepared catalog isolation',()=>{
 it('publishes only ready versions, never new drafts or private columns',()=>{
  const sheet=detailed(); sheet.rows.push([...makeRow({name:'SECRET DRAFT'}),'new-draft','SECRET DRAFT','','r','true']);
  const {catalog}=normalizeSheets([sheet]);expect(catalog.points).toHaveLength(1);expect(JSON.stringify(catalog)).not.toContain('SECRET');expect(JSON.stringify(catalog)).not.toContain('private draft');
 });
 it('rejects malformed ready content even if other reference rows are valid',()=>{
  const sheet=detailed();sheet.rows[1][headings.length+2]='{broken';expect(()=>normalizeSheets([makeSheet([makeRow()]),sheet])).toThrow('Публикация остановлена');
 });
 it('replaces just one branch and preserves stable identity through rename and archive',()=>{
  const reference=makeSheet([makeRow({coordinates:'55.75,37.6;55.76,37.61'})]);
  const old=normalizeSheets([reference]).catalog.points.find(p=>p.latitude===55.75)!;
  const data=venue();data.legacyIds=[old.id];data.name='Новое имя';
  const live=normalizeSheets([reference,detailed(data)]).catalog;expect(live.points).toHaveLength(2);expect(live.points.find(p=>p.id===data.id)?.name).toBe('Новое имя');expect(live.points.find(p=>p.latitude===55.76)?.details).toBeUndefined();
  const archived=normalizeSheets([reference,detailed(data,{archived:true,revision:'v2'})]).catalog;expect(archived.points).toHaveLength(1);expect(archived.revisions?.[data.id]).toBe('v2');
 });
 it('rejects duplicate identities and branch claims across sheets',()=>{
  expect(()=>normalizeSheets([detailed(),detailed()])).toThrow('ID');
  const a=venue();const b=structuredClone(demoVenues[1]);a.legacyIds=['same'];b.legacyIds=['same'];expect(()=>normalizeSheets([detailed(a),detailed(b)])).toThrow('один филиал');
 });
 it('publishes photo URLs unchanged and rejects non-URL image sources',()=>{
  const data=venue();data.photos.push({kind:'url',url:'https://example.com/photo.jpg?size=large',alt:'Фото'});
  const p=normalizeSheets([detailed(data)]).catalog.points[0];expect(p.details?.photos).toEqual(data.photos.map(({url,alt})=>({url,alt})));
  const ready=JSON.parse(prepared(data));ready.data.photos=[{kind:'drive',fileId:'file_1',alt:'Фото'}];expect(readySchema.safeParse(ready).success).toBe(false);
 });
 it('does not invent missing partner, scale or ownership values for prepared venues',()=>{
  const p=point();expect(p.partnerTypes).toEqual(['Нет данных']);expect(p.scales).toEqual(['Нет данных']);expect(p.ownerships).toEqual(['Нет данных']);
 });
 it('uses the existing column aliases for prepared venue filters',()=>{
  const data=venue();data.specialties=['творчество/исскуство'];data.partnerTypes=['нужно ходить регулярно'];data.ownerships=['государственный'];
  const p=normalizeSheets([detailed(data)]).catalog.points[0];expect(p.specialties).toEqual(['Творчество и искусство']);expect(p.partnerTypes).toEqual(['Регулярные занятия']);expect(p.ownerships).toEqual(['Государственная']);
 });
});

describe('schedule and search semantics',()=>{
 it('uses Moscow calendar days and rolls a 28-day horizon without past sessions',()=>{
  const p=point();const slots=sessionsFor(p,[],now);expect(slots.length).toBeGreaterThan(0);expect(slots.every(s=>s.startsAt>now && s.startsAt<Date.parse('2026-12-09T00:00:00+03:00'))).toBe(true);
  expect(moscowDate(Date.parse('2026-11-11T21:30:00Z'))).toBe('2026-11-12');expect(sessionsFor(p,[],now+DAY).at(-1)!.startsAt).toBeGreaterThanOrEqual(slots.at(-1)!.startsAt);
 });
 it('matches age and time on the same group rather than combining different groups',()=>{
  const p=point();const senior=structuredClone(p.details!.activities[0]);senior.id='dancing';senior.direction='Танцы';senior.groups=senior.groups.filter(g=>g.minAge===12);senior.groups[0].trialCapacity=4;p.details!.activities.push(senior);
  expect(searchPoints([p],{...initialSearch(),age:'8',start:'19:00'},'',[],now)).toHaveLength(0);
  expect(searchPoints([p],{...initialSearch(),age:'12',start:'19:00'},'',[],now)).toHaveLength(1);
 });
 it('requires the full duration, accepts any selected day, and distinguishes free from unknown',()=>{
  const p=point();const group=p.details!.activities[0].groups[0];group.schedule=[{days:[3],start:'19:00',durationMinutes:60},{days:[4],start:'19:30',durationMinutes:60}];
  const filters={...initialSearch(),days:[3,4],start:'18:00',end:'20:00',maxPrice:'0'};
  expect(matchingSessions(p,filters,[],now).every(s=>s.weekday===3)).toBe(true);expect(matchingSessions(p,filters,[],now).length).toBeGreaterThan(0);
  group.trialPrice=null;expect(matchingSessions(p,filters,[],now)).toHaveLength(0);
 });
 it('includes references only when booking/group constraints are absent and applies radius',()=>{
  const ref=normalizeSheets([makeSheet([makeRow()])]).catalog.points[0];const p=point();
  expect(searchPoints([ref,p],initialSearch(),'',[],now)).toHaveLength(2);expect(searchPoints([ref,p],{...initialSearch(),bookableOnly:true},'',[],now)).toEqual([p]);
  const fromColumns=filterPoints([ref,p],{...emptyFilters(),specialties:ref.specialties},'');expect(searchPoints(fromColumns,initialSearch(),'',[],now)).toContainEqual(ref);
  const origin={latitude:p.latitude,longitude:p.longitude,label:'Дом',source:'osm-click' as const,acquiredAt:now};
  expect(searchPoints([ref,p],{...initialSearch(),bookableOnly:false,radiusKm:1},'',[],now,origin)).toEqual([p]);expect(searchPoints([ref,p],{...initialSearch(),bookableOnly:false,radiusKm:null},'',[],now,origin)).toHaveLength(2);
 });
 it('rejects invalid prepared ages, missing prices and sessions crossing midnight',()=>{
  const data=venue();data.activities[0].groups[0].maxAge=7;expect(readySchema.safeParse(JSON.parse(prepared(data))).success).toBe(false);
  data.activities[0].groups[0].maxAge=11;data.activities[0].groups[0].trialPrice=null;expect(readySchema.safeParse(JSON.parse(prepared(data))).success).toBe(false);
  data.activities[0].groups[0].trialPrice=0;data.activities[0].groups[0].schedule[0].start='23:30';expect(readySchema.safeParse(JSON.parse(prepared(data))).success).toBe(false);
 });
});

describe('local booking lifecycle',()=>{
 it('consumes the last seat, prevents duplicates, restores on cancellation and permits rebooking',()=>{
  const p=point();const slot=sessionsFor(p,[],now)[0];const booking=createBooking(p,slot.id,parent,[],now,'one');
  expect(sessionsFor(p,[booking],now).find(s=>s.id===slot.id)?.remaining).toBe(0);expect(()=>createBooking(p,slot.id,parent,[booking],now,'two')).toThrow();
  const cancelled=cancelBooking(booking,now);expect(sessionsFor(p,[cancelled],now).find(s=>s.id===slot.id)?.remaining).toBe(1);expect(createBooking(p,slot.id,parent,[cancelled],now,'two').status).toBe('confirmed');
  expect(()=>cancelBooking(booking,slot.startsAt)).toThrow();expect(()=>createBooking(p,slot.id,{...parent,age:15},[],now,'bad')).toThrow('Возраст');
 });
 it('retains snapshot terms through catalog changes and LocalStorage serialization',()=>{
  const p=point();const booking=createBooking(p,sessionsFor(p,[],now)[0].id,parent,[],now,'one');p.name='Переименовано';p.details!.activities=[];
  const data={...emptyData(),bookings:[booking],parent:{...parent,age:'9'}};const restored=parseLocalData(JSON.stringify(data));expect(restored.bookings[0].venueName).toBe('Палитра');expect(restored.parent.age).toBe('9');expect(restored.bookings[0].price).toBe(0);
 });
 it('requires separate attendance confirmation, one editable review and correct rating after deletion',()=>{
  const p=point();const booking=createPastExample(p,[],now,'past');let data={...emptyData(),bookings:[booking]};expect(booking.status).toBe('confirmed');expect(()=>saveReview(data,'past',5,'',now)).toThrow('подтвердите');
  data={...data,bookings:[confirmAttendance(booking,now)]};data=saveReview(data,'past',5,'',now);expect(ratingFor(p.id,[{rating:4}],data)).toEqual({rating:'4.5',count:2});
  data=saveReview(data,'past',1,'Изменён',now);expect(data.reviews).toHaveLength(1);expect(ratingFor(p.id,[{rating:4}],data).rating).toBe('2.5');data.reviews=[];expect(ratingFor(p.id,[{rating:4}],data).rating).toBe('4.0');
 });
 it('rejects broken stored data and orphan reviews instead of silently replacing history',()=>{
  expect(()=>parseLocalData('{')).toThrow();expect(()=>parseLocalData(JSON.stringify({...emptyData(),reviews:[{bookingId:'missing',rating:5,text:'',updatedAt:now}]}))).toThrow();expect(parseLocalData(null).bookings).toHaveLength(0);
 });
 it('expires geocoder coordinates after 30 days while retaining the parent-entered address',()=>{
  const data={...emptyData(),saved:{home:{latitude:55.75,longitude:37.6,label:'Мой адрес',source:'yandex-geocoder',acquiredAt:Date.now()-31*DAY}}};
  const restored=parseLocalData(JSON.stringify(data));expect(restored.saved.home).toBeUndefined();expect(restored.savedLabels.home).toBe('Мой адрес');
 });
});

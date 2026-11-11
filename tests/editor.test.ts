import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadRecord, saveRecord, validateReady } from '../apps-script/server';
import { demoVenues } from '../scripts/demo-venues';
import { editorHeaders } from '../shared/marketplace-model';
import { headings, makeRow } from './fixtures';
let rows: unknown[][];
const sheet = {
 getSheetId:()=>0,getName:()=> 'Пресненский',getLastColumn:()=>Math.max(...rows.map(row=>row.length)),getMaxColumns:()=>100,getLastRow:()=>rows.length,
 hideColumns:vi.fn(),insertColumnsAfter:vi.fn(),
 getRange:(row:number,column:number,height=1,width=1)=>({
  getValues:()=>Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>rows[row-1+r]?.[column-1+c]??'')),
  setValue:(value:unknown)=>{rows[row-1]??=[];rows[row-1][column-1]=value;},
  setValues:(values:unknown[][])=>values.forEach((line,r)=>line.forEach((value,c)=>{rows[row-1+r]??=[];rows[row-1+r][column-1+c]=value;})),
 }),
};
beforeEach(()=>{
 rows=[[...headings],makeRow()];let next=0;
 vi.stubGlobal('SpreadsheetApp',{getActive:()=>({getSheetById:()=>sheet}),flush:vi.fn()});
 vi.stubGlobal('Utilities',{getUuid:()=>`revision-${++next}`,DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_:unknown,value:string)=>Array.from(createHash('sha256').update(value).digest())});
 vi.stubGlobal('LockService',{getDocumentLock:()=>({waitLock:vi.fn(),releaseLock:vi.fn()})});
 vi.stubGlobal('PropertiesService',{getDocumentProperties:()=>({getProperty:()=>null})});
 vi.stubGlobal('UrlFetchApp',{fetch:()=>({getResponseCode:()=>404})});
});
const cell=(heading:string,row=1)=>rows[row][rows[0].indexOf(heading)];
describe('Sheets editor persistence',()=>{
 it('keeps an incomplete draft separate from ready content and detects competing writes',()=>{
  const opened=loadRecord(0,2);const incomplete={...structuredClone(demoVenues[0]),id:opened.data.id,name:''};
  const saved=saveRecord({...opened,data:incomplete,prepare:false});expect(cell(editorHeaders.ready)).toBeUndefined();expect(saved.data.name).toBe('');
  expect(()=>saveRecord({...opened,data:demoVenues[0],prepare:false})).toThrow('КОНФЛИКТ');
  expect(()=>saveRecord({...saved,prepare:true})).toThrow();
  const ready=saveRecord({...saved,data:{...demoVenues[0],id:saved.data.id},prepare:true});const json=cell(editorHeaders.ready);
  saveRecord({...ready,data:{...ready.data,name:'Рабочий черновик'},prepare:false});expect(cell(editorHeaders.ready)).toBe(json);expect(rows[1][0]).toBe('Палитра');expect(ready.publicationChecked).toBe(false);
 });
 it('creates new rows without exposing incomplete details and separates a selected branch',()=>{
  const initial=loadRecord(0,0);const saved=saveRecord({...initial,data:{...demoVenues[0],id:initial.data.id},prepare:false});expect(saved.rowNumber).toBe(3);expect(cell(editorHeaders.isNew,2)).toBe(true);expect(cell(editorHeaders.ready,2)).toBeUndefined();
  rows=[[...headings],makeRow({coordinates:'55.75,37.6;55.76,37.61'})];const multi=loadRecord(0,2);expect(multi.branches).toHaveLength(2);
  const result=saveRecord({...multi,data:{...demoVenues[0],id:multi.data.id,legacyIds:[multi.branches[1].legacyId]},prepare:true});expect(result.rowNumber).toBe(3);expect(rows[1][7]).toBe('55.75,37.6;55.76,37.61');
 });
 it('publishes archival state without deleting spreadsheet data',()=>{
  const initial=loadRecord(0,0);const ready=saveRecord({...initial,data:{...demoVenues[0],id:initial.data.id},prepare:true});
  const archived=saveRecord({...ready,archived:true,prepare:true});expect(archived.archived).toBe(true);expect(archived.data.activities).toHaveLength(1);expect(JSON.parse(String(cell(editorHeaders.ready,2))).archived).toBe(true);
  const restored=saveRecord({...archived,archived:false,prepare:true});expect(restored.archived).toBe(false);
 });
 it('uses the same publication validation as the import',()=>{
  const data=structuredClone(demoVenues[0]);data.activities[0].groups[0].trialPrice=null;expect(()=>validateReady(data,false,'v1')).toThrow('trialPrice');
 });
});

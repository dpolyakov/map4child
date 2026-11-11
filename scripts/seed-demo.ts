import { sheets } from '@googleapis/sheets';
import { randomUUID } from 'node:crypto';
import { googleAuth, spreadsheetIdFromUrl } from './google-sheets';
import { demoVenues } from './demo-venues';
import { editorHeaders, readySchema } from '../shared/marketplace-model';
const spreadsheetId = spreadsheetIdFromUrl(process.env.GOOGLE_SHEET_URL ?? '');
const client = sheets({version:'v4',auth:googleAuth(['https://www.googleapis.com/auth/spreadsheets'])});
try {
 const metadata=await client.spreadsheets.get({spreadsheetId,fields:'sheets(properties)'});
 const sheet=metadata.data.sheets?.find(value=>value.properties?.sheetId===0)?.properties;
 if(!sheet?.title)throw new Error('Не найден Пресненский лист.');
 const range=`'${sheet.title.replaceAll("'","''")}'!A:AZ`;
 const response=await client.spreadsheets.values.get({spreadsheetId,range});const rows=response.data.values??[];
 const width=Math.max(10,...rows.map(row=>row.length));const headers=Array.from({length:width},(_,i)=>String(rows[0]?.[i]??''));
 const ids=new Set(rows.slice(1).map(row=>row[headers.indexOf(editorHeaders.id)]));
 const added=demoVenues.filter(venue=>!ids.has(venue.id));if(!added.length){console.log('Демонстрационные площадки уже есть; данные не изменены.');process.exit(0);}
 const missing=Object.values(editorHeaders).filter(value=>!headers.includes(value));headers.push(...missing);
 const newRows=added.map(data=>{const row=Array(headers.length).fill('');const revision=randomUUID();const json=JSON.stringify(readySchema.parse({schemaVersion:1,revision,archived:false,data}));row[headers.indexOf(editorHeaders.id)]=data.id;row[headers.indexOf(editorHeaders.draft)]=json;row[headers.indexOf(editorHeaders.ready)]=json;row[headers.indexOf(editorHeaders.revision)]=revision;row[headers.indexOf(editorHeaders.isNew)]='true';const name=headers.findIndex(value=>value.toLowerCase()==='название студии');if(name>=0)row[name]=`${data.name} · ДЕМО`;return row;});
 const latest=await client.spreadsheets.values.get({spreadsheetId,range});if(JSON.stringify(latest.data.values??[])!==JSON.stringify(rows))throw new Error('Таблица изменилась во время подготовки. Повторите запуск.');
 const requests:any[]=[];
 if(headers.length>(sheet.gridProperties?.columnCount??0))requests.push({appendDimension:{sheetId:0,dimension:'COLUMNS',length:headers.length-(sheet.gridProperties?.columnCount??0)}});
 if(rows.length+newRows.length>(sheet.gridProperties?.rowCount??0))requests.push({appendDimension:{sheetId:0,dimension:'ROWS',length:rows.length+newRows.length-(sheet.gridProperties?.rowCount??0)}});
 const cells=(row:string[])=>({values:row.map(value=>({userEnteredValue:{stringValue:value}}))});
 if(missing.length){requests.push({updateCells:{range:{sheetId:0,startRowIndex:0,endRowIndex:1,startColumnIndex:width,endColumnIndex:headers.length},rows:[cells(missing)],fields:'userEnteredValue'}});requests.push({updateDimensionProperties:{range:{sheetId:0,dimension:'COLUMNS',startIndex:width,endIndex:headers.length},properties:{hiddenByUser:true},fields:'hiddenByUser'}});}
 requests.push({updateCells:{range:{sheetId:0,startRowIndex:rows.length,endRowIndex:rows.length+newRows.length,startColumnIndex:0,endColumnIndex:headers.length},rows:newRows.map(cells),fields:'userEnteredValue'}});
 await client.spreadsheets.batchUpdate({spreadsheetId,requestBody:{requests}});
 console.log(`Добавлено ${added.length} демонстрационных площадок в существующий лист. Ранее заполненные строки сохранены. Публикация запускается вручную.`);
}catch(error:any){console.error(error.response?`Google Sheets: запрос не выполнен (${error.response.status}, ${error.response.data?.error?.status??'API error'}). Данные не опубликованы.`:error.message);process.exitCode=1;}

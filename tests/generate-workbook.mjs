import fs from 'node:fs';
import {baseline}from '../src/engine/scenario.js';import{simulate,compare}from '../src/engine/simulation.js';
// The fallback API is imported explicitly; this does NOT assert ExcelJS was installed.
const source=fs.readFileSync(new URL('../src/export/workbook.js',import.meta.url),'utf8').replace("from 'exceljs'","from '../vendor/offline-workbook.js'");
const temporary=new URL('../src/verify-workbook-temp.js',import.meta.url);fs.writeFileSync(temporary,source);
try{
 const {approvalWorkbook}=await import(temporary.href+'?v='+Date.now());
 const p=JSON.parse(fs.readFileSync(new URL('../public/data/source/B203_Web_Implementation_Data_v2_20261016.json',import.meta.url))),records=JSON.parse(fs.readFileSync(new URL('../src/data/qualityInspectionRecords.json',import.meta.url)));
 fs.mkdirSync(new URL('../docs/verification/',import.meta.url),{recursive:true});
 for(const changed of [false,true]){
  const s=baseline(p);if(changed){s.scenarioId='CHANGED-INPUT-EXPORT';s.budget=29000000;s.rates.overtime=60000;}
  const r=simulate(s,records),wb=approvalWorkbook(s,r,compare(s,records));
  const name=changed?'changed-budget-request':'baseline-budget-request';
  fs.writeFileSync(new URL('../docs/verification/'+name+'.xlsx',import.meta.url),await wb.xlsx.writeBuffer());
  fs.writeFileSync(new URL('../docs/verification/'+name+'.json',import.meta.url),JSON.stringify({input:s,result:r},null,2));
  console.log(name,r.total,r.budgetRemaining);
 }
}finally{fs.unlinkSync(temporary);}

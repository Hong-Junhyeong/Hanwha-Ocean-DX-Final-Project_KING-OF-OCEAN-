// Read only: inspect actual browser-download bytes using the existing ExcelJS dependency.
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),folder=path.join(root,'docs/phase6-browser');
const checks=[];
for(const [file,snapshot]of [['approval-baseline.xlsx','baseline.json'],['approval-changed.xlsx','rate60.json']]){
 const {input:s,result:r,comparison}=JSON.parse(fs.readFileSync(path.join(folder,snapshot),'utf8'));
 const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(path.join(folder,file));
 assert.deepEqual(wb.worksheets.map(s=>s.name),['예산 집행 승인 요청서','노무비 산출 상세','시나리오 비교','계산 근거 및 가정']);
 const request=wb.worksheets[0],detail=wb.worksheets[1];
 for(const [cell,value]of [['B6',s.scenarioId],['B10',r.name],['B11',s.budget],['B12',s.baseCost],['B13',r.incremental],['B14',r.total],['B15',r.budgetRemaining],['B16',r.handover]])assert.equal(request.getCell(cell).value,value,`${file} ${cell}`);
 for(let i=18;i<=22;i++)assert.ok(['',null].includes(request.getCell(`B${i}`).value));
 let sum=0;
 for(let i=0;i<r.costs.length;i++){const row=detail.getRow(i+2),source=r.costs[i];assert.equal(row.getCell(7).value.formula,`E${i+2}*F${i+2}`);assert.equal(row.getCell(7).value.result??0,source.mh);assert.equal(row.getCell(12).value.result??0,source.subtotal);sum+=source.subtotal;}
 assert.equal(sum,r.incremental);assert.equal(detail.getRow(detail.rowCount).getCell(12).value.result,r.total);
 const compareRows=[];wb.worksheets[2].eachRow((row,i)=>{if(i>1)compareRows.push(row.values.slice(1));});
 const selected=compareRows.find(row=>row[0]===r.strategy);assert.equal(selected[5],r.handover);assert.equal(selected[8],r.total);assert.equal(selected[9],r.budgetRemaining);
 for(const row of compareRows){const original=comparison.find(r=>r.strategy===row[0]);assert.equal(row[8],original.total);}
 let storedInput;wb.worksheets[3].eachRow(row=>{if(row.getCell(1).value==='전체 입력 스냅샷')storedInput=JSON.parse(row.getCell(2).value);});assert.deepEqual(storedInput,s);
 checks.push({file,selectedStrategy:r.strategy,scenarioId:s.scenarioId,total:r.total,incremental:r.incremental,budgetRemaining:r.budgetRemaining,handover:r.handover,fourSheets:true,costLineCount:r.costs.length,approvalFieldsBlank:true,fullPrecisionMatched:true});
}
const history=new ExcelJS.Workbook();await history.xlsx.readFile(path.join(folder,'inspection-history.xlsx'));assert.equal(history.worksheets[0].rowCount,1201);
const summary=new ExcelJS.Workbook();await summary.xlsx.readFile(path.join(folder,'quality-summary.xlsx'));assert.deepEqual([3,4,6].map(col=>summary.worksheets[0].getRow(2).getCell(col).value),[1200,72,54]);
fs.writeFileSync(path.join(folder,'workbook-verification.json'),JSON.stringify({checks,qualityRecords:1200,qualityCounts:[1200,72,54]},null,2));console.log('PASS downloaded approval sheets, current input snapshots, formulas, totals, selected rows and 1200 quality records');

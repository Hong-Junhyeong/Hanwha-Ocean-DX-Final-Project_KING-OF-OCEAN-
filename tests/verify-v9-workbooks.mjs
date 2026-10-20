import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';import JSZip from 'jszip';
import {financialBreakdown} from '../src/ui/simulationSummary.js';import{REPORT_SHEETS}from'../src/export/approvalReport.js';import{validateAssemblyPlaybackPlan}from'../src/playback/index.js';
const out=path.resolve('docs/phase9/regression'),reports=[];
const near=(a,b,label)=>assert.ok(typeof a==='number'&&Math.abs(a-b)<1e-4,`${label}: ${a} != ${b}`);
function evaluator(w){
 const cache=new Map(),busy=new Set();
 const cells=(sheet,range)=>{const m=range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);assert.ok(m,'bounded range');const ws=w.getWorksheet(sheet),a=ws.getColumn(m[1]).number,b=ws.getColumn(m[3]).number,values=[];for(let r=+m[2];r<=+m[4];r++)for(let c=a;c<=b;c++)values.push(value(sheet,ws.getCell(r,c).address));return values;};
 const value=(sheet,address)=>{const key=sheet+'!'+address;if(cache.has(key))return cache.get(key);assert.ok(!busy.has(key),'circular reference '+key);busy.add(key);const cell=w.getWorksheet(sheet).getCell(address);let result=cell.value;
  if(cell.type===ExcelJS.ValueType.Formula){let formula=cell.formula;const conditional=formula.match(/^IF\(([A-Z]+\d+)=0,"([^"]*)",([^)]+)\)$/);if(conditional){if(value(sheet,conditional[1])===0){assert.equal(cell.result,conditional[2]);cache.set(key,conditional[2]);busy.delete(key);return conditional[2];}formula=conditional[3];}
   formula=formula.replace(/SUMIF\(([A-Z]+\d+:[A-Z]+\d+),"([^"]+)",([A-Z]+\d+:[A-Z]+\d+)\)/g,(_,a,criterion,b)=>{const labels=cells(sheet,a),nums=cells(sheet,b);return String(nums.reduce((n,v,i)=>n+(labels[i]===criterion?Number(v):0),0));});
   formula=formula.replace(/SUM\(([^()]+)\)/g,(_,args)=>String(args.split(',').reduce((n,x)=>n+cells(sheet,x.trim()).reduce((t,v)=>t+Number(v||0),0),0)));
   formula=formula.replace(/'([^']+)'!([A-Z]+\d+)/g,(_,tab,ref)=>String(value(tab,ref)));
   formula=formula.replace(/(?<![\w.])([A-Z]+\d+)(?!\w)/g,(_,ref)=>String(value(sheet,ref)));
   assert.match(formula,/^[\d.eE+\-*/()\s]+$/,'supported formula '+cell.formula);result=Function('return ('+formula+')')();near(result,cell.result,key+' cache vs recalculation');
  }
  busy.delete(key);cache.set(key,result);return result;
 };return {value};
}

for(const [bookName,snapshot]of [['baseline','baseline'],['custom-overtime','custom-overtime'],['rate-change','rate-change'],['budget-change','budget-change'],['internal-support','internal-support'],['zero-budget','zero-budget']]){
 const data=JSON.parse(fs.readFileSync(path.join(out,snapshot+'.json'))),{input:s,result:r,comparison,playbackPlan}=data,cost=financialBreakdown(r);
 const filename=path.join(out,'approval-'+bookName+'.xlsx'),w=new ExcelJS.Workbook();await w.xlsx.readFile(filename);assert.deepEqual(w.worksheets.map(x=>x.name),REPORT_SHEETS);
 const [q,d,c,b]=w.worksheets,ev=evaluator(w);let formulaCount=0;
 for(const sheet of w.worksheets)sheet.eachRow(row=>row.eachCell(cell=>{if(cell.type===ExcelJS.ValueType.Formula){ev.value(sheet.name,cell.address);formulaCount++;}assert.ok(!['#REF!','#VALUE!','#DIV/0!','#NAME?','#NUM!'].includes(String(cell.value)));}));
 for(const [cell,expected]of [['A17',s.budget],['D17',r.total],['G17',r.budgetRemaining],['I18',r.incremental],['I29',cost.labor],['I30',r.incremental]]){near(q.getCell(cell).result,expected,bookName+' '+cell);assert.match(q.getCell(cell).formula,/^'노무비 산출 상세'!C\d+$/);}
 if(s.budget)near(q.getCell('J17').result,r.total/s.budget,'budget ratio');else assert.equal(q.getCell('J17').result,'미산출');
 assert.equal(q.getCell('A2').value,'노무비 예산 보고서');for(const [cell,label]of [['A9','1. 프로젝트 개요'],['A15','2. 예산 요약'],['A20','3. 항목별 노무비 예산'],['A32','4. 집행 계획 및 흐름'],['A42','5. 주요 내용 및 특이사항']])assert.equal(q.getCell(cell).value,label);
 assert.equal(q.getCell('I5').value,`${r.strategy} · ${r.name}`);assert.equal(q.getCell('G6').value,s.scenarioId);assert.ok(q.getCell('C11').value.includes(s.blockId));assert.ok(q.getCell('C13').value instanceof Date);assert.equal(q.getCell('C13').value.toISOString(),new Date(Date.parse(s.start)+9*3600000).toISOString());assert.equal(q.getCell('I40').value.toISOString(),new Date(Date.parse(r.handover)+9*3600000).toISOString());
 for(const cell of ['G3','I3','K3','I12'])assert.equal(q.getCell(cell).value,null);assert.equal(q.getCell('A6').value,'시뮬레이션 산출 / 검토 및 승인 필요');assert.equal(q.pageSetup.printArea,'A1:L49');assert.equal(q.pageSetup.paperSize,9);assert.equal(q.pageSetup.orientation,'portrait');
 const chartZip=await JSZip.loadAsync(fs.readFileSync(filename)),chart=await chartZip.file('xl/charts/chart1.xml').async('string');assert.match(chart,/barChart/);assert.match(chart,/일별 추가비용 집행 계획/);assert.match(chart,/\$E\$35:/);assert.match(await chartZip.file('xl/worksheets/sheet1.xml').async('string'),/rIdExecutionChart/);assert.match(await chartZip.file('xl/workbook.xml').async('string'),/fullCalcOnLoad="1"/);
 near(q.getCell('E39').result,r.incremental,'execution plan reconciliation');const dates=[];for(let row=35;row<=38;row++){if(q.getCell(row,1).value)dates.push(q.getCell(row,1).value);}assert.ok(dates.every(v=>/^2026-\d\d-\d\d$/.test(v)||v==='기간 미배분'||v==='추가 집행 없음'));
 const currentRow=6+comparison.findIndex(x=>x.strategy===r.strategy);near(c.getCell(currentRow,7).value,cost.labor,'comparison labor');near(c.getCell(currentRow,9).value,r.total,'comparison total');
 const pieces=[];b.eachRow(row=>{if(String(row.getCell(1).value).startsWith('전체 입력 스냅샷')||String(row.getCell(1).value).startsWith('입력 스냅샷 계속'))pieces.push(row.getCell(2).value);});assert.deepEqual(JSON.parse(pieces.join('')),s);
 assert.equal(validateAssemblyPlaybackPlan(playbackPlan).valid,true);assert.equal(playbackPlan.expectedHandover,r.handover);near(playbackPlan.financialSnapshot.total,r.total,'playback finance');
 reports.push({case:bookName,strategy:r.strategy,total:r.total,incremental:r.incremental,budgetRemaining:r.budgetRemaining,formulasIndependentlyRecalculated:formulaCount,nativeChart:true,sections:5,blankApprovals:true,currentPlaybackMatches:true});
}
fs.writeFileSync('docs/phase9/workbook-verification.json',JSON.stringify(reports,null,2));console.log(reports);

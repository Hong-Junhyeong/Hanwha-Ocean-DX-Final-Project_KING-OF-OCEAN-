import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {financialBreakdown} from '../src/ui/simulationSummary.js';
import {REPORT_SHEETS} from '../src/export/approvalReport.js';
const out=path.resolve('docs/phase7/browser'),reports=[];
const near=(a,b,label)=>assert.ok(typeof a==='number'&&Math.abs(a-b)<1e-5,`${label}: ${a} != ${b}`);
// Independent evaluation of the generated, bounded product/SUM/SUMIF/link
// formulas. No cached value is treated as recalculation evidence.
function evaluator(w){
 const cache=new Map(),busy=new Set();
 const cells=(sheet,range)=>{const m=range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);assert.ok(m,'bounded range');const ws=w.getWorksheet(sheet),a=ws.getColumn(m[1]).number,b=ws.getColumn(m[3]).number,values=[];for(let r=+m[2];r<=+m[4];r++)for(let c=a;c<=b;c++)values.push(value(sheet,ws.getCell(r,c).address));return values;};
 const value=(sheet,address)=>{const key=sheet+'!'+address;if(cache.has(key))return cache.get(key);assert.ok(!busy.has(key),'circular reference '+key);busy.add(key);const cell=w.getWorksheet(sheet).getCell(address);let result=cell.value;
  if(cell.type===ExcelJS.ValueType.Formula){let formula=cell.formula;
   formula=formula.replace(/SUMIF\(([A-Z]+\d+:[A-Z]+\d+),"([^"]+)",([A-Z]+\d+:[A-Z]+\d+)\)/g,(_,a,criterion,b)=>{const labels=cells(sheet,a),nums=cells(sheet,b);return String(nums.reduce((n,v,i)=>n+(labels[i]===criterion?Number(v):0),0));});
   formula=formula.replace(/SUM\(([^()]+)\)/g,(_,args)=>String(args.split(',').reduce((n,x)=>n+cells(sheet,x.trim()).reduce((t,v)=>t+Number(v||0),0),0)));
   formula=formula.replace(/'([^']+)'!([A-Z]+\d+)/g,(_,tab,ref)=>String(value(tab,ref)));
   formula=formula.replace(/(?<![\w.])([A-Z]+\d+)(?!\w)/g,(_,ref)=>String(value(sheet,ref)));
   assert.match(formula,/^[\d.eE+\-*/()\s]+$/,'supported formula '+cell.formula);result=Function('return ('+formula+')')();near(result,cell.result,key+' cache vs recalculation');
  }
  busy.delete(key);cache.set(key,result);return result;
 };return {value};
}
for(const [bookName,snapshot]of [['baseline','baseline'],['custom-overtime','custom-overtime'],['rate-change','rate-change'],['budget-change','budget-change'],['internal-support','internal-support']]){
 const data=JSON.parse(fs.readFileSync(path.join(out,snapshot+'.json'))),{input:s,result:r,comparison}=data,cost=financialBreakdown(r);
 const w=new ExcelJS.Workbook();await w.xlsx.readFile(path.join(out,'approval-'+bookName+'.xlsx'));assert.deepEqual(w.worksheets.map(x=>x.name),REPORT_SHEETS);
 const [q,d,c,b]=w.worksheets,ev=evaluator(w);let formulaCount=0;
 for(const sheet of w.worksheets)sheet.eachRow(row=>row.eachCell(cell=>{if(cell.type===ExcelJS.ValueType.Formula){ev.value(sheet.name,cell.address);formulaCount++;}assert.ok(!['#REF!','#VALUE!','#DIV/0!','#NAME?','#NUM!'].includes(String(cell.value)),'no formula error');}));
 for(const [cell,expected]of [['E17',s.baseCost],['E18',cost.overtime],['E19',cost.support],['E20',cost.labor],['E21',cost.qc],['E22',cost.other],['E23',r.incremental],['E24',r.total],['E25',s.budget],['E26',r.budgetRemaining]]){near(q.getCell(cell).result,expected,bookName+' '+cell);assert.match(q.getCell(cell).formula,/^'노무비 산출 상세'!C\d+$/);}
 assert.equal(q.getCell('B9').value,`${r.strategy} · ${r.name}`);assert.equal(q.getCell('F7').value,s.scenarioId);assert.equal(q.getCell('B7').value,s.blockId);assert.ok(q.getCell('B8').value instanceof Date);assert.ok(q.getCell('F29').value instanceof Date);assert.equal(q.getCell('F29').value.toISOString(),new Date(Date.parse(r.handover)+9*3600000).toISOString());
 assert.equal(q.pageSetup.paperSize,9);assert.equal(q.pageSetup.orientation,'portrait');assert.equal(q.pageSetup.fitToWidth,1);assert.equal(q.pageSetup.printArea,'A1:H38');assert.equal(d.pageSetup.orientation,'landscape');assert.equal(c.pageSetup.orientation,'landscape');const zip=await JSZip.loadAsync(fs.readFileSync(path.join(out,'approval-'+bookName+'.xlsx')));assert.match(await zip.file('xl/workbook.xml').async('string'),/fullCalcOnLoad="1"/);
 for(const cell of ['A35','C35','E35','G35','B36'])assert.equal(q.getCell(cell).value,null,'approval blank');assert.equal(q.getCell('A3').value,'시뮬레이션 산출 / 검토 및 승인 필요');
 const currentRow=6+comparison.findIndex(x=>x.strategy===r.strategy);near(c.getCell(currentRow,7).value,cost.labor,'comparison labor');near(c.getCell(currentRow,8).value,cost.qc+cost.other,'comparison QC-other');near(c.getCell(currentRow,9).value,r.total,'comparison total');assert.equal(c.getCell(currentRow,1).value,r.strategy);assert.equal(c.getRow(currentRow).fill.fgColor.argb,'FFFFF0E3');
 const pieces=[];b.eachRow(row=>{if(String(row.getCell(1).value).startsWith('전체 입력 스냅샷')||String(row.getCell(1).value).startsWith('입력 스냅샷 계속'))pieces.push(row.getCell(2).value);});assert.deepEqual(JSON.parse(pieces.join('')),s,'complete current snapshot');
 reports.push({case:bookName,strategy:r.strategy,reworkMH:r.reworkMH,labor:cost.labor,qc:cost.qc,other:cost.other,incremental:r.incremental,total:r.total,budgetRemaining:r.budgetRemaining,formulasIndependentlyRecalculated:formulaCount,approvalBlank:true,print:'A4 portrait summary; landscape support',snapshotMatches:true});
}
fs.writeFileSync('docs/phase7/workbook-verification.json',JSON.stringify(reports,null,2));console.log('Five downloaded workbooks independently recalculated and verified',reports);

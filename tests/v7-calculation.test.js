import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {baseline} from '../src/engine/scenario.js';
import {simulate,compare} from '../src/engine/simulation.js';
import {createSimulationSession} from '../src/ui/riskState.js';
import {financialBreakdown,qualityBasis,laborBasis,workforceBasis} from '../src/ui/simulationSummary.js';
import {approvalWorkbook,REPORT_CELLS} from '../src/export/approvalReport.js';
const project=JSON.parse(fs.readFileSync(new URL('../public/data/source/B203_Web_Implementation_Data_v2_20261016.json',import.meta.url)));
const rows=JSON.parse(fs.readFileSync(new URL('../src/data/qualityInspectionRecords.json',import.meta.url)));
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('V7 quality models derive independent expected physical quantities',()=>{
 const s=baseline(project);for(const [mode,mh]of [['12M',6.499203778677463],['6M',7.151393188854489],['WEIGHTED',6.955736365801381],['NONE',0]]){s.qualityMode=mode;const r=simulate(s,rows);near(r.reworkMH,mh);assert.ok(qualityBasis(s,r).text);}
 s.qualityMode='CUSTOM';s.customReworkMH=12;near(simulate(s,rows).reworkMH,12);s.qualityMode='CONFIRMED';s.confirmedReworks=[{id:'confirmed-input',mh:4,status:'CONFIRMED'},{id:'resolved-input',mh:8,status:'RESOLVED'}];near(simulate(s,rows).reworkMH,4);
});
test('V7 relevant pending count and standard MH alter workload; unrelated inputs do not',()=>{const s=baseline(project),base=simulate(s,rows);for(const change of [{outageHours:2},{rates:{...s.rates,overtime:60000}},{budget:1},{overtimeHours:4}])near(simulate({...s,...change},rows).reworkMH,base.reworkMH);const a=structuredClone(s);a.pending.WELD*=2;assert.ok(simulate(a,rows).reworkMH>base.reworkMH);a.standards.WELD*=2;assert.ok(simulate(a,rows).reworkMH>base.reworkMH);});
test('V7 complete workforce round trip and result round trip are exact',()=>{
 const session=createSimulationSession(baseline(project),rows),before=session.draft,applied=session.applied,result=session.result;
 session.change('workers',4);session.run();assert.equal(session.draft.overtimeWorkers,5);assert.equal(session.applied.overtimeWorkers,4);assert.equal(session.applied.reworkWorkers,4);assert.equal(session.applied.affectedWorkers,4);assert.match(workforceBasis(session.applied),/입력 5명 → 계산 4명/);near(session.result.reworkMH,result.reworkMH);
 const imported=createSimulationSession(session.applied,rows);imported.change('workers',5);imported.run();assert.deepEqual(imported.draft,before);
 session.change('workers',5);session.run();assert.deepEqual(session.draft,before);assert.deepEqual(session.applied,applied);assert.deepEqual(session.result,result);
});
test('V7 fixed overtime cost and current explanations; custom actual paid inputs',()=>{const s=baseline(project),r=simulate(s,rows);near(financialBreakdown(r).labor,675000);near(financialBreakdown(r).qc,50000);near(r.incremental,725000);assert.match(laborBasis(r),/A2/);assert.match(laborBasis(r),/5명 × 인당 3h/);s.qualityMode='6M';near(financialBreakdown(simulate(s,rows)).overtime,675000);s.selectedStrategy='A';s.overtimeWorkers=4;s.overtimeHours=4;s.rates.overtime=60000;near(financialBreakdown(simulate(s,rows)).overtime,960000);});
test('V7 fractional workforce preference cannot be hidden by effective cap',()=>{const session=createSimulationSession(baseline(project),rows);session.change('workers',4);session.change('overtimeWorkers',5.5);assert.throws(()=>session.run(),/정수/);assert.throws(()=>session.assertExportable());});
test('V7 QC-only calendar wait adds no production crew wage; approval wait is unpriced',()=>{const s=baseline(project);s.qualityMode='CUSTOM';s.customReworkMH=0.5;s.selectedStrategy='A2';s.qcUnavailable=[{start:'2026-10-14T13:00:00+09:00',end:'2026-10-15T12:00:00+09:00'}];const r=simulate(s,rows);const regular=r.costs.find(c=>c.category==='납기 이후 추가 정규 대응');assert.ok(!regular||regular.mh<7);const a=baseline(project);a.approvalHours=2;const base=simulate(baseline(project),rows),delayed=simulate(a,rows);near(financialBreakdown(delayed).qc,financialBreakdown(base).qc);assert.ok(delayed.missingCosts.some(x=>x.includes('승인 대기')));});
test('V7 four-sheet formulas and financial categories match selected engine results',async()=>{
 const s=baseline(project);for(const strategy of ['A2','A','B1','C2','N']){s.selectedStrategy=strategy;const r=simulate(s,rows),cost=financialBreakdown(r),w=approvalWorkbook(s,r,compare(s,rows)),d=w.worksheets[1],q=w.worksheets[0];assert.equal(w.worksheets.length,4);near(d.getCell('C10').result,cost.labor);near(d.getCell('C11').result,cost.qc);near(d.getCell('C12').result,cost.other);near(d.getCell('C13').result,r.incremental);near(q.getCell(REPORT_CELLS.request.total).result,r.total);assert.match(q.getCell('I29').value.formula,/ノ|노무비 산출 상세/);for(const address of ['I29','I23','I24','I18','D17','G17'])assert.match(q.getCell(address).value.formula,/노무비 산출 상세/);for(const address of ['G3','I3','K3','I12'])assert.equal(q.getCell(address).value,null);assert.equal(q.pageSetup.orientation,'portrait');assert.equal(q.pageSetup.paperSize,9);assert.equal(w.calcProperties.fullCalcOnLoad,true);const bytes=await w.xlsx.writeBuffer();assert.ok(bytes.length>12000);}
});

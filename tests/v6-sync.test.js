import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {baseline} from '../src/engine/scenario.js';
import {simulate} from '../src/engine/simulation.js';
import {createSimulationSession,createAutoCalculation,strategyForEdit,prioritize} from '../src/ui/riskState.js';
import {approvalWorkbook} from '../src/export/workbook.js';
import {renderHeader} from '../src/components/layout.js';
import {createStore} from '../src/state.js';
const p=JSON.parse(fs.readFileSync(new URL('../public/data/source/B203_Web_Implementation_Data_v2_20261016.json',import.meta.url)));
const records=JSON.parse(fs.readFileSync(new URL('../src/data/qualityInspectionRecords.json',import.meta.url)));
const session=()=>createSimulationSession(baseline(p),records);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('V6 debounce commits latest input exactly once; stale export blocked while pending',async()=>{
 const s=session();let commits=0;const auto=createAutoCalculation(s,{delay:25,onSuccess:()=>commits++});
 for(const value of [130,135,140]){s.change('remaining',value);auto.schedule();}
 assert.throws(()=>s.assertExportable());await wait(120);
 assert.equal(commits,1);assert.equal(s.result.remainingOriginal,140);assert.equal(s.appliedVersion,s.version);s.assertExportable();
});
test('V6 composition pauses engine until composition end',async()=>{const s=session();let n=0;const auto=createAutoCalculation(s,{delay:10,onSuccess:()=>n++});auto.composition(true);s.change('scenarioId','한글 입력');auto.schedule();await wait(30);assert.equal(n,0);auto.composition(false);auto.schedule();await wait(100);assert.equal(n,1);assert.equal(s.applied.scenarioId,'한글 입력');});
test('V6 invalid unfinished input preserved and cannot export; corrected input recovers',async()=>{const s=session();let errors=0;const before=s.result;const auto=createAutoCalculation(s,{delay:10,onError:()=>errors++});s.change('workers',null);auto.schedule();await wait(50);assert.equal(errors,1);assert.equal(s.draft.workers,null);assert.equal(s.result,before);assert.throws(()=>s.assertExportable());s.change('workers',4);auto.schedule(true);await wait(100);assert.equal(s.applied.workers,4);s.assertExportable();});
test('V6 canceled obsolete calculations cannot replace reset',async()=>{const s=session();const auto=createAutoCalculation(s,{delay:40});s.change('remaining',200);auto.schedule();auto.cancel();s.reset(baseline(p));await wait(80);assert.equal(s.result.remainingOriginal,120);assert.equal(s.result.total,29525000);});
test('V6 fixed A1/A2 preserved; OT-specific edits route only selection to custom A',()=>{for(const id of ['A1','A2'])for(const path of ['overtimeHours','overtimeWorkers','overtimeDates','overtimeApproved'])assert.equal(strategyForEdit(id,path),'A');assert.equal(strategyForEdit('A2','rates.overtime'),'A2');const s=baseline(p);s.overtimeHours=4;assert.equal(simulate(s,records,'A1').otHours,2.5);assert.equal(simulate(s,records,'A2').otHours,3);assert.equal(simulate(s,records,'A').otHours,4);});
test('V6 strategy-specific comparison changes without overwriting selected response',()=>{const s=session(),before=s.comparison.find(r=>r.strategy==='B1').total;s.change('internalWorkers',2);s.run();assert.notEqual(s.comparison.find(r=>r.strategy==='B1').total,before);assert.equal(s.result.strategy,'A2');assert.equal(s.applied.selectedStrategy,'A2');const selected=s.result.strategy;prioritize(s.comparison,s.applied);assert.equal(s.result.strategy,selected);});
test('V6 selected result, comparison, costs and four-sheet workbook share current snapshot',async()=>{const s=session();s.change('remaining',140);s.change('rates.overtime',60000);s.change('budget',29000000);s.run();for(const id of ['N','A','B1','C2']){s.select(id);const r=s.result,c=s.comparison.find(row=>row.strategy===id);assert.equal(r.total,c.total);assert.equal(r.handover,c.handover);assert.equal(r.incremental,r.costs.reduce((n,c)=>n+c.subtotal,0));assert.equal(r.total,s.applied.baseCost+r.incremental);const wb=approvalWorkbook(s.applied,r,s.comparison);assert.equal(wb.worksheets.length,4);assert.equal(wb.worksheets[0].getCell('D17').value.result,r.total);assert.equal(wb.worksheets[0].getCell('G17').value.result,r.budgetRemaining);assert.equal(wb.worksheets[0].getCell('I40').value.toISOString(),new Date(Date.parse(r.handover)+9*3600000).toISOString());assert.equal(wb.worksheets[0].getCell('I5').value,`${r.strategy} · ${r.name}`);}});
test('V6 budget and rate edits do not change physical schedule',()=>{const s=session(),handover=s.result.handover;s.change('budget',29000000);s.run();assert.equal(s.result.handover,handover);s.change('rates.overtime',60000);s.run();assert.equal(s.result.handover,handover);assert.equal(s.result.budgetRemaining,-750000);});
test('V6 header presentation removal leaves block/facility selection state intact',()=>{const store=createStore();store.selectBlock('B-203');const header=renderHeader(store.getState());assert.ok(!header.includes('meta-selection'));assert.equal(store.getState().selectedBlock,'B-203');assert.equal(store.getState().selectedFacility,'B_ZONE');});
test('V6 form-only validation guard prevents unrelated edits releasing old outputs',()=>{const s=session();let incomplete=true;const auto=createAutoCalculation(s,{beforeRun:()=>{if(incomplete)throw Error('작업일 입력 필요');}});s.change('budget',31000000);assert.equal(auto.run(),false);assert.throws(()=>s.assertExportable());incomplete=false;assert.equal(auto.run(),true);s.assertExportable();});

import {clock} from '../engine/calendar.js';
const clamp=x=>Math.max(0,Math.min(1,x));
// Using epoch endpoints avoids the legacy engine's subsecond ISO truncation.
const fraction=(segment,t)=>clamp((t-segment.startEpochHours)/(segment.endEpochHours-segment.startEpochHours));
const productive=segment=>segment.workedOriginalMH+segment.workedReworkMH>0;
export function getPlaybackStateAt(plan,productionTimestamp){
 const parsed=clock(productionTimestamp);if(typeof productionTimestamp!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(productionTimestamp)||!Number.isFinite(parsed))throw Error('시간대가 있는 유효한 재생 시각이 필요합니다.');
 // Existing engine ISO labels are whole-second truncated. A seek to such an
 // exact boundary label resolves to that recorded boundary, not 0.9s before it.
 const boundary=!/\.\d+/.test(productionTimestamp)?plan.steps.flatMap(s=>[s.startEpochHours,s.endEpochHours]).filter(x=>x!==null&&Math.floor(x*3600+1e-5)===Math.floor(parsed*3600+1e-5)):[];
 const t=boundary.length?Math.max(...boundary):parsed,snapshot=clock(plan.snapshot.timestamp),release=plan.releaseEpochHours;
 const originals=plan.steps.flatMap(s=>s.activitySegments).reduce((n,a)=>n+a.workedOriginalMH*fraction(a,t),0);
 const productionProgress=clamp((plan.snapshot.completedMH+originals)/plan.snapshot.plannedMH);
 const states=plan.steps.map(s=>{
  const segments=s.activitySegments,active=segments.filter(a=>t>=a.startEpochHours&&t<a.endEpochHours);
  const original=segments.reduce((n,a)=>n+a.workedOriginalMH*fraction(a,t),0),rework=segments.reduce((n,a)=>n+a.workedReworkMH*fraction(a,t),0);
  const qc=segments.filter(a=>['QC_INSPECTION','QC_REINSPECTION'].includes(a.type)&&a.resourceLane==='QC'),qcHours=qc.reduce((n,a)=>n+a.durationMinutes/60*fraction(a,t),0);
  let progress=s.process==='INITIAL_QC'||s.process==='REINSPECTION'?(s.durationHours?qcHours/s.durationHours:0):s.plannedMH?(original+rework)/s.plannedMH:0;
  let state=s.skipped?'SKIPPED':s.process==='HANDOVER'?(t>=release?'RELEASED':t>=s.startEpochHours?'WAITING_QC':'NOT_STARTED'):t>=s.endEpochHours?'COMPLETE':t<s.startEpochHours?'NOT_STARTED':active.some(productive)||active.some(a=>['QC_INSPECTION','QC_REINSPECTION'].includes(a.type))?'IN_PROGRESS':active.some(a=>a.type==='WAIT_QC')?'WAITING_QC':active.length?'WAITING_NONWORK':'READY';
  if(state==='COMPLETE'||state==='RELEASED'||state==='SKIPPED')progress=1;
  return {id:s.id,state,progress:clamp(progress),activeSegments:active};
 });
 let index=states.findIndex(s=>!['COMPLETE','SKIPPED','RELEASED','NOT_STARTED'].includes(s.state));
 if(index<0)index=t>=release?6:states.findIndex(s=>s.state==='NOT_STARTED');if(index<0)index=6;
 const current=states[index],allActive=states.flatMap(s=>s.activeSegments),rework=states[4],qc=states[3],inspection=states[5];
 const qualityStatus=t>=release?'RELEASED':qc.state!=='COMPLETE'?'INITIAL_QC_PENDING':!plan.quality.reworkRequired?'AWAITING_RELEASE':rework.state!=='COMPLETE'?rework.state==='NOT_STARTED'?'REWORK_PENDING':'REWORK_IN_PROGRESS':inspection.state==='COMPLETE'?'AWAITING_RELEASE':inspection.state==='IN_PROGRESS'?'REINSPECTION_IN_PROGRESS':'WAITING_QC';
 const geometry=plan.geometryMapping.modules.map(m=>{const mh=productionProgress*plan.snapshot.plannedMH,progress=clamp((mh-m.cumulativeStartMH)/m.workWeightMH);return {moduleId:m.moduleId,geometryObjectId:m.geometryObjectId,moduleProgress:progress,state:progress===1?'COMPLETE':progress===0?'NOT_STARTED':'PARTIAL'};});
 return {timestamp:productionTimestamp,beforeSnapshot:t<snapshot,productionProgress,currentStep:plan.steps[index].id,stepProgress:current.progress,stepState:current.state,activeSegmentType:current.activeSegments.find(a=>productive(a)||a.type.startsWith('QC_'))?.type??current.activeSegments[0]?.type??null,qualityStatus,handoverStatus:t>=release?'RELEASED':'NOT_RELEASED',activeResourceLanes:[...new Set(allActive.map(a=>a.resourceLane))],steps:states.map(({activeSegments,...v})=>v),geometryProgress:geometry};
}

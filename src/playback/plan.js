import {clock,stamp} from '../engine/calendar.js';
import {STEPS,geometryMapping} from './definitions.js';
import {validateAssemblyPlaybackPlan} from './validate.js';
import {getPlaybackStateAt} from './state.js';
import {inputFingerprint} from '../engine/fingerprint.js';
export {inputFingerprint} from '../engine/fingerprint.js';
export function buildAssemblyPlaybackPlan(s,r,{generatedAt=new Date().toISOString()}={}){
 if(s.selectedStrategy!==r.strategy)throw Error('재생 입력과 계산 대응안이 다릅니다.');
 const trace=r.activityTrace,issues=[];if(trace?.status!=='COMPLETE')issues.push('엔진 활동 추적 없음');if(trace?.inputSnapshotId!==inputFingerprint(s))issues.push('입력 스냅샷과 추적 지문 불일치');
 const phases=trace?.phases??[],epoch=trace?.handoverEpochHours??clock(r.handover);
 const steps=STEPS.map(def=>{
  const p=phases.find(x=>x.sourceTask===def.sourceTask),skip=['REWORK','REINSPECTION'].includes(def.process)&&r.reworkMH===0;
  const prior=def.step===5?phases.find(x=>x.sourceTask==='T40'):def.step===6?phases.find(x=>x.sourceTask==='REWORK'):null;
  const a=p?.startEpochHours??(skip?prior?.endEpochHours??phases.find(x=>x.sourceTask==='T40')?.endEpochHours:def.step===7?phases.find(x=>x.sourceTask==='APPROVAL')?.startEpochHours??epoch:null),b=p?.endEpochHours??a;
  const activitySegments=def.step===7?(phases.find(x=>x.sourceTask==='APPROVAL')?.segments??[]):(p?.segments??[]);
  if(!skip&&def.step<7&&!p)issues.push(`${def.sourceTask} 추적 미연결`);
  const production=activitySegments.filter(x=>x.workedOriginalMH+x.workedReworkMH>0),intervals=[...new Set(production.map(x=>x.startEpochHours+':'+x.endEpochHours))].map(key=>key.split(':').map(Number));
  const productiveHours=intervals.reduce((n,[u,v])=>n+v-u,0),qcHours=activitySegments.filter(x=>['QC_INSPECTION','QC_REINSPECTION'].includes(x.type)&&x.resourceLane==='QC').reduce((n,x)=>n+x.durationMinutes/60,0),workHours=['INITIAL_QC','REINSPECTION'].includes(def.process)?qcHours:productiveHours;
  const crews=intervals.map(([u,v])=>production.filter(x=>x.startEpochHours===u&&x.endEpochHours===v).reduce((n,x)=>n+x.effectiveWorkers,0)),rates=intervals.map(([u,v],i)=>production.filter(x=>x.startEpochHours===u&&x.endEpochHours===v).reduce((n,x)=>n+x.effectiveWorkers*x.productivity,0)/crews[i]);
  const constant=values=>values.length&&values.every(x=>Math.abs(x-values[0])<1e-8)?values[0]:null;
  return {...def,namespace:'PRODUCTION_PLAYBACK',plannedMH:p?.plannedMH??0,effectiveWorkers:constant(crews),productivity:constant(rates),workHours,elapsedHours:a===null?null:(def.step===7?epoch:b)-a,start:a===null?null:stamp(a),end:b===null?null:stamp(def.step===7?epoch:b),startEpochHours:a,endEpochHours:def.step===7?epoch:b,state:skip?'SKIPPED':'NOT_STARTED',skipped:skip,activitySegments,durationHours:qcHours,waitQcHours:activitySegments.filter(x=>!['QC_INSPECTION','QC_REINSPECTION'].includes(x.type)&&x.resourceLane==='QC').reduce((n,x)=>n+x.durationMinutes/60,0),virtualZone:['INITIAL_QC','REINSPECTION'].includes(def.process)?'VIRTUAL_INSPECTION':def.process==='REWORK'?'VIRTUAL_REWORK':null,playbackReady:false};
 });
 const qualityClass=r.reworkMH===0?'NONE':s.qualityMode==='CONFIRMED'?'USER_CONFIRMED_INPUT':s.qualityMode==='CUSTOM'?'HYPOTHETICAL':'SYNTHETIC_EXPECTED';
 const plan={schema:'ASSEMBLY_PLAYBACK_PLAN_V1',version:1,blockId:s.blockId,scenarioId:s.scenarioId,strategyId:r.strategy,generatedAt,inputSnapshotId:inputFingerprint(s),dataClassification:'SYNTHETIC_DEMONSTRATION',snapshot:{timestamp:s.start,plannedMH:s.planned,completedMH:s.completed,remainingMH:s.remaining,productionProgress:s.completed/s.planned,geometryMappingMode:'MH_BASED_SCHEMATIC'},productionBaseline:{plannedOriginalMH:s.planned,completedAtSnapshotMH:s.completed,remainingOriginalMH:s.remaining,originalTaskMH:steps.slice(0,4).map(x=>({sourceTask:x.sourceTask,mh:x.plannedMH})),sourceProcessLostMH:r.sourceProcessLostMH},quality:{mode:s.qualityMode,expectedReworkMH:r.reworkMH,expectedReworkCases:r.reworkMH===0?0:r.prediction?.cases??(s.qualityMode==='CONFIRMED'?s.confirmedReworks.filter(x=>x.status==='CONFIRMED').length:null),reworkRequired:r.reworkMH>0,reinspectionRequired:r.reworkMH>0&&s.reinspectionHours>0,predictionClassification:qualityClass,dataClassification:qualityClass,virtualInspectionZone:'VIRTUAL_INSPECTION',virtualReworkZone:'VIRTUAL_REWORK'},deadline:s.deadline,expectedHandover:r.handover,releaseEpochHours:epoch,deadlineMet:r.deadlineMet,geometryMapping:geometryMapping(s.planned,s.completed),steps,activityTraceStatus:trace?.status??'MISSING',timePrecision:trace?.precision??'UNKNOWN',financialSnapshot:{additionalLabor:r.costs.filter(x=>x.category!=='추가 QC').reduce((n,x)=>n+x.labor,0),incremental:r.incremental,total:r.total,budget:s.budget,budgetRemaining:r.budgetRemaining},playbackReady:false,readinessIssues:issues};
 const atSnapshot=getPlaybackStateAt(plan,s.start);steps.forEach((step,i)=>step.state=atSnapshot.steps[i].state);
 let validation=validateAssemblyPlaybackPlan(plan,{checkReadiness:false});issues.push(...validation.errors);plan.playbackReady=issues.length===0;steps.forEach(x=>x.playbackReady=plan.playbackReady);
 validation=validateAssemblyPlaybackPlan(plan);if(!validation.valid){plan.playbackReady=false;steps.forEach(x=>x.playbackReady=false);issues.push(...validation.errors);}
 return plan;
}

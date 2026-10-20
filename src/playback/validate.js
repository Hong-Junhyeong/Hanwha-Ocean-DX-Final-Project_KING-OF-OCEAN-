import Ajv from 'ajv';
import schema from './ASSEMBLY_PLAYBACK_PLAN_V1.schema.json' with {type:'json'};
import {clock} from '../engine/calendar.js';
import {getPlaybackStateAt} from './state.js';
const ajv=new Ajv({allErrors:true,strict:false});ajv.addFormat('date-time',v=>typeof v==='string'&&/T.*(Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v)));
const check=ajv.compile(schema);
export function validateAssemblyPlaybackPlan(plan,{checkReadiness=true}={}){
 const errors=[];if(!check(plan))return {valid:false,errors:check.errors.map(e=>`${e.instancePath||'/'} ${e.message}`)};
 const near=(a,b,label,tolerance=1e-6)=>{if(Math.abs(a-b)>tolerance)errors.push(label);};
 const s=plan.snapshot;near(s.plannedMH,s.completedMH+s.remainingMH,'원작업 총량 불일치');near(s.productionProgress,s.completedMH/s.plannedMH,'스냅샷 진도 불일치');
 near(plan.geometryMapping.modules.reduce((n,x)=>n+x.workWeightMH,0),s.plannedMH,'교육용 모듈 MH 합계 불일치');
 if(new Set(plan.geometryMapping.modules.map(x=>x.moduleId)).size!==plan.geometryMapping.modules.length)errors.push('교육 모듈 ID 중복');
 for(const [i,m]of plan.geometryMapping.modules.entries()){near(m.cumulativeStartMH,i?plan.geometryMapping.modules[i-1].cumulativeEndMH:0,'모듈 누적 범위');near(m.cumulativeEndMH-m.cumulativeStartMH,m.workWeightMH,'모듈 공수 범위');}
 if(plan.deadlineMet!==(plan.releaseEpochHours<=clock(plan.deadline)+1e-8))errors.push('납기 판정 불일치');
 if(plan.quality.reworkRequired!==(plan.quality.expectedReworkMH>0))errors.push('보수 필요 여부 불일치');
 let original=0,rework=0;const lanes=new Map(),ids=new Set();
 for(const step of plan.steps){
  if(checkReadiness&&plan.playbackReady&&!step.playbackReady)errors.push('단계별 준비 상태 불일치');
  if(step.startEpochHours===null||step.endEpochHours===null){errors.push(step.id+' 시각 미연결');continue;}
  if(step.endEpochHours<step.startEpochHours)errors.push(step.id+' 역방향 시각');
  near(step.elapsedHours,step.endEpochHours-step.startEpochHours,step.id+' 경과시간');
  let work=0;for(const a of step.activitySegments){
   if(ids.has(a.sourceEventId))errors.push('활동 ID 중복');ids.add(a.sourceEventId);
   if(a.startEpochHours<step.startEpochHours-1e-8||a.endEpochHours>step.endEpochHours+1e-8)errors.push(step.id+' 활동 경계');
   near(a.durationMinutes,(a.endEpochHours-a.startEpochHours)*60,'활동 시간 불일치');
   near(clock(a.start),a.startEpochHours,'활동 착수 ISO 정밀도',1/3600+.00000001);near(clock(a.end),a.endEpochHours,'활동 종료 ISO 정밀도',1/3600+.00000001);
   const mh=a.workedOriginalMH+a.workedReworkMH;work+=mh;original+=a.workedOriginalMH;rework+=a.workedReworkMH;
   if(['LUNCH','WAIT_NONWORK','WAIT_QC','EQUIPMENT_STOP'].includes(a.type)&&mh>1e-7)errors.push('대기 구간에 생산 MH 존재');
   if(mh>0&&a.resourceLane==='QC')errors.push('QC에 원작업/보수 MH 중복');
   if(mh>0)near(mh,a.effectiveWorkers*(a.productivity??0)*a.durationMinutes/60,'활동 자원×시간과 MH 불일치',1e-5);
   if(!lanes.has(a.resourceLane))lanes.set(a.resourceLane,[]);lanes.get(a.resourceLane).push(a);
  }
  if(step.step<=5)near(work,step.plannedMH,step.id+' MH 대조',1e-5);
  if(step.skipped&&(step.activitySegments.length||step.plannedMH))errors.push('SKIPPED에 활동 존재');
 }
 near(original,s.remainingMH,'원작업 활동 MH 합계 불일치',1e-5);near(rework,plan.quality.expectedReworkMH,'재작업 활동 MH 합계 불일치',1e-5);
 for(const [lane,segments]of lanes){segments.sort((a,b)=>a.startEpochHours-b.startEpochHours);for(let i=1;i<segments.length;i++)if(segments[i].startEpochHours<segments[i-1].endEpochHours-1e-8)errors.push(lane+' 동일 레인 겹침');}
 const state=getPlaybackStateAt(plan,plan.snapshot.timestamp),again=getPlaybackStateAt(plan,plan.snapshot.timestamp);if(JSON.stringify(state)!==JSON.stringify(again))errors.push('시각 조회 비결정성');
 near(state.productionProgress,s.productionProgress,'시작 진도 불일치');near(clock(plan.expectedHandover),plan.releaseEpochHours,'인계 시각 불일치',1/3600+.00000001);
 if(checkReadiness&&plan.playbackReady&&(errors.length||plan.activityTraceStatus!=='COMPLETE'||plan.readinessIssues.length))errors.push('불완전한 계획을 준비 완료로 표시');
 return {valid:errors.length===0,errors};
}

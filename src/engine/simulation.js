import {predict} from './quality.js';
import {validate} from './scenario.js';
import {clock,stamp,slots,day,dateKey,workingEnd,inspectionSlot} from './calendar.js';
import {createActivityTrace} from './activityTrace.js';
export const STRATEGIES={N:'무대응',A1:'기존 인원 OT 2.5h',A2:'기존 인원 OT 3h',A:'사용자 OT',B1:'내부 인력 지원',C2:'외부 인력 지원',D:'설비·물류 조정',E:'QC 창 조정'};
export function productivityIndex(standard,actual){return actual>0?standard/actual:null;}
function overlaps(a,b,u,v){return Math.max(0,Math.min(b,v)-Math.max(a,u));}
// Finite-interval integration: no minute rounding, no hardcoded finish timestamps.
// Serial topological resource dispatch is intentionally conservative for independent tasks.
export function simulate(s,records,strategy=s.selectedStrategy){
 validate(s);if(!STRATEGIES[strategy])throw Error('대응안 오류');
 const start=clock(s.start),deadline=clock(s.deadline),allSlots=slots(start,s.calendar);
 const availableDates=new Set([...new Set(allSlots.filter(([a])=>a<deadline).map(([a])=>dateKey(a)))].slice(0,s.availableRegularWorkdays??Infinity));
 // Availability before the fixed deadline is separate from post-deadline
 // recovery work. More requested days never move the reference deadline.
 const baseSlots=allSlots.flatMap(([a,b])=>a>=deadline||availableDates.has(dateKey(a))?[[a,b]]:b>deadline?[[deadline,b]]:[]),trace=createActivityTrace(s,strategy);
 const ot=['A','A1','A2'].includes(strategy)?(strategy==='A1'?2.5:strategy==='A2'?3:s.overtimeHours):0;
 const support=strategy==='B1'?s.internalWorkers:strategy==='C2'?s.externalWorkers:0,sp=strategy==='B1'?s.internalProductivity:s.externalProductivity,supportDays=strategy==='B1'?s.internalDays:s.externalDays,supportHours=strategy==='B1'?s.internalHours:s.externalHours;
 const workDates=[...new Set(baseSlots.map(([a])=>dateKey(a)))].slice(0,supportDays),supportSlots=[];
 for(const d of workDates){let remaining=supportHours;for(const [a,b]of baseSlots.filter(([a])=>dateKey(a)===d)){const n=Math.min(remaining,b-a);if(n>0)supportSlots.push([a,a+n]);remaining-=n;}}
 const extraSlots=ot?s.overtimeDates.map(d=>{const a=clock(d+'T00:00:00+09:00')+s.calendar.sessions.at(-1)[1];return [a,a+ot/s.overtimeDates.length];}):[];
 const outageA=clock(s.outageStart),outageB=outageA+Math.max(0,s.outageHours-(strategy==='D'?s.equipmentRecoveryHours:0));
 const bounds=[...new Set([...baseSlots,...extraSlots,...supportSlots].flat().concat([start,deadline,outageA,outageB],(s.workerUnavailable??[]).flatMap(x=>[clock(x.start),clock(x.end)])))].filter(t=>t>=start).sort((a,b)=>a-b);
 const inside=(t,arr)=>arr.some(([a,b])=>t>=a-1e-9&&t<b-1e-9);
 let alternativeLeft=s.alternativeMH,gross=0,alternative=0,regularAfter=0,cursor=start;
 const timeline=[],daily={};
 function work(mh,maxWorkers,equipment,earliest,label,sourceTask='REWORK'){
  const phase=trace.phase(sourceTask,earliest,mh),rework=sourceTask==='REWORK';
  if(mh<=1e-10){trace.close(phase,earliest,earliest);return earliest;}
  let remaining=mh,begin=null,finish=null;
  for(let i=0;i<bounds.length-1;i++){
   let a=Math.max(bounds[i],earliest),b=bounds[i+1];if(a>=b-1e-10)continue;
   const mid=(a+b)/2,isRegular=inside(mid,baseSlots),isOT=inside(mid,extraSlots);
   if(!isRegular&&!isOT){trace.wait(phase,a,b,'PRODUCTION');continue;}
   const absent=(s.workerUnavailable??[]).filter(x=>clock(x.start)<=mid&&clock(x.end)>mid).reduce((n,x)=>n+x.count,0);
   const crew=Math.max(0,Math.min(isRegular?s.workers:s.overtimeWorkers,maxWorkers)-absent),sup=isRegular&&inside(mid,supportSlots)?support:0;
   let rate=crew*s.productivity+sup*sp;
   const isOut=mid>=outageA&&mid<outageB&&equipment===s.outageEquipment;
   const affected=isOut?Math.min(crew,s.affectedWorkers):0;
   const lostRate=affected*s.productivity;
   rate-=lostRate;
   const altRate=lostRate>0&&alternativeLeft>0?lostRate:0;
   // Recognized alternatives complete valid remaining work in this aggregate scenario,
   // and are credited once through production capacity, never also subtracted from MH.
   const chunks=altRate>0?[Math.min(b,a+alternativeLeft/altRate),b]:[b];
   for(const end of chunks){if(end<=a+1e-10)continue;
    const alt=alternativeLeft>1e-10?altRate:0,effective=rate+alt;
    const duration=effective>0?Math.min(end-a,remaining/effective):end-a;
    const productiveCrew=Math.max(0,crew-affected+alt/s.productivity),crewMH=productiveCrew*s.productivity*duration,supportMH=sup*sp*duration;
    if(crewMH>0)trace.segment(phase,isOT?'OT':'WORK',a,a+duration,'PRODUCTION',{effectiveWorkers:productiveCrew,productivity:s.productivity,workedOriginalMH:rework?0:crewMH,workedReworkMH:rework?crewMH:0,paidMH:crew*duration,reason:alt?'유효 대체작업 포함':'원본 엔진 생산 배정'});
    else trace.segment(phase,affected?'EQUIPMENT_STOP':'WAIT_NONWORK',a,a+duration,'PRODUCTION',{reason:affected?'지정 설비 중단':'적격 생산인원 가용 없음'});
    if(supportMH>0)trace.segment(phase,'WORK',a,a+duration,'SUPPORT',{effectiveWorkers:sup,productivity:sp,workedOriginalMH:rework?0:supportMH,workedReworkMH:rework?supportMH:0,paidMH:sup*duration,reason:'내부 또는 외부 적격 지원 배정'});
    if(affected)trace.segment(phase,'EQUIPMENT_STOP',a,a+duration,'EQUIPMENT',{effectiveWorkers:affected,reason:equipment+' 중단; 비영향 인원·지원은 동시 작업 가능'});
    gross+=affected*duration;const altDone=Math.min(alternativeLeft,alt*duration);alternativeLeft-=altDone;alternative+=altDone/s.productivity;
    if(effective>0){if(begin===null)begin=a;remaining-=effective*duration;const d=dateKey(a);daily[d]=(daily[d]??0)+effective*duration;
     if(isRegular&&a+duration>deadline){const paid=overlaps(a,a+duration,deadline,Infinity)*crew;regularAfter+=paid;trace.paid('납기 이후 추가 정규 대응',Math.max(a,deadline),a+duration,paid,s.rates.regular);}
     if(remaining<1e-8){finish=a+duration;break;}}
    a=end;
   }
   if(finish!==null)break;
  }
  if(finish===null)throw Error(`${label}: 자원/설비/달력 범위 내 완료 불가`);
  trace.close(phase,earliest,finish);timeline.push({label,start:stamp(begin),end:stamp(finish),mh});return finish;
 }
 const taskTotal=s.tasks.reduce((n,t)=>n+t.remaining,0),productionTarget=Math.max(0,s.remaining-s.workers*s.initialInspectionHours);
 const ordered=[],done=new Set();let todo=[...s.tasks];while(todo.length){const i=todo.findIndex(t=>t.predecessors.every(p=>done.has(p)));const t=todo.splice(i,1)[0];ordered.push(t);done.add(t.id);}
 if(!taskTotal&&productionTarget)throw Error('작업별 잔여 공수 누락');
 const ends={};for(const t of ordered){const ready=Math.max(cursor,...t.predecessors.map(p=>ends[p]));cursor=work(taskTotal?t.remaining/taskTotal*productionTarget:0,(t.maxWorkers??s.workers),t.equipment,ready,t.name,t.id);ends[t.id]=cursor;}
 const preInspection=cursor,qcReady=clock(strategy==='E'?s.adjustedQcReady:s.qcReady),ready=Math.max(cursor,qcReady,...s.readiness.map(clock));
 const initial=inspectionSlot(ready,s.initialInspectionHours,s.calendar,s.qcUnavailable);
 const initialTrace=trace.phase('T40',preInspection,s.workers*s.initialInspectionHours);trace.wait(initialTrace,preInspection,initial.start,'QC',true,'최초 검사 선행조건·연속 QC 창 대기');trace.segment(initialTrace,'QC_INSPECTION',initial.start,initial.end,'QC',{effectiveWorkers:1,reason:'검사원 자원; 생산 대응 MH와 별도'});trace.segment(initialTrace,'QC_INSPECTION',initial.start,initial.end,'PRODUCTION',{effectiveWorkers:s.workers,productivity:1,workedOriginalMH:s.workers*s.initialInspectionHours,paidMH:s.workers*s.initialInspectionHours,reason:'T40 정상 잔여량에 포함된 생산 대응; QC MH 추가 아님'});trace.close(initialTrace,preInspection,initial.end);
 trace.paid('납기 이후 추가 정규 대응',Math.max(initial.start,deadline),initial.end,overlaps(initial.start,initial.end,deadline,Infinity)*s.workers,s.rates.regular);
 timeline.push({label:'최초 검사 (QC·생산 대응)',start:stamp(initial.start),end:stamp(initial.end),mh:s.workers*s.initialInspectionHours});
 regularAfter+=overlaps(initial.start,initial.end,deadline,Infinity)*s.workers;
 let prediction=null,reworkMH=0;
 if(['12M','6M','WEIGHTED'].includes(s.qualityMode)){prediction=predict(records,{mode:s.qualityMode,weight6:s.weight6,pending:s.pending,standards:s.standards});reworkMH=prediction.mh;}
 if(s.qualityMode==='CONFIRMED')reworkMH=s.confirmedReworks.filter(r=>r.status==='CONFIRMED').reduce((n,r)=>n+r.mh,0);
 if(s.qualityMode==='CUSTOM')reworkMH=s.customReworkMH;
 if(s.reworkStatus==='RESOLVED')reworkMH=0;
 cursor=initial.end;let reinspection=null;
 if(reworkMH>0){cursor=work(reworkMH,s.reworkWorkers,s.outageEquipment,cursor,'추가 재작업');const qcTrace=trace.phase('REINSPECTION',cursor,0);reinspection=inspectionSlot(Math.max(cursor,qcReady),s.reinspectionHours,s.calendar,s.qcUnavailable);trace.wait(qcTrace,cursor,reinspection.start,'QC',true,'연속 재검사 창 부족·QC 가용 조건');trace.segment(qcTrace,'QC_REINSPECTION',reinspection.start,reinspection.end,'QC',{effectiveWorkers:1,paidMH:s.reinspectionHours,reason:'생산인력 추가 유급을 추정하지 않는 재검사'});trace.close(qcTrace,cursor,reinspection.end);timeline.push({label:'재검사',start:stamp(reinspection.start),end:stamp(reinspection.end),mh:0});cursor=reinspection.end;}
 if(s.approvalHours){const approval=trace.phase('APPROVAL',cursor,0),gate=inspectionSlot(cursor,s.approvalHours,s.calendar,s.qcUnavailable);trace.wait(approval,cursor,gate.end,'QC',true,'추가 승인 대기 (검사·생산 유급 참석 근거 없음)');trace.close(approval,cursor,gate.end);timeline.push({label:'가정 추가 승인',start:stamp(gate.start),end:stamp(gate.end),mh:0});cursor=gate.end;}
 // Reinspection is inspector time. Approval/waiting alone has no verified
 // production attendance or inspector paid allocation; never infer crew wages.
 const handover=cursor,qcExtra=reworkMH>0?s.reinspectionHours:0;
 // Paid support is contracted allocation, including any unused reserved hours.
 const supportPaid=supportSlots.reduce((n,[a,b])=>n+(b-a)*support,0),otPaid=s.overtimeWorkers*ot;
 extraSlots.forEach(([a,b])=>trace.paid('연장근로',a,b,(b-a)*s.overtimeWorkers,s.rates.overtime));supportSlots.forEach(([a,b])=>trace.paid(strategy==='B1'?'내부 지원':'외부 지원',a,b,(b-a)*support,strategy==='B1'?s.rates.internal:s.rates.external));if(reinspection)trace.paid('추가 QC',reinspection.start,reinspection.end,s.reinspectionHours,s.rates.qc);
 const line=(category,headcount,hours,rate,other=0)=>({category,task:s.blockId,description:category,workforce:category,headcount,hours,mh:headcount*hours,rate,labor:headcount*hours*rate,other,subtotal:headcount*hours*rate+other,inBaseline:false,approval:'검토 및 승인 필요'});
 const costs=[];
 if(otPaid)costs.push(line('연장근로',s.overtimeWorkers,ot,s.rates.overtime));
 if(supportPaid)costs.push(line(strategy==='B1'?'내부 지원':'외부 지원',support,supportPaid/support,strategy==='B1'?s.rates.internal:s.rates.external));
 if(regularAfter)costs.push(line('납기 이후 추가 정규 대응',s.workers,regularAfter/s.workers,s.rates.regular));
 if(qcExtra)costs.push(line('추가 QC',1,qcExtra,s.rates.qc));
 for(const [name,v]of [['설비',s.equipmentCost],['물류',s.logisticsCost],['자재',s.materialCost],['기타',s.otherCost],['외부 착수',strategy==='C2'?s.externalMobilization:0]])if(v)costs.push(line(name,0,0,0,v));
 const incremental=costs.reduce((n,c)=>n+c.subtotal,0),total=s.baseCost+incremental,budgetRemaining=s.budget-total;
 const missingCosts=strategy==='C2'&&s.externalMobilization===null?['외부 인력 착수비 미확인']:[];
 if(s.approvalHours>0)missingCosts.push('추가 승인 대기 중 유급 참석·수수료 미확인 (미가산)');
 const conditions=['합성 교육용 시나리오','QC 슬롯은 예약이 아닌 가용 가정','작업별 적격 자격·작업면·설비 능력 현장 검증 필요'];
 if(ot&&!s.overtimeApproved)conditions.push('OT 승인 필요');
 if(support){if(!s.supportQualified)conditions.push('지원자 자격 미확인');if(!s.supportAvailable)conditions.push('지원자 가용 미확인');if(strategy==='B1')conditions.push(`${s.internalSource} 원공정 ${supportPaid}MH 감소 영향 미검증`);}
 let downstream={status:'비활성 / 별도 시나리오'};
 if(s.downstream.enabled){const d=s.downstream,prep=workingEnd(handover,d.preparationHours,d.calendar);downstream={status:'미확정: 상차 예약·이송시간·후행 자원 필요',preparationComplete:stamp(prep),latestPreparationStart:d.loadingReservation?stamp(clock(d.loadingReservation)-d.preparationHours):null};
 if(d.loadingReservation&&d.transportHours!==null&&d.receiptHours!==null&&d.resourceReady&&d.precedingReady){const dispatch=clock(d.loadingReservation);if(prep>dispatch)downstream.status='예약 불충족: 재예약 필요';else{const receipt=workingEnd(dispatch,d.transportHours+d.receiptHours,d.calendar),r=Math.max(receipt,clock(d.resourceReady),clock(d.precedingReady)),next=slots(r,d.calendar).find(([a,b])=>b>r);downstream={...downstream,status:'조건부 예측 / 운반팀 담당',receipt:stamp(receipt),downstreamStart:stamp(Math.max(r,next[0]))};}}}
 const regularCapacity=baseSlots.reduce((n,[a,b])=>{const loss=(s.workerUnavailable??[]).reduce((v,x)=>v+overlaps(Math.max(a,start),Math.min(b,deadline),clock(x.start),clock(x.end))*x.count,0);return n+Math.max(0,overlaps(a,b,start,deadline)*s.workers-loss)*s.productivity;},0);
 return {activityTrace:trace.finish(handover),strategy,name:STRATEGIES[strategy],preInspectionReady:stamp(preInspection),handover:stamp(handover),marginMinutes:(deadline-handover)*60,deadlineMet:handover<=deadline+1e-8,regularCapacity,nominalMargin:regularCapacity-s.remaining,reworkMH,prediction,
 grossLostMH:gross,alternativeRecognizedMH:alternative,netLostMH:Math.max(0,gross-alternative),remainingOriginal:s.remaining,requiredWorkMH:s.remaining+reworkMH,daily,timeline,costs,incremental,total,budgetRemaining,overrun:Math.max(0,-budgetRemaining),missingCosts,conditions,otPaid,supportPaid,addedCapacity:otPaid*s.productivity+supportPaid*sp,additionalWorkers:support,otHours:ot,sourceProcessLostMH:strategy==='B1'?supportPaid:0,downstream,
 conditionalExpectedMH:s.eventModel?s.eventModel.reduce((n,e)=>n+e.probability*e.mh,0):null,
 status:budgetRemaining<0?'예산 초과':handover>deadline+1e-8?'기한 미충족':missingCosts.length?'정보 미확인':'조건부 충족 / 승인 필요'};
}
export function compare(s,records){return Object.keys(STRATEGIES).map(id=>{try{return simulate(s,records,id);}catch(error){return {strategy:id,name:STRATEGIES[id],status:'정보 미확인',error:error.message};}});}

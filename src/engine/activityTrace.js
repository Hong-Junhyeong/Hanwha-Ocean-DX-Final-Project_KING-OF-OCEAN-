import {stamp,day,clock} from './calendar.js';
import {inputFingerprint} from './fingerprint.js';
// Observer only: receives the intervals selected by the existing dispatcher.
// Numeric durations retain integration precision; legacy ISO output truncates
// to seconds. Consumers may use epoch-hour endpoints for subsecond seeking.
export function createActivityTrace(s,strategy){
 const phases=[],paidAllocations=[];
 const phase=(id,ready,mh)=>{const p={sourceTask:id,ready:stamp(ready),readyEpochHours:ready,plannedMH:mh,start:null,end:null,segments:[]};phases.push(p);return p;};
 function segment(p,type,a,b,lane,fields={}){
  if(b<=a+1e-10)return;
  p.segments.push({type,start:stamp(a),end:stamp(b),startEpochHours:a,endEpochHours:b,durationMinutes:(b-a)*60,resourceLane:lane,effectiveWorkers:0,productivity:null,workedOriginalMH:0,workedReworkMH:0,paidMH:null,reason:type,sourceEventId:`${strategy}:${p.sourceTask}:${p.segments.length+1}`,...fields});
 }
 function wait(p,a,b,lane,qc=false,reason='작업 달력의 비근무 또는 자원 대기'){
  const cuts=[a,b];for(let d=day(a);d<b;d+=24){cuts.push(d+12,d+13,d+24);for(const [x,y]of s.calendar.sessions)cuts.push(d+x,d+y);for(const q of s.qcUnavailable??[])cuts.push(clock(q.start),clock(q.end));}
  const edges=[...new Set(cuts.filter(t=>t>=a&&t<=b))].sort((x,y)=>x-y);
  for(let i=0;i<edges.length-1;i++){const u=edges[i],v=edges[i+1],mid=(u+v)/2,d=day(mid),wd=new Date((d+9)*3600000).getUTCDay(),regular=s.calendar.weekdays.includes(wd)&&s.calendar.sessions.some(([x,y])=>mid>=d+x&&mid<d+y),lunch=s.calendar.weekdays.includes(wd)&&mid>=d+12&&mid<d+13;
   segment(p,lunch?'LUNCH':regular&&qc?'WAIT_QC':'WAIT_NONWORK',u,v,lane,{reason,secondaryReason:qc?'연속 QC 가용 슬롯 대기':null});
  }
 }
 const close=(p,a,b)=>{p.start=stamp(a);p.end=stamp(b);p.startEpochHours=a;p.endEpochHours=b;};
 const paid=(category,a,b,mh,rate)=>{if(mh>0)paidAllocations.push({category,date:a===null?null:stamp(a).slice(0,10),start:a===null?null:stamp(a),end:b===null?null:stamp(b),paidMH:mh,rate,amount:mh*rate,allocationBasis:'ENGINE_PAID_ALLOCATION'});};
 return {phases,paidAllocations,phase,segment,wait,close,paid,finish:handover=>({version:1,status:'COMPLETE',inputSnapshotId:inputFingerprint({...s,selectedStrategy:strategy}),precision:'ISO timestamps: existing engine seconds; epoch-hour endpoints and durations: integration precision',handoverEpochHours:handover,phases,paidAllocations})};
}

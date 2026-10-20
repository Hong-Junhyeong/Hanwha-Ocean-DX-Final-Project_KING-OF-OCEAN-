import Ajv from'ajv';
import schema from'./VIEWER_MESSAGE_V1.schema.json' with{type:'json'};
const validate=new Ajv({strict:false}).compile(schema);
// The iframe never schedules production. It requests a timestamp from the parent.
export const PROTOCOL='B203_PRODUCTION_VIEWER_V1';
export const TYPES=Object.freeze(['HELLO','PLAN_ACK','STATE_REQUEST','VIEWER_ERROR']);
const token=x=>typeof x==='string'&&x.length>0&&x.length<=160;
export function validViewerMessage(m){
 if(!validate(m)||!token(m.viewerId))return false;
 if(m.type==='HELLO')return true;
 if(m.type==='VIEWER_ERROR')return typeof m.message==='string'&&m.message.length<=1000;
 if(!token(m.channel)||!token(m.planId)||!Number.isSafeInteger(m.inputVersion)||m.inputVersion<0)return false;
 if(m.type==='PLAN_ACK')return true;
 return Number.isSafeInteger(m.requestId)&&m.requestId>=0&&typeof m.timestamp==='string'&&m.timestamp.length<=40&&/(Z|[+-]\d\d:\d\d)$/.test(m.timestamp)&&Number.isFinite(Date.parse(m.timestamp));
}
export function activeSegmentsAt(plan,timestamp){
 const parsed=Date.parse(timestamp)/3600000;
 // Match V8's documented whole-second boundary labels, including final release.
 // This reads its precision contract; it does not reschedule any activity.
 const boundary=!/\.\d+/.test(timestamp)?plan.steps.flatMap(s=>[s.startEpochHours,s.endEpochHours]).filter(x=>x!==null&&Math.floor(x*3600+1e-5)===Math.floor(parsed*3600+1e-5)):[];
 const t=boundary.length?Math.max(...boundary):parsed;
 return plan.steps.flatMap(step=>step.activitySegments.map(segment=>({...segment,stepId:step.id}))).filter(a=>t>=a.startEpochHours&&t<a.endEpochHours);
}

import{getPlaybackStateAt,validateAssemblyPlaybackPlan}from'../playback/index.js';
import{PROTOCOL,validViewerMessage,activeSegmentsAt}from'./protocol.js';

// Scoped lifetime: the main render disposes this before replacing the iframe.
export function connectProductionViewer(frame,readCurrent,{onStatus=()=>{}}={}){
 const origin=window.location.origin,channel=crypto.randomUUID();
 let alive=true,viewerId=null,sent=null,lastRequest=-1,acked=false,blocked=false,statusKey='';
 const post=(type,data={})=>{if(alive&&viewerId)frame.contentWindow?.postMessage({protocol:PROTOCOL,type,viewerId,channel,...data},origin);};
 const status=(code,message)=>{const key=code+message;if(key!==statusKey){statusKey=key;onStatus(code,message);} };
 function sync(){
  if(!alive||!frame.isConnected)return null;
  const current=readCurrent();
  if(current.status!=='CURRENT'||!current.plan){
   if(!blocked){post('STATUS',{status:'STALE',message:current.message});blocked=true;}
   status('STALE',current.message);return null;
  }
  const p=current.plan,key=p.inputSnapshotId+':'+current.inputVersion;
  if(p.blockId!=='B-203'){post('STATUS',{status:'UNAVAILABLE',message:'현재 적용 시나리오가 B-203이 아닙니다.'});status('UNAVAILABLE','B-203 적용 시나리오가 필요합니다.');blocked=true;return null;}
  if(!sent||sent.key!==key||blocked){
   const check=validateAssemblyPlaybackPlan(p);
   if(!p.playbackReady||!check.valid){post('STATUS',{status:'INVALID',message:'재생 계획 검증에 실패했습니다.'});status('INVALID','재생 계획을 확인해 주세요.');blocked=true;return null;}
   sent={key,plan:p,inputVersion:current.inputVersion};lastRequest=-1;acked=false;blocked=false;
   if(viewerId)post('PLAN',{plan:p,planId:p.inputSnapshotId,inputVersion:current.inputVersion});
  }
  return sent;
 }
 function receive(event){
  if(!alive||event.origin!==origin||event.source!==frame.contentWindow||!validViewerMessage(event.data))return;
  const m=event.data;
  if(m.type==='HELLO'){
   if(viewerId&&viewerId!==m.viewerId)return;
   viewerId=m.viewerId;sent=null;sync();return;
  }
  if(m.viewerId!==viewerId)return;
  if(m.type==='VIEWER_ERROR'){status('ERROR',m.message);return;}
  if(m.channel!==channel)return;
  const current=sync();if(!current||m.planId!==current.plan.inputSnapshotId||m.inputVersion!==current.inputVersion)return;
  if(m.type==='PLAN_ACK'){acked=true;status('READY','현재 적용 시나리오 연결 완료');return;}
  if(!acked||m.requestId<=lastRequest)return;
  const p=current.plan,t=Date.parse(m.timestamp),start=Date.parse(p.snapshot.timestamp),end=p.releaseEpochHours*3600000;
  if(t<start-1||t>end+1)return;
  lastRequest=m.requestId;
  const state=getPlaybackStateAt(p,m.timestamp);
  post('STATE',{planId:p.inputSnapshotId,inputVersion:current.inputVersion,requestId:m.requestId,state,activeSegments:activeSegmentsAt(p,m.timestamp)});
 }
 window.addEventListener('message',receive);
 const probe=()=>frame.contentWindow?.postMessage({protocol:PROTOCOL,type:'PROBE'},origin);
 frame.addEventListener('load',probe);probe();
 const interval=window.setInterval(sync,250);
 const timeout=window.setTimeout(()=>{if(!acked&&!blocked)status('ERROR','3D 초기화 또는 데이터 연결이 완료되지 않았습니다. WebGL 지원 여부와 입력 조건을 확인해 주세요.');},15000);
 return()=>{alive=false;clearInterval(interval);clearTimeout(timeout);frame.removeEventListener('load',probe);window.removeEventListener('message',receive);};
}

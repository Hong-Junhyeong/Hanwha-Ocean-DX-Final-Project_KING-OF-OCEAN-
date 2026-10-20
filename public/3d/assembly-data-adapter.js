/* V9 adapter. This file controls the supplied scene, not production calculations.
   Authoritative states are resolved by the parent through V8 getPlaybackStateAt. */
(()=>{
 'use strict';
 const protocol='B203_PRODUCTION_VIEWER_V1',origin=location.origin,viewerId=crypto.randomUUID();
 const id=x=>document.getElementById(x),clamp=x=>Math.max(0,Math.min(1,x));
 const labels=['잔여 취부 작업','본용접 작업','마감·검사 준비','최초 품질검사','추가 재작업','QC 대기·재검사','품질 인계·반출 준비'];
 let channel=null,plan=null,version=null,playing=false,blocked=true,position=0,speed=1,requestId=0,pending=null,lastApplied=-1,intent=0,app=null,current=null,segments=[],lastStep=-1;
 const send=(type,data={})=>{if(parent!==window)parent.postMessage({protocol,type,viewerId,channel,...data},origin);};
 const hello=()=>{if(app)send('HELLO');};
 const greeting=setInterval(()=>{if(!plan)hello();},500);
 const kst=t=>new Date(Date.parse(t)+9*3600000).toISOString().slice(0,19).replace('T',' ');
 const validPlan=p=>p?.schema==='ASSEMBLY_PLAYBACK_PLAN_V1'&&p.version===1&&p.blockId==='B-203'&&p.playbackReady===true&&typeof p.inputSnapshotId==='string'&&p.steps?.length===7&&p.steps.every((s,i)=>s.id===`STEP_0${i+1}`&&s.namespace==='PRODUCTION_PLAYBACK'&&Array.isArray(s.activitySegments))&&Number.isFinite(Date.parse(p.snapshot?.timestamp))&&Number.isFinite(p.releaseEpochHours);
 const controls=()=>[id('play'),id('replay'),id('reset'),id('replayStep'),id('seek'),id('speed'),...document.querySelectorAll('[data-step]')];
 const request=()=>{
  if(!plan||blocked||pending)return;
  const timestamp=position<=Date.parse(plan.snapshot.timestamp)?plan.snapshot.timestamp:position>=plan.releaseEpochHours*3600000?plan.expectedHandover:new Date(position).toISOString();
  pending={id:++requestId,intent};
  send('STATE_REQUEST',{planId:plan.inputSnapshotId,inputVersion:version,requestId,timestamp});
 };
 function seek(ms,{play=false}={}){
  if(!plan||blocked)return;
  playing=play;position=Math.max(Date.parse(plan.snapshot.timestamp),Math.min(plan.releaseEpochHours*3600000,ms));intent++;request();updateUi();
 }
 const start=()=>seek(Date.parse(plan.snapshot.timestamp));
 const selectStep=i=>{if(!plan)return;seek(plan.steps[i].startEpochHours*3600000);};
 function stop(message){blocked=true;playing=false;pending=null;controls().forEach(el=>el.disabled=true);id('phase').textContent=message;id('detail').textContent='이전 검증 상태 보존 · 현재 조건으로 재계산 필요';updateUi();}
 window.reportProductionViewerError=message=>{send('HELLO');send('VIEWER_ERROR',{message:String(message).slice(0,1000)});};
 function receive(event){
  const m=event.data;
  if(event.origin!==origin||event.source!==parent||!m||m.protocol!==protocol)return;
  if(m.type==='PROBE'){hello();return;}
  if(m.viewerId!==viewerId||typeof m.channel!=='string'||(channel&&channel!==m.channel))return;
  if(m.type==='PLAN'){
   if(!validPlan(m.plan)||m.planId!==m.plan.inputSnapshotId||!Number.isSafeInteger(m.inputVersion)||m.inputVersion<0)return;
   if(version!==null&&m.inputVersion<version)return;
   channel=m.channel;plan=m.plan;version=m.inputVersion;blocked=false;playing=false;position=Date.parse(plan.snapshot.timestamp);requestId=0;lastApplied=-1;pending=null;current=null;intent++;lastStep=-1;
   clearInterval(greeting);controls().forEach(el=>el.disabled=false);
   id('seek').setAttribute('aria-label','생산 시나리오 전체 시간 이동');
   document.querySelector('.prototype').textContent=`B-203 · ${plan.strategyId} · ${plan.quality.mode}`;
   send('PLAN_ACK',{planId:plan.inputSnapshotId,inputVersion:version});request();return;
  }
  if(m.type==='STATUS'){if(['STALE','INVALID','UNAVAILABLE'].includes(m.status)&&typeof m.message==='string')stop(m.message);return;}
  if(m.type!=='STATE'||blocked||!plan||m.planId!==plan.inputSnapshotId||m.inputVersion!==version||!pending||m.requestId!==pending.id||m.requestId<=lastApplied)return;
  const s=m.state;if(!s||!/^STEP_0[1-7]$/.test(s.currentStep)||!Number.isFinite(s.productionProgress)||!Array.isArray(s.geometryProgress)||s.geometryProgress.length!==5||!Array.isArray(s.steps)||s.steps.length!==7||!Array.isArray(m.activeSegments))return;
  const matches=pending.intent===intent;pending=null;lastApplied=m.requestId;
  if(matches){current=s;segments=m.activeSegments;applyScene();updateUi();}
  else request();
 }
 window.addEventListener('message',receive);
 window.addEventListener('pagehide',()=>{playing=false;clearInterval(greeting);window.removeEventListener('message',receive);},{once:true});

 const materials=new Map();
 function initializeMaterials(){
  app.blocks.modules.forEach(module=>module.traverse(o=>{if(!o.isMesh)return;
   const list=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const clone=m.clone();materials.set(clone,{opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,emissive:m.emissive?.clone(),intensity:m.emissiveIntensity});return clone;});
   o.material=Array.isArray(o.material)?list:list[0];
  }));
 }
 function applyScene(){
  if(!app||!current)return;
  const h=app.productionHooks,{engine,blocks,crane}=app;
  const next=current.geometryProgress.find(g=>g.state!=='COMPLETE');
  const part=next?h.parts.findIndex(p=>p.id===next.moduleId):-1;
  const geometryStage=next?h.order.indexOf(part):5;
  // Native pose/rigging path is reused; no geometry, factory or crane rebuilt.
  engine.playing=false;engine.applyState(geometryStage,next?next.moduleProgress:1);
  const step=Number(current.currentStep.slice(-1))-1;
  const productive=segments.some(a=>a.workedOriginalMH+a.workedReworkMH>0&&['WORK','OT'].includes(a.type));
  const qcActive=segments.some(a=>a.resourceLane==='QC'&&['QC_INSPECTION','QC_REINSPECTION'].includes(a.type));
  const fitupActive=step===0&&productive;
  if(!fitupActive){crane.update(h.home,null);engine.state.crane=[...h.home];engine.state.craneState='HOME';engine.state.active=-1;}
  blocks.modules.forEach((module,i)=>{
   const g=current.geometryProgress.find(x=>x.moduleId===h.parts[i].id);
   module.userData.productionProgress=g.moduleProgress;module.userData.productionState=g.state;
   module.traverse(o=>{if(!o.isMesh)return;for(const material of(Array.isArray(o.material)?o.material:[o.material])){
    const base=materials.get(material);if(!base)continue;
    const opacity=g.state==='COMPLETE'?1:g.state==='NOT_STARTED'?.25:.35+.65*g.moduleProgress;
    material.transparent=opacity<1||base.transparent;material.opacity=base.opacity*opacity;material.depthWrite=opacity===1&&base.depthWrite;
    if(base.emissive){material.emissive.copy(base.emissive);material.emissiveIntensity=base.intensity;
     if(g.state==='PARTIAL'||step===2&&productive){material.emissive.setHex(0xd49550);material.emissiveIntensity=.14+.08*current.stepProgress;}
    }
   }});
  });
  const weld=current.steps[1].progress,inspection=step===3||step===5?current.stepProgress:0;
  const repairing=step===4&&productive;
  const effectsState={...engine.state,step:productive&&(step===1||step===4)||qcActive?5:4,u:current.stepProgress,weld:repairing?.2+.6*current.stepProgress:weld,inspection:qcActive?inspection:0,tackPoint:fitupActive?engine.state.tackPoint:null};
  engine.effects.update(effectsState,blocks.assembly);
  engine.effects.root.visible=weld>0;
  // Reuse the arc for a labeled virtual repair without removing completed seams.
  if(step>=4)engine.effects.paths.forEach(({mesh})=>mesh.geometry.setDrawRange(0,Infinity));
  window.productionViewer.visualState={step:current.currentStep,productionProgress:current.productionProgress,geometryStage,productive,qcActive,fitupActive,repairing,craneHome:!fitupActive,virtualZone:repairing?'VIRTUAL_REWORK':qcActive?'VIRTUAL_INSPECTION':null,equipmentStopped:segments.some(a=>a.type==='EQUIPMENT_STOP'),timestamp:current.timestamp};
  if(lastStep!==step){lastStep=step;if(app.cam.auto)app.cam.set(h.cameras[step===0?2:5].camera);}
 }
 function updateUi(){
  if(!app)return;
  id('play').innerHTML=playing?'Ⅱ <span>일시정지</span>':'▶ <span>재생</span>';
  id('autoCam').classList.toggle('active',app.cam.auto);id('autoCam').setAttribute('aria-pressed',String(app.cam.auto));
  if(!plan||!current)return;
  const s=current,i=Number(s.currentStep.slice(-1))-1,step=plan.steps[i];
  id('sceneTitle').textContent=labels[i];id('descriptionTitle').textContent=labels[i];id('stepCode').textContent=`STEP ${String(i+1).padStart(2,'0')} / 07`;
  id('currentProcess').textContent=`${step.process} · ${s.stepState}`;
  id('description').textContent=`${kst(step.start)} ~ ${kst(step.end)} KST · ${step.plannedMH.toFixed(2)} MH · 단계 ${(s.stepProgress*100).toFixed(1)}%`;
  if(!blocked){
   const scope=i===4?`${plan.quality.predictionClassification} · VIRTUAL_REWORK`:'MH_BASED_SCHEMATIC · 교육용 형상';
   id('detail').textContent=`${scope} · 품질 ${s.qualityStatus} · 인계 ${s.handoverStatus}`;
   const lanes=[...new Set(segments.map(a=>`${a.resourceLane}:${a.type}`))].join(' / ');
   id('phase').textContent=`${s.stepState} · ${lanes||s.handoverStatus}`;
  }
  id('time').textContent=kst(s.timestamp)+' KST';
  id('seek').value=Math.round(clamp((position-Date.parse(plan.snapshot.timestamp))/(plan.releaseEpochHours*3600000-Date.parse(plan.snapshot.timestamp)))*1000);
  id('seek').setAttribute('aria-valuetext',kst(s.timestamp)+' KST');
  id('progress').innerHTML=(s.productionProgress*100).toFixed(2)+'<small>%</small>';id('progressBar').style.width=s.productionProgress*100+'%';
  document.querySelectorAll('[data-step]').forEach((b,n)=>{b.classList.toggle('active',n===i);b.classList.toggle('done',['COMPLETE','SKIPPED','RELEASED'].includes(s.steps[n].state));b.setAttribute('aria-label',`${labels[n]} · ${s.steps[n].state}`);if(n===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');b.title=`${labels[n]} · ${s.steps[n].state}`;});
  app.productionHooks.parts.forEach(p=>{const g=s.geometryProgress.find(x=>x.moduleId===p.id),el=id('state-'+p.id);el.textContent=`${g.state} ${(g.moduleProgress*100).toFixed(0)}%`;el.className='state '+g.state.toLowerCase();});
  ['bridgeX','trolleyY','hookZ'].forEach((name,n)=>id(name).textContent=app.engine.state.crane[n].toFixed(1)+' m');
  id('craneState').textContent=window.productionViewer.visualState?.equipmentStopped?'EQUIPMENT_STOP · 비영향 레인 별도':app.engine.state.craneState;
  id('inspection').hidden=i<3;id('inspectionRows').replaceChildren();
  ['WELD','FITUP','DIMENSION'].forEach(category=>{const row=document.createElement('div'),name=document.createElement('span'),state=document.createElement('b');name.textContent=category;state.textContent=window.productionViewer.visualState?.qcActive?'모델 검사 중':s.handoverStatus==='RELEASED'?'모델 완료':'대기 / 참고';row.append(name,state);id('inspectionRows').append(row);});
  id('nextStep').textContent=labels[i+1]??'후행 운반시간 미제공';id('complete').hidden=s.handoverStatus!=='RELEASED';
  document.documentElement.dataset.planId=plan.inputSnapshotId;document.documentElement.dataset.strategy=plan.strategyId;document.documentElement.dataset.quality=plan.quality.mode;document.documentElement.dataset.productionStep=s.currentStep;document.documentElement.dataset.segment=s.activeSegmentType??'';
 }
 window.installProductionPlayback=scene=>{
  if(app)return;app=scene;scene.engine.playing=false;initializeMaterials();
  document.querySelectorAll('[data-step]').forEach((b,i)=>{b.querySelector('.name').textContent=labels[i];b.querySelector('.en').textContent=['FITUP','WELDING','FINISH','INITIAL QC','REWORK','QC WAIT / REINSPECTION','QUALITY HANDOVER'][i];b.onclick=()=>selectStep(i);});
  document.querySelector('.timeline-panel h1').textContent='B-203 잔여 생산·품질';
  document.querySelector('.timeline-panel > .subtle').textContent='현재 적용 시나리오 · 실제 시각을 압축 재생합니다.';
  document.querySelector('.block-id strong').textContent='B-203';document.querySelector('.metric > span').textContent='원작업 생산 진도율';document.querySelector('.metric > small').textContent='합성 계산 · 형상 매핑은 교육용 가정';
  document.querySelector('.scene-caption').textContent='B-203 / PRODUCTION_PLAYBACK';
  id('inspection').querySelector('.section-caption').textContent='INSPECTION · 모델 상태';
  id('complete').querySelector('strong').textContent='QUALITY RELEASE';id('complete').querySelector('p').textContent='모델 품질 인계 · 실제 반출 미실행';
  id('info').querySelector('.subtle').textContent='생산 시각은 V8 엔진 계산값입니다. 모듈 투명도·설치 동작은 교육용 MH 매핑이며 실측 완료 경계가 아닙니다. 품질 인계 후 실제 운반은 재생하지 않습니다.';
  id('play').onclick=()=>{if(blocked||!plan)return;if(position>=plan.releaseEpochHours*3600000)seek(Date.parse(plan.snapshot.timestamp),{play:true});else playing=!playing;updateUi();};
  id('replay').onclick=()=>seek(Date.parse(plan.snapshot.timestamp),{play:true});id('completeReplay').onclick=id('replay').onclick;
  id('reset').onclick=start;id('replayStep').onclick=()=>seek(plan.steps[Number(current.currentStep.slice(-1))-1].startEpochHours*3600000,{play:true});
  id('seek').oninput=e=>seek(Date.parse(plan.snapshot.timestamp)+clamp(+e.target.value/1000)*(plan.releaseEpochHours*3600000-Date.parse(plan.snapshot.timestamp)));
  id('speed').onchange=e=>{if([.5,1,2,4].includes(+e.target.value))speed=+e.target.value;};
  id('autoCam').onclick=()=>{app.cam.auto=!app.cam.auto;if(app.cam.auto&&current)app.cam.set(app.productionHooks.cameras[current.currentStep==='STEP_01'?2:5].camera);updateUi();};
  document.querySelectorAll('[data-camera]').forEach(button=>{const native=button.onclick;button.onclick=()=>{native();updateUi();};});
  const nativeManual=app.cam.onManual;app.cam.onManual=()=>{nativeManual?.();updateUi();};
  document.addEventListener('keydown',event=>{if(event.code==='Space'&&!['INPUT','SELECT','BUTTON','TEXTAREA'].includes(document.activeElement.tagName)&&!id('info').open){event.preventDefault();event.stopImmediatePropagation();id('play').click();}},true);
  window.productionViewer={update:updateUi,tick(dt){if(!playing||blocked||!plan||pending)return;const duration=plan.releaseEpochHours*3600000-Date.parse(plan.snapshot.timestamp);position=Math.min(plan.releaseEpochHours*3600000,position+dt*duration/90*speed);intent++;request();if(position>=plan.releaseEpochHours*3600000)playing=false;},get state(){return current?structuredClone(current):null;},get plan(){return plan?structuredClone(plan):null;},get playing(){return playing;},get blocked(){return blocked;},get position(){return position;},visualState:null};
  controls().forEach(el=>el.disabled=true);id('phase').textContent='현재 적용 생산 데이터 연결 중...';hello();
  id('progress').textContent='—';id('progressBar').style.width='0';id('currentProcess').textContent='현재 적용 시나리오 연결 대기';
  if(parent===window){id('loading').hidden=false;id('loading').innerHTML='<h2>생산 데이터 연결이 필요합니다.</h2><p>메인 웹사이트의 Overview에서 B-203 상세 보기를 열어 주세요.</p>';}
 };
 hello();
})();

// Presentation timing only. Data loading begins immediately in bootstrap().
export function createSplash(documentRoot=document){
 const node=documentRoot.getElementById('app-splash'),app=documentRoot.getElementById('app');
 const started=performance.now(),minimum=5000,timers=new Set();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let closed=false,frame=null,completing=null;
 const pause=ms=>new Promise(resolve=>{const timer=setTimeout(()=>{timers.delete(timer);resolve();},ms);timers.add(timer);});
 const progress=value=>node?.style.setProperty('--splash-progress',String(value));
 function tick(now){
  if(closed)return;
  const elapsed=Math.min(1,(now-started)/minimum);
  // Stop short of completion until real application initialization succeeds.
  progress(.94*(reduced?Math.floor(elapsed*5)/5:elapsed));
  if(elapsed<1)frame=requestAnimationFrame(tick);
 }
 const remove=()=>{
  closed=true;cancelAnimationFrame(frame);for(const timer of timers)clearTimeout(timer);timers.clear();
  node?.remove();documentRoot.body.classList.remove('splash-active');
  app?.removeAttribute('inert');app?.setAttribute('aria-busy','false');
 };
 progress(0);frame=requestAnimationFrame(tick);
 async function finish(){
  const image=node?.querySelector('img');
  await Promise.race([image?.decode?.().catch(()=>{}),pause(2000)]);
  await pause(Math.max(0,minimum-(performance.now()-started)));
  if(closed)return;
  cancelAnimationFrame(frame);progress(1);
  if(!reduced)await pause(180);
  if(closed)return;
  node?.classList.add('is-leaving');
  if(!reduced)await pause(180);
  remove();
 }
 return {
  complete(){return completing??=finish();},
  fail(){remove();},
 };
}

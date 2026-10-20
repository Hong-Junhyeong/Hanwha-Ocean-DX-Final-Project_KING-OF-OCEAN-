const{chromium}=require('playwright'),{spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/phase10/browser');fs.mkdirSync(out,{recursive:true});
const sizes=[[1440,900],[1280,720],[1024,600],[940,385],[760,600],[390,844],[375,667]],checks=[],errors=[],consoleErrors=[],layouts=[];
const ok=(n,v)=>{assert.ok(v,n);checks.push(n);console.log('PASS',n);};
(async()=>{const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5210','--strictPort']);await new Promise((r,j)=>{server.stdout.on('data',d=>String(d).includes('Local:')&&r());server.on('error',j);});let browser,page;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({locale:'ko-KR',acceptDownloads:true});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 const shot=async n=>page.screenshot({path:path.join(out,n+'.png')});
 const layout=async(frame,mode,label)=>{
  const metrics=await frame.evaluate(()=>{
   const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};},visible=el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0;
   const buttons=[...document.querySelectorAll('.transport-controls button,#speed,#seek,.camera-toolbar button')].filter(visible),boxes=buttons.map(el=>({id:el.id||el.dataset.camera,...rect(el)})),overlap=[];
   for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){const u=boxes[a],v=boxes[b];if(Math.min(u.x+u.w,v.x+v.w)-Math.max(u.x,v.x)>1&&Math.min(u.y+u.h,v.y+v.h)-Math.max(u.y,v.y)>1)overlap.push([u.id,v.id]);}
   return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,canvas:rect(document.querySelector('.viewport')),camera:rect(document.querySelector('.camera-toolbar')),playback:rect(document.querySelector('.playback')),boxes,overlap,badge:getComputedStyle(document.querySelector('.prototype')).display,planId:window.productionViewer.plan?.inputSnapshotId};
  });
  ok(label+' '+mode+' no horizontal overflow',metrics.scrollWidth<=metrics.width+1);
  ok(label+' '+mode+' usable scene and separate controls',metrics.canvas.h>=280&&metrics.camera.y+metrics.camera.h<=metrics.playback.y+1&&metrics.overlap.length===0);
  ok(label+' '+mode+' badge hidden without adapter error',metrics.badge==='none'&&!!metrics.planId);
  layouts.push({label,mode,...metrics});
  await frame.locator('#play').click();await page.waitForTimeout(80);await frame.locator('#play').click();
  await frame.locator('#speed').selectOption('2');await frame.locator('#seek').evaluate(el=>{el.value=200;el.dispatchEvent(new Event('input',{bubbles:true}));});
  await frame.waitForFunction(()=>window.productionViewer?.position>Date.parse(window.productionViewer.plan.snapshot.timestamp),null,{timeout:15000});
  await frame.locator('[data-camera="top"]').click();await frame.locator('[data-step="1"]').click();
  await frame.waitForFunction(()=>window.productionViewer?.state.currentStep==='STEP_02',null,{timeout:15000});
  ok(label+' '+mode+' controls and seven-step seek usable',await frame.locator('#steps [data-step]').count()===7);
 };
 for(const [width,height]of sizes){
  const label=width+'x'+height;await page.setViewportSize({width,height});let release;const gate=new Promise(r=>release=r);
  let handled;const continued=new Promise(r=>handled=r);const route=async r=>{await gate;try{await r.continue();}finally{handled();}};await page.route('**/B203_Web_Implementation_Data_v2_20261016.json',route);
  await page.goto('http://127.0.0.1:5210/',{waitUntil:'domcontentloaded'});
  await page.locator('#app-splash').waitFor();await page.waitForFunction(()=>document.querySelector('.app-splash__desktop').naturalWidth>0);
  ok(label+' splash uses exact local artwork',await page.locator('.app-splash__desktop').getAttribute('src')==='./assets/production-loading-screen.png');
  ok(label+' splash locks only loading document',await page.evaluate(()=>document.body.classList.contains('splash-active')&&document.querySelector('#app').inert&&document.documentElement.scrollWidth<=innerWidth+1));
  if(width<600){ok(label+' mobile title readable',await page.locator('.app-splash__mobile h1').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=21));}
  await shot('splash-'+label);release();await continued;await page.unroute('**/B203_Web_Implementation_Data_v2_20261016.json',route);await page.locator('#app-splash').waitFor({state:'detached'});
  ok(label+' splash closes and main title exact',await page.title()==='생산관리 통합 관리 시스템'&&await page.locator('.topbar h1').innerText()==='생산관리 통합 관리 시스템');
  ok(label+' title fits and document remains usable',await page.locator('.topbar h1').evaluate(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth&&r.bottom<=document.querySelector('.topbar').getBoundingClientRect().bottom;})&&await page.evaluate(()=>!document.querySelector('#app').inert&&document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('[data-block="B-203"]').click();await page.locator('.facility-panel__body').evaluate(el=>el.scrollTop=el.scrollHeight);await page.locator('[data-open-b203-viewer]').scrollIntoViewIfNeeded();
  ok(label+' facility final button not clipped',await page.locator('[data-open-b203-viewer]').evaluate(el=>{const b=el.getBoundingClientRect(),p=el.closest('.facility-panel').getBoundingClientRect();return b.bottom<=p.bottom+1&&b.top>=p.top;}));
  await shot('facility-'+label);await page.locator('[data-open-b203-viewer]').click();await page.locator('[data-b203-frame][data-connection="READY"]').waitFor({timeout:20000});
  const frame=page.frames().find(f=>f.url().includes('/3d/assembly_factory_v9.html'));await frame.waitForFunction(()=>window.productionViewer?.state,null,{timeout:15000});await frame.waitForFunction(()=>window.assemblyApp.renderer.info.render.frame>5,null,{timeout:15000});
  await layout(frame,'embedded',label);await shot('3d-embedded-'+label);
  const pos=await frame.evaluate(()=>window.productionViewer.position);await page.locator('[data-viewer-fullscreen]').click();await page.waitForFunction(()=>!!document.fullscreenElement||!!document.querySelector('.is-css-fullscreen'));
  ok(label+' fullscreen keeps playback position',await frame.evaluate(()=>window.productionViewer.position)===pos);
  await layout(frame,'fullscreen',label);await shot('3d-fullscreen-'+label);
  if(await page.evaluate(()=>!!document.fullscreenElement))await page.evaluate(()=>document.exitFullscreen());if(await page.locator('.is-css-fullscreen').count())await page.locator('[data-viewer-fullscreen]').click();
  await page.locator('[data-return-yard]').click();ok(label+' viewer return never replays global splash',await page.locator('#app-splash').count()===0);
  for(const id of['schedule','quality','risk','overview']){await page.locator(`[data-page="${id}"]`).click();ok(label+' '+id+' no splash or page overflow',await page.locator('#app-splash').count()===0&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 }
 // A failed initialization must leave the splash and provide an actionable retry.
 await page.route('**/B203_Web_Implementation_Data_v2_20261016.json',r=>r.fulfill({status:503,body:'unavailable'}));await page.reload();await page.locator('.error-screen').waitFor();ok('initialization error dismisses splash and offers retry',await page.locator('#app-splash').count()===0&&await page.locator('.error-screen button').innerText()==='다시 시도');await page.unroute('**/B203_Web_Implementation_Data_v2_20261016.json');await page.locator('.error-screen button').click();await page.locator('#app-splash').waitFor({state:'detached'});ok('retry recovers Overview',await page.locator('[data-block="B-203"]').count()===1);
 // Reduced motion and slow-data splash are real browser states, not a mock page.
 await page.emulateMedia({reducedMotion:'reduce'});let release;const gate=new Promise(r=>release=r);let handled;const continued=new Promise(r=>handled=r);const route=async r=>{await gate;try{await r.continue();}finally{handled();}};await page.route('**/B203_Web_Implementation_Data_v2_20261016.json',route);await page.reload({waitUntil:'domcontentloaded'});ok('reduced-motion splash disables transition',await page.locator('#app-splash').evaluate(el=>getComputedStyle(el).transitionDuration==='0s'));release();await continued;await page.unroute('**/B203_Web_Implementation_Data_v2_20261016.json',route);await page.locator('#app-splash').waitFor({state:'detached'});await page.emulateMedia({reducedMotion:'no-preference'});
 // Check actual layout at practical zoom factors; native browser chrome zoom differs.
 for(const [width,height]of [[1440,900],[940,385]]){await page.setViewportSize({width,height});await page.locator('[data-block="B-203"]').click();for(const zoom of[.8,1,1.25,1.5]){await page.evaluate(z=>document.documentElement.style.zoom=z,zoom);await page.locator('.facility-panel__body').evaluate(el=>el.scrollTop=el.scrollHeight);await page.locator('[data-open-b203-viewer]').scrollIntoViewIfNeeded();ok(width+' CSS zoom '+zoom+' facility accessible',await page.locator('[data-open-b203-viewer]').evaluate(el=>el.getBoundingClientRect().bottom<=el.closest('.facility-panel').getBoundingClientRect().bottom+1));}await page.evaluate(()=>document.documentElement.style.zoom='1');}
 const touch=await browser.newContext({viewport:{width:375,height:667},isMobile:true,hasTouch:true,locale:'ko-KR'}),mobile=await touch.newPage();await mobile.goto('http://127.0.0.1:5210/');await mobile.locator('#app-splash').waitFor({state:'detached'});await mobile.locator('[data-block="B-203"]').tap();await mobile.locator('[data-open-b203-viewer]').tap();await mobile.locator('[data-b203-frame][data-connection="READY"]').waitFor({timeout:20000});const mf=mobile.frames()[1];await mf.locator('[data-step="1"]').tap();await mf.locator('#play').tap();await mf.locator('#play').tap();ok('mobile touch step and play controls respond',await mf.evaluate(()=>window.productionViewer.state.currentStep==='STEP_02'));await touch.close();
 // The expected synthetic 503 is checked above, so distinguish it from runtime errors.
 ok('no JavaScript runtime errors',errors.length===0);ok('no unexpected console errors',consoleErrors.every(e=>e.includes('503')));
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors,consoleErrors,layouts,viewports:sizes,browser:await browser.version(),renderer:'ANGLE SwiftShader WebGL',zoom:'CSS zoom verified; native browser zoom not verified'},null,2));console.log('V10 BROWSER PASS',checks.length);
}catch(e){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:e.stack,checks,errors,consoleErrors},null,2));await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});

const{chromium}=require('playwright');const{spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/phase10/scenarios');fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[],consoleErrors=[],scenarios=[];
const ok=(name,condition)=>{assert.ok(condition,name);checks.push(name);console.log('PASS',name);};
(async()=>{
 const{getPlaybackStateAt}=await import('../src/playback/index.js');
 const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5212','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});let browser,page;
 try{
  await new Promise((resolve,reject)=>{server.stdout.on('data',d=>String(d).includes('Local:')&&resolve());server.on('error',reject);server.on('exit',c=>reject(Error('V10 server exit '+c)));});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  page=await browser.newPage({viewport:{width:1920,height:1080},locale:'ko-KR',acceptDownloads:true});
  page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  const nav=async name=>{await page.locator(`[data-page="${name}"]`).click();await page.locator(`[data-page="${name}"].is-active`).waitFor();};
  const calculated=()=>page.waitForFunction(()=>document.querySelector('[data-dirty]')?.textContent==='현재 입력조건 계산 완료'&&!document.querySelector('.calculated-output')?.classList.contains('is-stale'));
  const shot=async name=>{await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(out,name+'.png')});};
  const open=async()=>{await nav('overview');await page.locator('[data-open-b203-viewer]').click();await page.locator('[data-b203-frame][data-connection="READY"]').waitFor({timeout:20000});const frame=page.frames().find(f=>f.url().includes('/3d/assembly_factory_v9.html'));assert.ok(frame);await frame.waitForFunction(()=>window.productionViewer?.state);await frame.waitForFunction(()=>window.assemblyApp.renderer.info.render.frame>10);return frame;};
  const data=frame=>frame.evaluate(()=>({plan:window.productionViewer.plan,state:window.productionViewer.state,visual:window.productionViewer.visualState,playing:window.productionViewer.playing,position:window.productionViewer.position,frame:window.assemblyApp.renderer.info.render.frame,transporter:window.assemblyApp.transporter.position.toArray(),camera:window.assemblyApp.cam.camera.position.toArray()}));
  const seek=async(frame,plan,time)=>{
   const value=Math.max(0,Math.min(1000,Math.round((Date.parse(time)-Date.parse(plan.snapshot.timestamp))/(plan.releaseEpochHours*3600000-Date.parse(plan.snapshot.timestamp))*1000)));
   const before=await frame.evaluate(()=>window.productionViewer.state.timestamp);
   await frame.locator('#seek').evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
   const expected=new Date(Date.parse(plan.snapshot.timestamp)+(plan.releaseEpochHours*3600000-Date.parse(plan.snapshot.timestamp))*value/1000).toISOString();
   await frame.waitForFunction(t=>{const v=window.productionViewer;return v.state&&Math.abs(Date.parse(v.state.timestamp)-Date.parse(t))<1200;},value===0?plan.snapshot.timestamp:value===1000?plan.expectedHandover:expected);
   const result=await data(frame);assert.deepEqual(result.state,getPlaybackStateAt(plan,result.state.timestamp));return result;
  };
  const midpoint=a=>new Date((a.startEpochHours+a.endEpochHours)*1800000).toISOString();
  const exitFullscreen=async()=>{if(await page.evaluate(()=>!!document.fullscreenElement))await page.evaluate(()=>document.exitFullscreen());if(await page.locator('.is-css-fullscreen').count())await page.locator('[data-viewer-fullscreen]').click();};
  await page.goto('http://127.0.0.1:5212/');await page.locator('[data-block="B-203"]').waitFor();
  ok('exactly four menus and neutral initial selection',await page.locator('[data-page]').count()===4&&await page.locator('.map-hotspot.is-selected').count()===0);
  ok('original sidebar photo is used',await page.locator('.sidebar-ship').evaluate(el=>el.naturalWidth===140&&el.naturalHeight===342));
  ok('crisp vector footer with exact text and no duplicate',await page.locator('.sidebar-brand').count()===1&&(await page.locator('.sidebar-brand').innerText()).includes('Shipyard Production Management'));
  await shot('01-overview-after');await page.locator('.sidebar').screenshot({path:path.join(out,'02-sidebar-after.png')});
  await page.locator('[data-block="B-203"]').click();let frame=await open(),d=await data(frame);
  ok('baseline calculated without first opening Risk',d.plan.strategyId==='A2'&&d.plan.playbackReady);
  ok('local viewer uses supplied Three.js scene',await page.locator('[data-b203-frame]').getAttribute('src')==='/3d/assembly_factory_v9.html'&&await frame.evaluate(()=>window.assemblyApp.scene.getObjectByName('FORE_BLOCK_ROOT')&&window.assemblyApp.scene.getObjectByName('CRN-01')&&window.assemblyApp.renderer.getContext().getParameter(window.assemblyApp.renderer.getContext().VERSION).includes('WebGL')));
  ok('snapshot starts at 64.7059 percent',Math.abs(d.state.productionProgress-220/340)<1e-10);
  ok('initial geometry modules include 75 percent partial shell',d.state.geometryProgress.find(x=>x.moduleId==='S190').moduleProgress===.75);
  ok('seven production steps retain original buttons',await frame.locator('#steps .step').count()===7&&(await frame.locator('#steps').innerText()).includes('QC 대기·재검사'));
  await shot('03-embedded-snapshot');await page.locator('[data-viewer-fullscreen]').click();await page.waitForFunction(()=>!!document.fullscreenElement||!!document.querySelector('.is-css-fullscreen'));await shot('04-fullscreen-snapshot');
  let camera=(await data(frame)).camera;await frame.locator('[data-camera="top"]').click();await page.waitForTimeout(400);ok('native camera preset responds',JSON.stringify((await data(frame)).camera)!==JSON.stringify(camera));
  camera=(await data(frame)).camera;const canvas=frame.locator('#scene'),box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.55);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.6,{steps:5});await page.mouse.up();await page.waitForTimeout(150);ok('native orbit rotation responds',JSON.stringify((await data(frame)).camera)!==JSON.stringify(camera));
  camera=(await data(frame)).camera;await page.mouse.wheel(0,200);await page.waitForTimeout(150);ok('native camera zoom responds',JSON.stringify((await data(frame)).camera)!==JSON.stringify(camera));
  await frame.locator('#roof').click();ok('native roof toggle responds',await frame.locator('#roof').getAttribute('aria-pressed')==='true');await frame.locator('#roof').click();
  await frame.locator('#play').click();await page.waitForTimeout(350);await frame.locator('#play').click();const paused=await data(frame);await page.waitForTimeout(200);ok('play advances and pause freezes production position',paused.position>Date.parse(d.plan.snapshot.timestamp)&&(await data(frame)).position===paused.position);
  await frame.locator('#speed').selectOption('2');await frame.locator('#replay').click();await page.waitForTimeout(150);await frame.locator('#play').click();await frame.locator('#reset').click();await frame.waitForFunction(()=>window.productionViewer.state.productionProgress===220/340);ok('replay reset restore snapshot with speed control',await frame.locator('#speed').inputValue()==='2');
  const weld=d.plan.steps[1].activitySegments.find(x=>x.type==='WORK'&&x.durationMinutes>20);let a=await seek(frame,d.plan,midpoint(weld));ok('welding work advances existing seam effects with crane HOME',a.visual.productive&&a.visual.craneHome&&a.state.currentStep==='STEP_02');await shot('05-welding');
  const lunch=d.plan.steps[1].activitySegments.find(x=>x.type==='LUNCH');a=await seek(frame,d.plan,midpoint(lunch));ok('lunch stops production animation',!a.visual.productive&&a.state.activeSegmentType==='LUNCH');
  const frozen=await data(frame);await page.waitForTimeout(150);ok('paused lunch has deterministic scene and progress',JSON.stringify((await data(frame)).state)===JSON.stringify(frozen.state));
  a=await seek(frame,d.plan,midpoint(lunch));ok('repeat seek reconstructs identical production state',JSON.stringify(a.state)===JSON.stringify(frozen.state));
  const night=d.plan.steps[1].activitySegments.find(x=>x.type==='WAIT_NONWORK');a=await seek(frame,d.plan,midpoint(night));ok('overnight stops production effects',!a.visual.productive&&a.state.stepState==='WAITING_NONWORK');
  await exitFullscreen();await page.locator('[data-return-yard]').click();ok('return preserves B203 selection',await page.locator('[data-block="B-203"].is-selected').count()===1);

  for(const name of ['N','A1','A2','B1','NONE']){
   await nav('risk');await page.locator('[data-scenario-reset]').click();await calculated();
   await page.locator('[data-scenario="selectedStrategy"]').selectOption(name==='NONE'?'N':name);await calculated();
   if(name==='NONE'){await page.locator('[data-scenario="qualityMode"]').selectOption('NONE');await calculated();}
   const[download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-results-export]:visible').first().click()]);const jsonFile=path.join(out,name+'-current.json');await download.saveAs(jsonFile);const exported=JSON.parse(fs.readFileSync(jsonFile));
   frame=await open();d=await data(frame);assert.equal(d.plan.inputSnapshotId,exported.playbackPlan.inputSnapshotId);assert.equal(d.plan.expectedHandover,exported.result.handover);assert.equal(d.plan.financialSnapshot.total,exported.result.total);ok(name+' viewer uses the same current applied input and financial result',true);
   await page.locator('[data-viewer-fullscreen]').click();
   if(name==='A1'){
    const wait=d.plan.steps[5].activitySegments.find(x=>x.type==='WAIT_QC');a=await seek(frame,d.plan,midpoint(wait));ok('A1 waits for QC without scan or inspection progress',a.state.stepState==='WAITING_QC'&&!a.visual.qcActive&&a.state.stepProgress===0);await shot('06-A1-QC-wait');
    const qc=d.plan.steps[5].activitySegments.find(x=>x.type==='QC_REINSPECTION');a=await seek(frame,d.plan,midpoint(qc));ok('A1 next window activates native inspection scan',a.visual.qcActive&&a.state.qualityStatus==='REINSPECTION_IN_PROGRESS'&&await frame.evaluate(()=>window.assemblyApp.engine.effects.scan.visible));
   }
   if(name==='A2'){
    const qc=d.plan.steps[5].activitySegments.find(x=>x.type==='QC_REINSPECTION');a=await seek(frame,d.plan,midpoint(qc));ok('A2 same-day reinspection uses actual QC segment',a.visual.qcActive&&a.state.productionProgress===1&&d.plan.steps[5].waitQcHours===0);await shot('07-A2-reinspection');
   }
   if(name==='B1')ok('B1 current plan retains support and 24 MH source-process loss',d.plan.productionBaseline.sourceProcessLostMH===24&&d.plan.steps[0].effectiveWorkers===6);
   if(name==='NONE'){ok('NONE skips rework and reinspection without invented effects',d.plan.steps[4].skipped&&d.plan.steps[5].skipped);}
   a=await seek(frame,d.plan,d.plan.expectedHandover);ok(name+' release matches engine without transporter exit',a.state.handoverStatus==='RELEASED'&&Math.abs(a.transporter[0]-105)<1e-8&&a.state.productionProgress===1);
   scenarios.push({scenario:name,strategy:d.plan.strategyId,quality:d.plan.quality.mode,handover:d.plan.expectedHandover,deadlineMet:d.plan.deadlineMet,qcWaitHours:d.plan.steps[5].waitQcHours,inputSnapshotId:d.plan.inputSnapshotId,total:d.plan.financialSnapshot.total});
   await exitFullscreen();await page.locator('[data-return-yard]').click();
  }
  await nav('risk');await page.locator('[data-scenario-reset]').click();await calculated();await page.locator('[data-advanced-settings]').evaluate(el=>el.open=true);await page.locator('[data-advanced-json]').evaluate(el=>el.closest('details').open=true);await page.locator('[data-advanced-json]').fill('{');await nav('overview');await page.locator('[data-open-b203-viewer]').click();await page.locator('[data-b203-frame][data-connection="STALE"]').waitFor();ok('unapplied JSON blocks stale plan transmission',await page.locator('[data-frame-loading]').isVisible());await page.locator('[data-return-yard]').click();await nav('risk');await page.locator('[data-scenario-reset]').click();await calculated();
  frame=await open();d=await data(frame);const original=d.state;await page.evaluate(()=>window.postMessage({protocol:'B203_PRODUCTION_VIEWER_V1',type:'HELLO',viewerId:'forged'},location.origin));await page.waitForTimeout(150);ok('forged same-window source cannot replace iframe plan',JSON.stringify((await data(frame)).state)===JSON.stringify(original));await page.locator('[data-return-yard]').click();

  const responsive=[];
  for(const width of [1440,1280,1200,1080,900,760,600]){
   await page.setViewportSize({width,height:900});
   for(const zoom of [.8,1,1.25,1.5]){
    // CSS zoom exercises actual layout boxes; native browser chrome zoom is separate.
    await page.evaluate(z=>document.documentElement.style.zoom=z,zoom);
    const result=await page.locator('.facility-panel__body').evaluate(el=>{el.scrollTop=el.scrollHeight;const last=el.lastElementChild,panel=el.closest('.facility-panel');return{width:innerWidth,zoom:getComputedStyle(document.documentElement).zoom,bodyHeight:el.clientHeight,scrollHeight:el.scrollHeight,max:getComputedStyle(el).maxHeight,overflow:getComputedStyle(el).overflowY,panelBottom:panel.getBoundingClientRect().bottom,lastBottom:last.getBoundingClientRect().bottom,scrollTop:el.scrollTop};});
    ok(`facility content accessible ${width} at CSS zoom ${zoom}`,width<=1200?result.max==='none'&&result.lastBottom<=result.panelBottom+2:result.lastBottom<=result.panelBottom+2||result.scrollTop>0);
    responsive.push(result);
   }
   await page.evaluate(()=>document.documentElement.style.zoom='1');
   if([1200,1080,600].includes(width)){await page.locator('.facility-panel').scrollIntoViewIfNeeded();await shot('scroll-'+width);}
  }
  fs.writeFileSync(path.join(out,'responsive.json'),JSON.stringify(responsive,null,2));
  ok('no uncaught runtime errors',errors.length===0);ok('no console errors',consoleErrors.length===0);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors,consoleErrors,scenarios,browser:await browser.version(),renderer:'Chromium ANGLE SwiftShader WebGL, original scene',server:'V9 dedicated 5212',zoomVerification:'CSS zoom 80/100/125/150%; native browser chrome zoom not tested'},null,2));
  console.log('V10 SCENARIO BROWSER PASS',checks.length);
 }catch(error){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:error.stack,checks,errors,consoleErrors},null,2));if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
 finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});

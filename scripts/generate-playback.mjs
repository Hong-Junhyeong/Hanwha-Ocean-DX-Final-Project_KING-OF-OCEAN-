import fs from 'node:fs';
import {baseline} from '../src/engine/scenario.js';
import {simulate} from '../src/engine/simulation.js';
import {buildAssemblyPlaybackPlan,getPlaybackStateAt,validateAssemblyPlaybackPlan} from '../src/playback/index.js';
const p=JSON.parse(fs.readFileSync('public/data/source/B203_Web_Implementation_Data_v2_20261016.json')),records=JSON.parse(fs.readFileSync('src/data/qualityInspectionRecords.json'));
fs.mkdirSync('examples/playback',{recursive:true});fs.mkdirSync('docs/phase8',{recursive:true});
const report=[];for(const name of ['N','A1','A2','B1','NONE']){
 const s=baseline(p);s.selectedStrategy=name==='NONE'?'N':name;if(name==='NONE')s.qualityMode='NONE';
 const r=simulate(s,records),plan=buildAssemblyPlaybackPlan(s,r),validation=validateAssemblyPlaybackPlan(plan);
 if(!validation.valid||!plan.playbackReady)throw Error(name+': '+[...validation.errors,...plan.readinessIssues].join(' / '));
 fs.writeFileSync(`examples/playback/${name}.json`,JSON.stringify(plan,null,2));
 report.push({scenario:name,ready:plan.playbackReady,segments:plan.steps.reduce((n,x)=>n+x.activitySegments.length,0),handover:plan.expectedHandover,deadlineMet:plan.deadlineMet,reworkMH:r.reworkMH,waitQcHours:plan.steps[5].waitQcHours,total:r.total,sourceProcessLostMH:r.sourceProcessLostMH,progressCheckpoints:[s.start,...plan.steps.slice(0,4).map(x=>x.end),plan.expectedHandover].map(timestamp=>getPlaybackStateAt(plan,timestamp))});
}
fs.copyFileSync('src/playback/ASSEMBLY_PLAYBACK_PLAN_V1.schema.json','examples/playback/ASSEMBLY_PLAYBACK_PLAN_V1.schema.json');fs.writeFileSync('docs/phase8/playback-validation.json',JSON.stringify(report,null,2));console.log(report.map(({progressCheckpoints,...r})=>r));

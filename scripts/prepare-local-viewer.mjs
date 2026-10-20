// Reproducible, guarded patch of the preserved single-file viewer. No geometry edits.
import fs from 'node:fs';
import crypto from 'node:crypto';
const original='integration-reference/assembly_factory_v1.original.html';
let html=fs.readFileSync(original,'utf8');
if(crypto.createHash('sha256').update(html).digest('hex')!=='e5b2d85432e189df94872bd2ca4313de0d9cf385445bcf061201097bae9b9155')throw Error('원본 3D HTML이 다릅니다. 패치를 중단합니다.');
const patches=[
 ['</style>','</style><link rel="stylesheet" href="./viewer-responsive.css">'],
 ['<script>(()=>','<script src="./assembly-data-adapter.js"></script>\n<script>(()=>'],
 ['l.tick(g)&&(h.step(l.step),p.update())','(window.productionViewer?window.productionViewer.tick(g):l.tick(g)&&(h.step(l.step),p.update()))'],
 ['d>.08&&(p.update(),d=0)','d>.08&&((window.productionViewer?.update??p.update)(),d=0)'],
 ['factory:i},document.addEventListener("visibilitychange"','factory:i,productionHooks:{parts:_t,order:Gr,home:zn,cameras:Qt}},window.installProductionPlayback?.(window.assemblyApp),document.addEventListener("visibilitychange"'],
 ['}catch(r){console.error(r),document.getElementById("loading").innerHTML=', '}catch(r){window.reportProductionViewerError?.(r.message),console.error(r),document.getElementById("loading").innerHTML='],
];
for(const [from,to]of patches){if(html.split(from).length!==2)throw Error('3D 패치 기준점 불일치: '+from);html=html.replace(from,to);}
fs.mkdirSync('public/3d',{recursive:true});fs.writeFileSync('public/3d/assembly_factory_v9.html',html);
console.log('Local viewer: six guarded patches; geometry/factory/crane/effects/camera code retained.');

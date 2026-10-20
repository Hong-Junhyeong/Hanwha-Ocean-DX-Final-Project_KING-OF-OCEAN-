import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base=process.argv[2];if(!base)throw Error('사용법: node tests/verify-v7-preservation.mjs <첨부 V6 압축해제 폴더>');
const list=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?list(path.join(dir,x.name)):[path.join(dir,x.name)]);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const changedAllowed=new Set(['src/ui/riskState.js','src/components/riskPage.js','src/components/navigation.js','src/export/workbook.js','src/engine/simulation.js','src/styles/responsive.css']);
const same=[],changed=[];
for(const p of [...list(path.join(base,'src')),...list(path.join(base,'public'))]){const name=path.relative(base,p);assert.ok(fs.existsSync(name),'base file retained '+name);if(hash(p)===hash(name))same.push(name);else{changed.push(name);assert.ok(changedAllowed.has(name),'no unrelated edits '+name);}}
const report={base:'Attached Shipyard_Production_Management_Clean_V6(3).zip',unchangedCount:same.length,unchanged:same,approvedChanged:changed};fs.writeFileSync('docs/phase7/preservation.json',JSON.stringify(report,null,2));
const bat=fs.readFileSync('start-dev.bat','utf8');assert.ok(bat.includes('cd /d "%~dp0"')&&bat.includes('where node')&&bat.includes('where npm')&&bat.includes('call npm install')&&bat.includes('--open'));assert.ok(!/(?<!\r)\n/.test(bat),'Windows CRLF');console.log(report.unchangedCount+' source/asset files byte-identical; approved changes: '+changed.join(', '));console.log('start-dev.bat static checks passed; Windows execution not performed');

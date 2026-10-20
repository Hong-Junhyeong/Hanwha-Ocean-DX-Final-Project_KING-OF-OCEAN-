import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const hash=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const baseline=JSON.parse(fs.readFileSync('docs/phase10/v9-source-sha256.json'));
const permitted=new Set(['src/main.js','src/components/layout.js','src/styles/responsive.css','public/3d/assembly_factory_v9.html']);
const changed=[],preserved=[];
for(const [file,sha]of Object.entries(baseline)){
 assert.ok(fs.existsSync(file),'V9 file retained: '+file);
 if(hash(file)===sha)preserved.push(file);
 else {assert.ok(permitted.has(file),'Unauthorized V9 source/asset change: '+file);changed.push(file);}
}
assert.equal(preserved.length+changed.length,54);
assert.equal(hash('public/assets/production-loading-screen.png'),'b723c7907c6a231fb4e0e9d76b579fdd1f3c99e1d068009fe043f5e413f82327','exact uploaded PNG');
assert.equal(hash('integration-reference/assembly_factory_v1.original.html'),'e5b2d85432e189df94872bd2ca4313de0d9cf385445bcf061201097bae9b9155','original viewer geometry and logic');
const bat=fs.readFileSync('start-dev.bat','utf8');
for(const text of ['cd /d "%~dp0"','where node','where npm','call npm install','call npm run dev -- --host 0.0.0.0 --open','if errorlevel 1','pause'])assert.ok(bat.includes(text),'Windows startup: '+text);
assert.ok(bat.includes('\r\n')&&!bat.replaceAll('\r\n','').includes('\n'),'Windows CRLF retained');
const report={baselineFiles:54,preservedFiles:preserved.length,changedFiles:changed,exactUploadedPng:true,originalViewerUnchanged:true,unchangedFiles:preserved,windowsStartup:'CRLF, quoted directory, runtime/install/error/open checks retained; actual Windows execution not performed'};
fs.writeFileSync('docs/phase10/preservation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

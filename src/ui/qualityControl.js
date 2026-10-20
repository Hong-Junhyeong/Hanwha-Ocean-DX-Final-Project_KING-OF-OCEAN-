import {controlPoints,LABELS}from '../engine/quality.js';
const pct=n=>n===null?'—':(n*100).toFixed(2)+'%';
// Management targets affect annotations only. Historical rates and predictions remain immutable.
export function monthlyControlModel(records,type,targetPct=null){
 if(targetPct!==null&&(!Number.isFinite(targetPct)||targetPct<0||targetPct>100))throw Error('품질 목표는 0~100% 또는 미설정이어야 합니다.');
 return controlPoints(records,type).map(r=>({...r,target:targetPct===null?null:targetPct/100,targetExceeded:targetPct!==null&&r.n>0&&r.failRate>targetPct/100,statisticalExceeded:r.out}));
}
export function renderMonthlyControl(rows,u){
 const type=u.scatterType,target=u.targets[type],points=monthlyControlModel(rows,type,target),visible=u.showLimits;
 const maxY=Math.max(.1,...points.flatMap(r=>[r.failRate,visible?(r.ucl??0):0]),target===null?0:target/100)*1.15;
 const x=i=>55+i*475/Math.max(1,points.length-1),y=v=>240-v/maxY*185;
 const path=k=>points.filter(r=>r[k]!==null&&r.n).map(r=>`${x(points.indexOf(r))},${y(r[k])}`).join(' ');
 const p=points.find(r=>r.month===u.selectedMonth);
 return `<div class="control-settings"><label>품질 목표 상한 (%) <input type="number" data-quality-target="${type}" min="0" max="100" step="0.1" value="${target??''}" placeholder="미설정"></label><span class="target-source">${target===null?'미설정':`품질 목표 상한 — 사용자 설정 (${target.toFixed(2)}%)`}</span><label class="check-inline"><input type="checkbox" data-control-limits ${visible?'checked':''}>통계 관리한계 표시</label></div>
 <p class="chart-legend"><span>● 월별 관측</span>${visible?'<span class="cl">CL</span><span class="ucl">UCL</span><span class="lcl">LCL</span>':''}${target!==null?'<span class="target">목표 상한 (사용자)</span>':''}</p>
 <div class="quality-scroll-chart" tabindex="0" role="region" aria-label="월별 관리도. 좁은 화면에서는 가로로 스크롤할 수 있습니다."><svg class="scatter-chart monthly-control-chart" viewBox="0 0 580 300" role="img" aria-label="${LABELS[type]} 월별 불합격률 관리도"><title>월별 최초 불합격률과 표본수별 p-chart 통계 한계</title>
 ${[0,.25,.5,.75,1].map(r=>`<line x1="55" x2="530" y1="${y(maxY*r)}" y2="${y(maxY*r)}" stroke="#e0e6ee"/><text x="47" y="${y(maxY*r)+4}" text-anchor="end">${pct(maxY*r)}</text>`).join('')}
 ${visible?`<polyline data-control="ucl" points="${path('ucl')}" fill="none" stroke="#d54a54" stroke-dasharray="5 4"/><polyline data-control="lcl" points="${path('lcl')}" fill="none" stroke="#546da6" stroke-dasharray="5 4"/><polyline data-control="cl" points="${path('cl')}" fill="none" stroke="#20906e" stroke-dasharray="5 4"/>`:''}
 ${target!==null?`<line data-target-line x1="55" x2="530" y1="${y(target/100)}" y2="${y(target/100)}" stroke="#ff720b" stroke-width="2" stroke-dasharray="3 3"/>`:''}
 <polyline data-monthly-observations points="${path('failRate')}" fill="none" stroke="#3376cc" stroke-width="2"/>
 ${points.map((r,i)=>`<g role="button" tabindex="0" data-scatter-month="${r.month}" data-target-exceeded="${r.targetExceeded}" data-statistical-exceeded="${r.statisticalExceeded}" aria-label="${r.month} ${pct(r.failRate)}. ${r.targetExceeded?'목표 초과.':''}${r.statisticalExceeded?'통계 관리한계 이탈.':''}"><title>${r.month}: 검사 ${r.n} / 불합격 ${r.failures} / ${pct(r.failRate)} / CL ${pct(r.cl)}, UCL ${pct(r.ucl)}, LCL ${pct(r.lcl)} / ${target===null?'목표 미설정':r.targetExceeded?'사용자 목표 초과':'사용자 목표 이내'}</title>${r.n?`<circle cx="${x(i)}" cy="${y(r.failRate)}" r="12" fill="transparent" stroke="none" pointer-events="all"/><circle cx="${x(i)}" cy="${y(r.failRate)}" r="${u.selectedMonth===r.month?7:5}" fill="${r.statisticalExceeded?'#c93644':'#3376cc'}" stroke="${r.targetExceeded?'#ff720b':'white'}" stroke-width="${r.targetExceeded?3:1.5}"/>`:''}</g><text x="${x(i)}" y="263" text-anchor="middle" font-size="10">${r.month.slice(2).replace('-','.')}</text>`).join('')}
 <text x="295" y="291" text-anchor="middle">검사 월</text><text x="12" y="142" text-anchor="middle" transform="rotate(-90 12 142)">최초 불합격률 (%)</text></svg></div>
 <div class="control-observation" aria-live="polite">${p?`<strong>선택 월 ${p.month}</strong> · 검사 ${p.n}건 / 불합격 ${p.failures}건 / ${pct(p.failRate)}<br>CL ${pct(p.cl)} · UCL ${pct(p.ucl)} · LCL ${pct(p.lcl)}<br>통계: ${p.statisticalExceeded?'관리한계 이탈':'관리한계 이내'} · 목표: ${target===null?'미설정':p.targetExceeded?'사용자 목표 초과':'사용자 목표 이내'}`:'월별 점을 선택하면 상세 수치와 해당 월 검사 이력을 확인할 수 있습니다.'}</div>
 <p class="quality-chart-note">목표 초과 ${points.filter(r=>r.targetExceeded).length}개월 · 통계 관리한계 이탈 ${points.filter(r=>r.statisticalExceeded).length}개월. 두 판정은 별개입니다. ${points.some(r=>r.approximationLimited)?'일부 월 np 또는 n(1−p) < 5로 정규근사 해석에 제한이 있습니다.':''} 통계 한계는 합격 공차나 공식 회사 목표가 아닙니다.</p>`;
}

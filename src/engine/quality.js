// Pure statistics. Inspection categories are not physical defect-cause codes.
export const TYPES = ['WELD','FITUP','DIMENSION'];
export const LABELS = {WELD:'용접',FITUP:'취부·정합',DIMENSION:'치수·형상'};
export function periodRows(records, months=12) {
 const dates=[...new Set(records.map(r=>r.month))].sort().slice(-months);
 return records.filter(r=>dates.includes(r.month));
}
export function summary(rows) {
 const n=rows.length, failures=rows.filter(r=>r.result==='FAIL').length, reworks=rows.filter(r=>r.reworkRequired).length;
 return {n,failures,reworks,failRate:n?failures/n:0,reworkRate:n?reworks/n:0,mh:rows.reduce((a,r)=>a+r.reworkMH,0)};
}
export function pareto(rows, metric='failures',types=TYPES) {
 const a=types.map(type=>({type,...summary(rows.filter(r=>r.type===type))})).sort((a,b)=>b[metric]-a[metric]);
 const total=a.reduce((s,r)=>s+r[metric],0);let cumulative=0;
 return a.map(r=>({...r,value:r[metric],share:total?r[metric]/total:0,cumulative:total?(cumulative+=r[metric])/total:0}));
}
export function limits(p,n) {return n>0?{cl:p,ucl:Math.min(1,p+3*Math.sqrt(p*(1-p)/n)),lcl:Math.max(0,p-3*Math.sqrt(p*(1-p)/n))}:{cl:p,ucl:null,lcl:null};}
export function controlPoints(rows,type) {
 const selected=rows.filter(r=>r.type===type),p=summary(selected).failRate;
 return [...new Set(rows.map(r=>r.month))].sort().map(month=>{const s=summary(selected.filter(r=>r.month===month)),l=limits(p,s.n);return {month,...s,...l,out:s.n>0&&(s.failRate>l.ucl||s.failRate<l.lcl),approximationLimited:s.n*p<5||s.n*(1-p)<5};});
}
export function predict(records,{mode='12M',weight6=.7,pending={WELD:27,FITUP:15,DIMENSION:8},standards={WELD:3,FITUP:2,DIMENSION:4}}={}) {
 if(!['12M','6M','WEIGHTED'].includes(mode)||weight6<0||weight6>1)throw Error('품질 모델/가중치 오류');
 const rows=TYPES.map(type=>{const a=summary(periodRows(records,12).filter(r=>r.type===type)),b=summary(periodRows(records,6).filter(r=>r.type===type));
 if(!a.n||!b.n)throw Error(`${type} 품질 이력 부족`);
 const mix=key=>mode==='12M'?a[key]:mode==='6M'?b[key]:weight6*b[key]+(1-weight6)*a[key];
 const failures=pending[type]*mix('failRate'),cases=pending[type]*mix('reworkRate');
 return {type,pending:pending[type],failRate:mix('failRate'),reworkRate:mix('reworkRate'),failures,cases,mh:cases*standards[type]};});
 return {rows,failures:rows.reduce((s,r)=>s+r.failures,0),cases:rows.reduce((s,r)=>s+r.cases,0),mh:rows.reduce((s,r)=>s+r.mh,0)};
}

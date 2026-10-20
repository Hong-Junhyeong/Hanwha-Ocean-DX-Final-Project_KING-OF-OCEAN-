// Shared explanations and cost categories read the engine's calculated lines.
// No schedule or quality formula is duplicated in the presentation/export layer.
export function financialBreakdown(r){
 const sum=(filter,key)=>r.costs.filter(filter).reduce((n,c)=>n+c[key],0);
 return {labor:sum(c=>c.category!=='추가 QC','labor'),overtime:sum(c=>c.category==='연장근로','labor'),support:sum(c=>['내부 지원','외부 지원'].includes(c.category),'labor'),regular:sum(c=>c.category==='납기 이후 추가 정규 대응','labor'),qc:sum(c=>c.category==='추가 QC','labor'),other:sum(()=>true,'other')};
}
export const QUALITY_MODE_LABELS={'12M':'최근 12개월 합성 품질 이력','6M':'최근 6개월 합성 품질 이력',WEIGHTED:'가중 합성 품질 이력',NONE:'추가 재작업 없음',CONFIRMED:'확정 보수 목록 입력',CUSTOM:'사용자 가정 공수'};
export function qualityBasis(s,r){
 const pending=Object.values(s.pending).reduce((n,v)=>n+v,0);
 if(s.reworkStatus==='RESOLVED')return {model:'해결 처리',text:'재작업 상태 RESOLVED로 추가 공수를 0 MH 적용했습니다.'};
 if(r.prediction)return {model:QUALITY_MODE_LABELS[s.qualityMode],text:`검사 예정 ${pending}건 · 예상 보수 약 ${r.prediction.cases.toFixed(2)}건${s.qualityMode==='WEIGHTED'?` · 6개월 ${(s.weight6*100).toFixed(1)}% / 12개월 ${((1-s.weight6)*100).toFixed(1)}%`:''}. 검사 유형별 보수 필요율 × 예정 건수 × 표준 보수공수로 계산합니다.`};
 if(s.qualityMode==='CONFIRMED')return {model:QUALITY_MODE_LABELS.CONFIRMED,text:`입력 목록 중 CONFIRMED ${s.confirmedReworks.filter(x=>x.status==='CONFIRMED').length}건의 공수 합계입니다. 현장 검증 여부는 별도 확인해야 합니다.`};
 return {model:QUALITY_MODE_LABELS[s.qualityMode],text:s.qualityMode==='CUSTOM'?'입력한 사용자 가정 MH를 적용했습니다. 보수 건수·확정 불량을 추정하지 않습니다.':'추가 재작업 및 재검사 비용을 적용하지 않았습니다.'};
}
export function laborBasis(r){
 const f=financialBreakdown(r),money=n=>Math.round(n).toLocaleString('ko-KR')+'원',number=n=>Number(n.toFixed(3)).toLocaleString('ko-KR');
 const lines=r.costs.filter(c=>c.category!=='추가 QC'&&c.mh>0).map(c=>`${c.category} ${c.headcount}명 × 인당 ${number(c.hours)}h × ${money(c.rate)}/MH`);
 return `${r.strategy} · ${lines.join(' / ')||'추가 생산인력 유급 배정 없음'}${['A1','A2'].includes(r.strategy)?' (고정 OT 배정)':''}. 추가 QC ${money(f.qc)} · 기타 ${money(f.other)} 별도.`;
}
export function workforceBasis(s){
 const labels={reworkWorkers:'재작업',affectedWorkers:'설비 영향',overtimeWorkers:'OT'};
 const items=Object.entries(s.workforcePreferences??{}).filter(([key,value])=>value!==s[key]).map(([key,value])=>`${labels[key]} 입력 ${value}명 → 계산 ${s[key]}명`);
 return items.length?`주 인원 ${s.workers}명 한도를 적용했습니다: ${items.join(', ')}. 입력 선호값은 유지하며 주 인원 복원 시 다시 적용됩니다.`:'';
}

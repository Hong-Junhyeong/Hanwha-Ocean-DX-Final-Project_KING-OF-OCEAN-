// Period allocation comes only from the dispatcher's actual paid reservations.
// Ratios link the dated share back to the existing cost-detail Excel cells.
export function executionPlan(s,r){
 const days=new Map(),unallocated={date:'기간 미배분',productionPaidMH:0,qcPaidMH:0,amount:0,terms:[]};
 const rowFor=date=>{if(!days.has(date))days.set(date,{date,productionPaidMH:0,qcPaidMH:0,amount:0,terms:[]});return days.get(date);};
 r.costs.forEach((c,i)=>{
  const row=i+20,isQC=c.category==='추가 QC',ref=`'노무비 산출 상세'!${isQC?'I':'H'}${row}`;
  const allocations=(r.activityTrace?.paidAllocations??[]).filter(a=>a.category===c.category);
  if(allocations.length&&c.mh>0){for(const a of allocations){const item=a.date?rowFor(a.date):unallocated,ratio=a.paidMH/c.mh;item.amount+=c.labor*ratio;item[isQC?'qcPaidMH':'productionPaidMH']+=a.paidMH;item.terms.push(`(${ref}*${ratio})`);}}
  else if(c.labor){unallocated.amount+=c.labor;unallocated[isQC?'qcPaidMH':'productionPaidMH']+=c.mh;unallocated.terms.push(ref);}
  if(c.other){unallocated.amount+=c.other;unallocated.terms.push(`'노무비 산출 상세'!I${row}`);}
 });
 const rows=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date));if(unallocated.amount)rows.push(unallocated);
 if(!rows.length)rows.push({date:'추가 집행 없음',productionPaidMH:0,qcPaidMH:0,amount:0,terms:['0']});
 const total=rows.reduce((n,x)=>n+x.amount,0);if(Math.abs(total-r.incremental)>.05)throw Error('집행 배정과 추가 요청액이 일치하지 않습니다.');
 if(rows.length>4)return {grouped:true,title:'기간 추가비용 집행 계획',rows:[{date:'시나리오 기간 합계',productionPaidMH:rows.reduce((n,x)=>n+x.productionPaidMH,0),qcPaidMH:rows.reduce((n,x)=>n+x.qcPaidMH,0),amount:r.incremental,terms:["'노무비 산출 상세'!C13"]}],sourceRows:rows};
 return {grouped:false,title:'일별 추가비용 집행 계획',rows,sourceRows:rows};
}

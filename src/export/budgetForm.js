import {executionPlan} from './executionPlan.js';
const NAVY='FF153653',GRAY='FFE5EAF1',LINE='FF8895A2',INK='FF112C44';
const MONEY='#,##0;[Red](#,##0);"—"',DATE='yyyy-mm-dd hh:mm';
const date=v=>new Date(Date.parse(v)+9*3600000),formula=(text,result)=>({formula:text,result});
export const V8_REQUEST_CELLS={strategy:'I5',scenario:'G6',labor:'I29',incremental:'I18',total:'D17',budget:'A17',balance:'G17',handover:'I40'};
export function renderBudgetForm(wb,ws,detail,s,r,calculatedAt,cost,q){
 ws.columns=[10,7,7,8,8,8,8,8,8,8,8,8].map(width=>({width}));ws.views=[{showGridLines:false}];
 ws.pageSetup={paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:1,margins:{left:.22,right:.22,top:.24,bottom:.24,header:.1,footer:.1}};
 ws.headerFooter.oddFooter='&L시뮬레이션 산출 / 검토 및 승인 필요&R&P / &N';
 const merge=(range,value,{fill,bold=false,size=10,align='left',border=false,numFmt}={})=>{if(range.split(':')[0]!==range.split(':')[1])ws.mergeCells(range);const c=ws.getCell(range.split(':')[0]);c.value=value===''?null:value;c.font={name:'맑은 고딕',size,bold,color:{argb:INK}};c.alignment={horizontal:align,vertical:'middle',wrapText:true};if(numFmt)c.numFmt=numFmt;if(fill)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};if(border){const [a,b]=range.split(':');const from=ws.getCell(a),to=ws.getCell(b??a);for(let row=from.row;row<=to.row;row++)for(let col=from.col;col<=to.col;col++)ws.getCell(row,col).border={top:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}}};}return c;};
 const heading=(row,text,unit='')=>{merge(`A${row}:${unit?'I':'L'}${row}`,text,{bold:true,size:13});if(unit)merge(`J${row}:L${row}`,unit,{align:'right',size:9});};
 const link=(range,cell,value,options={})=>merge(range,formula(`'${detail.name}'!${cell}`,value),{numFmt:MONEY,align:'right',...options});
 merge('A2:F4','노무비 예산 보고서',{size:23,bold:true});
 for(const [col,end,label]of [['G','H','작성'],['I','J','검토'],['K','L','승인']]){merge(`${col}2:${end}2`,label,{fill:GRAY,align:'center',bold:true,border:true});merge(`${col}3:${end}4`,null,{border:true});}
 const facility=s.facilityId==='B_ZONE'?'대조립 공정':s.facilityId;
 merge('A5:H5',`${s.blockId} ${facility} · 추가 노무비 집행 승인 요청`,{size:9.5});merge('I5:L5',`${r.strategy} · ${r.name}`,{size:9.5,align:'right'});
 merge('A6:F6','시뮬레이션 산출 / 검토 및 승인 필요',{size:9});merge('G6:L6',s.scenarioId,{size:9,align:'right'});
 for(let c=1;c<=12;c++)ws.getCell(7,c).border={bottom:{style:'medium',color:{argb:NAVY}}};
 heading(9,'1. 프로젝트 개요');
 for(const [row,left,value,right,value2]of [[11,'프로젝트명',`${s.blockId} 대조립 공정`,'작성일자',date(calculatedAt.toISOString())],[12,'장소 / 공정',`${s.facilityId} / ${s.blockId}`,'작성자',null],[13,'보고 기준',date(s.start),'적용기간',`${s.start.slice(5,16).replace('T',' ')} ~ ${s.deadline.slice(5,16).replace('T',' ')} (KST)`]]){
  merge(`A${row}:B${row}`,left,{fill:GRAY,bold:true,align:'center',border:true});merge(`C${row}:F${row}`,value,{border:true,...(row===13?{numFmt:DATE}:{})});merge(`G${row}:H${row}`,right,{fill:GRAY,bold:true,align:'center',border:true});merge(`I${row}:L${row}`,value2,{border:true,...(row===11?{numFmt:'yyyy-mm-dd'}:{})});
 }
 heading(15,'2. 예산 요약','(단위: 원)');
 for(const [start,end,label]of [['A','C','프로젝트 총 예산'],['D','F','예상 총원가'],['G','I','예산 잔액'],['J','L','예산 사용률']])merge(`${start}16:${end}16`,label,{fill:GRAY,bold:true,align:'center',border:true});
 link('A17:C17','C6',s.budget,{border:true});link('D17:F17','C14',r.total,{border:true,bold:true});link('G17:I17','C15',r.budgetRemaining,{border:true});merge('J17:L17',formula('IF(A17=0,"미산출",D17/A17)',s.budget?r.total/s.budget:'미산출'),{numFmt:'0.0%',border:true,align:'right'});
 merge('A18:H18','현재 추가 집행 요청금액 (생산 노무비 + QC + 기타)',{bold:true});link('I18:L18','C13',r.incremental,{bold:true});
 heading(20,'3. 항목별 노무비 예산');
 const columns=[['A','B','구분'],['C','E','작업내역'],['F','F','수량'],['G','H','단가(원)'],['I','J','금액(원)'],['K','L','비고']];
 for(const [a,b,text]of columns)merge(`${a}22:${b}22`,text,{fill:GRAY,bold:true,align:'center',border:true});
 const count=Math.max(7,r.costs.length+1),totalRow=23+count;
 for(let i=0;i<count-1;i++){const row=23+i,c=r.costs[i],detailRow=20+i,isQC=c?.category==='추가 QC';
  const values=c?[isQC?'QC 검사비':c.labor?'생산 노무비':'기타 비용',c.category,c.mh?`${Number(c.mh.toFixed(2))} ${isQC?'h':'MH'}`:'일괄',c.mh?c.rate:null,formula(`'${detail.name}'!J${detailRow}`,c.subtotal),c.other?'제공 일괄액':isQC?'검사원 별도':r.strategy+' 배정']:Array(6).fill(null);
  columns.forEach(([a,b],j)=>merge(`${a}${row}:${b}${row}`,values[j],{border:true,...([3,4].includes(j)?{numFmt:MONEY,align:'right'}:{})}));
 }
 const subtotal=totalRow-1;merge(`A${subtotal}:H${subtotal}`,'추가 생산 노무비 소계 (QC·기타 제외)',{border:true,bold:true,size:9});link(`I${subtotal}:J${subtotal}`,'C10',cost.labor,{border:true,bold:true});merge(`K${subtotal}:L${subtotal}`,'구성 소계',{border:true,size:9});
 merge(`A${totalRow}:H${totalRow}`,'추가 집행 요청금액 합계',{fill:GRAY,bold:true,align:'center',border:true});link(`I${totalRow}:J${totalRow}`,'C13',r.incremental,{fill:GRAY,border:true,bold:true});merge(`K${totalRow}:L${totalRow}`,null,{fill:GRAY,border:true});
 const offset=totalRow-30,at=n=>n+offset,plan=executionPlan(s,r),header=at(34),first=at(35),last=first+plan.rows.length-1;
 heading(at(32),'4. 집행 계획 및 흐름');
 for(const [a,b,text]of [['A','B','날짜 / 기간'],['C','D','유급 MH (생산/QC)'],['E','F','집행 예정액(원)']])merge(`${a}${header}:${b}${header}`,text,{fill:GRAY,bold:true,align:'center',border:true});
 for(let i=0;i<4;i++){const row=first+i,item=plan.rows[i];merge(`A${row}:B${row}`,item?.date??null,{border:true,size:9});merge(`C${row}:D${row}`,item?`${Number(item.productionPaidMH.toFixed(2))} / ${Number(item.qcPaidMH.toFixed(2))}`:null,{border:true,align:'right',size:9});merge(`E${row}:F${row}`,item?formula(item.terms.join('+'),item.amount):null,{border:true,numFmt:MONEY,align:'right'});}
 merge(`A${at(39)}:D${at(39)}`,'합 계',{fill:GRAY,bold:true,align:'center',border:true});merge(`E${at(39)}:F${at(39)}`,formula(`SUM(E${first}:E${first+3})`,r.incremental),{fill:GRAY,border:true,numFmt:MONEY,bold:true,align:'right'});
 merge(`A${at(40)}:F${at(40)}`,plan.grouped?'기간 합계 표시 · 상세 배정은 근거 시트 부록':'유급 배정 계획 · 미배분 비용은 별도 행',{size:8.5});merge(`G${at(40)}:H${at(40)}`,'품질 인계',{bold:true,size:9});merge(`I${at(40)}:L${at(40)}`,date(r.handover),{numFmt:'yyyy-mm-dd hh:mm:ss',size:9});
 heading(at(42),'5. 주요 내용 및 특이사항');
 const notes=`잔여 원작업 ${s.remaining} MH / 정규능력 ${Number(r.regularCapacity.toFixed(2))} MH. 기준 프로젝트 원가 ${s.baseCost.toLocaleString('ko-KR')}원은 일괄 예측 기준이며 기지급액이 아닙니다.\n${q.model}: 추가 보수 ${r.reworkMH.toFixed(2)} MH (${s.qualityMode==='CONFIRMED'?'사용자 확정 목록':'예상·가정'}). 선택 ${r.strategy} ${r.name}, 예상 품질 인계 ${r.handover.slice(5,19).replace('T',' ')} KST, 납기 ${r.deadlineMet?'이내':'미충족'}.\n추가 집행 ${r.incremental.toLocaleString('ko-KR',{maximumFractionDigits:0})}원 검토: 생산 노무 ${cost.labor.toLocaleString('ko-KR',{maximumFractionDigits:0})} / QC ${cost.qc.toLocaleString('ko-KR')} / 기타 ${cost.other.toLocaleString('ko-KR')}원. 예산 잔액 ${r.budgetRemaining.toLocaleString('ko-KR',{maximumFractionDigits:0})}원.\nOT·지원 인력·QC 창 및 실제 의무비용 확인·승인이 필요합니다. ${r.missingCosts.join(' / ')}\n합성 교육용 데이터이며 예상 보수는 확정 불량이 아닙니다. 이 보고서는 실제 집행 승인·검사 예약·현장 인계를 증명하지 않습니다.`;
 merge(`A${at(44)}:L${at(49)}`,notes,{border:true,size:9.5});
 const heights=[6,17,21,21,18,14,5,5,21,4,18,18,27,6,21,22,24,20,6,21,4,23,...Array(7).fill(18),21,7,21,4,23,...Array(4).fill(19),20,23,6,21,4,...Array(6).fill(16),16];
 for(let i=1;i<=at(50);i++)ws.getRow(i).height=i<=30?heights[i-1]??18:heights[i-offset-1]??18;
 // Keep close to A4 reference proportions without reducing body font size.
 ws.pageSetup.printArea=`A1:L${at(49)}`;
 ws.addConditionalFormatting({ref:'G17',rules:[{type:'cellIs',operator:'lessThan',formulae:[0],style:{font:{color:{argb:'FFBE2222'},bold:true}}}]});
 wb.reportLayout.request={...V8_REQUEST_CELLS,labor:`I${subtotal}`,handover:`I${at(40)}`,totalIncremental:`I${totalRow}`};
 wb.executionChart={sheetName:ws.name,title:plan.title,firstRow:first,lastRow:last,labels:plan.rows.map(x=>x.date),values:plan.rows.map(x=>x.amount),from:{col:6,row:at(34)-1},to:{col:12,row:at(40)-1}};
 wb.executionAllocation=plan;
 return plan;
}

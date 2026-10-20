import ExcelJS from 'exceljs';
import {renderBudgetForm,V8_REQUEST_CELLS} from './budgetForm.js';
import {attachNativeChart} from './nativeChart.js';
import {financialBreakdown,qualityBasis,laborBasis,workforceBasis} from '../ui/simulationSummary.js';

const NAVY='FF123654',ORANGE='FFE97625',PALE='FFEDF3F8',INK='FF18334C';
const KRW='#,##0"원";[Red](#,##0)"원";"—"';
const DEC='#,##0.00;[Red](#,##0.00);"—"';
const DATE='yyyy-mm-dd hh:mm:ss';
const STATUS='시뮬레이션 산출 / 검토 및 승인 필요';
export const REPORT_SHEETS=['예산 집행 승인 요청서','노무비 산출 상세','시나리오 비교','계산 근거 및 가정'];
export const REPORT_CELLS={request:V8_REQUEST_CELLS,detail:{base:'C5',budget:'C6',overtime:'C7',support:'C8',regular:'C9',labor:'C10',qc:'C11',other:'C12',incremental:'C13',total:'C14',balance:'C15',first:20}};

// Excel wall-clock values are explicitly KST (Excel dates have no timezone).
const excelDate=v=>v?new Date(Date.parse(v)+9*3600000):null;
const humanDate=v=>v?new Date(Date.parse(v)+9*3600000).toISOString().slice(0,19).replace('T',' '):'미확인';
const f=(formula,result)=>({formula,result});
function setup(ws,widths,{landscape=false,freeze=0}={}){
 ws.columns=widths.map(width=>({width}));ws.properties.defaultRowHeight=22;
 ws.views=[{showGridLines:false,...(freeze?{state:'frozen',ySplit:freeze}:{} )}];
 ws.pageSetup={paperSize:9,orientation:landscape?'landscape':'portrait',fitToPage:true,fitToWidth:1,fitToHeight:landscape?0:1,margins:{left:.3,right:.3,top:.35,bottom:.35,header:.15,footer:.15}};
 ws.headerFooter.oddFooter='&LShipyard Production Management&R&P / &N';
 ws.properties.tabColor={argb:NAVY};
}
function span(ws,row,start,end,value,{fill,bold=false,size=10,height=22,color=INK}={}){
 if(start!==end)ws.mergeCells(row,start,row,end);
 const c=ws.getCell(row,start);c.value=value===''?null:value;c.font={name:'맑은 고딕',size,bold,color:{argb:color.length===6?'FF'+color:color}};
 c.alignment={vertical:'middle',wrapText:true};
 if(fill)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill.length===6?'FF'+fill:fill}};
 ws.getRow(row).height=height;return c;
}
function section(ws,row,last,title){span(ws,row,1,last,title,{fill:NAVY,color:'FFFFFF',bold:true,height:23});}
function title(ws,last,text,context){span(ws,2,1,last,text,{size:15,bold:true,height:30});ws.getRow(2).border={bottom:{style:'medium',color:{argb:ORANGE}}};span(ws,3,1,last,context,{size:10,height:26});}
function finish(ws,lastRow,lastCol){
 ws.eachRow(row=>{row.eachCell(c=>{if(!c.font?.name)c.font={name:'맑은 고딕',size:10,color:{argb:INK}};if(!c.alignment?.vertical)c.alignment={vertical:'middle',wrapText:true};});});
 ws.pageSetup.printArea=`A1:${lastCol}${lastRow}`;
}
function numberCell(c,value,format=KRW){c.value=value;c.numFmt=format;c.alignment={horizontal:'right',vertical:'middle'};}

export function approvalWorkbook(s,r,comparison,{calculatedAt=new Date()}={}){
 if(s.selectedStrategy!==r.strategy)throw Error('선택 대응안과 계산 결과가 다릅니다. 최신 결과로 다시 생성하십시오.');
 const wb=new ExcelJS.Workbook();wb.creator='Shipyard Production Management';wb.created=calculatedAt;wb.modified=calculatedAt;
 wb.calcProperties={fullCalcOnLoad:true,forceFullCalc:true,calcMode:'auto'};
 // All four worksheets exist before any cross-sheet references are written.
 const [request,detail,compare,basis]=REPORT_SHEETS.map(name=>wb.addWorksheet(name));
 const cost=financialBreakdown(r),q=qualityBasis(s,r),selected=comparison.find(x=>x.strategy===r.strategy);
 if(!selected||selected.error||Math.abs(selected.total-r.total)>1e-6||selected.handover!==r.handover)throw Error('비교표와 현재 결과가 다릅니다.');
 const facility=s.facilityId==='B_ZONE'?'B구역 대조립':s.facilityId;
 const process=s.facilityId==='B_ZONE'?'대조립 공정':`${s.facilityId} 공정`;
 const context=`${s.scenarioId} / 선택 ${r.strategy} (${r.name}) / ${s.blockId}`;

 // Supporting build. Original engine lines, multiplied in Excel, own all money.
 setup(detail,[19,13,17,9,12,13,16,17,18,19,46],{landscape:true,freeze:19});detail.pageSetup.paperSize=8;
 title(detail,11,'추가 노무비 및 비용 산출 상세',context);
 const labels=['기준 프로젝트 원가 (일괄)','승인 예산 한도','추가 OT 노무비','추가 내부·외부 지원','납기 후 실제 생산 대응','추가 생산 노무비 합계','추가 QC 검사비','설비·물류·기타','추가 요청액 합계','예상 총원가','예산 잔액 / (초과)'];
 labels.forEach((label,i)=>span(detail,i+5,1,2,label,{bold:[5,8,9,10].includes(i)}));
 numberCell(detail.getCell('C5'),s.baseCost);numberCell(detail.getCell('C6'),s.budget);
 span(detail,5,4,11,'원본에서 제공한 일괄 기준원가. 개인별 급여로 재구성하지 않음.');
 span(detail,6,4,11,STATUS);
 span(detail,7,4,11,laborBasis(r),{height:42});
 span(detail,10,4,11,'생산인력 유급 MH만 합산. QC 검사비는 별도. 기준 노동을 중복 가산하지 않음.');
 span(detail,11,4,11,'재검사 검사원 1명 × 추가 검사시간. 최초 검사 대응은 정상 잔여작업에 포함.');
 span(detail,12,4,11,r.missingCosts.join(' / ')||'입력된 기타 비용만 포함. 실제 의무비용 현장 확인 필요.');
 span(detail,16,1,11,'유급시간은 배정·계약 또는 실제 모델 생산 대응 기준입니다. QC 대기·달력 지연만으로 생산인력 전체 유급시간을 추가하지 않습니다.',{height:32});
 section(detail,18,11,'유급 배정 및 비용 항목 (금액: 원, 시간: 인당 h, 공수: MH)');
 detail.getRow(19).values=['비용 구분','대상 공정','인력 유형','투입 인원','인당 추가 유급시간','총 유급 MH','적용 단가 / MH','추가 생산 노무비','QC 및 기타 추가비','소계','산출 근거 / 승인 조건'];
 detail.getRow(19).height=38;detail.getRow(19).font={name:'맑은 고딕',size:10,bold:true,color:{argb:'FFFFFFFF'}};detail.getRow(19).fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}};
 const lines=r.costs.length?r.costs:[{category:'추가 항목 없음',task:s.blockId,workforce:'해당 없음',headcount:0,hours:0,mh:0,rate:0,labor:0,other:0,subtotal:0,approval:'검토 필요'}];
 lines.forEach((c,i)=>{
  const row=20+i,isQC=c.category==='추가 QC';
  detail.getRow(row).values=[c.category,c.task,isQC?'검사원':c.workforce,c.headcount,c.hours,f(`D${row}*E${row}`,c.mh),c.rate,isQC?0:f(`F${row}*G${row}`,c.labor),isQC?f(`F${row}*G${row}+${Number(c.other)}`,c.labor+c.other):c.other,f(`SUM(H${row}:I${row})`,c.subtotal),`${c.headcount}명 × ${Number(c.hours.toFixed(4))}h × ${c.rate.toLocaleString('ko-KR')}원${c.other?` / 기타 ${c.other.toLocaleString('ko-KR')}원`:''}. ${c.approval}`];
  detail.getRow(row).height=46;if(i%2===0)detail.getRow(row).fill={type:'pattern',pattern:'solid',fgColor:{argb:PALE}};
  for(const col of [4,5,6])detail.getCell(row,col).numFmt=DEC;
  for(const col of [7,8,9,10])detail.getCell(row,col).numFmt=KRW;
 });
 const last=19+lines.length,range=col=>`${col}20:${col}${last}`;
 const sums={C7:[`SUMIF(${range('A')},"연장근로",${range('H')})`,cost.overtime],C8:[`SUMIF(${range('A')},"내부 지원",${range('H')})+SUMIF(${range('A')},"외부 지원",${range('H')})`,cost.support],C9:[`SUMIF(${range('A')},"납기 이후 추가 정규 대응",${range('H')})`,cost.regular],C10:[`SUM(${range('H')})`,cost.labor],C11:[`SUMIF(${range('A')},"추가 QC",${range('I')})`,cost.qc],C12:[`SUM(${range('I')})-C11`,cost.other],C13:[`SUM(${range('H')},${range('I')})`,r.incremental],C14:['C5+C13',r.total],C15:['C6-C14',r.budgetRemaining]};
 for(const [cell,[formula,value]]of Object.entries(sums))numberCell(detail.getCell(cell),f(formula,value));
 for(const row of [10,13,14,15]){detail.getRow(row).font={name:'맑은 고딕',size:10,bold:true,color:{argb:INK}};detail.getCell(`C${row}`).fill={type:'pattern',pattern:'solid',fgColor:{argb:row===13?'FFFFF0E3':PALE}};}
 detail.autoFilter=`A19:K${last}`;detail.pageSetup.printTitlesRow='19:19';finish(detail,last,'K');

 wb.reportLayout={...REPORT_CELLS,request:{...REPORT_CELLS.request}};
 const expenditure=renderBudgetForm(wb,request,detail,s,r,calculatedAt,cost,q);
 setup(compare,[10,20,9,10,21,12,19,19,20,20,48,26],{landscape:true,freeze:5});compare.pageSetup.paperSize=8;
 title(compare,12,'대응안별 일정 및 예산 비교',context+' / 입력 변경 시 웹에서 다시 계산·다운로드');
 compare.getRow(5).values=['대응안 ID','대응 내용','추가 인력','OT 인당 h','예상 품질 인계 (KST)','여유 / (지연) 분','추가 생산 노무비','QC 및 기타 추가비','예상 총원가','예산 잔액 / (초과)','주요 실행 조건','승인 상태 / 판단'];
 compare.getRow(5).height=36;compare.getRow(5).font={name:'맑은 고딕',size:10,bold:true,color:{argb:'FFFFFFFF'}};compare.getRow(5).fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}};
 comparison.forEach((x,i)=>{const row=6+i,valid=!x.error,b=valid?financialBreakdown(x):null;
  compare.getRow(row).values=[x.strategy,x.name,x.additionalWorkers??null,x.otHours??null,excelDate(x.handover),x.marginMinutes??null,b?.labor??null,b?b.qc+b.other:null,x.total??null,x.budgetRemaining??null,valid?[...x.conditions,...x.missingCosts].join(' / '):x.error,valid?`검토 및 승인 필요 / ${x.status}`:'산출 불가 / 정보 미확인'];
  compare.getRow(row).height=65;compare.getCell(row,5).numFmt=DATE;compare.getCell(row,6).numFmt='0.0;[Red](0.0)';for(const col of [7,8,9,10])compare.getCell(row,col).numFmt=KRW;
  if(x.strategy===r.strategy){compare.getRow(row).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF0E3'}};compare.getCell(row,1).font={name:'맑은 고딕',size:10,bold:true,color:{argb:ORANGE}};}
 });
 compare.autoFilter=`A5:L${5+comparison.length}`;compare.pageSetup.printTitlesRow='5:5';finish(compare,5+comparison.length,'L');

 setup(basis,[27,30,30,30],{landscape:true,freeze:4});
 title(basis,4,'계산 근거 및 가정',context);
 let row=5;
 const band=label=>section(basis,row++,4,label);
 let technical=false;
 const wrappedLines=(value,width)=>typeof value==='string'?Math.ceil([...value].reduce((n,ch)=>n+(ch.charCodeAt(0)>127?1.8:1),0)/width):1;
 const item=(label,value,format,notes=null)=>{const i=row++,height=technical?24:Math.min(300,Math.max(24,wrappedLines(value,60)*14,wrappedLines(notes,30)*14));span(basis,i,1,1,label,{bold:true});const c=span(basis,i,2,3,value,{height});if(format)c.numFmt=format;span(basis,i,4,4,notes,{height});return i;};
 band('프로젝트 및 출처');item('시나리오 ID',s.scenarioId);item('선택 대응안',r.strategy+' · '+r.name);item('데이터 버전',s.sourceVersion);item('시설 / 블록',facility+' / '+s.blockId);item('계산시각 (KST)',excelDate(calculatedAt.toISOString()),DATE);
 item('원본 자료','v2 프로젝트 JSON / 12개월 합성 최초검사 이력',undefined,'실제 한화오션 실적·급여·승인 데이터가 아닙니다.');
 band('생산 및 자원');item('잔여 원작업 (MH)',s.remaining,DEC);item('가용 적격 인원 (명)',s.workers,'0');item('동시 재작업 / OT 인원',`${s.reworkWorkers} / ${s.overtimeWorkers}`,undefined,workforceBasis(s));
 item('작업 달력',s.calendar.sessions.map(([a,b])=>`${a}:00–${b}:00`).join(' / '),undefined,`요일 ${s.calendar.weekdays.join(',')} (0=일), 점심·비근무시간 제외`);item('생산성 (표준/실제 MH)',s.productivity,DEC);item('정규 가용 / 명목 여유 MH',`${r.regularCapacity.toFixed(2)} / ${r.nominalMargin.toFixed(2)}`);
 band('품질 예측');item('적용 모델',q.model,undefined,q.text);item('6개월 가중치',s.weight6,'0.0%');item('12개월 가중치',1-s.weight6,'0.0%');item('검사 예정 건수',Object.values(s.pending).reduce((n,v)=>n+v,0),'0');item('예상 보수 건수',r.prediction?.cases??(s.qualityMode==='CONFIRMED'?s.confirmedReworks.filter(x=>x.status==='CONFIRMED').length:'미산출'),DEC);item('추가 재작업 MH',r.reworkMH,DEC);item('재작업 상태',s.reworkStatus);
 if(r.prediction)for(const x of r.prediction.rows)item(x.type,`${x.pending}건 × ${(100*x.reworkRate).toFixed(3)}% × ${s.standards[x.type]} MH = ${x.mh.toFixed(3)} MH`,undefined,'최초 불합격률이 아닌 보수 필요율을 적용');
 band('설비 · QC · 일정');item('설비 중단 (h)',s.outageHours,DEC);item('QC 가용 시작 (KST)',excelDate(r.strategy==='E'?s.adjustedQcReady:s.qcReady),DATE,'실제 예약·승인 미확인');item('QC 불가구간',s.qcUnavailable.length?s.qcUnavailable.map(x=>`${humanDate(x.start)}–${humanDate(x.end)}`).join(' / '):'입력 없음');item('최초 / 재검사 연속 h',`${s.initialInspectionHours} / ${s.reinspectionHours}`);item('추가 승인 대기 (h)',s.approvalHours,DEC,'유급 참석·수수료 근거가 없어 자동 비용 가산하지 않음');item('OT 인당 배정 h',r.otHours,DEC,`참여 ${s.overtimeWorkers}명 / ${s.overtimeDates.join(', ')} / 승인 가정 ${s.overtimeApproved?'확인':'미확인'}`);item('지원 유급 MH',r.supportPaid,DEC);item('예상 품질 인계',excelDate(r.handover),DATE);item('기준 납기',excelDate(s.deadline),DATE);item('일정 여유 (분)',r.marginMinutes,'0.0;[Red](0.0)');item('후행 공정',r.downstream.status);
 band('노무 · 예산');for(const [key,label]of [['regular','추가 정규'],['overtime','OT'],['internal','내부 지원'],['external','외부 지원'],['qc','QC 검사원']])item(`${label} 단가 / MH`,s.rates[key],KRW,'QC 50,000원/h v2 기준; 나머지는 편집 가능한 교육용 가정');item('추가 유급 OT MH',r.otPaid,DEC);item('추가 QC 검사비',f(`'${detail.name}'!C11`,cost.qc),KRW);item('기준원가',f(`'${detail.name}'!C5`,s.baseCost),KRW);item('승인 예산 한도',f(`'${detail.name}'!C6`,s.budget),KRW);
 band('제약 및 확인 사항');item('실행 조건',r.conditions.join(' / '));item('미확인 비용',r.missingCosts.join(' / ')||'현장 의무비용 추가 확인 필요');item('회계 처리','정상 기준원가 1회 + 추가 생산 노무비 + 추가 QC + 기타 비용',undefined,'QC 대기·재검사 달력시간을 생산인력 전체 유급 MH로 간주하지 않음');item('확률 및 스케줄','직렬 자원 배정 모델. 기대 보수 MH와 소요시간은 별개.',undefined,'사건 확률·중복 정보가 없으면 확률 기대공수 미산출');
 const readableLast=row-1;basis.pageSetup.printArea=`A1:D${readableLast}`;basis.pageSetup.fitToHeight=0;
 technical=true;band('기술 부록 — 내보낸 입력 스냅샷');item('스냅샷 안내','현 계산에 적용된 유효 입력. workforcePreferences는 보존된 사용자 희망 배정값.');
 // Chunked exact JSON avoids Excel cell's 32767-character limit. The complete
 // source snapshot remains recoverable by joining pieces, outside print area.
 const json=JSON.stringify(s),chunks=json.match(/[\s\S]{1,12000}/g)||[''];
 for(let i=0;i<chunks.length;i++)item(i===0?'전체 입력 스냅샷':`입력 스냅샷 계속 ${i+1}`,chunks[i]);
 band('유급 배정 집행 계획 — 원본 엔진 추적');
 for(const allocation of expenditure.sourceRows)item(allocation.date,allocation.amount,KRW,`생산 유급 ${allocation.productionPaidMH.toFixed(3)} MH / QC ${allocation.qcPaidMH.toFixed(3)} h. 실제 지급 기록이 아닌 배정 계획.`);
 finish(basis,row-1,'D');basis.pageSetup.printArea=`A1:D${readableLast}`;
 for(const ws of [request,detail,compare])for(const address of ws===request?['G17']:ws===detail?['C15']:[]){ws.addConditionalFormatting({ref:address,rules:[{type:'cellIs',operator:'lessThan',formulae:[0],style:{font:{bold:true,color:{argb:'FFC52E2E'}},fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFFDEBEC'}}}}]});}
 attachNativeChart(wb);
 return wb;
}

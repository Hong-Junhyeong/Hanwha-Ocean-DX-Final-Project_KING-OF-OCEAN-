// Normal builds bundle ExcelJS locally. Offline builds explicitly use the
// documented OOXML fallback in vite.config.js; neither path uses a CDN.
import ExcelJS from 'exceljs';
import {approvalWorkbook} from './approvalReport.js';
export function saveBlob(data,name,type='application/json'){
 const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function formatSheet(ws){
 ws.views=[{state:'frozen',ySplit:1}];ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF143958'}};
 ws.getRow(1).height=28;ws.columns.forEach(c=>{c.width=Math.min(65,Math.max(18,...c.values.map(v=>String(v??'').length*1.1+3)));});
 ws.eachRow((row,i)=>{if(i>1&&i%2===0)row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F5FB'}};row.alignment={vertical:'middle',wrapText:true};row.eachCell(c=>{if(typeof c.value==='number')c.numFmt='#,##0.00';});});
}
export async function downloadTable(name,headers,rows){const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet(name.slice(0,31));ws.addRows([headers,...rows]);formatSheet(ws);saveBlob(await wb.xlsx.writeBuffer(),name+'.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}
export {approvalWorkbook} from './approvalReport.js';
export async function downloadApproval(s,r,comparison,{assertCurrent=()=>{}}={}){assertCurrent();const wb=approvalWorkbook(s,r,comparison),bytes=await wb.xlsx.writeBuffer();assertCurrent();saveBlob(bytes,`예산_집행_승인요청_${s.scenarioId.replace(/[^a-zA-Z0-9_-]/g,'_')}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}

// Explicit offline fallback, not ExcelJS. Only the export features used by Phase 4
// are supported. Primary path remains ExcelJS when installed. OOXML is validated
// independently with openpyxl; no network calls occur during export.
import JSZip from './jszip.cjs';
const xml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const col=n=>{let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;};
class Row{
 constructor(values){this.cells=values.map(value=>({value}));this.font={};this.fill=null;}
 eachCell(fn){this.cells.forEach(fn);}
}
class Sheet{
 constructor(name){this.name=name;this.rows=[];this.views=[];this._columns=[];}
 addRow(row){const r=new Row(row);this.rows.push(r);return r;}
 addRows(rows){rows.forEach(r=>this.addRow(r));}
 get rowCount(){return this.rows.length;}
 getRow(n){return this.rows[n-1];}
 eachRow(fn){this.rows.forEach((r,i)=>fn(r,i+1));}
 get columns(){const n=Math.max(0,...this.rows.map(r=>r.cells.length));while(this._columns.length<n)this._columns.push({width:20});return this._columns.map((c,i)=>{c.values=this.rows.map(r=>r.cells[i]?.value);return c;});}
 getColumn(n){this.columns;return this._columns[n-1];}
 getCell(ref){const [,letters,number]=ref.match(/^([A-Z]+)(\d+)$/);const n=[...letters].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);const r=this.getRow(Number(number));while(r.cells.length<n)r.cells.push({value:''});return r.cells[n-1];}
}
class Workbook{
 constructor(){this.worksheets=[];this.calcProperties={};this.xlsx={writeBuffer:()=>this.write()};}
 addWorksheet(name){const ws=new Sheet(name);this.worksheets.push(ws);return ws;}
 async write(){
 const z=new JSZip(),ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 z.file('[Content_Types].xml',`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${this.worksheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
 z.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 z.file('xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${this.worksheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr fullCalcOnLoad="1"/></workbook>`);
 z.file('xl/_rels/workbook.xml.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${this.worksheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
 z.file('xl/styles.xml',`<styleSheet xmlns="${ns}"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="맑은 고딕"/></font><font><b/><color rgb="FFCE2929"/><sz val="11"/><name val="맑은 고딕"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF143958"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="2" fillId="0" borderId="0" applyFont="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
 this.worksheets.forEach((s,i)=>{z.file(`xl/worksheets/sheet${i+1}.xml`,`<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${s.columns.map((c,i)=>`<col min="${i+1}" max="${i+1}" width="${c.width??20}" customWidth="1"/>`).join('')}</cols><sheetData>${s.rows.map((r,ri)=>`<row r="${ri+1}">${r.cells.map((c,ci)=>{const v=c.value,address=col(ci+1)+(ri+1),numeric=typeof v==='number'||(v&&typeof v==='object'&&'formula'in v),style=ri===0?1:c.font?.color?.argb==='FFCE2929'?3:numeric?2:0;return `<c r="${address}" s="${style}" ${numeric?'':'t="inlineStr"'}>${v&&typeof v==='object'&&'formula'in v?`<f>${xml(v.formula)}</f><v>${v.result??0}</v>`:typeof v==='number'?`<v>${v}</v>`:`<is><t xml:space="preserve">${xml(v===null?'':v)}</t></is>`}</c>`;}).join('')}</row>`).join('')}</sheetData></worksheet>`);});
 return z.generateAsync({type:'uint8array',compression:'DEFLATE'});
 }
}
export default {Workbook};

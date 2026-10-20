// Shared presentation primitives. Color values are visual choices, not official brand specifications.
export const escapeHtml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export const sectionHead=(n,title,description='',actions='')=>`<div class="section-head"><div class="section-head__title"><b class="section-number">${n}</b><h2>${title}</h2>${description?`<p>${description}</p>`:''}</div>${actions?`<div class="section-actions">${actions}</div>`:''}</div>`;
export const pageHeading=(title,description='',actions='')=>`<div class="page-heading"><div><h1>${title}</h1>${description?`<p>${description}</p>`:''}</div>${actions?`<div class="section-actions">${actions}</div>`:''}</div>`;
export const money=n=>Number.isFinite(n)?Math.round(n).toLocaleString('ko-KR')+'원':'미확인';
export const number=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('ko-KR',{maximumFractionDigits:d}):'—';
export const dateTime=v=>v?new Date(Math.round(Date.parse(v)/60000)*60000+9*3600000).toISOString().slice(5,16).replace('T',' '):'미확정';
export const dataTable=(headers,rows,cls='')=>`<div class="table-wrap"><table class="${cls}"><thead><tr>${headers.map(v=>`<th>${v}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

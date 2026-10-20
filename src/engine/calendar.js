// All internal clocks are epoch hours. KST is a fixed UTC+09 zone (no DST).
export const H=3600000;
export const clock=s=>Date.parse(s)/H;
export const stamp=t=>new Date(t*H+9*H).toISOString().slice(0,19)+'+09:00';
export function day(t){return Math.floor((t+9)/24)*24-9;}
export function dateKey(t){return stamp(t).slice(0,10);}
export function slots(start,calendar) {
 const out=[];
 for(let d=day(start),i=0;i<calendar.horizonDays;i++,d+=24){const wd=new Date((d+9)*H).getUTCDay();if(calendar.weekdays.includes(wd))for(const [a,b]of calendar.sessions)out.push([d+a,d+b]);}
 return out;
}
export function workingEnd(start,hours,calendar) {
 if(!hours)return start;
 for(const [a,b]of slots(start,calendar)){const x=Math.max(a,start);if(x>=b)continue;const h=Math.min(hours,b-x);hours-=h;if(hours<1e-9)return x+h;}
 throw Error('달력 탐색 범위 내 완료 불가');
}
export function inspectionSlot(ready,hours,calendar,unavailable=[]) {
 if(!hours)return {start:ready,end:ready};
 for(const [a,b]of slots(ready,calendar)){let x=Math.max(a,ready);const blocks=unavailable.map(q=>[clock(q.start),clock(q.end)]).sort((u,v)=>u[0]-v[0]);for(const [u,v]of blocks){if(v<=x||u>=b)continue;if(x+hours<=u+1e-9)break;x=Math.max(x,v);}if(x+hours<=b+1e-9)return {start:x,end:x+hours};}
 throw Error('연속 QC 슬롯 확보 불가');
}

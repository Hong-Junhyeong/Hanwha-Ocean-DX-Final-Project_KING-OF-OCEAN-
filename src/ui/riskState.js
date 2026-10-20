import {validate}from '../engine/scenario.js';
import {simulate,compare}from '../engine/simulation.js';
import {buildAssemblyPlaybackPlan} from '../playback/plan.js';
import {clock,slots,stamp}from '../engine/calendar.js';
export const STALE_MESSAGE='입력값 변경됨 — 현재 조건 계산 전 결과';
const preferredInput=s=>{const value=structuredClone(s);for(const key of ['reworkWorkers','affectedWorkers','overtimeWorkers'])if(Object.hasOwn(value.workforcePreferences??{},key))value[key]=value.workforcePreferences[key];delete value.workforcePreferences;return value;};
// Presentation state is kept separate from the unchanged V4 formula engine.
export function createSimulationSession(initial,records){
 let draft=preferredInput(initial),applied=null,result=null,playbackPlan=null,comparison=[],dirty=true,version=0,appliedVersion=-1;
 const run=()=>{const next=structuredClone(draft),preferences={};for(const k of ['reworkWorkers','affectedWorkers','overtimeWorkers']){if(Number.isFinite(next[k])&&!Number.isInteger(next[k]))throw Error(`${k}: 배정 선호 인원은 정수여야 합니다.`);if(Number.isFinite(next[k])&&Number.isFinite(next.workers)&&next[k]>next.workers){preferences[k]=next[k];next[k]=next.workers;}}if(Object.keys(preferences).length)next.workforcePreferences=preferences;else delete next.workforcePreferences;validate(next);const r=simulate(next,records),c=compare(next,records);const plan=buildAssemblyPlaybackPlan(next,r);applied=next;result=r;comparison=c;playbackPlan=plan;dirty=false;appliedVersion=version;return r;};
 run();
 return {get draft(){return structuredClone(draft);},get applied(){return structuredClone(applied);},get result(){return result;},get comparison(){return comparison;},get playbackPlan(){return structuredClone(playbackPlan);},get dirty(){return dirty;},
 get version(){return version;},get appliedVersion(){return appliedVersion;},
 setDraft(next){draft=preferredInput(next);dirty=true;version++;},
 change(path,value){const keys=path.split('.');let node=draft;for(const k of keys.slice(0,-1))node=node[k];node[keys.at(-1)]=value;if(path==='remaining'&&Number.isFinite(value))draft.planned=draft.completed+value;dirty=true;version++;},
 markDirty(){dirty=true;},run,
 select(strategy){this.assertExportable();draft.selectedStrategy=strategy;version++;return run();},
 assertExportable(){if(dirty||appliedVersion!==version||!applied||!result)throw Error(STALE_MESSAGE);},
 reset(next){draft=preferredInput(next);version++;return run();}
 };
}

// Debouncing owns no formulas. A single synchronous engine pass atomically commits
// the applied snapshot, selected result and all comparison rows at one version.
export function createAutoCalculation(session,{delay=320,beforeRun=()=>{},onPending=()=>{},onSuccess=()=>{},onError=()=>{}}={}){
 let timer=null,generation=0,composing=false;
 const cancel=()=>{clearTimeout(timer);timer=null;generation++;};
 const run=()=>{cancel();try{beforeRun();const result=session.run();onSuccess(result);return true;}catch(e){onError(e);return false;}};
 return {
  schedule(immediate=false){cancel();onPending();if(composing)return;const current=generation;timer=setTimeout(()=>{if(current===generation)run();},immediate?0:delay);},
  composition(active){composing=active;if(active)cancel();},run,cancel,
  get pending(){return timer!==null||composing;}
 };
}

export function strategyForEdit(selected,path){
 if(['A1','A2'].includes(selected)&&['overtimeHours','overtimeWorkers','overtimeDates','overtimeApproved'].includes(path))return 'A';
 return selected;
}
export function regularDayCount(s){if(s.availableRegularWorkdays!==undefined)return s.availableRegularWorkdays;if(!Number.isFinite(clock(s.start))||!Number.isFinite(clock(s.deadline)))return 0;return new Set(slots(clock(s.start),s.calendar).filter(([a,b])=>a<clock(s.deadline)&&b>clock(s.start)).map(([a])=>stamp(a).slice(0,10))).size;}
export function deadlineForDays(s,days){if(!Number.isInteger(days)||days<1||days>s.calendar.horizonDays)throw Error('정규 작업일 범위 오류');const periods=slots(clock(s.start),s.calendar),dates=[...new Set(periods.map(([a])=>stamp(a).slice(0,10)))],selected=dates[days-1];if(!selected)throw Error('달력 범위를 초과했습니다.');return stamp(periods.filter(([a])=>stamp(a).slice(0,10)===selected).at(-1)[1]);}
export function prioritize(comparison,s){
 const feasible=comparison.filter(r=>!r.error&&r.deadlineMet&&r.budgetRemaining>=0);
 if(!feasible.length)return {label:'현재 조건에서 충족안 없음',result:null,explanation:'계산된 대응안 중 납기와 입력 예산을 동시에 만족하는 안이 없습니다.'};
 const annotations=r=>{const missing=['QC 가용은 가정이며 실제 검사 예약 확인 필요','작업면·설비 및 직무 자격 현장 확인 필요'];
 if(r.otPaid&&!s.overtimeApproved)missing.push('OT 승인 미확인');
 if(r.additionalWorkers){if(!s.supportQualified)missing.push('지원자 자격 미확인');if(!s.supportAvailable)missing.push('지원자 가용 미확인');}
 if(r.sourceProcessLostMH)missing.push(`지원 원공정 ${r.sourceProcessLostMH}MH 감소 영향 검증 필요`);
 if(r.strategy==='D'&&s.equipmentRecoveryHours)missing.push('대체설비·복구 승인 확인 필요');
 return missing.concat(r.missingCosts??[]);};
 const completeCost=feasible.filter(r=>!r.missingCosts.length),candidates=completeCost.length?completeCost:feasible;
 const ranked=candidates.map(r=>({r,missing:annotations(r)})).sort((a,b)=>a.missing.length-b.missing.length||a.r.sourceProcessLostMH-b.r.sourceProcessLostMH||a.r.incremental-b.r.incremental||b.r.marginMinutes-a.r.marginMinutes);
 const first=ranked[0];return {label:completeCost.length?'조건부 우선 검토안':'실행 조건 확인 필요',result:first.r,conditions:first.missing,explanation:'납기·예산 충족안을 먼저 확인하고, 비용 누락·미확인 조건 수·원공정 손실·추가비용·일정 여유 순으로 비교했습니다. 실제 승인 상태를 보장하지 않습니다.'};
}

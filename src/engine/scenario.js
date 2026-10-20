// Immutable source is adapted into an independent editable scenario.
export function baseline(project) {
 return {version:4,facilityId:'B_ZONE',blockId:'B-203',scenarioId:'B203-P4',sourceVersion:project.schema_version,
 start:project.overview.snapshot,deadline:project.overview.blockHandoverDeadline,planned:340,completed:220,remaining:120,
 workers:5,productivity:1,reworkWorkers:5,calendar:{weekdays:[1,2,3,4,5],sessions:[[7,12],[13,16]],horizonDays:90},
 tasks:project.workSequence.steps.filter(t=>t.id!=='T40').map((t,i,a)=>({id:t.id,name:t.label,remaining:t.remaining_mh,predecessors:i?[a[i-1].id]:[],qualification:'MODEL_QUALIFIED',equipment:'EQ1',maxWorkers:5})),
 initialInspectionHours:1,reinspectionHours:1,qcReady:project.overview.snapshot,qcUnavailable:[],readiness:[],approvalHours:0,
 qualityMode:'12M',weight6:.7,pending:{...project.quality.pending50ByType},standards:{...project.quality.inputModel.mhPerReworkByType},
 reworkStatus:'EXPECTED',confirmedReworks:[],customReworkMH:0,outageStart:project.overview.snapshot,outageHours:0,affectedWorkers:5,outageEquipment:'EQ1',alternativeMH:0,
 overtimeHours:3,overtimeWorkers:5,overtimeDates:['2026-10-12','2026-10-13'],overtimeApproved:false,
 internalWorkers:1,internalDays:3,internalHours:8,internalProductivity:1,internalSource:'B-204',externalWorkers:1,externalDays:3,externalHours:8,externalProductivity:1,
 supportQualified:false,supportAvailable:false,equipmentRecoveryHours:0,adjustedQcReady:project.overview.snapshot,
 rates:{regular:30000,overtime:45000,internal:30000,external:50000,qc:50000},budget:30000000,baseCost:28800000,equipmentCost:0,logisticsCost:0,materialCost:0,otherCost:0,externalMobilization:null,
 downstream:{enabled:false,preparationHours:.5,loadingReservation:null,transportHours:null,receiptHours:null,resourceReady:null,precedingReady:null,calendar:{weekdays:[1,2,3,4,5],sessions:[[7,12],[13,16]],horizonDays:90}},
 eventModel:null,selectedStrategy:'A2'};
}
const nonneg=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error(`${name}: 0 이상 유한수 필요`);};
export function validate(s) {
 if(!s||s.version!==4)throw Error('V4 시나리오가 아닙니다.');
 if(s.availableRegularWorkdays!==undefined&&(!Number.isInteger(s.availableRegularWorkdays)||s.availableRegularWorkdays<1||s.availableRegularWorkdays>s.calendar?.horizonDays))throw Error('정규 작업일 범위 오류');
 for(const k of ['remaining','planned','completed','workers','reworkWorkers','productivity','outageHours','affectedWorkers','alternativeMH','overtimeHours','overtimeWorkers','internalWorkers','internalDays','internalHours','internalProductivity','externalWorkers','externalDays','externalHours','externalProductivity','budget','baseCost','customReworkMH','initialInspectionHours','reinspectionHours','approvalHours','equipmentCost','logisticsCost','materialCost','otherCost','equipmentRecoveryHours']) nonneg(s[k],k);
 if(!s.workers||!s.productivity||!s.reworkWorkers||s.completed>s.planned)throw Error('인원/생산성/인정 공수 관계 오류');
 for(const k of ['workers','reworkWorkers','affectedWorkers','overtimeWorkers','internalWorkers','externalWorkers','internalDays','externalDays'])if(!Number.isInteger(s[k]))throw Error(`${k}: 정수 필요`);
 if(s.overtimeWorkers>s.workers||s.affectedWorkers>s.workers||s.reworkWorkers>s.workers)throw Error('배정 인원이 기존 인원을 초과합니다.');
 if(Math.abs(s.planned-s.completed-s.remaining)>1e-7)throw Error('계획−인정=잔여 공수 관계 오류');
 const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&/([+-]\d\d:\d\d|Z)$/.test(v);
 for(const k of ['start','deadline','outageStart','qcReady','adjustedQcReady'])if(!date(s[k]))throw Error(`${k}: 시간대 포함 시각 필요`);
 if(Date.parse(s.deadline)<=Date.parse(s.start))throw Error('납기는 기준시각 이후여야 합니다.');
 if(!['12M','6M','WEIGHTED','NONE','CONFIRMED','CUSTOM'].includes(s.qualityMode))throw Error('품질 모델 오류');
 nonneg(s.weight6,'가중치');if(s.weight6>1)throw Error('가중치 0~1');
 if(s.blockId!=='B-203'&&['12M','6M','WEIGHTED'].includes(s.qualityMode))throw Error('타 블록 품질 이력 미연결: NONE/CUSTOM/CONFIRMED 또는 검증된 별도 이력 어댑터 필요');
 if(['12M','6M','WEIGHTED','CUSTOM'].includes(s.qualityMode)&&s.reworkStatus==='CONFIRMED')throw Error('기대값·가정 MH를 확정 보수로 표시할 수 없습니다. 확정 보수 목록 모델을 선택하십시오.');
 if(!['EXPECTED','CONFIRMED','RESOLVED'].includes(s.reworkStatus))throw Error('재작업 상태 오류');
 if(!['N','A1','A2','A','B1','C2','D','E'].includes(s.selectedStrategy))throw Error('대응안 오류');
 if(!s.facilityId||!s.blockId||!s.scenarioId||!s.sourceVersion)throw Error('프로젝트 식별 정보 필요');
 for(const type of ['WELD','FITUP','DIMENSION']) {nonneg(s.pending?.[type],'검사 예정');nonneg(s.standards?.[type],'표준 보수 MH');if(!Number.isInteger(s.pending[type]))throw Error('검사 예정 수는 정수');}
 for(const v of Object.values(s.rates??{}))nonneg(v,'단가');for(const k of ['regular','overtime','internal','external','qc'])nonneg(s.rates?.[k],k);
 function calendar(c){if(!c||!Array.isArray(c.sessions)||!c.sessions.length||!Array.isArray(c.weekdays)||!c.weekdays.length||!c.weekdays.every(d=>Number.isInteger(d)&&d>=0&&d<=6)||!Number.isInteger(c.horizonDays)||c.horizonDays<1||c.horizonDays>366)throw Error('작업 달력 오류');let last=0;for(const [a,b] of c.sessions){if(!Number.isFinite(a)||!Number.isFinite(b)||a<last||a>=b||b>24)throw Error('작업 구간 중복/오류');last=b;}}
 calendar(s.calendar);calendar(s.downstream?.calendar);
 if(s.overtimeHours&&(!s.overtimeDates?.length||new Set(s.overtimeDates).size!==s.overtimeDates.length))throw Error('OT 일자 필요/중복');
 for(const d of s.overtimeDates)if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!date(d+'T00:00:00+09:00'))throw Error('OT 일자 오류');
 const end=s.calendar.sessions.at(-1)[1];if(s.overtimeHours/Math.max(1,s.overtimeDates.length)>24-end)throw Error('OT 구간이 자정을 초과합니다.');
 for(const q of s.qcUnavailable??[])if(!date(q.start)||!date(q.end)||Date.parse(q.end)<=Date.parse(q.start))throw Error('QC 불가 구간 오류');
 if(!Array.isArray(s.readiness)||!s.readiness.every(date))throw Error('검사 선행조건 시각 오류');
 if(!Array.isArray(s.tasks)||!s.tasks.length)throw Error('작업 데이터 필요');
 const ids=new Set();for(const t of s.tasks){if(!t.id||ids.has(t.id))throw Error('작업 ID 중복');ids.add(t.id);nonneg(t.remaining,'작업 잔여');if(t.maxWorkers!==undefined){nonneg(t.maxWorkers,'작업 적격자');if(!Number.isInteger(t.maxWorkers))throw Error('적격자 정수 필요');}if(!t.qualification||!t.equipment)throw Error('작업 자격/설비 정보 필요');}
 const done=new Set();let left=[...s.tasks];while(left.length){const i=left.findIndex(t=>Array.isArray(t.predecessors)&&t.predecessors.every(p=>done.has(p)));if(i<0)throw Error('선행 작업 누락/순환 의존성');done.add(left.splice(i,1)[0].id);}
 for(const x of s.workerUnavailable??[]){if(!date(x.start)||!date(x.end)||Date.parse(x.end)<=Date.parse(x.start)||!Number.isInteger(x.count)||x.count<0||x.count>s.workers)throw Error('작업자 불가 구간 오류');}
 const seen=new Set();for(const r of s.confirmedReworks){if(!r.id||seen.has(r.id))throw Error('동일 보수 작업 중복');seen.add(r.id);nonneg(r.mh,'확정 보수');if(!['CONFIRMED','RESOLVED'].includes(r.status))throw Error('확정 보수 상태 오류');}
 if(s.externalMobilization!==null)nonneg(s.externalMobilization,'외부 착수비');
 for(const k of ['preparationHours','transportHours','receiptHours'])if(s.downstream[k]!==null)nonneg(s.downstream[k],k);
 for(const k of ['loadingReservation','resourceReady','precedingReady'])if(s.downstream[k]!==null&&!date(s.downstream[k]))throw Error('후행 시각 오류');
 if(s.eventModel!==null){if(!Array.isArray(s.eventModel)||!s.eventModel.length)throw Error('확률 모델 오류');const groups=new Set();for(const e of s.eventModel){nonneg(e.probability,'확률');nonneg(e.mh,'사건 MH');if(e.probability>1||!e.exclusiveGroup||groups.has(e.exclusiveGroup))throw Error('독립/중복 검증된 사건 그룹만 허용');groups.add(e.exclusiveGroup);}}
 return s;
}
export function importScenario(text){return validate(JSON.parse(text));}

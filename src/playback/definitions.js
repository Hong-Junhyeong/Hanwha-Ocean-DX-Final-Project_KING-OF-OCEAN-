export const STEP_STATES=['NOT_STARTED','READY','IN_PROGRESS','WAITING_NONWORK','WAITING_QC','SKIPPED','COMPLETE','RELEASED'];
export const SEGMENT_TYPES=['WORK','OT','LUNCH','WAIT_NONWORK','WAIT_QC','QC_INSPECTION','QC_REINSPECTION','EQUIPMENT_STOP'];
export const STEPS=[
 ['FITUP','잔여 취부 작업','T10','ACTIVE'],['WELDING','본용접 작업','T20','HOME'],['FINISH','마감·검사 준비','T30','HOME'],['INITIAL_QC','최초 품질검사','T40','HOME'],['REWORK','추가 재작업','REWORK','HOME'],['REINSPECTION','QC 대기 · 재검사','REINSPECTION','HOME'],['HANDOVER','품질 인계 · 반출 준비','HANDOVER','HOME']
].map(([process,name,sourceTask,craneIntent],i)=>({step:i+1,id:`STEP_0${i+1}`,process,name,sourceTask,craneIntent}));
// These names and IDs are from Nf, Bd and Vd in the unmodified reference HTML.
// The weights/order are explicitly educational; no component completion survey.
const MODULES=[['S180','LOWER + BULB','LOWER_BOW_GRP',100],['T350','COLLISION BHD','COLLISION_BHD_GRP',60],['S190','PORT SHELL','PORT_SHELL_GRP',80],['D380','STBD SHELL','STBD_SHELL_GRP',60],['D390','UPPER BOW','UPPER_BOW_GRP',40]];
export function geometryMapping(plannedMH,completedMH){
 let start=0;return {mode:'MH_BASED_SCHEMATIC',classification:'EDUCATIONAL_ASSUMPTION',namespace:'GEOMETRY_MODULE',physicalMappingVerified:false,totalWeightMH:plannedMH,modules:MODULES.map(([moduleId,moduleName,geometryObjectId,weight])=>{const workWeightMH=weight*plannedMH/340,cumulativeStartMH=start,cumulativeEndMH=start+=workWeightMH,moduleProgress=Math.max(0,Math.min(1,(completedMH-cumulativeStartMH)/workWeightMH));return {moduleId,moduleName,geometryObjectId,workWeightMH,cumulativeStartMH,cumulativeEndMH,stateAtSnapshot:moduleProgress===1?'COMPLETE':moduleProgress===0?'NOT_STARTED':'PARTIAL',moduleProgress,mappingBasis:'EDUCATIONAL_ASSUMPTION'};})};
}

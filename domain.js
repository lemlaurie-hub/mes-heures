/* Regles metier centralisees : une seule source de verite pour planning, prevision et evenements */
(function(){
const DAY=86400000;
const clone=o=>JSON.parse(JSON.stringify(o));
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const cfg=()=>state.config||(state.config={});
const plans=()=>Array.isArray(cfg().planningProfiles)?cfg().planningProfiles.filter(p=>!p.archived):[];
const planBy=id=>(cfg().planningProfiles||[]).find(p=>p.id===id)||null;
const typeBy=id=>(cfg().dayTypes||[]).find(t=>t.id===id)||null;
function principalPlan(){return plans().find(p=>p.role==='principal')||planBy('normal')||plans()[0]||null}
function planDays(plan,k,pending=false){if(!plan)return{};const versions=(plan.versions||[]).filter(v=>v.effectiveFrom<=k&&(v.status==='validated'||pending&&v.status==='pending')).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));return clone(versions.length?versions[versions.length-1].days:(plan.days||{}))}
function activePeriod(k,pending=false){const xs=(cfg().planningPeriods||[]).map((x,i)=>({x,i})).filter(o=>o.x.start<=k&&o.x.end>=k&&(o.x.status==='validated'||pending&&o.x.status==='pending')).sort((a,b)=>b.x.start.localeCompare(a.x.start)||b.i-a.i);return xs[0]?.x||null}
function activePlan(k,pending=false){return planBy(activePeriod(k,pending)?.profileId)||principalPlan()}
function plannedType(k,pending=false){const p=activePlan(k,pending),days=planDays(p,k,pending),dow=String(new Date(k+'T12:00:00').getDay());return typeBy(days[dow])||null}
function clock(v){if(!v||!String(v).includes(':'))return null;const [h,m]=String(v).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null}
function minutesOfType(t){return Math.max(0,Number(t?.minutes)||0)}
function baseDay(k){const o=cfg().dayOverridesV32?.[k]||null,t=(o?.dayTypeId&&typeBy(o.dayTypeId))||plannedType(k),part=o?.part||'full';if(!t)return{type:null,part:'full',start:'',end:'',minutes:0,pause:0};if(part==='full')return{type:t,part,start:t.start||'',end:t.end||'',minutes:minutesOfType(t),pause:Math.max(0,Number(t.pause)||0)};const start=part==='morning'?(t.start||''):(o?.boundary||'13:30'),end=part==='morning'?(o?.boundary||'12:00'):(t.end||''),a=clock(start),b=clock(end),minutes=a!=null&&b!=null?Math.max(0,b-a):Math.round(minutesOfType(t)/2);return{type:t,part,start,end,minutes,pause:0,boundary:o?.boundary||''}}
function eventsFor(k,pending=false){return(cfg().futureEvents||[]).filter(e=>e.start<=k&&e.end>=k&&(e.status==='validated'||pending&&e.status==='pending'))}
function recuperationMinutes(k,event,base){const part=event.part||'full';if(part==='full')return 0;const split=clock(event.splitTime||(part==='morning'?'13:30':'12:00')),a=clock(base.start),b=clock(base.end);if(split==null||a==null||b==null)return Math.round(base.minutes/2);if(part==='morning')return Math.max(0,b-Math.max(a,split));return Math.max(0,Math.min(b,split)-a)}
function forecastMinutes(k,pending=false){const base=baseDay(k);let m=base.minutes;for(const e of eventsFor(k,pending)){if(e.type!=='Récup'||e.status!=='validated')continue;m=Math.min(m,recuperationMinutes(k,e,base))}return Math.max(0,Math.round(m))}
function weekForecast(ws,pending=false){return weekDays(ws).reduce((n,k)=>n+forecastMinutes(k,pending),0)}
function addDays(k,n){const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+n);return localKey(d)}
function normalizePlanningPeriods(){cfg().planningPeriods=Array.isArray(cfg().planningPeriods)?cfg().planningPeriods:[]}
function mergePeriods(list){const sorted=list.slice().sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));const out=[];for(const p of sorted){const prev=out[out.length-1];if(prev&&prev.profileId===p.profileId&&prev.status===p.status&&addDays(prev.end,1)===p.start){prev.end=p.end;continue}out.push(p)}return out}
function assignPlanningRange(profileId,start,end,status='validated'){
 normalizePlanningPeriods();if(!start||!end||end<start)throw new Error('Période invalide');
 const principal=principalPlan();const next=[];
 for(const p of cfg().planningPeriods){if(p.end<start||p.start>end){next.push(p);continue}if(p.start<start)next.push({...p,id:uid('per'),end:addDays(start,-1)});if(p.end>end)next.push({...p,id:uid('per'),start:addDays(end,1)})}
 if(profileId&&profileId!==principal?.id)next.push({id:uid('per'),profileId,start,end,status,createdAt:dateKey()});
 cfg().planningPeriods=mergePeriods(next);save();return cfg().planningPeriods
}
function removePlanningPeriod(id){normalizePlanningPeriods();cfg().planningPeriods=cfg().planningPeriods.filter(x=>x.id!==id);save()}
function saveDayOverride(k,data){cfg().dayOverridesV32=cfg().dayOverridesV32||{};cfg().dayOverridesV32[k]={...data,updatedAt:dateKey()};save()}
function removeDayOverride(k){cfg().dayOverridesV32=cfg().dayOverridesV32||{};delete cfg().dayOverridesV32[k];save()}
function createEvent(data){cfg().futureEvents=Array.isArray(cfg().futureEvents)?cfg().futureEvents:[];const e={id:uid('evt'),createdAt:dateKey(),...data};if(e.status==='validated'&&!e.validatedAt)e.validatedAt=dateKey();cfg().futureEvents.push(e);save();return e}
function validateEvent(id){const e=(cfg().futureEvents||[]).find(x=>x.id===id);if(!e)return false;e.status='validated';e.validatedAt=dateKey();save();return true}
function removeEvent(id){cfg().futureEvents=(cfg().futureEvents||[]).filter(x=>x.id!==id);save()}
function weeklyObjective(k=dateKey()){return Math.round(Number(scheduleFor(weekStart(k))?.weeklyTarget??cfg().weeklyTarget??35)*60)}
function currentBalance(k=dateKey()){
 let total=Number(state.initialBalanceMinutes||0)+(state.historicalWeeks||[]).reduce((n,w)=>n+Number(w.deltaMinutes||0),0);
 const ws=weekStart(k),today=dateKey();if(ws!==weekStart(today))return total;
 const completed=weekDays(ws).filter(d=>d<today);if(!completed.length)return total;
 const workedDone=completed.reduce((n,d)=>{const day=state.days[d],w=day?worked(day):null;return n+(w==null?0:w)+Number(day?.retainedMinutes||0)},0);
 const plannedDone=completed.reduce((n,d)=>n+forecastMinutes(d),0);
 return total+workedDone-plannedDone
}
window.MH={plans,planBy,typeBy,principalPlan,planDays,activePeriod,activePlan,plannedType,baseDay,eventsFor,forecastMinutes,weekForecast,assignPlanningRange,removePlanningPeriod,saveDayOverride,removeDayOverride,createEvent,validateEvent,removeEvent,weeklyObjective,currentBalance};
window.forecastMinutesV31=forecastMinutes;
window.dayForecastOverrideV32=k=>cfg().dayOverridesV32?.[k]?baseDay(k).minutes:null;
expectedFor=k=>forecastMinutes(k);
weekTarget=k=>weeklyObjective(k);
balanceNow=k=>currentBalance(k);
window.saveWeekPlanChangeV28=ws=>{try{const profileId=document.querySelector('#weekPlanSelectV28')?.value,status=document.querySelector('#weekPlanStatusV28')?.value||'validated';assignPlanningRange(profileId,ws,weekDays(ws)[6],status);document.querySelector('#weekPlanDialogV28')?.close();document.querySelector('#weekDialogV28')?.close();document.querySelector('#weekDialogV31')?.close();renderAll();toast('✓ Planning de la semaine enregistré.')}catch(e){toast(e.message||'Impossible d’enregistrer ce planning.','error')}};
window.addPlanPeriodV28=id=>{try{const start=document.querySelector('#pp-'+id+'Start')?.value,end=document.querySelector('#pp-'+id+'End')?.value,status=document.querySelector('#pps-'+id)?.value||'validated';if(!start||!end){toast('Choisis la période.','error');return}assignPlanningRange(id,start,end,status);renderSettings();renderAll();toast('✓ Période d’application enregistrée.')}catch(e){toast(e.message||'Impossible d’enregistrer cette période.','error')}};
window.removePlanPeriodV28=id=>{removePlanningPeriod(id);renderSettings();renderAll()};
window.validateEventV28=id=>{if(validateEvent(id))renderAll()};
window.removeEventV28=id=>{removeEvent(id);renderAll()};
})();
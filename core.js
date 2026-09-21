/* Mes heures - noyau unique : stockage, dates, pointages et migration */
window.MH = window.MH || {};
(function(MH){
  'use strict';
  const KEY='mes-heures-data-v8';
  const OLD_KEYS=['mes-heures-data-v7','mes-heures-data-v6','mes-heures-data-v5','mes-heures-data-v4','mes-heures-data-v3','mes-heures-data-v2','mes-heures-data-v1'];
  const DAY=86400000;
  const DEFAULT_SCHEDULE={1:{start:'',end:'',minutes:0},2:{start:'',end:'',minutes:0},3:{start:'',end:'',minutes:0},4:{start:'',end:'',minutes:0},5:{start:'',end:'',minutes:0},6:{start:'',end:'',minutes:0},0:{start:'',end:'',minutes:0}};
  const clone=o=>JSON.parse(JSON.stringify(o));
  const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  function localKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function dateKey(d=new Date()){return localKey(d)}
  function hhmm(d=new Date()){return d.toTimeString().slice(0,5)}
  function mins(t){if(!t||!String(t).includes(':'))return null;const [h,m]=String(t).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null}
  function clock(n){n=((Math.round(Number(n)||0)%1440)+1440)%1440;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
  function fmtMinutes(m){m=Math.round(Number(m)||0);const sign=m<0?'-':m>0?'+':'';m=Math.abs(m);return `${sign}${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`}
  function fmtPlainMinutes(m){m=Math.abs(Math.round(Number(m)||0));return `${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`}
  function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  const escapeAttr=escapeHtml;
  function addDays(k,n){const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+Number(n||0));return localKey(d)}
  function frenchDate(k,opts={weekday:'long',day:'numeric',month:'long'}){return new Intl.DateTimeFormat('fr-FR',opts).format(new Date(k+'T12:00:00'))}
  function shortDate(k){return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit'}).format(new Date(k+'T12:00:00'))}
  function weekStart(k=dateKey()){const d=new Date(k+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));return localKey(d)}
  function weekDays(k=dateKey()){const s=new Date(weekStart(k)+'T12:00:00');return Array.from({length:7},(_,i)=>{const d=new Date(s);d.setDate(s.getDate()+i);return localKey(d)})}
  function firstMonday(y){const d=new Date(Number(y),0,1,12);while(d.getDay()!==1)d.setDate(d.getDate()+1);return localKey(d)}
  function mondays(y){const out=[];let k=firstMonday(y);while(new Date(k+'T12:00:00').getFullYear()===Number(y)){out.push(k);k=addDays(k,7)}return out}
  function weekNumber(k){const d=new Date(k+'T12:00:00'),first=new Date(firstMonday(d.getFullYear())+'T12:00:00'),dayUtc=Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()),firstUtc=Date.UTC(first.getFullYear(),first.getMonth(),first.getDate());return 1+Math.floor((dayUtc-firstUtc)/(7*DAY))}
  function rangeDates(a,b){const out=[];if(!a||!b||b<a)return out;for(let k=a;k<=b;k=addDays(k,1))out.push(k);return out}
  function monthBounds(offset=0){const d=new Date();d.setMonth(d.getMonth()+Number(offset||0),1);return[localKey(new Date(d.getFullYear(),d.getMonth(),1,12)),localKey(new Date(d.getFullYear(),d.getMonth()+1,0,12))]}
  function validSegments(day){return Array.isArray(day?.segments)?day.segments.filter(s=>s&&s.start):[]}
  function openSegment(day){const ss=validSegments(day);return ss.length&&!ss.at(-1).end?ss.at(-1):null}
  function pauseFor(day){return Math.max(0,Number(day?.pauseMinutes??0)||0)}
  function worked(day,pauseMinutes=pauseFor(day)){
    if(!day)return null;
    const ss=validSegments(day);
    const duration=(start,end)=>{const a=mins(start),b=mins(end);return a==null||b==null?null:(b<a?b+1440:b)-a};
    const pause=Math.max(0,Number(pauseMinutes)||0);
    if(ss.length){let total=0,complete=0;for(const s of ss){const n=duration(s.start,s.end);if(n!=null){total+=n;complete++}}return complete?Math.max(0,total-pause):null}
    if(day.workedMinutes!=null)return Math.max(0,Number(day.workedMinutes)-pause);
    const n=duration(day.arrival,day.departure);return n==null?null:Math.max(0,n-pause);
  }
  function ensureSegments(day){if(Array.isArray(day.segments))return day.segments;day.segments=[];if(day.arrival)day.segments.push({start:day.arrival,end:day.departure||null,label:''});delete day.arrival;delete day.departure;delete day.workedMinutes;return day.segments}
  function segmentText(day){const ss=validSegments(day);return ss.length?ss.map(s=>{const a=mins(s.start),b=mins(s.end);return `${s.start}–${s.end||'…'}${a!=null&&b!=null&&b<a?' (+1 j)':''}`}).join(' · '):'—'}
  function defaultConfig(){const today=dateKey();return{weeklyTarget:0,pause:0,personName:'',employmentName:'Mon emploi',employmentStart:today,contractEnd:'',calendarUrl:'',balanceAlertNegative:20,balanceAlertPositive:20,balanceReturnDelayValue:'',balanceReturnDelayUnit:'weeks',alsaceMoselle:false,scheduleVersions:[{effectiveFrom:today,weeklyTarget:0,schedule:clone(DEFAULT_SCHEDULE)}],dayTypes:[{id:'repos',code:'OFF',name:'Repos',description:'',start:'',end:'',pause:0,minutes:0}],weekPlan:{1:'repos',2:'repos',3:'repos',4:'repos',5:'repos',6:'repos',0:'repos'},planningProfiles:[],planningPeriods:[],futureEvents:[],dayOverridesV32:{},annualViewYear:new Date().getFullYear()}}
  /** Reconnaît uniquement l’ancien modèle personnel encore vierge de toute vraie saisie. */
  function isUnusedLegacyStarter(s,c){
    const types=c.dayTypes||[],plan=(c.planningProfiles||[])[0],days=plan?.days||{};
    const exactTypes=types.length===3&&types.some(t=>t.id==='normal'&&t.code==='NORM'&&t.start==='09:00'&&t.end==='18:30'&&Number(t.pause)===30)&&types.some(t=>t.id==='normal-jeudi'&&t.code==='NORJ'&&t.start==='09:00'&&t.end==='18:30'&&Number(t.pause)===90)&&types.some(t=>t.id==='repos'&&t.code==='OFF'&&Number(t.minutes)===0);
    const exactPlan=(c.planningProfiles||[]).length===1&&plan?.code==='MJC'&&String(days[1])==='normal'&&String(days[2])==='normal'&&String(days[3])==='normal'&&String(days[4])==='normal-jeudi'&&String(days[5])==='repos'&&String(days[6])==='repos'&&String(days[0])==='repos';
    const meaningfulDay=Object.values(s.days||{}).some(day=>(day?.segments||[]).some(x=>x?.start)||day?.arrival||day?.departure||day?.workedMinutes!=null||day?.retainedMinutes!=null||String(day?.note||'').trim());
    return!String(c.personName||'').trim()&&exactTypes&&exactPlan&&!meaningfulDay&&!(s.historicalWeeks||[]).length&&!(s.balanceAdjustments||[]).length&&!(c.futureEvents||[]).length&&!String(s.balanceReferenceDate||'');
  }
  function migrate(raw){
    const s=raw&&typeof raw==='object'?raw:{};s.config=s.config&&typeof s.config==='object'?s.config:{};const d=defaultConfig(),c=s.config;
    for(const [k,v] of Object.entries(d))if(c[k]==null)c[k]=clone(v);
    s.days=s.days&&typeof s.days==='object'?s.days:{};s.historicalWeeks=Array.isArray(s.historicalWeeks)?s.historicalWeeks:[];s.balanceAdjustments=Array.isArray(s.balanceAdjustments)?s.balanceAdjustments:[];s.initialBalanceMinutes=Number(s.initialBalanceMinutes||0);
    c.dayTypes=Array.isArray(c.dayTypes)&&c.dayTypes.length?c.dayTypes:d.dayTypes;
    for(const t of c.dayTypes){t.id=t.id||uid('type');t.code=String(t.code||t.name||'JOUR').toUpperCase().replace(/\s+/g,'').slice(0,4);t.name=t.name||'Journée';t.description=t.description||'';t.start=t.start||'';t.end=t.end||'';t.pause=Math.max(0,Number(t.pause)||0);if(!Number.isFinite(Number(t.minutes))){const a=mins(t.start),b=mins(t.end);t.minutes=a!=null&&b!=null&&b>=a?Math.max(0,b-a-t.pause):0}else t.minutes=Math.max(0,Number(t.minutes)||0)}
    c.weekPlan=c.weekPlan||d.weekPlan;c.planningProfiles=Array.isArray(c.planningProfiles)?c.planningProfiles:[];
    if(!c.planningProfiles.length)c.planningProfiles=[{id:'principal',code:'BASE',name:'Planning principal',role:'principal',days:clone(c.weekPlan),versions:[],archived:false}];
    for(let i=0;i<c.planningProfiles.length;i++){const p=c.planningProfiles[i];p.id=p.id||uid('plan');p.code=p.code||`P${i+1}`;p.name=p.name||'Planning';p.role=p.role||(p.id==='normal'||i===0?'principal':i===1?'secondary':i===2?'exceptional':'extra');p.days=p.days||clone(c.weekPlan);p.versions=Array.isArray(p.versions)?p.versions:[];p.archived=!!p.archived}
    const principal=c.planningProfiles.find(p=>p.role==='principal')||c.planningProfiles[0];if(principal)principal.role='principal';
    c.planningPeriods=Array.isArray(c.planningPeriods)?c.planningPeriods:[];c.futureEvents=Array.isArray(c.futureEvents)?c.futureEvents:[];c.dayOverridesV32=c.dayOverridesV32&&typeof c.dayOverridesV32==='object'?c.dayOverridesV32:{};
    c.scheduleVersions=Array.isArray(c.scheduleVersions)&&c.scheduleVersions.length?c.scheduleVersions:d.scheduleVersions;c.annualViewYear=Number(c.annualViewYear)||new Date().getFullYear();
    if(isUnusedLegacyStarter(s,c)){
      c.weeklyTarget=d.weeklyTarget;c.pause=d.pause;c.scheduleVersions=clone(d.scheduleVersions);c.dayTypes=clone(d.dayTypes);c.weekPlan=clone(d.weekPlan);c.planningProfiles=[{id:'principal',code:'BASE',name:'Planning principal',role:'principal',days:clone(d.weekPlan),versions:[],archived:false}];c.planningPeriods=[];c.dayOverridesV32={};
    }
    for(const [k,day] of Object.entries(s.days)){
      day.note=day.note||'';
      /* Les imports historiques nommaient la pause réelle `pause`. Elle est
         certaine et doit rester prioritaire sur le planning. */
      if(day.pause!=null&&day.pauseExplicit==null){day.pauseMinutes=Math.max(0,Number(day.pause)||0);day.pauseExplicit=true}
      else if(day.pauseMinutes==null)day.pauseMinutes=Number(c.pause||0);
      delete day.pause;
      ensureSegments(day);
      if(day.dayTypeId&&!c.dayOverridesV32[k])c.dayOverridesV32[k]={dayTypeId:day.dayTypeId,part:'full',boundary:'',updatedAt:k,legacy:true};
      if(day.eventType&&!c.futureEvents.some(e=>e.start===k&&e.end===k&&e.type===day.eventType))c.futureEvents.push({id:uid('evt'),type:day.eventType,comment:'',start:k,end:k,part:'full',splitTime:'',status:'validated',createdAt:k,validatedAt:k,legacy:true});
      delete day.dayTypeId;delete day.eventType;
    }
    for(const w of s.historicalWeeks){w.weekStart=w.weekStart||'';w.targetMinutes=Number(w.targetMinutes??2100);w.workedMinutes=Number(w.workedMinutes??(w.targetMinutes+Number(w.deltaMinutes||0)));w.deltaMinutes=Number(w.deltaMinutes??(w.workedMinutes-w.targetMinutes));w.eventType=w.eventType||'';w.note=w.note||''}
    return s
  }
  function load(){try{let raw=localStorage.getItem(KEY);if(!raw)for(const k of OLD_KEYS){raw=localStorage.getItem(k);if(raw)break}return migrate(raw?JSON.parse(raw):null)}catch(e){console.error(e);return migrate(null)}}
  let state=load();
  function save(){localStorage.setItem(KEY,JSON.stringify(state))}
  function replaceState(next){state=migrate(next);save();return state}
  function dayObj(k=dateKey()){return state.days[k]||(state.days[k]={segments:[],pauseMinutes:Number(state.config.pause||0),note:'',status:'open',source:'live'})}
  MH.core={KEY,DAY,DEFAULT_SCHEDULE,clone,uid,localKey,dateKey,hhmm,mins,clock,fmtMinutes,fmtPlainMinutes,escapeHtml,escapeAttr,addDays,frenchDate,shortDate,weekStart,weekDays,firstMonday,mondays,weekNumber,rangeDates,monthBounds,validSegments,openSegment,pauseFor,worked,ensureSegments,segmentText,dayObj,save,replaceState,get state(){return state}};
})(window.MH);

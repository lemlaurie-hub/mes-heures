/* Mes heures - règles métier uniques : planning, événements, prévisions et compteurs */
window.MH = window.MH || {};
(function(MH){
  'use strict';
  const C=MH.core;
  const S=()=>C.state, cfg=()=>S().config;
  const NEUTRAL_TYPES=new Set(['Congé','Congé exceptionnel','Arrêt maladie','Férié']);
  function plans(includeArchived=false){return (cfg().planningProfiles||[]).filter(p=>includeArchived||!p.archived)}
  function planBy(id){return(cfg().planningProfiles||[]).find(p=>p.id===id)||null}
  function typeBy(id){return(cfg().dayTypes||[]).find(t=>t.id===id)||null}
  function principalPlan(){return plans().find(p=>p.role==='principal')||planBy('normal')||plans()[0]||null}
  function planDays(plan,k,pending=false){if(!plan)return{};const versions=(plan.versions||[]).filter(v=>v.effectiveFrom<=k&&(v.status==='validated'||pending&&v.status==='pending')).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));return C.clone(versions.length?versions.at(-1).days:(plan.days||{}))}
  function activePeriod(k,pending=false){return(cfg().planningPeriods||[]).map((p,i)=>({p,i})).filter(x=>x.p.start<=k&&x.p.end>=k&&(x.p.status==='validated'||pending&&x.p.status==='pending')).sort((a,b)=>b.p.start.localeCompare(a.p.start)||b.i-a.i)[0]?.p||null}
  function activePlan(k,pending=false){return planBy(activePeriod(k,pending)?.profileId)||principalPlan()}
  function plannedType(k,pending=false){const p=activePlan(k,pending),days=planDays(p,k,pending),dow=String(new Date(k+'T12:00:00').getDay());return typeBy(days[dow])||null}
  function baseDay(k){const o=cfg().dayOverridesV32?.[k]||null,t=(o?.dayTypeId&&typeBy(o.dayTypeId))||plannedType(k),part=o?.part||'full';if(!t)return{type:null,part:'full',start:'',end:'',minutes:0,pause:0,boundary:''};if(part==='full')return{type:t,part,start:t.start||'',end:t.end||'',minutes:Math.max(0,Number(t.minutes)||0),pause:Math.max(0,Number(t.pause)||0),boundary:''};const start=part==='morning'?(t.start||''):(o?.boundary||'13:30'),end=part==='morning'?(o?.boundary||'12:00'):(t.end||''),a=C.mins(start),b=C.mins(end);return{type:t,part,start,end,minutes:a!=null&&b!=null?Math.max(0,b-a):Math.round((Number(t.minutes)||0)/2),pause:0,boundary:o?.boundary||''}}
  function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=y%100,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-Math.floor(b/4)-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*(b%4)+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,da,12)}
  function holidays(y){const map=new Map(),fixed=[[1,1,'Jour de l’an'],[5,1,'Fête du Travail'],[5,8,'Victoire 1945'],[7,14,'Fête nationale'],[8,15,'Assomption'],[11,1,'Toussaint'],[11,11,'Armistice'],[12,25,'Noël']];for(const[mo,d,n]of fixed)map.set(C.localKey(new Date(y,mo-1,d,12)),n);const e=easter(y),ek=C.localKey(e);map.set(C.addDays(ek,1),'Lundi de Pâques');map.set(C.addDays(ek,39),'Ascension');map.set(C.addDays(ek,50),'Lundi de Pentecôte');if(cfg().alsaceMoselle){map.set(C.localKey(new Date(y,11,26,12)),'Saint-Étienne');const gf=new Date(e);gf.setDate(gf.getDate()-2);map.set(C.localKey(gf),'Vendredi saint')}return map}
  function holidayFor(k){return holidays(Number(k.slice(0,4))).get(k)||''}
  function storedEventsFor(k,pending=false){return(cfg().futureEvents||[]).filter(e=>e.start<=k&&e.end>=k&&(e.status==='validated'||pending&&e.status==='pending'))}
  function eventsFor(k,pending=false){const out=storedEventsFor(k,pending).slice(),h=holidayFor(k);if(h&&!out.some(e=>e.type==='Férié'))out.push({id:'holiday:'+k,type:'Férié',comment:h,start:k,end:k,part:'full',splitTime:'',status:'validated',automatic:true});return out}
  function segmentWork(base,part,split){if(part==='full')return 0;const a=C.mins(base.start),b=C.mins(base.end),s=C.mins(split||(part==='morning'?'13:30':'12:00'));if(a==null||b==null||s==null)return Math.round(base.minutes/2);return part==='morning'?Math.max(0,b-Math.max(a,s)):Math.max(0,Math.min(b,s)-a)}
  function dayExpectation(k,pending=false){const base=baseDay(k),events=eventsFor(k,pending);let required=base.minutes,credit=0,requiredPause=base.pause;for(const e of events){if(e.status!=='validated'&&!pending)continue;const part=e.part||'full';if(NEUTRAL_TYPES.has(e.type)){const work=part==='full'?0:segmentWork(base,part,e.splitTime);required=Math.min(required,work);credit=Math.max(credit,Math.max(0,base.minutes-work));requiredPause=0}else if(e.type==='Récup'){const work=part==='full'?0:segmentWork(base,part,e.splitTime);required=Math.min(required,work);requiredPause=0}}if(base.part!=='full')requiredPause=0;const retained=Math.max(0,required+credit);return{date:k,base,events,requiredWork:Math.max(0,Math.round(required)),credit:Math.max(0,Math.round(credit)),retainedForecast:Math.max(0,Math.round(retained)),requiredPause:Math.max(0,Math.round(requiredPause))}}
  /** Pause retenue : valeur personnalisée explicitement, sinon journée type applicable à la date. */
  function actualPause(k,day=S().days[k]){return day?.pauseExplicit===true?C.pauseFor(day):dayExpectation(k).requiredPause}
  /** Temps réel commun à l'interface, aux compteurs et aux exports. */
  function actualWorked(k,day=S().days[k]){return day?C.worked(day,actualPause(k,day)):null}
  /**
   * État réel d'une journée affiché par toutes les vues.
   * Une journée arrivée à sa date, prévue à 0 h et sans saisie réelle est
   * valide par nature. Un pointage éventuel reste toutefois prioritaire.
   */
  function actualDayState(k,day=S().days[k]){const worked=actualWorked(k,day),expected=dayExpectation(k);if(k>C.dateKey())return{code:'future',label:'À venir',worked};if(C.openSegment(day))return{code:'open',label:'En cours',worked};if(worked!=null)return{code:'worked',label:C.fmtPlainMinutes(worked),worked};if(expected.requiredWork===0)return{code:'validated-zero',label:'Validée',worked:null};return{code:'missing',label:'À compléter',worked:null}}
  function forecastMinutes(k,pending=false){return dayExpectation(k,pending).retainedForecast}
  function requiredWorkMinutes(k){return dayExpectation(k).requiredWork}
  function accountedMinutes(k){const x=dayExpectation(k),day=S().days[k],w=actualWorked(k,day);return (w==null?0:w)+x.credit+Number(day?.retainedMinutes||0)}
  function scheduleFor(k){const vs=(cfg().scheduleVersions||[]).slice().sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));let v=vs[0]||{weeklyTarget:Number(cfg().weeklyTarget||35)};for(const x of vs)if(x.effectiveFrom<=k)v=x;return v}
  function weeklyObjective(k=C.dateKey()){return Math.round(Number(scheduleFor(C.weekStart(k))?.weeklyTarget??cfg().weeklyTarget??35)*60)}
  /**
   * Une semaine complète de congé planifié vaut l'objectif contractuel. Cette
   * règle ne concerne pas les arrêts ni les jours fériés : ceux-ci restent
   * transparents par rapport au planning qui était réellement prévu.
   */
  function weekFullyOnLeave(ws,pending=false){const workedDays=C.weekDays(ws).filter(k=>baseDay(k).minutes>0);return workedDays.length>0&&workedDays.every(k=>eventsFor(k,pending).some(e=>(e.status==='validated'||pending&&e.status==='pending')&&(e.part||'full')==='full'&&e.type==='Congé'))}
  function weekForecast(ws,pending=false){ws=C.weekStart(ws);if(weekFullyOnLeave(ws,pending))return weeklyObjective(ws);return C.weekDays(ws).reduce((n,k)=>n+forecastMinutes(k,pending),0)}
  function calculatedWeekAccounted(ws){ws=C.weekStart(ws);if(weekFullyOnLeave(ws))return weeklyObjective(ws);return C.weekDays(ws).reduce((n,k)=>n+accountedMinutes(k),0)}
  function weekAccounted(ws=C.weekStart()){ws=C.weekStart(ws);const hist=(S().historicalWeeks||[]).find(w=>C.weekStart(w.weekStart)===ws);if(hist)return Number(hist.workedMinutes||0);return calculatedWeekAccounted(ws)}
  function weekActualWorked(ws=C.weekStart()){return C.weekDays(ws).reduce((n,k)=>{const w=actualWorked(k);return n+(w==null?0:w)},0)}
  /** État d'une ressaisie progressive, sans remplacer le total consolidé. */
  function weekReconstruction(ws){ws=C.weekStart(ws);const consolidated=(S().historicalWeeks||[]).find(w=>C.weekStart(w.weekStart)===ws);if(!consolidated)return null;const days=C.weekDays(ws),missing=days.filter(k=>{const x=dayExpectation(k),day=S().days[k],worked=actualWorked(k,day);return x.requiredWork>0&&worked==null&&Number(day?.retainedMinutes||0)<=0}),detailedMinutes=calculatedWeekAccounted(ws);return{weekStart:ws,consolidated,missing,detailedMinutes,differenceMinutes:detailedMinutes-Number(consolidated.workedMinutes||0),complete:missing.length===0,requiredDays:days.filter(k=>dayExpectation(k).requiredWork>0).length,completedRequiredDays:days.filter(k=>dayExpectation(k).requiredWork>0&&!missing.includes(k)).length}}
  /** Remplace explicitement une consolidation complète par ses journées réelles, en archivant l'ancien total. */
  function replaceConsolidatedWeek(ws){const reconstruction=weekReconstruction(ws);if(!reconstruction)throw new Error('Semaine consolidée introuvable');if(!reconstruction.complete)throw new Error('Toutes les journées attendues doivent être complétées');S().replacedHistoricalWeeks=Array.isArray(S().replacedHistoricalWeeks)?S().replacedHistoricalWeeks:[];S().replacedHistoricalWeeks.push({...C.clone(reconstruction.consolidated),replacedAt:C.dateKey(),replacementWorkedMinutes:reconstruction.detailedMinutes});S().historicalWeeks=(S().historicalWeeks||[]).filter(w=>C.weekStart(w.weekStart)!==reconstruction.weekStart);C.save();return reconstruction}
  function remainingThisWeek(k=C.dateKey()){return Math.max(0,weeklyObjective(k)-weekAccounted(C.weekStart(k)))}
  function paidForWeek(ws){return(S().balanceAdjustments||[]).filter(x=>x.weekStart===ws).reduce((n,x)=>n+Number(x.minutes||0),0)}
  function reference(){const date=String(S().balanceReferenceDate||''),minutes=Number(S().balanceReferenceMinutes);return date&&Number.isFinite(minutes)?{date,minutes}:null}
  /** Position d'une semaine par rapport au point de départ du compteur. */
  function referenceCoverage(ws,ref=reference()){if(!ref)return'after';ws=C.weekStart(ws);const end=C.weekDays(ws)[6];if(end<=ref.date)return'covered';if(ws<=ref.date&&ref.date<end)return'junction';return'after'}
  /** Point de référence situé dans l'exercice hebdomadaire demandé. */
  function annualReference(y){const ref=reference();return ref&&C.weekStart(ref.date).slice(0,4)===String(y)?ref:null}
  /**
   * Solde acquis avant une semaine, lorsque l'installation n'utilise pas de
   * point de référence. Après les consolidations, toute semaine passée dont
   * le réel journalier est complet doit contribuer au solde. Une semaine
   * incomplète reste ignorée : ses heures absentes ne sont jamais inventées.
   */
  function legacyHistoricalCarryBefore(ws){let b=Number(S().initialBalanceMinutes||0);const hist=(S().historicalWeeks||[]).slice().sort((a,z)=>a.weekStart.localeCompare(z.weekStart));const histSet=new Set(hist.map(w=>C.weekStart(w.weekStart)));for(const w of hist)if(C.weekStart(w.weekStart)<ws)b+=Number(w.deltaMinutes||0);const actualWeeks=new Set([...Object.keys(S().days||{}).map(k=>C.weekStart(k)),...(S().replacedHistoricalWeeks||[]).map(w=>C.weekStart(w.weekStart))]);for(const aws of actualWeeks)if(aws<ws&&!histSet.has(aws)&&weekReadyForBalance(aws))b+=weekAccounted(aws)-weeklyObjective(aws);for(const a of(S().balanceAdjustments||[]))if(C.weekStart(a.weekStart)<ws&&!histSet.has(C.weekStart(a.weekStart)))b-=Number(a.minutes||0);return Math.round(b)}
  function weekReadyForBalance(ws){return C.weekDays(ws).every(k=>{const x=dayExpectation(k),day=S().days[k],w=actualWorked(k,day);return x.requiredWork===0||w!=null||Number(day?.retainedMinutes||0)>0})}
  function balanceFromReference(until){const ref=reference();if(!ref)return null;if(until<=ref.date)return ref.minutes;let b=ref.minutes;const hist=new Map((S().historicalWeeks||[]).map(w=>[C.weekStart(w.weekStart),w]));const usedWeeks=new Set();for(let k=C.addDays(ref.date,1);k<=until;k=C.addDays(k,1)){const ws=C.weekStart(k),h=hist.get(ws),weekEnd=C.weekDays(ws)[6],fullWeek=ws>ref.date&&weekEnd<=until;if(h&&fullWeek){if(!usedWeeks.has(ws)){b+=Number(h.deltaMinutes||0);b-=paidForWeek(ws);usedWeeks.add(ws)}k=weekEnd;continue}if(fullWeek&&weekReadyForBalance(ws)){if(!usedWeeks.has(ws)){b+=weekAccounted(ws)-weeklyObjective(ws);b-=paidForWeek(ws);usedWeeks.add(ws)}k=weekEnd;continue}const day=S().days[k],w=actualWorked(k,day),completed=k<C.dateKey()||(k===C.dateKey()&&!C.openSegment(day)&&w!=null);if(!completed||w==null)continue;b+=accountedMinutes(k)-forecastMinutes(k)}for(const a of(S().balanceAdjustments||[])){const ws=C.weekStart(a.weekStart);if(ws>ref.date&&ws<=until&&!usedWeeks.has(ws))b-=Number(a.minutes||0)}return Math.round(b)}
  function historicalCarryBefore(ws){const ref=reference();if(!ref)return legacyHistoricalCarryBefore(ws);const dayBefore=C.addDays(ws,-1);return dayBefore<=ref.date?ref.minutes:balanceFromReference(dayBefore)}
  function currentWeekDelta(k=C.dateKey()){const ws=C.weekStart(k),today=C.dateKey();let delta=0;for(const d of C.weekDays(ws)){if(d>today)continue;const day=S().days[d],open=C.openSegment(day),w=actualWorked(d,day);const completed=d<today||(d===today&&!open&&w!=null);if(!completed)continue;delta+=accountedMinutes(d)-forecastMinutes(d)}return Math.round(delta)}
  function currentBalance(k=C.dateKey()){const ref=reference();if(ref)return balanceFromReference(k);return legacyHistoricalCarryBefore(C.weekStart(k))+currentWeekDelta(k)}
  function projectedWeekEndBalance(k=C.dateKey()){return currentBalance(k)}
  function annualObjective(y){return C.mondays(y).reduce((n,ws)=>n+weeklyObjective(ws),0)}
  function annualProjection(y){const today=C.dateKey(),hist=new Map((S().historicalWeeks||[]).map(w=>[w.weekStart,w]));let n=0;for(const ws of C.mondays(y)){const h=hist.get(ws);if(h){n+=Number(h.workedMinutes||0);continue}if(ws===C.weekStart(today)){if(weekFullyOnLeave(ws)){n+=weekForecast(ws);continue}n+=weekAccounted(ws)+Math.max(0,weekForecast(ws)-C.weekDays(ws).filter(k=>k<=today).reduce((s,k)=>s+forecastMinutes(k),0));continue}if(ws<C.weekStart(today)){n+=weekAccounted(ws);continue}n+=weekForecast(ws)}return Math.round(n)}
  function projectedClosingAtYear(y){const ref=annualReference(y);if(ref){const today=C.dateKey(),last=C.weekDays(C.mondays(y).at(-1))[6];if(today>last)return balanceFromReference(last);let balance=currentBalance(),current=C.weekStart(today);for(const ws of C.mondays(y))if(ws>=current)balance+=weekForecast(ws)-weeklyObjective(ws);return Math.round(balance)}const opening=openingAtYear(y);return opening==null?null:Math.round(opening+annualProjection(y)-annualObjective(y))}
  function openingAtYear(y){const currentYear=Number(C.dateKey().slice(0,4));if(y>currentYear)return projectedClosingAtYear(y-1);const ref=reference(),first=C.firstMonday(y);if(ref&&ref.date>=first)return null;return historicalCarryBefore(first)}
  function annualRealized(y){const today=C.dateKey(),hist=new Map((S().historicalWeeks||[]).map(w=>[w.weekStart,w]));let n=0;for(const ws of C.mondays(y)){if(ws>C.weekStart(today))break;const h=hist.get(ws);if(h)n+=Number(h.workedMinutes||0);else n+=weekAccounted(ws)}return Math.round(n)}
  /**
   * Série hebdomadaire unique pour Historique, Années et les exports.
   * Les semaines importées restent inchangées. Après la dernière semaine
   * importée, les semaines sont reconstruites depuis les journées réelles.
   * Une semaine passée incomplète reste signalée sans inventer d'écart.
   */
  function historyWeekRows(until=C.weekStart(C.dateKey())){
    const current=C.weekStart(C.dateKey()),end=until<current?C.weekStart(until):current;
    const historical=(S().historicalWeeks||[]).filter(w=>w.weekStart);
    const rows=new Map(historical.filter(w=>C.weekStart(w.weekStart)<=end).map(w=>{
      const ws=C.weekStart(w.weekStart);
      return[ws,{...w,weekStart:ws,week:w.week||C.weekNumber(ws),workedMinutes:Number(w.workedMinutes||0),targetMinutes:Number(w.targetMinutes||0),deltaMinutes:Number(w.deltaMinutes||0),status:'Consolidée',consolidated:true,current:false}];
    }));
    const latest=[...rows.keys()].sort().at(-1);
    const actualStarts=Object.keys(S().days||{}).filter(k=>k<=C.dateKey()).map(k=>C.weekStart(k)).sort();
    const ref=reference(),firstAfterReference=ref?C.addDays(C.weekStart(ref.date),7):'';
    const first=latest?C.addDays(latest,7):(firstAfterReference&&firstAfterReference<=current?firstAfterReference:(actualStarts[0]||current));
    for(let ws=first;ws<=end;ws=C.addDays(ws,7)){
      const isCurrent=ws===current,ready=!isCurrent&&weekReadyForBalance(ws),worked=weekAccounted(ws),target=weeklyObjective(ws);
      rows.set(ws,{weekStart:ws,week:C.weekNumber(ws),workedMinutes:worked,targetMinutes:target,deltaMinutes:ready?worked-target:null,eventType:weekInfo(ws).events.join(', '),note:'',status:isCurrent?'En cours':ready?'Calculée':'À compléter',consolidated:false,current:isCurrent});
    }
    for(const archived of(S().replacedHistoricalWeeks||[])){const ws=C.weekStart(archived.weekStart);if(ws>end)continue;const ready=weekReadyForBalance(ws),worked=weekAccounted(ws),target=weeklyObjective(ws);rows.set(ws,{weekStart:ws,week:archived.week||C.weekNumber(ws),workedMinutes:worked,targetMinutes:target,deltaMinutes:ready?worked-target:null,eventType:weekInfo(ws).events.join(', '),note:'Reconstituée depuis le détail réel',status:ready?'Calculée':'À compléter',consolidated:false,reconstructed:true,current:false})}
    return [...rows.values()].sort((a,b)=>a.weekStart.localeCompare(b.weekStart));
  }
  /** État de provenance du réel utilisé par le calendrier annuel. */
  function weekActualState(ws){
    ws=C.weekStart(ws);
    const current=C.weekStart(C.dateKey());
    if(ws>=current)return{code:ws===current?'current':'future',label:ws===current?'Semaine en cours':'À venir'};
    const row=historyWeekRows(ws).find(w=>w.weekStart===ws);
    if(row?.consolidated)return{code:'consolidated',label:'Total consolidé, détail réel à ressaisir'};
    if(row?.status==='À compléter')return{code:'incomplete',label:'Données réelles incomplètes'};
    const ref=reference(),days=C.weekDays(ws);
    if(ref&&days[6]<=ref.date)return{code:'reference',label:'Incluse dans le solde de référence'};
    if(ref&&ws===C.weekStart(ref.date)){
      const missing=days.filter(k=>k>ref.date).some(k=>actualDayState(k).code==='missing');
      return missing?{code:'incomplete',label:'Données réelles incomplètes après le solde de référence'}:{code:'actual',label:'Données réelles complètes après le solde de référence'};
    }
    return{code:'actual',label:'Données réelles complètes'};
  }
  function weekInfo(ws){const codes=new Set(),events=[],hols=[],overrides=[],days=[];let pending=false;for(const k of C.weekDays(ws)){const p=activePlan(k);if(p)codes.add(p.code||p.name);const ex=dayExpectation(k,true);for(const e of ex.events){if(e.automatic){if(!hols.includes(e.comment))hols.push(e.comment)}else{if(!events.includes(e.type))events.push(e.type);if(e.status==='pending')pending=true}}if(cfg().dayOverridesV32?.[k])overrides.push(k);days.push({k,plan:p,expectation:ex})}const principal=principalPlan()?.code||'',minutes=weekForecast(ws,true);return{ws,code:codes.size>1?'MIXTE':([...codes][0]||'—'),minutes,events,holidays:hols,overrides,pending,special:codes.size>1||events.length||hols.length||overrides.length||[...codes].some(c=>c!==principal),days}}
  function assignPlanningRange(profileId,start,end,status='validated'){if(!start||!end||end<start)throw new Error('Période invalide');cfg().planningPeriods=Array.isArray(cfg().planningPeriods)?cfg().planningPeriods:[];const principal=principalPlan(),next=[];for(const p of cfg().planningPeriods){if(p.end<start||p.start>end){next.push(p);continue}if(p.start<start)next.push({...p,id:C.uid('per'),end:C.addDays(start,-1)});if(p.end>end)next.push({...p,id:C.uid('per'),start:C.addDays(end,1)})}if(profileId&&profileId!==principal?.id)next.push({id:C.uid('per'),profileId,start,end,status,createdAt:C.dateKey()});next.sort((a,b)=>a.start.localeCompare(b.start));const merged=[];for(const p of next){const prev=merged.at(-1);if(prev&&prev.profileId===p.profileId&&prev.status===p.status&&C.addDays(prev.end,1)===p.start)prev.end=p.end;else merged.push(p)}cfg().planningPeriods=merged;C.save();return merged}
  /**
   * Applique un planning à une semaine et retire uniquement les attributions
   * journalières devenues redondantes avec l'ancien planning. Les véritables
   * exceptions explicites restent prioritaires.
   */
  function assignWeekPlanning(profileId,ws){ws=C.weekStart(ws);const days=C.weekDays(ws),principal=principalPlan(),oldTypes=new Map(days.map(k=>[k,plannedType(k)?.id||''])),principalTypes=new Map(days.map(k=>{const dow=String(new Date(k+'T12:00:00').getDay());return[k,planDays(principal,k)[dow]||'']}));assignPlanningRange(profileId,ws,days[6],'validated');cfg().dayOverridesV32=cfg().dayOverridesV32||{};for(const k of days){const o=cfg().dayOverridesV32[k];if(!o||o.part&&o.part!=='full')continue;const newType=plannedType(k)?.id||'',repeatedOldPlan=o.dayTypeId===oldTypes.get(k),staleLegacyPrincipal=o.legacy===true&&o.dayTypeId===principalTypes.get(k)&&o.dayTypeId!==newType;if(repeatedOldPlan||staleLegacyPrincipal)delete cfg().dayOverridesV32[k]}C.save()}
  /** Répare les anciennes attributions MJC qui masquent déjà un planning secondaire. */
  function cleanupLegacyPlanningOverrides(){const overrides=cfg().dayOverridesV32||{},principal=principalPlan();if(!principal)return false;let changed=false;for(const[k,o]of Object.entries(overrides)){if(o?.legacy!==true||(o.part&&o.part!=='full'))continue;const active=activePlan(k);if(!active||active.id===principal.id)continue;const dow=String(new Date(k+'T12:00:00').getDay()),principalType=planDays(principal,k)[dow]||'',activeType=planDays(active,k)[dow]||'';if(o.dayTypeId===principalType&&o.dayTypeId!==activeType){delete overrides[k];changed=true}}if(changed)C.save();return changed}
  function removePlanningPeriod(id){cfg().planningPeriods=(cfg().planningPeriods||[]).filter(p=>p.id!==id);C.save()}
  function saveDayOverride(k,data){cfg().dayOverridesV32=cfg().dayOverridesV32||{};cfg().dayOverridesV32[k]={dayTypeId:data.dayTypeId||plannedType(k)?.id||'',part:data.part||'full',boundary:data.part==='full'?'':data.boundary||'',updatedAt:C.dateKey()};C.save()}
  function removeDayOverride(k){if(cfg().dayOverridesV32)delete cfg().dayOverridesV32[k];C.save()}
  function upsertEvent(data,id=''){cfg().futureEvents=Array.isArray(cfg().futureEvents)?cfg().futureEvents:[];const clean={type:data.type||'Autre',comment:String(data.comment||'').trim(),start:data.start,end:data.end,part:data.part||'full',splitTime:data.part==='full'?'':data.splitTime||'',status:data.status||'validated'};if(!clean.start||!clean.end||clean.end<clean.start)throw new Error('Période invalide');let e=id?cfg().futureEvents.find(x=>x.id===id):null;if(e)Object.assign(e,clean,{updatedAt:C.dateKey(),validatedAt:clean.status==='validated'?(e.validatedAt||C.dateKey()):''});else{e={id:C.uid('evt'),createdAt:C.dateKey(),...clean,validatedAt:clean.status==='validated'?C.dateKey():''};cfg().futureEvents.push(e)}C.save();return e}
  function removeEvent(id){cfg().futureEvents=(cfg().futureEvents||[]).filter(e=>e.id!==id);C.save()}
  /**
   * Remplace les événements manuels sur une période sans supprimer leurs
   * éventuelles portions situées avant ou après. La même règle sert à
   * l’éditeur d’une journée et à celui d’une semaine.
   */
  function setEventRange(start,end,type=''){
    if(!start||!end||end<start)throw new Error('Période invalide');
    const next=[];
    for(const event of(cfg().futureEvents||[])){
      if(event.end<start||event.start>end){next.push(event);continue}
      if(event.start<start)next.push({...C.clone(event),id:C.uid('evt'),end:C.addDays(start,-1),updatedAt:C.dateKey()});
      if(event.end>end)next.push({...C.clone(event),id:C.uid('evt'),start:C.addDays(end,1),updatedAt:C.dateKey()});
    }
    if(type)next.push({id:C.uid('evt'),type,comment:'',start,end,part:'full',splitTime:'',status:'validated',createdAt:C.dateKey(),validatedAt:C.dateKey()});
    cfg().futureEvents=next.sort((a,b)=>a.start.localeCompare(b.start));C.save();
  }
  /** Modifie seulement l'événement couvrant toute la semaine et préserve les événements journaliers. */
  function setWholeWeekEvent(ws,type=''){ws=C.weekStart(ws);const end=C.weekDays(ws)[6],next=[];for(const event of(cfg().futureEvents||[])){const coversWeek=(event.part||'full')==='full'&&event.start<=ws&&event.end>=end;if(!coversWeek){next.push(event);continue}if(event.start<ws)next.push({...C.clone(event),id:C.uid('evt'),end:C.addDays(ws,-1),updatedAt:C.dateKey()});if(event.end>end)next.push({...C.clone(event),id:C.uid('evt'),start:C.addDays(end,1),updatedAt:C.dateKey()})}if(type)next.push({id:C.uid('evt'),type,comment:'',start:ws,end,part:'full',splitTime:'',status:'validated',createdAt:C.dateKey(),validatedAt:C.dateKey()});cfg().futureEvents=next.sort((a,b)=>a.start.localeCompare(b.start));C.save()}
  function validateEvent(id){const e=(cfg().futureEvents||[]).find(x=>x.id===id);if(!e)return false;e.status='validated';e.validatedAt=C.dateKey();C.save();return true}
  function saveDayActual(k,{segments,pauseMinutes,note}){const d=C.dayObj(k);d.segments=(segments||[]).filter(s=>s.start).map(s=>({start:s.start,end:s.end||null,label:s.label||''}));d.pauseMinutes=Math.max(0,Number(pauseMinutes)||0);d.note=String(note||'');d.status=C.openSegment(d)?'open':'closed';d.source=d.source||'manual';C.save();return d}
  function saveDayType(data,id=''){const a=C.mins(data.start),b=C.mins(data.end),pause=Math.max(0,Number(data.pause)||0);if(!data.code||!data.name)throw new Error('Code et nom nécessaires');if((data.start&&!data.end)||(!data.start&&data.end))throw new Error('Renseigne le début et la fin, ou laisse les deux vides');if(a!=null&&b!=null&&b<a)throw new Error('La fin doit être après le début');const code=String(data.code).trim().toUpperCase().slice(0,4);if((cfg().dayTypes||[]).some(t=>t.id!==id&&String(t.code).toUpperCase()===code))throw new Error('Ce code est déjà utilisé');const values={code,name:String(data.name).trim(),description:String(data.description||'').trim(),start:data.start||'',end:data.end||'',pause,minutes:a!=null&&b!=null?Math.max(0,b-a-pause):0};let t=id?typeBy(id):null;if(t)Object.assign(t,values);else{t={id:C.uid('type'),...values};cfg().dayTypes.push(t)}C.save();return t}
  function deleteDayType(id){if((cfg().dayTypes||[]).length<=1)throw new Error('Il faut garder au moins une journée type');const used=plans(true).some(p=>Object.values(p.days||{}).includes(id)||(p.versions||[]).some(v=>Object.values(v.days||{}).includes(id)));if(used)throw new Error('Cette journée type est encore utilisée dans un planning');cfg().dayTypes=cfg().dayTypes.filter(t=>t.id!==id);C.save()}
  function createPlanning({name,code,baseId}){if(!name||!code)throw new Error('Nom et code nécessaires');if(plans(true).some(p=>p.code.toUpperCase()===String(code).toUpperCase()))throw new Error('Ce code est déjà utilisé');const base=planBy(baseId)||principalPlan(),count=plans().length,role=count===0?'principal':count===1?'secondary':count===2?'exceptional':'extra',p={id:C.uid('plan'),name:String(name).trim(),code:String(code).trim().toUpperCase().slice(0,6),role,days:C.clone(planDays(base,C.dateKey())),versions:[],archived:false};cfg().planningProfiles.push(p);C.save();return p}
  function savePlanningVersion(id,{name,code,effectiveFrom,status,days}){const p=planBy(id);if(!p)throw new Error('Planning introuvable');if(!name||!code||!effectiveFrom)throw new Error('Nom, code et date d’effet nécessaires');if(plans(true).some(x=>x.id!==id&&x.code.toUpperCase()===String(code).toUpperCase()))throw new Error('Ce code est déjà utilisé');p.name=String(name).trim();p.code=String(code).trim().toUpperCase().slice(0,6);p.versions.push({id:C.uid('ver'),effectiveFrom,status:status||'validated',days:C.clone(days||{}),createdAt:C.dateKey(),validatedAt:status==='pending'?'':C.dateKey()});C.save();return p}
  function archivePlanning(id){const p=planBy(id);if(!p||p.role==='principal')return false;p.archived=true;C.save();return true}
  function saveProfile(data){Object.assign(cfg(),{personName:String(data.personName||'').trim(),employmentName:String(data.employmentName||'').trim()||'Mon emploi',employmentStart:data.employmentStart||cfg().employmentStart,contractEnd:data.contractEnd||'',weeklyTarget:Math.max(0,Number(data.weeklyTarget)||0),pause:Math.max(0,Number(data.pause)||0),calendarUrl:String(data.calendarUrl??cfg().calendarUrl??'').trim()});const today=C.dateKey(),vs=cfg().scheduleVersions||(cfg().scheduleVersions=[]),last=vs.slice().sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom)).at(-1);if(last&&last.effectiveFrom===today)last.weeklyTarget=cfg().weeklyTarget;else if(!last||Number(last.weeklyTarget)!==cfg().weeklyTarget)vs.push({effectiveFrom:today,weeklyTarget:cfg().weeklyTarget,schedule:C.clone(C.DEFAULT_SCHEDULE)});C.save()}
  function saveAlerts(data){cfg().balanceAlertNegative=Math.max(0,Number(data.negative)||0);cfg().balanceAlertPositive=Math.max(0,Number(data.positive)||0);cfg().balanceReturnDelayValue=data.delayValue===''?'':Math.max(1,Math.round(Number(data.delayValue)||1));cfg().balanceReturnDelayUnit=['days','weeks','months'].includes(data.delayUnit)?data.delayUnit:'weeks';C.save()}
  function thresholdStatus(balance=currentBalance()){const neg=Math.abs(Number(cfg().balanceAlertNegative||0))*60,pos=Math.abs(Number(cfg().balanceAlertPositive||0))*60;let side='',limit=0;if(neg&&balance<-neg){side='low';limit=-neg}else if(pos&&balance>pos){side='high';limit=pos}if(!side){cfg().balanceAlertTracking=null;C.save();return null}let tr=cfg().balanceAlertTracking;if(!tr||tr.side!==side){tr=cfg().balanceAlertTracking={side,since:C.dateKey()};C.save()}const excess=Math.abs(balance-limit);let deadline='';const val=Number(cfg().balanceReturnDelayValue||0);if(val){if(cfg().balanceReturnDelayUnit==='days')deadline=C.addDays(tr.since,val);else if(cfg().balanceReturnDelayUnit==='weeks')deadline=C.addDays(tr.since,val*7);else{const d=new Date(tr.since+'T12:00:00'),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+val);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));deadline=C.localKey(d)}}if(cfg().contractEnd&&(!deadline||cfg().contractEnd<deadline))deadline=cfg().contractEnd;return{side,limit,excess,since:tr.since,deadline}}
  function departureEstimate(k=C.dateKey()){const day=S().days[k],open=C.openSegment(day),x=dayExpectation(k);if(!day||!open?.start||x.requiredWork<=0)return null;let closedGross=0;for(const s of C.validSegments(day)){if(s===open)continue;const a=C.mins(s.start),b=C.mins(s.end);if(a!=null&&b!=null)closedGross+=(b<a?b+1440:b)-a}const pause=actualPause(k,day),need=Math.max(0,x.requiredWork+pause-closedGross),start=C.mins(open.start);return start==null?null:{time:C.clock(start+need),target:x.requiredWork,pause,remainingWeek:remainingThisWeek(k)}}
  cleanupLegacyPlanningOverrides();
  MH.domain={NEUTRAL_TYPES,plans,planBy,typeBy,principalPlan,planDays,activePeriod,activePlan,plannedType,baseDay,holidays,holidayFor,storedEventsFor,eventsFor,dayExpectation,actualPause,actualWorked,actualDayState,forecastMinutes,requiredWorkMinutes,accountedMinutes,weekFullyOnLeave,weekForecast,scheduleFor,weeklyObjective,weekAccounted,weekActualWorked,weekReconstruction,replaceConsolidatedWeek,remainingThisWeek,paidForWeek,reference,referenceCoverage,annualReference,balanceFromReference,historicalCarryBefore,currentWeekDelta,currentBalance,projectedWeekEndBalance,openingAtYear,annualObjective,annualProjection,projectedClosingAtYear,annualRealized,historyWeekRows,weekActualState,weekInfo,assignPlanningRange,assignWeekPlanning,cleanupLegacyPlanningOverrides,removePlanningPeriod,saveDayOverride,removeDayOverride,upsertEvent,removeEvent,setEventRange,setWholeWeekEvent,validateEvent,saveDayActual,saveDayType,deleteDayType,createPlanning,savePlanningVersion,archivePlanning,saveProfile,saveAlerts,thresholdStatus,departureEstimate};
})(window.MH);

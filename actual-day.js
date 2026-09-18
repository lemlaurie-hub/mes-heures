/* Mes heures - édition du réel : le planning sert de base, le réel ne remplace que ce qui est saisi */
window.MH = window.MH || {};
(function(MH){
  'use strict';
  const C=MH.core,D=MH.domain,S=()=>C.state;

  function overnightDuration(start,end){
    const a=C.mins(start),b=C.mins(end);
    if(a==null||b==null)return null;
    return (b<a?b+1440:b)-a;
  }

  /* Une plage appartient au jour où elle commence. Une fin plus petite que le début = lendemain. */
  C.worked=function(day){
    if(!day)return null;
    const ss=C.validSegments(day);
    if(ss.length){
      let total=0,complete=0;
      for(const s of ss){const n=overnightDuration(s.start,s.end);if(n!=null){total+=n;complete++}}
      return complete?Math.max(0,total-C.pauseFor(day)):null;
    }
    if(day.workedMinutes!=null)return Math.max(0,Number(day.workedMinutes)-C.pauseFor(day));
    const n=overnightDuration(day.arrival,day.departure);
    return n==null?null:Math.max(0,n-C.pauseFor(day));
  };
  C.segmentText=function(day){
    const ss=C.validSegments(day);
    return ss.length?ss.map(s=>{const a=C.mins(s.start),b=C.mins(s.end);return `${s.start}–${s.end||'…'}${a!=null&&b!=null&&b<a?' (+1 j)':''}`}).join(' · '):'—';
  };

  function inheritedPause(k){return Math.max(0,Number(D.dayExpectation(k).requiredPause)||0)}
  function prepareLiveDay(k=C.dateKey()){
    const d=C.dayObj(k);
    if(d.pauseExplicit!==true){d.pauseMinutes=inheritedPause(k);d.pauseExplicit=false}
    return d;
  }

  function editModel(k){
    const stored=S().days[k]||null,x=D.dayExpectation(k),base=x.base;
    const segments=stored?C.validSegments(stored).map(s=>({...s})):[];
    if(!segments.length&&x.requiredWork>0&&base.start)segments.push({start:base.start,end:base.end||null,label:''});
    else if(segments.length===1&&!segments[0].end&&x.requiredWork>0&&base.end)segments[0].end=base.end;
    const explicit=stored?.pauseExplicit===true;
    return {stored,x,segments,pause:explicit?C.pauseFor(stored):inheritedPause(k),pauseExplicit:explicit,note:stored?.note||''};
  }

  function close(){const d=document.querySelector('#actualDialog');if(d){try{d.close()}catch{}d.remove()}}
  function open(k){
    const m=editModel(k);close();
    const esc=C.escapeHtml,attr=C.escapeAttr;
    document.body.insertAdjacentHTML('beforeend',`<dialog id="actualDialog" class="app-modal"><div class="row"><h2>${m.stored?'Modifier':'Ajouter'} une journée</h2><button type="button" class="ghost" data-actual-action="close">Fermer</button></div><div class="field"><label>Date</label><input id="actualDate" type="date" max="${C.dateKey()}" value="${k}"></div><p class="muted compact">Le planning prévu sert de base. Les valeurs déjà pointées le remplacent uniquement là où elles existent.</p><div class="segment-editor">${[0,1,2,3,4].map(i=>`<div class="segment-line"><strong>Plage ${i+1}</strong><input class="actual-start" type="time" value="${attr(m.segments[i]?.start||'')}"><input class="actual-end" type="time" value="${attr(m.segments[i]?.end||'')}"></div>`).join('')}</div><p class="muted compact">Si la fin est après minuit, saisis simplement l’heure du lendemain : 00:20 après 09:31 sera compté comme 00:20 (+1 jour).</p><div class="field"><label>Pause non travaillée (minutes)</label><input id="actualPause" type="number" min="0" step="5" value="${m.pause}" data-inherited="${m.pause}"></div><div class="field"><label>Remarque</label><textarea id="actualNote">${esc(m.note)}</textarea></div><button type="button" data-actual-action="save">Enregistrer cette journée</button></dialog>`);
    document.querySelector('#actualDialog').showModal();
  }

  function save(){
    const k=document.querySelector('#actualDate').value;
    const starts=[...document.querySelectorAll('#actualDialog .actual-start')],ends=[...document.querySelectorAll('#actualDialog .actual-end')];
    const segments=starts.map((x,i)=>({start:x.value,end:ends[i].value||null,label:''})).filter(x=>x.start);
    const pauseInput=document.querySelector('#actualPause'),pause=Math.max(0,Number(pauseInput.value)||0),inherited=Math.max(0,Number(pauseInput.dataset.inherited)||0);
    const d=D.saveDayActual(k,{segments,pauseMinutes:pause,note:document.querySelector('#actualNote').value});
    d.pauseExplicit=pause!==inherited;d.pauseMinutes=pause;C.save();close();MH.ui?.toast?.('✓ Journée enregistrée.');MH.ui?.renderAll?.();
  }

  function install(){
    document.addEventListener('click',e=>{
      const b=e.target.closest('[data-action],[data-actual-action]');if(!b)return;
      const custom=b.dataset.actualAction;
      if(custom==='close'){e.preventDefault();e.stopImmediatePropagation();return close()}
      if(custom==='save'){e.preventDefault();e.stopImmediatePropagation();return save()}
      const a=b.dataset.action;
      if(a==='edit-actual'){e.preventDefault();e.stopImmediatePropagation();return open(b.dataset.date||C.dateKey())}
      if(['start','resume','set-start'].includes(a)){prepareLiveDay(C.dateKey());C.save()}
      if(a==='save-pause'){const d=C.dayObj();d.pauseExplicit=true;C.save()}
    },true);
    document.addEventListener('change',e=>{if(e.target.id==='actualDate'&&e.target.closest('#actualDialog')&&e.target.value<=C.dateKey())open(e.target.value)},true);
  }

  MH.actualDay={editModel,prepareLiveDay,open};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})(window.MH);

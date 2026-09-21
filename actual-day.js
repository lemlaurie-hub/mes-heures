/*
 * Mes heures - journées réelles
 *
 * Rôle de ce module :
 * - une journée prévue sert de modèle de départ ;
 * - le pointage réel remplace seulement les valeurs réellement saisies ;
 * - la pause effective vient du moteur métier commun ;
 * - une pause modifiée manuellement reste explicitement prioritaire ;
 * - une plage peut se terminer après minuit sans changer de journée de travail.
 *
 * Important : les écrans ne doivent pas réinventer ces règles. Ils appellent
 * ce module, qui constitue l'unique porte d'entrée pour l'édition du réel.
 */
window.MH = window.MH || {};
(function(MH){
  'use strict';
  const C=MH.core,D=MH.domain,S=()=>C.state;
  let returnWeek='';

  /** Pause prévue par le planning effectivement applicable à cette date. */
  function inheritedPause(k){
    return Math.max(0,Number(D.dayExpectation(k).requiredPause)||0);
  }

  /**
   * Synchronise une pause héritée.
   * pauseExplicit === true signifie : « l'utilisateur a volontairement choisi
   * cette valeur ». Dans tous les autres cas créés par ce module, le planning
   * reste la source et sa valeur est matérialisée dans la journée.
   */
  function syncInheritedPause(k,day){
    if(!day||day.pauseExplicit===true)return false;
    const expected=inheritedPause(k);
    const changed=day.pauseMinutes!==expected||day.pauseExplicit!==false;
    day.pauseMinutes=expected;
    day.pauseExplicit=false;
    return changed;
  }

  /** Prépare une journée au premier pointage sans inventer d'horaires réels. */
  function prepareLiveDay(k=C.dateKey()){
    const d=C.dayObj(k);
    syncInheritedPause(k,d);
    return d;
  }

  /**
   * Construit le modèle d'édition : réel existant d'abord, prévu pour les
   * champs encore absents. La pause suit la même règle.
   */
  function editModel(k){
    const stored=S().days[k]||null,x=D.dayExpectation(k),base=x.base;
    const segments=stored?C.validSegments(stored).map(s=>({...s})):[];
    if(!segments.length&&x.requiredWork>0&&base.start){
      segments.push({start:base.start,end:base.end||null,label:''});
    }else if(segments.length===1&&!segments[0].end&&x.requiredWork>0&&base.end){
      segments[0].end=base.end;
    }
    /*
     * Une pause n'est prioritaire sur le planning que si elle a été marquée
     * comme volontairement personnalisée. Les anciennes journées, créées avant
     * l'ajout de ce marqueur, héritent donc elles aussi de la journée type.
     */
    const explicit=stored?.pauseExplicit===true;
    return {
      stored,x,segments,
      dayTypeId:S().config.dayOverridesV32?.[k]?.dayTypeId||D.plannedType(k)?.id||'',
      pause:D.actualPause(k,stored),
      pauseExplicit:explicit,
      note:stored?.note||''
    };
  }

  function close(){
    const d=document.querySelector('#actualDialog');
    if(d){try{d.close()}catch{}d.remove()}
  }

  function segmentLine(segment={},index=0){
    const attr=C.escapeAttr;
    return`<div class="segment-line"><div class="segment-head"><strong>Plage ${index+1}</strong>${index?'<button type="button" class="segment-remove" data-actual-action="remove-segment" aria-label="Retirer cette plage">Retirer</button>':''}</div><input class="actual-start" type="time" aria-label="Début de la plage ${index+1}" value="${attr(segment.start||'')}"><input class="actual-end" type="time" aria-label="Fin de la plage ${index+1}" value="${attr(segment.end||'')}"></div>`;
  }

  function renumberSegments(){
    document.querySelectorAll('#actualSegments .segment-line').forEach((line,index)=>{
      line.querySelector('strong').textContent=`Plage ${index+1}`;
      line.querySelector('.actual-start').setAttribute('aria-label',`Début de la plage ${index+1}`);
      line.querySelector('.actual-end').setAttribute('aria-label',`Fin de la plage ${index+1}`);
    });
  }

  /** Ouvre le même éditeur, quel que soit l'écran depuis lequel on arrive. */
  function open(k){
    const weekDialog=document.querySelector('#weekDialog');
    if(weekDialog){try{weekDialog.close()}catch{}weekDialog.remove()}
    const m=editModel(k);close();
    const esc=C.escapeHtml,attr=C.escapeAttr;
    const event=D.storedEventsFor(k,true).find(e=>!e.automatic);
    const visibleSegments=m.segments.length?m.segments:[{}];
    document.body.insertAdjacentHTML('beforeend',`<dialog id="actualDialog" class="app-modal"><div class="row"><h2>${m.stored?'Modifier':'Ajouter'} une journée</h2><button type="button" class="ghost" data-actual-action="close">Fermer</button></div><div class="field"><label>Date</label><input id="actualDate" type="date" max="${C.dateKey()}" value="${k}"></div><div class="field"><label>Journée type prévue ce jour</label><select id="actualDayType">${(S().config.dayTypes||[]).map(t=>`<option value="${attr(t.id)}" ${t.id===m.dayTypeId?'selected':''}>${esc(t.code)} · ${esc(t.name)}</option>`).join('')}</select><p class="muted compact">Cette attribution ne change que cette date.</p></div><p class="muted compact">Le planning prévu sert de base. Les valeurs déjà pointées le remplacent uniquement là où elles existent.</p><div id="actualSegments" class="segment-editor">${visibleSegments.map(segmentLine).join('')}</div><button type="button" class="ghost add-segment" data-actual-action="add-segment">+ Ajouter une plage</button><p class="muted compact">Si la fin est après minuit, saisis simplement l’heure du lendemain : 00:20 après 09:31 sera compté comme 00:20 (+1 jour).</p><div class="field"><label>Pause non travaillée (minutes)</label><input id="actualPause" type="number" min="0" step="5" value="${m.pause}" data-inherited="${m.pause}"></div><div class="field"><label>Remarque</label><textarea id="actualNote">${esc(m.note)}</textarea></div><div class="actions"><button type="button" data-actual-action="save">Enregistrer cette journée</button><button type="button" class="secondary" data-actual-action="event">${event?'Modifier':'Ajouter'} un événement</button></div></dialog>`);
    document.querySelector('#actualDialog').showModal();
  }

  /**
   * Enregistre la journée réelle en une seule opération métier.
   * Si la pause est identique au planning, elle reste marquée « héritée » ;
   * sinon elle devient une exception explicite et ne sera plus resynchronisée.
   */
  function save(){
    const k=document.querySelector('#actualDate').value;
    const starts=[...document.querySelectorAll('#actualDialog .actual-start')];
    const ends=[...document.querySelectorAll('#actualDialog .actual-end')];
    const segments=starts.map((x,i)=>({start:x.value,end:ends[i].value||null,label:''})).filter(x=>x.start);
    const selectedType=document.querySelector('#actualDayType')?.value||'',override=S().config.dayOverridesV32?.[k],plannedId=D.plannedType(k)?.id||'',currentType=override?.dayTypeId||plannedId;
    if(selectedType&&selectedType!==currentType){if(selectedType===plannedId)D.removeDayOverride(k);else D.saveDayOverride(k,{dayTypeId:selectedType,part:'full',boundary:''})}
    const inherited=inheritedPause(k);
    const pauseInput=document.querySelector('#actualPause');
    const pause=pauseInput.dataset.followType==='true'?inherited:Math.max(0,Number(pauseInput.value)||0);
    const d=D.saveDayActual(k,{segments,pauseMinutes:pause,note:document.querySelector('#actualNote').value});
    d.pauseExplicit=pause!==inherited;
    d.pauseMinutes=pause;
    C.save();
    const week=returnWeek;
    returnWeek='';
    close();
    MH.ui?.toast?.('✓ Journée enregistrée.');
    MH.ui?.renderAll?.();
    if(week)MH.ui?.openWeek?.(week);
  }

  /** Ouvre l’événement sans créer ni modifier artificiellement une journée réelle. */
  function openEvent(){
    const k=document.querySelector('#actualDate').value,week=returnWeek;
    const event=D.storedEventsFor(k,true).find(e=>!e.automatic);
    returnWeek='';close();
    return MH.ui?.openEventEditor?.(k,event?.id||'',week);
  }

  /** Branche les différents boutons de l'interface sur cette logique unique. */
  function install(){
    document.addEventListener('click',e=>{
      const b=e.target.closest('[data-action],[data-actual-action]');if(!b)return;
      const custom=b.dataset.actualAction;
      if(custom==='close'){e.preventDefault();e.stopImmediatePropagation();return close()}
      if(custom==='save'){e.preventDefault();e.stopImmediatePropagation();return save()}
      if(custom==='event'){e.preventDefault();e.stopImmediatePropagation();return openEvent()}
      if(custom==='add-segment'){e.preventDefault();e.stopImmediatePropagation();const box=document.querySelector('#actualSegments'),count=box.querySelectorAll('.segment-line').length;if(count<5)box.insertAdjacentHTML('beforeend',segmentLine({},count));if(count>=4)b.classList.add('hidden');return}
      if(custom==='remove-segment'){e.preventDefault();e.stopImmediatePropagation();b.closest('.segment-line')?.remove();document.querySelector('[data-actual-action="add-segment"]')?.classList.remove('hidden');return renumberSegments()}
      const a=b.dataset.action;
      if(a==='edit-actual'){e.preventDefault();e.stopImmediatePropagation();const k=b.dataset.date||C.dateKey();returnWeek=b.closest('#weekDialog')?C.weekStart(k):'';return open(k)}
      if(['start','resume','set-start'].includes(a)){prepareLiveDay(C.dateKey());C.save()}
      if(a==='save-pause'){const d=C.dayObj();d.pauseExplicit=true;C.save()}
    },true);
    document.addEventListener('change',e=>{
      if(e.target.id==='actualDate'&&e.target.closest('#actualDialog')&&e.target.value<=C.dateKey()){if(returnWeek)returnWeek=C.weekStart(e.target.value);open(e.target.value)}
      if(e.target.id==='actualDayType'&&e.target.closest('#actualDialog')){const type=D.typeBy(e.target.value),pause=document.querySelector('#actualPause'),starts=[...document.querySelectorAll('#actualSegments .actual-start')],ends=[...document.querySelectorAll('#actualSegments .actual-end')];if(pause){pause.value=Math.max(0,Number(type?.pause)||0);pause.dataset.followType='true'}if(starts.length===1&&!starts[0].value&&!ends[0].value&&type?.start){starts[0].value=type.start;ends[0].value=type.end||''}}
    },true);
    document.addEventListener('input',e=>{if(e.target.id==='actualPause'&&e.target.closest('#actualDialog'))e.target.dataset.followType='false'},true);
  }

  MH.actualDay={editModel,prepareLiveDay,open};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})(window.MH);

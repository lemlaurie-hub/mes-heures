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
      pause:D.actualPause(k,stored),
      pauseExplicit:explicit,
      note:stored?.note||''
    };
  }

  function close(){
    const d=document.querySelector('#actualDialog');
    if(d){try{d.close()}catch{}d.remove()}
  }

  /** Ouvre le même éditeur, quel que soit l'écran depuis lequel on arrive. */
  function open(k){
    const weekDialog=document.querySelector('#weekDialog');
    if(weekDialog){try{weekDialog.close()}catch{}weekDialog.remove()}
    const m=editModel(k);close();
    const esc=C.escapeHtml,attr=C.escapeAttr;
    document.body.insertAdjacentHTML('beforeend',`<dialog id="actualDialog" class="app-modal"><div class="row"><h2>${m.stored?'Modifier':'Ajouter'} une journée</h2><button type="button" class="ghost" data-actual-action="close">Fermer</button></div><div class="field"><label>Date</label><input id="actualDate" type="date" max="${C.dateKey()}" value="${k}"></div><p class="muted compact">Le planning prévu sert de base. Les valeurs déjà pointées le remplacent uniquement là où elles existent.</p><div class="segment-editor">${[0,1,2,3,4].map(i=>`<div class="segment-line"><strong>Plage ${i+1}</strong><input class="actual-start" type="time" value="${attr(m.segments[i]?.start||'')}"><input class="actual-end" type="time" value="${attr(m.segments[i]?.end||'')}"></div>`).join('')}</div><p class="muted compact">Si la fin est après minuit, saisis simplement l’heure du lendemain : 00:20 après 09:31 sera compté comme 00:20 (+1 jour).</p><div class="field"><label>Pause non travaillée (minutes)</label><input id="actualPause" type="number" min="0" step="5" value="${m.pause}" data-inherited="${m.pause}"></div><div class="field"><label>Remarque</label><textarea id="actualNote">${esc(m.note)}</textarea></div><button type="button" data-actual-action="save">Enregistrer cette journée</button></dialog>`);
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
    const pauseInput=document.querySelector('#actualPause');
    const pause=Math.max(0,Number(pauseInput.value)||0);
    const inherited=inheritedPause(k);
    const d=D.saveDayActual(k,{segments,pauseMinutes:pause,note:document.querySelector('#actualNote').value});
    d.pauseExplicit=pause!==inherited;
    d.pauseMinutes=pause;
    C.save();
    close();
    MH.ui?.toast?.('✓ Journée enregistrée.');
    MH.ui?.renderAll?.();
  }

  /** Branche les différents boutons de l'interface sur cette logique unique. */
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
    document.addEventListener('change',e=>{
      if(e.target.id==='actualDate'&&e.target.closest('#actualDialog')&&e.target.value<=C.dateKey())open(e.target.value);
    },true);
  }

  MH.actualDay={editModel,prepareLiveDay,open};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})(window.MH);

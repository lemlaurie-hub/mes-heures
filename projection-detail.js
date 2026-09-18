/* Mes heures - détail explicatif de la projection annuelle */
window.MH = window.MH || {};
(function(MH){
  'use strict';
  const C=MH.core,D=MH.domain,S=()=>C.state;
  let open=false;

  function weekForecast(ws){return D.weekInfo(ws).minutes}
  function contribution(ws){
    const today=C.dateKey(), current=C.weekStart(today);
    const hist=(S().historicalWeeks||[]).find(w=>w.weekStart===ws);
    if(hist)return Number(hist.workedMinutes||0);
    if(ws===current){
      const elapsed=C.weekDays(ws).filter(k=>k<=today).reduce((n,k)=>n+D.dayExpectation(k,true).retainedForecast,0);
      return D.weekAccounted(ws)+Math.max(0,weekForecast(ws)-elapsed);
    }
    if(ws<current)return D.weekAccounted(ws);
    return weekForecast(ws);
  }

  function rowsFor(y){
    const current=C.weekStart(C.dateKey());
    return C.mondays(y).map(ws=>{
      const projected=contribution(ws), objective=D.weeklyObjective(ws);
      return {ws,projected,objective,delta:projected-objective,phase:ws<current?'passée':ws===current?'en cours':'à venir'};
    });
  }

  function inject(){
    const view=document.querySelector('#forecastView');
    if(!view||view.classList.contains('hidden'))return;
    const summary=view.querySelector('.annual-summary'),yearInput=view.querySelector('#forecastYear');
    if(!summary||!yearInput)return;
    view.querySelector('#projectionDetail')?.remove();
    const y=Number(yearInput.value),currentYear=Number(C.dateKey().slice(0,4)),opening=D.openingAtYear(y);
    const closing=opening==null?null:opening+D.annualProjection(y)-D.annualObjective(y);
    const current=y===currentYear?D.currentBalance(C.dateKey()):null;
    const evolution=current==null||closing==null?null:closing-current;
    const rows=rowsFor(y),nonZero=rows.filter(r=>r.delta!==0);
    const futureDelta=rows.filter(r=>r.phase==='à venir').reduce((n,r)=>n+r.delta,0);
    const currentRow=rows.find(r=>r.phase==='en cours');
    const currentRemaining=currentRow?currentRow.delta-D.currentWeekDelta(C.dateKey()):0;
    const explained=y===currentYear?futureDelta+currentRemaining:null;
    const residual=evolution==null||explained==null?null:evolution-explained;
    const box=document.createElement('div');box.id='projectionDetail';box.className='projection-detail';
    box.innerHTML=`<button type="button" class="ghost" id="projectionDetailToggle">${open?'Masquer le détail':'Voir le détail de la projection'}</button>${open?`<div class="history-item"><div class="row"><strong>Évolution prévue jusqu’au 31/12</strong><strong class="${(evolution??0)>=0?'positive':'negative'}">${evolution==null?'—':C.fmtMinutes(evolution)}</strong></div>${y===currentYear?'<p class="muted compact">Différence entre le solde actuel et le report projeté de fin d’année.</p>':''}${nonZero.length?`<div style="margin-top:10px">${nonZero.map(r=>`<div class="row"><span>S${String(C.weekNumber(r.ws)).padStart(2,'0')} · ${r.phase}</span><span>${C.fmtPlainMinutes(r.projected)} / ${C.fmtPlainMinutes(r.objective)} → <strong class="${r.delta>=0?'positive':'negative'}">${C.fmtMinutes(r.delta)}</strong></span></div>`).join('')}</div>`:'<p class="muted compact">Toutes les semaines projetées sont exactement à leur objectif.</p>'}${residual!==null&&residual!==0?`<div class="alertline">⚠️ ${C.fmtMinutes(residual)} ne vient pas des semaines restantes : c’est un écart de raccord entre le calcul annuel et le solde actuel. Il faut alors vérifier le moteur plutôt qu’un planning.</div>`:''}</div>`:''}`;
    summary.insertAdjacentElement('afterend',box);
    box.querySelector('#projectionDetailToggle')?.addEventListener('click',()=>{open=!open;inject()});
  }

  document.addEventListener('click',e=>{if(e.target.closest('[data-view="forecastView"], [data-action="switch-view"]'))setTimeout(inject,0)});
  document.addEventListener('change',e=>{if(e.target.id==='forecastYear')setTimeout(inject,0)});
  window.addEventListener('load',()=>setTimeout(inject,0));
})(window.MH);

/* Mes heures - reprise progressive : point de référence du solde et accès au passé */
window.MH = window.MH || {};
(function(MH){
  'use strict';
  const C=MH.core,S=()=>C.state;

  function parts(){
    const n=Math.abs(Math.round(Number(S().balanceReferenceMinutes)||0));
    return {sign:Number(S().balanceReferenceMinutes)<0?'-':'+',hours:Math.floor(n/60),minutes:n%60};
  }

  function prettyDate(k){
    return k?C.frenchDate(k,{day:'2-digit',month:'2-digit',year:'numeric'}):'la date choisie';
  }

  function settingsHtml(){
    const p=parts(),date=S().balanceReferenceDate||'';
    return `<div class="history-item" id="balanceReferenceBlock"><h3>Point de départ du compteur</h3><p class="muted compact">Tu peux commencer maintenant, puis reconstituer les mois précédents plus tard. Les données antérieures restent utilisables pour les documents mais n’entrent dans le solde qu’après déplacement de cette référence.</p><div class="field"><label>Date de référence</label><input id="balanceReferenceDate" type="date" value="${C.escapeAttr(date)}"></div><div class="field"><label id="balanceReferenceLabel">Solde au ${prettyDate(date)} inclus</label><div class="row"><select id="balanceReferenceSign" aria-label="Signe du solde"><option value="+" ${p.sign==='+'?'selected':''}>+</option><option value="-" ${p.sign==='-'?'selected':''}>−</option></select><input id="balanceReferenceHours" type="number" min="0" step="1" value="${p.hours}" aria-label="Heures"><span>h</span><input id="balanceReferenceMinutes" type="number" min="0" max="59" step="1" value="${p.minutes}" aria-label="Minutes"><span>min</span></div></div><button type="button" data-reprise-action="save-reference">Enregistrer le solde de référence</button>${date?`<p class="muted compact">Calcul du compteur à partir du ${C.frenchDate(C.addDays(date,1),{day:'2-digit',month:'2-digit',year:'numeric'})}. Modifier cette référence ne supprime aucune journée déjà saisie.</p>`:''}</div>`;
  }

  function injectSettings(){
    const view=document.querySelector('#settingsView');
    if(!view||view.classList.contains('hidden')||document.querySelector('#balanceReferenceBlock'))return;
    const menus=[...view.querySelectorAll('details.settings-menu')];
    const target=menus.find(d=>d.querySelector('summary')?.textContent.includes('Importer / sauvegarder'));
    if(!target)return;
    const body=target.querySelector('.settings-body');
    if(body)body.insertAdjacentHTML('afterbegin',settingsHtml());
  }

  function renamePlanning(){
    document.querySelectorAll('[data-view="forecastView"]').forEach(b=>{
      if(b.textContent!=='Planning')b.textContent='Planning';
    });
    const forecast=document.querySelector('#forecastView');
    if(forecast&&!forecast.classList.contains('hidden')){
      const t=document.querySelector('#screenTitle');
      if(t&&t.textContent!=='Planning')t.textContent='Planning';
      const h=forecast.querySelector('h2');
      if(h&&h.textContent.trim()==='Prévisions')h.textContent='Planning';
    }
  }

  function refreshEnhancements(){
    injectSettings();
    renamePlanning();
  }

  function saveReference(){
    const date=document.querySelector('#balanceReferenceDate')?.value;
    const sign=document.querySelector('#balanceReferenceSign')?.value||'+';
    const h=Number(document.querySelector('#balanceReferenceHours')?.value);
    const m=Number(document.querySelector('#balanceReferenceMinutes')?.value);
    if(!date)throw new Error('Choisis la date du solde de référence.');
    if(!Number.isFinite(h)||h<0||!Number.isFinite(m)||m<0||m>59)throw new Error('Renseigne un solde valide.');
    const minutes=(Math.round(h)*60+Math.round(m))*(sign==='-'?-1:1);
    S().balanceReferenceDate=date;
    S().balanceReferenceMinutes=minutes;
    C.save();
    MH.ui?.toast(`✓ Solde enregistré au ${prettyDate(date)} inclus.`);
    MH.ui?.renderAll();
    setTimeout(refreshEnhancements,0);
  }

  function onClick(e){
    const b=e.target.closest('[data-reprise-action]');
    if(!b)return;
    try{
      if(b.dataset.repriseAction==='save-reference')saveReference();
    }catch(err){
      console.error(err);
      MH.ui?.toast(err.message||'Une erreur est survenue.','error');
    }
  }

  function onChange(e){
    if(e.target.id==='balanceReferenceDate'){
      const l=document.querySelector('#balanceReferenceLabel');
      if(l)l.textContent=`Solde au ${prettyDate(e.target.value)} inclus`;
    }
  }

  function init(){
    document.addEventListener('click',onClick);
    document.addEventListener('change',onChange);
    const observer=new MutationObserver(()=>{
      requestAnimationFrame(refreshEnhancements);
    });
    observer.observe(document.body,{childList:true,subtree:true});
    refreshEnhancements();
  }

  MH.reprise={settingsHtml,saveReference,injectSettings,renamePlanning};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window.MH);

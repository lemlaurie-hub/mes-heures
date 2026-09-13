/* Mes heures v17: actions Historique compactes et accessibles en haut */
(function(){
function compactHistoryActions(){
  const view=document.querySelector('#historyView');
  if(!view)return;
  const exportCard=document.querySelector('#exportV11');
  const adjustments=document.querySelector('#adjustmentsV12');
  if(!exportCard&&!adjustments)return;

  let zone=document.querySelector('#historyQuickActionsV17');
  if(!zone){
    zone=document.createElement('div');
    zone.id='historyQuickActionsV17';
    zone.className='history-quick-actions';
    view.insertAdjacentElement('afterbegin',zone);
  }

  function wrap(card,title){
    if(!card||card.closest('#historyQuickActionsV17'))return;
    const details=document.createElement('details');
    details.className='card history-action-v17';
    const summary=document.createElement('summary');
    summary.textContent=title;
    summary.style.cssText='font-weight:700;cursor:pointer;padding:2px 0;';
    const body=document.createElement('div');
    body.style.marginTop='10px';
    while(card.firstChild)body.appendChild(card.firstChild);
    card.remove();
    details.append(summary,body);
    zone.appendChild(details);
  }

  wrap(adjustments,'Heures supplémentaires / régularisations');
  wrap(exportCard,'Exports');
}

const oldRenderHistoryV17=renderHistory;
renderHistory=function(){oldRenderHistoryV17();compactHistoryActions()};
renderAll();
})();
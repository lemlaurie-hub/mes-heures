/* Aujourd'hui : affichage du repere de depart, calculs via domain.js */
(function(){
function grossDoneBeforeOpen(day){const ss=validSegments(day),open=openSegment(day);let total=0;for(const s of ss){if(s===open)continue;if(s.start&&s.end&&mins(s.end)>=mins(s.start))total+=mins(s.end)-mins(s.start)}return total}
function hhmmFromMinutes(n){n=((Math.round(n)%1440)+1440)%1440;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function departureCard(){const k=dateKey(),day=state.days[k],open=openSegment(day);if(!day||!open?.start)return '';const target=MH.forecastMinutes(k);if(target<=0)return '';const requiredGross=target+pauseFor(day),done=grossDoneBeforeOpen(day),remainingGross=Math.max(0,requiredGross-done),departure=mins(open.start)+remainingGross,weekRemain=Math.max(0,MH.weeklyObjective(k)-weekWorked(k));return `<div class="card departure-v33"><h2>Repère de fin de journée</h2><div class="row"><span>Pour atteindre ${fmtPlainMinutes(target)} aujourd’hui</span><strong>${hhmmFromMinutes(departure)}</strong></div><p class="muted compact">Départ indicatif avec ${pauseFor(day)} min de pause. Si la pause change, l’heure se recalcule.</p><div class="time-row row"><span>Reste pour l’objectif de la semaine</span><strong>${fmtPlainMinutes(weekRemain)}</strong></div></div>`}
function patch(){const v=document.querySelector('#todayView');if(!v)return;v.querySelector('.departure-v33')?.remove();const html=departureCard();if(!html)return;const cards=v.querySelectorAll('.card');if(cards.length)cards[0].insertAdjacentHTML('afterend',html);else v.insertAdjacentHTML('afterbegin',html)}
const oldToday=renderToday;renderToday=function(){oldToday();patch()};
const oldAll=renderAll;renderAll=function(){oldAll();patch()};
patch();
})();
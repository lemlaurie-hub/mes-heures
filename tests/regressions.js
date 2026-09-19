const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const RealDate=Date;
class FixedDate extends RealDate{
  constructor(...args){super(...(args.length?args:['2026-09-19T12:00:00Z']))}
  static now(){return new RealDate('2026-09-19T12:00:00Z').getTime()}
}

function baseState(){
  return{
    config:{
      weeklyTarget:35,pause:30,employmentStart:'2023-11-20',
      scheduleVersions:[{effectiveFrom:'2023-11-20',weeklyTarget:35}],
      dayTypes:[
        {id:'normal',code:'NORM',name:'Normal',start:'09:00',end:'18:30',pause:30,minutes:540},
        {id:'norj',code:'NORJ',name:'Normal jeudi',start:'09:00',end:'18:30',pause:90,minutes:480},
        {id:'repos',code:'OFF',name:'Repos',start:'',end:'',pause:0,minutes:0}
      ],
      weekPlan:{1:'normal',2:'normal',3:'normal',4:'norj',5:'repos',6:'repos',0:'repos'},
      planningProfiles:[{
        id:'mjc',code:'MJC',name:'Planning MJC',role:'principal',versions:[],archived:false,
        days:{1:'normal',2:'normal',3:'normal',4:'norj',5:'repos',6:'repos',0:'repos'}
      }],
      planningPeriods:[],futureEvents:[],dayOverridesV32:{},annualViewYear:2026
    },
    days:{},historicalWeeks:[],balanceAdjustments:[],initialBalanceMinutes:0
  };
}

function app(state){
  const store=new Map([['mes-heures-data-v8',JSON.stringify(state)]]);
  const context={
    console,Intl,Date:FixedDate,Map,Set,JSON,Math,Number,String,Object,Array,
    localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)},
    document:{readyState:'loading',addEventListener(){}}
  };
  context.window=context;
  vm.createContext(context);
  for(const file of ['core.js','domain.js','actual-day.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context,{filename:file});
  }
  context.MH.__testContext=context;
  return context.MH;
}

function loadConsumers(MH){
  const context=MH.__testContext;
  const uiSource=fs.readFileSync(path.join(ROOT,'ui.js'),'utf8')
    .replace('MH.ui={toast,','MH.ui={__dayHistoryItem:dayHistoryItem,__historyWeeks:historyWeeks,__historyYears:historyYears,toast,');
  vm.runInContext(uiSource,context,{filename:'ui.js'});
  const exportSource=fs.readFileSync(path.join(ROOT,'v17.js'),'utf8')
    .replace('MH.exports={exportCsv,','MH.exports={__dayRow:dayRow,__weekSummary:weekSummary,exportCsv,');
  vm.runInContext(exportSource,context,{filename:'v17.js'});
}

function completeDay(start,end,pauseMinutes=30){return{segments:[{start,end}],pauseMinutes,note:''}}

{
  const {domain:D}=app({});
  const thursday=D.dayExpectation('2026-09-17').base;
  assert.equal(thursday.type.code,'NORJ');
  assert.equal(thursday.pause,90);
  assert.equal(thursday.minutes,480);
}

{
  const state=baseState();
  state.days['2026-09-17']=completeDay('09:31','20:20',30);
  const MH=app(state),{core:C,domain:D,actualDay:A}=MH;
  assert.equal(D.actualPause('2026-09-17'),90,'NORJ doit fournir 90 min aux anciennes journées sans marqueur');
  assert.equal(A.editModel('2026-09-17').pause,90,'l’éditeur doit lire la même pause que le moteur');
  assert.equal(D.actualWorked('2026-09-17'),559,'le temps réel doit retirer les 90 min de NORJ');
  assert.equal(C.state.days['2026-09-17'].pauseMinutes,30,'la lecture ne doit pas réécrire silencieusement la donnée ancienne');
  loadConsumers(MH);
  assert.match(MH.ui.__dayHistoryItem('2026-09-17'),/pause 90 min/,'Historique Récent doit afficher la pause commune');
  assert.equal(MH.exports.__dayRow('2026-09-17').pause,90,'les exports doivent utiliser la pause commune');

  C.state.days['2026-09-17'].pauseExplicit=true;
  assert.equal(D.actualPause('2026-09-17'),30,'une pause explicitement personnalisée reste prioritaire');
  assert.equal(D.actualWorked('2026-09-17'),619,'le calcul doit utiliser la pause personnalisée');
}

{
  const state=baseState();
  state.days['2026-02-12']={arrival:'10:00',departure:'19:30',pause:45,workedMinutes:525,source:'import-2026'};
  const {core:C,domain:D}=app(state),day=C.state.days['2026-02-12'];
  assert.equal(day.pauseMinutes,45,'la pause certaine d’un ancien import doit être migrée');
  assert.equal(day.pauseExplicit,true,'une pause importée connue est une donnée réelle');
  assert.equal(D.actualPause('2026-02-12'),45,'le planning ne doit pas écraser une pause importée');
}

{
  const state=baseState();
  state.days['2026-09-17']=completeDay('09:31','00:20',90);
  state.days['2026-09-17'].pauseExplicit=true;
  const {core:C,domain:D}=app(state);
  assert.equal(D.actualWorked('2026-09-17'),799,'une fin après minuit appartient à la journée commencée la veille');
  assert.match(C.segmentText(C.state.days['2026-09-17']),/\(\+1 j\)/);
}

{
  const state=baseState();
  state.historicalWeeks.push({weekStart:'2026-08-31',week:35,workedMinutes:2100,targetMinutes:2100,deltaMinutes:0});
  for(const date of ['2026-09-07','2026-09-08','2026-09-09'])state.days[date]=completeDay('09:00','18:30',30);
  state.days['2026-09-10']=completeDay('09:00','18:30',90);
  state.days['2026-09-17']=completeDay('09:31','20:20',30);
  const MH=app(state),{domain:D}=MH,rows=D.historyWeekRows();
  assert.equal(rows.map(row=>row.week).join(','),'35,36,37','S36 et S37 doivent prolonger la dernière semaine importée');
  assert.equal(rows[1].status,'Calculée');
  assert.equal(rows[1].deltaMinutes,0);
  assert.equal(rows[2].status,'En cours');
  assert.equal(rows[2].deltaMinutes,null,'la semaine courante ne doit pas inventer un écart final');
  loadConsumers(MH);
  const weeksHtml=MH.ui.__historyWeeks();
  for(const label of ['S35','S36','S37'])assert.match(weeksHtml,new RegExp(label));
  assert.doesNotMatch(weeksHtml,/2026-09-14/,'l’interface ne doit pas afficher la date ISO technique');
  assert.equal(MH.exports.__weekSummary('2026-09-07').delta,0,'le PDF doit lire la même semaine calculée');
}

{
  const state=baseState();
  state.historicalWeeks.push({weekStart:'2026-08-31',week:35,workedMinutes:2100,targetMinutes:2100,deltaMinutes:0});
  state.days['2026-09-07']=completeDay('09:00','18:30',30);
  const {domain:D}=app(state),s36=D.historyWeekRows().find(row=>row.week===36);
  assert.equal(s36.status,'À compléter','une semaine passée avec des jours travaillés manquants reste incomplète');
  assert.equal(s36.deltaMinutes,null,'une semaine incomplète ne devient pas artificiellement une dette de 35 h');
}

{
  const state=baseState();
  state.days['2026-09-18']=completeDay('09:00','12:00',0);
  const {domain:D}=app(state);
  assert.equal(D.dayExpectation('2026-09-18').requiredWork,0,'le vendredi reste prévu à 0 h');
  assert.equal(D.actualWorked('2026-09-18'),180,'un pointage un jour prévu à 0 h reste du travail réel');
}

{
  const {core:C}=app(baseState());
  assert.equal(C.weekStart('2030-01-05'),'2029-12-31','la semaine appartient au mois et à l’année de son lundi');
}

console.log('Régressions Mes heures : OK');

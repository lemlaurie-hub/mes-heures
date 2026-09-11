/* Mes heures v13: sauvegarde immédiate des champs de profil sensibles */
(function(){
function bindProfileAutosave(){
  const pairs=[
    ['jobStart','employmentStart','Début de contrat enregistré.'],
    ['contractEnd','contractEnd','Fin de contrat enregistrée.'],
    ['personName','personName','Nom enregistré.'],
    ['jobName','employmentName','Emploi / structure enregistré.']
  ];
  for(const [id,key,msg] of pairs){
    const el=document.querySelector('#'+id);
    if(!el||el.dataset.autosaveBound==='1')continue;
    el.dataset.autosaveBound='1';
    el.addEventListener('change',()=>{
      state.config[key]=id==='personName'||id==='jobName'?el.value.trim():el.value;
      if(id==='jobName'&&!state.config[key])state.config[key]='Mon emploi';
      save();
      toast('✓ '+msg);
    });
  }
}
const oldRenderSettingsV13=renderSettings;
renderSettings=function(){oldRenderSettingsV13();bindProfileAutosave()};
renderSettings();
})();
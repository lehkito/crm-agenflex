let area='Pipeline',panelTab='Indicadores',audit=[],panelClient='',panelRoll='',filteredBoard=[];
function repurchase(o,date,expectedClose){
 const copy=structuredClone(o);
 delete copy.newItem; delete copy.duplicateOf;
 for(const line of copy.lines||[])delete line.newItem;
 return {...copy,tags:[...new Set([...(Array.isArray(copy.tags)?copy.tags:[]),copy.origin].filter(Boolean))],id:uid(),parent:o.id,orderRef:o.orderRef||o.id,title:'Venda Futura',stage:2,origin:'Carteira',result:'',closed:'',expectedClose,tasks:[task('Entrar em contato com o cliente',date)]};
}
function totals(rows){
 return {count:rows.length,kg:rows.reduce((n,o)=>n+Number(o.kg||0),0),value:rows.reduce((n,o)=>n+Number(o.value||0),0)};
}
function listDialog(title,rows,split=false){
 const footer=(label,group)=>{const t=totals(group);return '<div><b>'+esc(label)+'</b><span>'+t.count+' oportunidades</span><span>'+kgText(t.kg)+'</span><strong>'+money(t.value)+'</strong></div>'};
 show('<div class="row spread"><h2>'+esc(title)+'</h2><button aria-label="Fechar" onclick="modal.close()">Fechar ×</button></div>'+grid(rows)+'<section class="list-totals">'+(split?footer('Concluídas',rows.filter(o=>o.result==='Concluído'))+footer('Perdidas',rows.filter(o=>o.result==='Perdido')):'')+footer('Total',rows)+'</section>');
 modal.classList.add('wide-list');
 modal.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>edit(data.find(o=>o.id===b.dataset.open)));
}
function removalLabel(o){return o.stage===4?'Solicitar exclusão':'Excluir oportunidade'}
function removeDialog(o){
 if(!o||o.sellerId!==session.user.id)return;
 show(form(removalLabel(o),'<p><strong>'+esc(o.client)+'</strong> · '+esc(o.title)+'</p>'+itemDetails(o)+field('Motivo da exclusão','reason')+'<p role="status"></p>'));
 wideOpportunity(o,true);const f=modal.querySelector('form');f.querySelector('.primary').textContent=o.stage===4?'Enviar solicitação':'Confirmar exclusão';
 f.onsubmit=async e=>{e.preventDefault();const b=f.querySelector('.primary');b.disabled=true;try{await removalAction(o.id,'request',f.elements.reason.value);await loadBoard();show('<h2>'+(o.stage===4?'Solicitação enviada':'Oportunidade excluída')+'</h2><button onclick="modal.close()">Fechar</button>')}catch(err){f.querySelector('[role=status]').textContent=err.message;b.disabled=false}};
}
function cardWithMenu(o){
 const menu=o.sellerId===session.user.id?'<details class="op-menu"><summary aria-label="Opções da oportunidade">⋯</summary><button data-remove="'+esc(o.id)+'">'+removalLabel(o)+'</button></details>':'';
 return '<article class="op-wrap">'+opportunityCard(o)+menu+'</article>';
}
function linkedOrders(id){
 const list=new Map(data.filter(o=>o.parent===id).map(o=>[o.id,o.title]));
 for(const a of audit)if(a.snapshot.parent===id&&!list.has(a.opportunity_id))list.set(a.opportunity_id,a.snapshot.title+' (excluída)');
 return [...list.values()];
}
function auditView(){
 const view=$('#view');
 const detail=a=>[esc(a.snapshot.client),esc(a.snapshot.title),esc(a.snapshot.owner),money(a.snapshot.value),kgText(a.snapshot.kg),esc(a.reason),new Date(a.requested_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),esc(a.status),esc(linkedOrders(a.opportunity_id).join(', ')||'—'),a.status==='Aguardando aprovação'?'<button data-decision="approve" data-id="'+esc(a.opportunity_id)+'">Aprovar</button> <button data-decision="reject" data-id="'+esc(a.opportunity_id)+'">Reprovar</button>':'—'];
 view.innerHTML='<h2>Solicitações e histórico de exclusão</h2>'+table(['Cliente','Oportunidade','Solicitante','Valor','Peso','Motivo','Solicitada em','Status','Recompra vinculada','Decisão'],audit.map(detail));
 view.querySelectorAll('[data-decision]').forEach(b=>b.onclick=async()=>{
 const a=audit.find(a=>a.opportunity_id===b.dataset.id&&a.status==='Aguardando aprovação'),linked=linkedOrders(a.opportunity_id);
 const approve=b.dataset.decision==='approve';if(!confirm((approve?'Aprovar':'Reprovar')+' a exclusão de '+a.snapshot.client+' · '+a.snapshot.title+'? Recompras vinculadas: '+linked.length+'.'))return;
 try{await removalAction(a.opportunity_id,b.dataset.decision,'');await loadBoard()}catch(err){alert(err.message)}
 });
}
function materialLines(o){
 return expandItems(o).flatMap(l=>(l.rolls?.length?l.rolls:[{name:l.bobina,kg:l.kg}]).map(r=>({name:r.name||'Sem bobina',kg:Number(r.kg)||0})));
}
function dashboard(rows){
 const view=$('#view'),actions=[];
 const select=(id,label,values,value)=>'<label>'+label+'<select id="'+id+'"><option value="">Todos</option>'+values.map(([k,n])=>'<option value="'+esc(k)+'" '+(value===k?'selected':'')+'>'+esc(n)+'</option>').join('')+'</select></label>';
 const picks=select('dashClient','Cliente',[...new Map(data.map(o=>[o.cnpj,o.client]))],panelClient)+select('dashRoll','Bobina',[...new Set(data.flatMap(o=>materialLines(o).map(r=>r.name)))].sort().map(n=>[n,n]),panelRoll);
 const all=rows.filter(o=>(!panelClient||o.cnpj===panelClient)&&(!panelRoll||materialLines(o).some(r=>r.name===panelRoll)));
 const weight=o=>materialLines(o).reduce((s,r)=>s+(!panelRoll||panelRoll===r.name?r.kg:0),0);
 const open=all.filter(o=>o.stage<4),neg=open.filter(o=>o.stage===3),won=all.filter(o=>o.result==='Concluído'),lost=all.filter(o=>o.result==='Perdido'),closed=[...won,...lost];
 function metric(label,items,value){const ix=actions.push([label,items])-1;return '<button class="metric" data-drill="'+ix+'"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong></button>'}
 const overdueTasks=open.flatMap(o=>o.tasks.filter(t=>!t.done&&t.date<day()).map(t=>o));
 const metrics=[['Oportunidades abertas',open,open.length],['Valor em negociação',neg,money(totals(neg).value)],['Peso em negociação',neg,kgText(neg.reduce((s,o)=>s+weight(o),0))],['Previsão de fechamento',open.filter(o=>o.expectedClose),money(totals(open.filter(o=>o.expectedClose)).value)],['Previsão de recompra',open.filter(o=>o.stage===2),money(totals(open.filter(o=>o.stage===2)).value)],['Concluídas',won,won.length],['Perdidas',lost,lost.length],['Conversão das encerradas',closed,closed.length?(100*won.length/closed.length).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—'],['Oportunidades atrasadas',open.filter(late),open.filter(late).length],['Tarefas atrasadas',[...new Set(overdueTasks)],overdueTasks.length]];
 function chart(label,groups,format){
 const max=Math.max(1,...groups.map(g=>g[2]));
 return '<section class="chart"><h3>'+esc(label)+'</h3>'+groups.map(([name,items,n])=>{const ix=actions.push([label+' · '+name,items])-1;return '<button class="bar" data-drill="'+ix+'"><span>'+esc(name)+'</span><i><em style="width:'+Math.max(0,n/max*100)+'%"></em></i><b>'+esc(format(n))+'</b></button>'}).join('')+(!groups.length?'<small>Sem registros neste período.</small>':'')+'</section>';
 }
 const grouped=(items,key,measure)=>{const g=new Map();for(const o of items){const name=key(o)||'Sem informação';if(!g.has(name))g.set(name,[name,[],0]);const row=g.get(name);row[1].push(o);row[2]+=measure(o)}return [...g.values()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'pt-BR'))};
 const demand=new Map();for(const o of open)for(const r of materialLines(o)){if(panelRoll&&panelRoll!==r.name)continue;if(!demand.has(r.name))demand.set(r.name,[r.name,new Set(),0]);const v=demand.get(r.name);v[1].add(o);v[2]+=r.kg}
 const byStage=fn=>stages.map((s,i)=>{const group=all.filter(o=>o.stage===i);return [s,group,group.reduce((n,o)=>n+fn(o),0)]});
 view.innerHTML='<div class="row dash-filters">'+picks+'</div><div class="metric-grid">'+metrics.map(m=>metric(...m)).join('')+'</div><div class="charts">'+chart('Valor por etapa',byStage(o=>Number(o.value)),money)+chart('Peso por etapa',byStage(weight),kgText)+chart('Previsão por mês',grouped(open,o=>o.expectedClose?.slice(0,7),o=>Number(o.value)),money)+chart('Vendas por vendedor',grouped(won,o=>o.owner,o=>Number(o.value)),money)+chart('Vendas por departamento',grouped(won,o=>o.department,o=>Number(o.value)),money)+chart('Demanda por bobina',[...demand.values()].map(([n,set,kg])=>[n,[...set],kg]),kgText)+chart('Resultado das oportunidades',[['Concluídas',won,won.length],['Perdidas',lost,lost.length]],String)+'</div>';
 $('#dashClient').onchange=e=>{panelClient=e.target.value;render()};$('#dashRoll').onchange=e=>{panelRoll=e.target.value;render()};
 view.querySelectorAll('[data-drill]').forEach(b=>b.onclick=()=>listDialog(...actions[b.dataset.drill]));
}
function goArea(name){
 area=name;panelTab='Indicadores';rollReport=false;reports=catalogOpen=listMode=false;extraView=name==='Tarefas'?'Tarefas':'';
 render();
}
function syncNavigation(){
 document.body.dataset.area=area;
 for(const b of document.querySelectorAll('[data-area-link]'))b.setAttribute('aria-current',b.dataset.areaLink===area?'page':'false');
 $('#panelNav').hidden=area!=='Painel';$('#auditTab').hidden=profile?.role!=='Gestor';
 const waiting=audit.filter(a=>a.status==='Aguardando aprovação').length;$('#auditTab').textContent=waiting?'Exclusões ('+waiting+')':'Exclusões';
 $('#areaTitle').textContent=area==='Pipeline'?'Carteira comercial':area==='Painel'?'Painel comercial':'Tarefas comerciais';
 for(const b of document.querySelectorAll('[data-panel-tab]'))b.classList.toggle('active',b.dataset.panelTab===panelTab);
}

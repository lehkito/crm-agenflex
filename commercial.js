function commercialPanel(scope, matchesPeriod) {
 const view = $('#view');
 const matchesDate = date => matchesPeriod({stage:0, expectedClose:date});
 const rows = scope.filter(o => (!panelClient || o.cnpj === panelClient) &&
   (!panelRoll || materialLines(o).some(r => r.name === panelRoll)));
 const negotiations = rows.filter(o => o.stage === 3 && matchesDate(o.expectedClose));
 const repurchases = rows.filter(o => o.stage === 2);
 const leads = rows.filter(o => o.leadEntered && matchesDate(o.leadEntered));
 const actions = [];
 function link(label, action) {
   const id = actions.push(action) - 1;
   return '<button type="button" data-commercial="'+id+'">'+esc(label)+'</button>';
 }
 function list(label, ops) {return link(label, () => listDialog(label, ops))}
 function materialRows(ops) {
   return ops.flatMap(o => (o.lines?.length ? o.lines : [o]).flatMap(line =>
     (line.rolls?.length ? line.rolls : [{name:line.bobina,kg:line.kg}]).map(r =>
       ({o,item:line.item || 'Sem item',name:String(r.name || 'Sem bobina').trim() || 'Sem bobina',kg:Number(r.kg)||0}))
   )).filter(r=>!panelRoll || r.name===panelRoll);
 }
 const materials = materialRows(negotiations);
 function detail(label, entries) {
   const opps = [...new Set(entries.map(r=>r.o))];
   show('<div class="row spread"><h2>'+esc(label)+'</h2><button onclick="modal.close()">Fechar</button></div>'+
     table(['Cliente','Oportunidade','Item','Bobina','Peso'], entries.map(r=>[
       esc(r.o.client),'<button data-commercial-op="'+esc(r.o.id)+'">'+esc(r.o.title)+'</button>',esc(r.item),esc(r.name),kgText(r.kg)
     ]))+'<p><strong>Total: '+kgText(entries.reduce((s,r)=>s+r.kg,0))+'</strong> · '+opps.length+' oportunidade(s)</p>');
   modal.classList.add('wide-list');
   modal.querySelectorAll('[data-commercial-op]').forEach(b=>b.onclick=()=>edit(data.find(o=>o.id===b.dataset.commercialOp)));
 }
 function ranking(key, label) {
   const groups=new Map();
   for(const r of materials) {
     const k=r[key].normalize('NFC').toLocaleLowerCase('pt-BR');
     if(!groups.has(k))groups.set(k,{name:r[key],entries:[],kg:0});
     const g=groups.get(k);g.entries.push(r);g.kg+=r.kg;
   }
   return '<section><h3>'+label+' em negociação</h3>'+table([label,'Oportunidades','Peso'],[...groups.values()].sort((a,b)=>b.kg-a.kg).map(g=>[
     link(g.name,()=>detail(g.name,g.entries)),new Set(g.entries.map(r=>r.o.id)).size,kgText(g.kg)
   ]))+'</section>';
 }
 const expected=o=>o.expectedClose || '';
 const due=repurchases.filter(o=>matchesDate(expected(o)));
 const overdue=repurchases.filter(o=>expected(o)&&expected(o)<day());
 const [start,end]=calendarRange('week',day());
 const byOrigin=new Map();
 for(const o of leads){const k=o.leadOrigin||o.origin||'Sem origem';if(!byOrigin.has(k))byOrigin.set(k,[]);byOrigin.get(k).push(o)}
 const body='<section class="commercial"><h2>Negociação</h2><div class="row">'+list(negotiations.length+' oportunidades · '+money(totals(negotiations).value),negotiations)+
   link(kgText(materials.reduce((s,r)=>s+r.kg,0))+' em negociação',()=>detail('Peso em negociação',materials))+
   list('Fechamentos desta semana',rows.filter(o=>o.stage===3&&expected(o)>=start&&expected(o)<=end))+
   list('Negociações vencidas',rows.filter(o=>o.stage===3&&expected(o)&&expected(o)<day()))+'</div>'+
   '<div class="charts">'+ranking('name','Bobinas')+ranking('item','Itens')+'</div>'+
   '<h2>Recompra</h2><p>Por previsão de fechamento da recompra.</p><div class="row">'+
   list(new Set(due.map(o=>clientKey(o.cnpj)||o.client)).size+' clientes · '+money(totals(due).value)+' · '+kgText(materialRows(due).reduce((s,r)=>s+r.kg,0)),due)+
   list('Recompras vencidas ('+overdue.length+')',overdue)+'</div>'+
   '<h2>Entrada de leads</h2>'+list(leads.length+' entradas no período',leads)+
   table(['Origem','Entradas','Avançaram'],[...byOrigin].map(([name,ops])=>[esc(name),list(String(ops.length),ops),list(String(ops.filter(o=>o.stage!==0).length),ops.filter(o=>o.stage!==0))]))+
   '<p>A contagem por data de entrada começa com os leads registrados nesta versão.</p></section>';
 view.querySelector('.dash-filters').insertAdjacentHTML('afterend',body);
 view.querySelectorAll('[data-commercial]').forEach(b=>b.onclick=actions[Number(b.dataset.commercial)]);
}
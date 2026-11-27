const kgText=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:3})+' kg';
const itemText=o=>o.lines?.length>1?o.lines.length+' itens vinculados':o.item||'';
function opportunityCard(o){
 const t=next(o);
 return '<button class="card '+(late(o)?'delayed':'')+'" draggable="'+(o.stage<4&&myWallet(o.sellerId))+'" data-id="'+esc(o.id)+'"><span class="chip">'+esc(o.result||o.origin)+'</span>'+(Array.isArray(o.tags)?o.tags:[]).filter(t=>t!==o.origin&&t!==o.result).map(t=>'<span class="chip">'+esc(t)+'</span>').join('')+(o.thirdParty?' <span class="chip">Terceiros</span>':'')+'<strong>'+esc(o.client)+'</strong><small>'+esc(o.title)+'</small><small>'+esc(itemText(o))+'</small><div class="amount">'+money(o.value)+' · '+kgText(o.kg)+'</div><small>♙ '+avatar(o.sellerId,o.owner)+esc(o.owner)+'</small><small>▦ '+fmt(o.expectedClose)+'</small><span class="cardfoot '+(late(o)?'overdue':'')+'">'+(o.stage===4?'Fechado em '+fmt(o.closed)+(o.result==='Perdido'?' · '+esc(o.lossReason||'Motivo não registrado'):''):late(o)?'Atrasada · '+esc(delayReason(o)):t?esc(t.name)+' · '+fmt(t.date):'Sem tarefa agendada')+'</span></button>';
}
function clientLookup(editor){
 const select=editor.elements.existing;
 if(!select)return;
 const search=editor.querySelector('[data-search-client]');
 search.oninput=()=>{
   const term=search.value.trim().toLocaleLowerCase('pt-BR');
   const matches=clients.filter(c=>myWallet(c.seller_id)&&(c.name.toLocaleLowerCase('pt-BR').includes(term)||c.cnpj.includes(clientKey(term))));
   select.innerHTML='<option value="">Selecione o cliente</option>'+matches.map(c=>'<option value="'+esc(c.cnpj)+'">'+esc(c.name)+' · '+esc(c.cnpj)+'</option>').join('');
 };
 editor.querySelector('[data-new-client]').onclick=registerCustomer;
}
let taskFilter='Todas',rollReport=false;
function tasksView(rows){
 const filters=['Todas','Hoje','Atrasadas','Amanhã','Próximos sete dias','Futuras','Concluídas'];
 const result=[];
 for(const o of rows)for(const [i,t] of o.tasks.entries()){
   const state=t.done?'Concluídas':o.stage===4?'Encerrada':t.date===day()?'Hoje':t.date<day()?'Atrasadas':t.date===day(1)?'Amanhã':t.date<=day(7)?'Próximos sete dias':'Futuras';
   if(taskFilter==='Todas'||state===taskFilter)result.push({o,i,t,state});
 }
 const view=$('#view');
 view.innerHTML='<label>Mostrar tarefas<select data-task-filter>'+options(filters,taskFilter)+'</select></label>'+table(['Cliente','Oportunidade','Vendedor','Tarefa','Data prevista','Status','Ações'],result.sort((a,b)=>a.t.date.localeCompare(b.t.date)).map(({o,i,t,state})=>[esc(o.client),esc(o.title),esc(o.owner),esc(t.name),fmt(t.date),esc(state),'<button data-open="'+esc(o.id)+'">Abrir</button> '+(o.stage<4&&!t.done&&o.sellerId===session.user.id?'<button data-complete="'+i+'" data-op="'+esc(o.id)+'">Concluir</button> <button data-schedule="'+i+'" data-op="'+esc(o.id)+'">Editar / reagendar</button>':'')]));
 view.querySelector('[data-task-filter]').onchange=e=>{taskFilter=e.target.value;render()};
 view.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>{
   const o=data.find(x=>x.id===b.dataset.op),t=o.tasks[Number(b.dataset.complete??b.dataset.schedule)];
   if(b.hasAttribute('data-complete')){t.done=true;save();return}
   show(form('Editar tarefa',field('Descrição','description',t.name)+field('Data prevista','date',t.date,'date')));
   modal.querySelector('form').onsubmit=e=>{e.preventDefault();t.name=e.target.elements.description.value.trim();t.date=e.target.elements.date.value;modal.close();save()};
 });
}
const rollFilters={bobina:'',cliente:'',etapa:'',status:'',data:'Previsão de fechamento'};
function rollRows(rows,match){
 const detail=[];
 for(const o of rows){
   const status=o.stage===4?o.result:'Aberta';
   if(!match(o)||rollFilters.cliente&&rollFilters.cliente!==o.cnpj||rollFilters.etapa&&rollFilters.etapa!==stages[o.stage]||rollFilters.status&&rollFilters.status!==status)continue;
   for(const l of expandItems(o))for(const r of l.rolls?.length?l.rolls:[{name:l.bobina,kg:l.kg}]){
     const name=r.name||'Sem bobina';
     if(!rollFilters.bobina||name===rollFilters.bobina)detail.push({o,l,name,kg:Number(r.kg)||0,status});
   }
 }
 return detail;
}
function rollView(rows){
 const select=(label,key,values)=>'<label>'+label+'<select data-filter="'+key+'">'+(key==='data'?'':'<option value="">Todos</option>')+values.map(([v,n])=>'<option value="'+esc(v)+'" '+(rollFilters[key]===v?'selected':'')+'>'+esc(n)+'</option>').join('')+'</select></label>';
 const distinct=values=>[...new Set(values)].filter(Boolean).sort().map(v=>[v,v]);
 const names=data.flatMap(o=>expandItems(o).flatMap(l=>l.rolls?.length?l.rolls.map(r=>r.name):[l.bobina||'Sem bobina']));
 const match=periodFilter(),byConclusion=rollFilters.data==='Data de conclusão';
 const detail=rollRows(rows,o=>(!byConclusion||!!o.closed)&&match({...o,stage:byConclusion?4:0}));
 const groups=new Map(),total={ids:new Set(),kg:0,lost:0};
 for(const r of detail){
   if(!groups.has(r.name))groups.set(r.name,{ids:new Set(),kg:0,lost:0});
   for(const g of [groups.get(r.name),total]){g.ids.add(r.o.id);if(r.status==='Perdido')g.lost+=r.kg;else g.kg+=r.kg}
 }
 const summaryHeaders=['Bobina','Oportunidades','Kg em abertas e concluídas','Kg perdidos'];
 const summary=[...groups,['Total geral',total]].map(([name,g])=>[name,g.ids.size,g.kg,g.lost]);
 const headers=['Bobina','Cliente','Oportunidade','Item','Vendedor','Time','Etapa','Status','Kg'];
 const details=detail.map(r=>[r.name,r.o.client,r.o.title,r.l.item,r.o.owner,r.o.department,stages[r.o.stage],r.status,r.kg]);
 const view=$('#view');
 view.innerHTML='<h2>Relatório de Bobinas</h2><div class="row">'+select('Bobina','bobina',distinct(names))+select('Cliente','cliente',[...new Map(data.map(o=>[o.cnpj,o.client])).entries()])+select('Etapa','etapa',distinct(stages))+select('Status','status',distinct(['Aberta','Concluído','Perdido']))+select('Considerar período pela','data',distinct(['Data de conclusão','Previsão de fechamento']))+'<button data-export>Exportar para Excel</button></div>'+table(summaryHeaders,summary.map(r=>r.map(esc)))+'<details><summary>Detalhar clientes e oportunidades</summary>'+table(headers,details.map(r=>r.map(esc)))+'</details>';
 view.querySelectorAll('[data-filter]').forEach(s=>s.onchange=()=>{rollFilters[s.dataset.filter]=s.value;render()});
 view.querySelector('[data-export]').onclick=()=>exportExcel([['Resumo',[summaryHeaders,...summary]],['Detalhamento',[headers,...details]]]);
}
function exportExcel(sheets,filename='Relatorio-de-Bobinas.xml'){
 const xml='<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'+sheets.map(([name,rows])=>'<Worksheet ss:Name="'+esc(name)+'"><Table>'+rows.map(row=>'<Row>'+row.map(v=>'<Cell><Data ss:Type="'+(typeof v==='number'?'Number':'String')+'">'+esc(v)+'</Data></Cell>').join('')+'</Row>').join('')+'</Table></Worksheet>').join('')+'</Workbook>';
 const url=URL.createObjectURL(new Blob([xml],{type:'application/xml'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function itemDetails(o){
 return table(['Código','Item','Bobina','Peso','Valor'],expandItems(o).map(l=>[esc(l.code||l.item?.match(/^\d+/)?.[0]||'—'),esc(l.item),esc(l.rolls?.map(r=>r.name).join(', ')||l.bobina||'—'),kgText(l.kg),o.lines?.length>1&&o.lines.some(x=>x.value==null)?'Sem rateio':money(l.value)]));
}

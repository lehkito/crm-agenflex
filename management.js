let directory=[], wallets=[], pictures=[], targets=[];
let topLimit=10,topOrder='value',topClient='',taskClient='';
async function loadManagement(token){
 [directory,wallets,pictures,targets]=await Promise.all([
   profile?.role==='Gestor'?request('/rest/v1/rpc/crm_admin_roster',{},token):fetchRows('crm_pilot_profiles','user_id,display_name,department,is_manager','display_name',token),
   request('/rest/v1/rpc/crm_my_wallet',{},token),
   fetchRows('crm_avatars','user_id,photo','user_id',token),
   fetchRows('crm_targets','month,scope,amount','month,scope',token)
 ]);
}
function myWallet(id){return !!session&&(id===session.user.id||wallets.includes(id))}
function avatar(id,name){
 const img=pictures.find(p=>p.user_id===id)?.photo;
 return img?'<img class="avatar" alt="" src="'+esc(img)+'">':'<span class="avatar initials">'+esc((name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase())+'</span>';
}
function refreshIdentity(){
 if(!profile||!session)return;
 $('#profileMenu summary').innerHTML=avatar(session.user.id,profile.name)+esc(profile.name)+' · '+esc(profile.department);
 $('#manageProfiles').hidden=profile.role!=='Gestor';$('#manageProfiles').onclick=settingsDialog;
}
function delayReason(o){
 if(o.stage>=4 || ['Concluído','Perdido','Excluída'].includes(o.result))return '';
 const today=day();
 const reasons=[];
 function check(date,label){
  if(!date || date>=today)return;
  const days=Math.round((Date.parse(today)-Date.parse(date))/86400000);
  if(Number.isFinite(days))reasons.push(label+' · '+days+(days===1?' dia':' dias')+' de atraso ('+fmt(date)+')');
 }
 check(o.expectedClose,'Fechamento');
 for(const t of o.tasks||[])if(!t.done)check(t.date,t.name||'Tarefa');
 return reasons.join(' / ');
}
function attachNotes(o){
 const f=modal.querySelector('form');
 const section=document.createElement('section');
 section.innerHTML='<h3>Observações</h3>'+(f?'<textarea name="notes" aria-label="Observações" rows="5"></textarea>':'<p class="notes-text">'+esc(o?.notes||'Sem observações.')+'</p>');
 if(f)section.querySelector('textarea').value=o?.notes||'';
 (f||modal).append(section);
}
function choices(values,current){return values.map(([k,v])=>'<option value="'+esc(k)+'" '+(k===current?'selected':'')+'>'+esc(v)+'</option>').join('')}
async function upsert(tableName,conflict,body){
 const r=await fetch(endpoint+'/rest/v1/'+tableName+'?on_conflict='+conflict,{method:'POST',headers:{apikey:publicKey,Authorization:'Bearer '+await accessToken(),'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},body:JSON.stringify(body)});
 if(!r.ok)throw Error('Falha ao salvar ('+r.status+').');
}
function settingsDialog(){
 const users=directory.map(p=>[p.user_id,p.display_name]);
 const sellers=directory.filter(p=>['paulo.victor@agenflex.com.br','vitor.marcondes@agenflex.com.br','luigi.rossetto@agenflex.com.br'].includes(p.email));
 const scopes=[['Geral','Empresa — Geral'],...['Food','Pharma','Direct','Hunter'].map(t=>[t,t]),...users];
 show('<h2>Configuração comercial</h2><form id="targetForm"><h3>Meta mensal</h3><label>Mês<input required type="month" name="month" value="'+day().slice(0,7)+'"></label><label>Empresa, time ou vendedor<select name="scope">'+choices(scopes,'Geral')+'</select></label><label>Meta (R$)<input required type="number" min="0" step=".01" name="amount"></label><button>Salvar meta</button></form><form id="photoForm"><h3>Foto do perfil</h3><label>Usuário<select name="person">'+choices(users,'')+'</select></label><label>Imagem<input required type="file" accept="image/jpeg,image/png,image/webp" name="image"></label><button>Salvar foto</button></form><form id="accessForm"><h3>Equipe dos novos vendedores</h3><label>Vendedor<select name="person">'+choices(sellers.map(p=>[p.user_id,p.display_name]),'')+'</select></label><label>Time<select name="team" required>'+choices([['','Selecione'],...['Food','Pharma','Direct','Hunter'].map(k=>[k,k])],'')+'</select></label><button>Salvar equipe e liberar vendedor</button></form><p role="status"></p><button onclick="modal.close()">Fechar</button>');
 const tf=$('#targetForm'),pf=$('#photoForm'),msg=modal.querySelector('[role=status]');
 function fill(){tf.elements.amount.value=targets.find(t=>t.scope===tf.elements.scope.value&&t.month===tf.elements.month.value+'-01')?.amount??''}
 tf.elements.month.onchange=tf.elements.scope.onchange=fill;fill();
 async function submit(e,fn){e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{await fn();await loadManagement(await accessToken());render();msg.textContent='Salvo.'}catch(err){msg.textContent=err.message}finally{b.disabled=false}}
 const af=$('#accessForm');af.elements.person.onchange=()=>{af.elements.team.value=sellers.find(p=>p.user_id===af.elements.person.value)?.department||''};af.elements.person.onchange();
 af.onsubmit=e=>submit(e,()=>request('/rest/v1/rpc/crm_activate_seller',{person:af.elements.person.value,team:af.elements.team.value},session.access_token));
 tf.onsubmit=e=>submit(e,()=>upsert('crm_targets','month,scope',{month:tf.elements.month.value+'-01',scope:tf.elements.scope.value,amount:Number(tf.elements.amount.value)}));
 pf.onsubmit=e=>submit(e,async()=>{const img=await createImageBitmap(pf.elements.image.files[0]);const c=document.createElement('canvas');c.width=c.height=160;const side=Math.min(img.width,img.height);c.getContext('2d').drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,160,160);img.close();await upsert('crm_avatars','user_id',{user_id:pf.elements.person.value,photo:c.toDataURL('image/jpeg',.85)})});
}
function periodBounds(){
 const box=$('#periodBox'),mode=box.querySelector('[name=mode]').value;
 return calendarRange(mode,day(),box.querySelector('[type=month]').value,box.querySelector('[name=start]').value,box.querySelector('[name=end]').value);
}
function periodTarget(scope){
 const [a,b]=periodBounds();if(!scope||!a||!b||a>b)return null;
 let date=new Date(a+'T12:00:00Z'),end=new Date(b+'T12:00:00Z'),sum=0;
 while(date<=end){
   const key=date.toISOString().slice(0,7)+'-01',target=targets.find(t=>t.month===key&&t.scope===scope);
   if(!target)return null;
   const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0,12));
   sum+=Number(target.amount)*(1+(Math.min(end,last)-date)/86400000)/last.getUTCDate();
   date=new Date(last.getTime()+86400000);
 }
 return sum;
}
function pipelineNumbers(goal,current,won){
 return {ideal:goal*3,forecast:current/3,remaining:Math.max(0,goal-won),gap:Math.max(0,3*goal-current),salesGap:Math.max(0,goal-current/3),required:3*Math.max(0,goal-won),coverage:goal?100*current/(3*goal):null,attainment:goal?100*won/goal:null};
}
function metricCards(cards){
 return '<div class="metric-grid">'+cards.map(([k,v],i)=>'<button class="metric" data-metric="'+i+'"><small>'+esc(k)+'</small><strong>'+esc(v)+'</strong></button>').join('')+'</div>';
}
function pipelineView(rows){
 const seller=$('#owner').value,scope=profile.role==='Gestor'?(seller?directory.find(p=>p.display_name===seller)?.user_id:$('#team').value||'Geral'):session.user.id;
 const goal=periodTarget(scope),re=rows.filter(o=>o.stage===2),neg=rows.filter(o=>o.stage===3),open=[...re,...neg],won=rows.filter(o=>o.stage===4&&o.result==='Concluído');
 const v=totals(open),sales=totals(won).value,n=pipelineNumbers(goal||0,v.value,sales);
 const gm=x=>goal==null?'Sem meta':money(x),pct=x=>goal==null||x==null?'—':x.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
 const cards=[['Meta do período',gm(goal),open],['Pipeline ideal',gm(n.ideal),open],['Pipeline atual',money(v.value),open],['Recompra',money(totals(re).value),re],['Negociação',money(totals(neg).value),neg],['Previsão de vendas · 33,33%',money(n.forecast),open],['Concluído no CRM',money(sales),won],['Saldo da meta',gm(n.remaining),won],['Déficit de oportunidades',gm(n.gap),open],['Déficit previsto de vendas',gm(n.salesGap),open],['Cobertura do pipeline ideal',pct(n.coverage),open],['Atingimento da meta',pct(n.attainment),won],['Pipeline necessário para o saldo',gm(n.required),open],['Peso de recompra + negociação',kgText(v.kg),open]];
 const view=$('#view');
 view.innerHTML=(profile.role==='Gestor'?'<button id="targets">Configurar metas</button>':'')+metricCards(cards)+'<section class="chart"><h3>Composição do pipeline</h3>'+[3,4].map(i=>'<button class="bar" data-metric="'+i+'"><span>'+cards[i][0]+'</span><i><em style="width:'+(v.value?100*totals(cards[i][2]).value/v.value:0)+'%"></em></i><b>'+cards[i][1]+'</b></button>').join('')+'</section><p>Metas mensais proporcionais aos dias selecionados. Sem meta indica que falta uma meta para o período ou responsável.</p>';
 if($('#targets'))$('#targets').onclick=settingsDialog;
 view.querySelectorAll('[data-metric]').forEach(b=>b.onclick=()=>{const [label,,ops]=cards[b.dataset.metric];listDialog(label,ops)});
}
function customerGroups(rows){
 const groups=new Map();
 for(const o of rows){const k=clientKey(o.cnpj)||o.id;if(!groups.has(k))groups.set(k,{key:k,name:o.client,ops:[],value:0,kg:0,count:0});const g=groups.get(k);g.ops.push(o);g.count++;g.value+=Number(o.value||0);g.kg+=Number(o.kg||0)}
 const sorted=[...groups.values()].sort((a,b)=>b.value-a.value||a.key.localeCompare(b.key)),sum=totals(rows).value;let cumulative=0;
 for(const g of sorted){g.share=sum?100*g.value/sum:0;g.abc=!g.value?'C':cumulative<sum*.80?'A':cumulative<sum*.95?'B':'C';cumulative+=g.value;g.cumulative=sum?100*cumulative/sum:0}
 return sorted;
}
function clientPicker(scope,current){
 return '<label>Cliente<select data-client-filter>'+choices([['','Todos'],...new Map(scope.map(o=>[clientKey(o.cnpj)||o.id,o.client]))],current)+'</select></label>';
}
function topView(scope,match){
 const base=scope.filter(o=>o.stage===4&&o.result==='Concluído'),rows=base.filter(o=>match(o)&&(!topClient||(clientKey(o.cnpj)||o.id)===topClient));
 const groups=customerGroups(rows),total=totals(rows),shown=[...groups].sort((a,b)=>b[topOrder]-a[topOrder]).slice(0,topLimit||undefined);
 const selected=shown.flatMap(g=>g.ops),sub=totals(selected),pct=x=>x.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';
 const headers=['Posição','Cliente','Vendedor','Vendas concluídas','Peso KG','Valor total (R$)','Participação %','Curva'];
 const lines=shown.map((g,i)=>[i+1,g.name,[...new Set(g.ops.map(o=>o.owner))].join(', '),g.count,g.kg,g.value,g.share,g.abc]);
 const foot=['','Total da lista','',sub.count,sub.kg,sub.value,total.value?100*sub.value/total.value:0,''];
 const byMonth=new Map();for(const o of rows){const k=o.closed.slice(0,7);if(!byMonth.has(k))byMonth.set(k,[]);byMonth.get(k).push(o)}
 const cards=[['Vendas concluídas no CRM',money(total.value),rows],['Peso vendido',kgText(total.kg),rows],['Clientes compradores',groups.length,rows],['Oportunidades concluídas',rows.length,rows],['Ticket médio',money(rows.length?total.value/rows.length:0),rows],['Participação dos 10 maiores',pct(groups.slice(0,10).reduce((s,g)=>s+g.share,0)),groups.slice(0,10).flatMap(g=>g.ops)]];
 const view=$('#view');
 const pretty=(r,i)=>[r[0],i<shown.length?'<button data-customer="'+i+'">'+esc(r[1])+'</button>':esc(r[1]),esc(r[2]),r[3],kgText(r[4]),money(r[5]),pct(r[6]),r[7]];
 const series=groups.slice(0,topLimit||undefined),max=series[0]?.value||1;
 const pareto=series.length?'<svg viewBox="0 0 600 140" role="img" aria-label="Pareto: barras de vendas e linha de participação acumulada">'+series.map((g,i)=>'<rect data-point="'+i+'" x="'+(i*600/series.length)+'" y="'+(130-120*g.value/max)+'" width="'+(500/series.length)+'" height="'+(120*g.value/max)+'" fill="#478593"><title>'+esc(g.name)+' · '+money(g.value)+'</title></rect>').join('')+'<polyline pointer-events="none" fill="none" stroke="#c17725" stroke-width="3" points="'+series.map((g,i)=>[(i+.42)*600/series.length,130-1.2*g.cumulative].join(',')).join(' ')+'"/></svg>':'<p>Sem vendas concluídas no período.</p>';
 view.innerHTML='<div class="row">'+clientPicker(base,topClient)+'<label>Mostrar<select id="topN">'+choices([[10,'TOP 10'],[20,'TOP 20'],[50,'TOP 50'],[0,'Todos']],topLimit)+'</select></label><label>Ranking por<select id="topOrder">'+choices([['value','Valor'],['kg','Peso'],['count','Quantidade']],topOrder)+'</select></label><button id="downloadTop">Exportar Excel</button></div>'+metricCards(cards)+table(headers,[...lines,foot].map(pretty))+'<div class="charts"><section class="chart"><h3>Pareto · valor e participação acumulada</h3>'+pareto+'</section><section class="chart"><h3>Vendas concluídas por mês</h3>'+[...byMonth].sort().map(([k,ops])=>'<button class="bar" data-month="'+esc(k)+'"><span>'+esc(k)+'</span><i><em style="width:'+100*totals(ops).value/(total.value||1)+'%"></em></i><b>'+money(totals(ops).value)+'</b></button>').join('')+'</section></div>';
 view.querySelector('[data-client-filter]').onchange=e=>{topClient=e.target.value;render()};
 $('#topN').onchange=e=>{topLimit=Number(e.target.value);render()};$('#topOrder').onchange=e=>{topOrder=e.target.value;render()};
 $('#downloadTop').onclick=()=>exportExcel([['Vendas concluídas no CRM',[headers,...lines,foot]]],'Curva-TOP-Clientes.xml');
 view.querySelectorAll('[data-metric]').forEach(b=>b.onclick=()=>listDialog(cards[b.dataset.metric][0],cards[b.dataset.metric][2]));
 for(const b of view.querySelectorAll('[data-customer],[data-point]'))b.onclick=()=>{const g=b.hasAttribute('data-point')?series[b.dataset.point]:shown[b.dataset.customer];listDialog(g.name,g.ops)};
 view.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>listDialog(b.dataset.month,byMonth.get(b.dataset.month)));
}
const lanes=['Atrasadas','Hoje','Amanhã','Próximos 7 dias','Futuras','Concluídas'];
function taskState(t){
 if(t.done)return 5;if(!t.date)return 4;
 if(t.date<day())return 0;if(t.date===day())return 1;if(t.date===day(1))return 2;return t.date<=day(7)?3:4;
}
function taskEditor(o,i,ops,destination){
 const t=o?.tasks[i],isNew=!t;
 show(form(isNew?'Nova tarefa':'Editar tarefa',(isNew?'<label>Oportunidade<select name="op" required>'+choices(ops.map(x=>[x.id,x.client+' · '+x.title]),o?.id)+'</select></label>':'<p>'+esc(o.client)+' · '+esc(o.title)+'</p>')+field('Descrição','description',t?.name||'','text','required')+field('Data prevista','date',t?.date||day(),'date','required')));
 modal.querySelector('form').onsubmit=e=>{e.preventDefault();const f=e.target.elements,op=isNew?ops.find(x=>x.id===f.op.value):o;
 if(!op||!myWallet(op.sellerId)||op.stage===4)return;const fresh={...t,name:f.description.value.trim(),date:f.date.value,done:destination==null?!!t?.done:destination===5};
 if(!fresh.name)return;if(destination!=null&&taskState(fresh)!==destination){f.date.setCustomValidity('Escolha uma data correspondente à coluna '+lanes[destination]+'.');f.date.reportValidity();f.date.oninput=()=>f.date.setCustomValidity('');return}
 if(isNew)op.tasks.push(fresh);else op.tasks[i]=fresh;modal.close();save()};
}
function taskBoard(scope,match){
 const ops=scope.filter(o=>!taskClient||(clientKey(o.cnpj)||o.id)===taskClient);
 const entries=ops.flatMap(o=>(o.tasks||[]).map((t,i)=>({t,i,o}))).filter(({t,o})=>(o.stage!==4||t.done)&&match({stage:0,expectedClose:t.date})).sort((a,b)=>(a.t.date||'').localeCompare(b.t.date||''));
 const writable=ops.filter(o=>o.stage<4&&myWallet(o.sellerId));
 const view=$('#view');
 view.innerHTML='<div class="row">'+clientPicker(scope,taskClient)+'<button id="newTask" '+(!writable.length?'disabled':'')+'>Nova tarefa</button></div><div class="task-board">'+lanes.map((label,lane)=>{
 const set=entries.filter(e=>taskState(e.t)===lane);
 return '<section data-task-lane="'+lane+'"><h3>'+label+' · '+set.length+'</h3>'+set.map(e=>{
 const index=entries.indexOf(e),can=e.o.stage<4&&myWallet(e.o.sellerId);
 return '<article draggable="'+can+'" data-task-index="'+index+'"><strong>'+esc(e.o.client)+'</strong><small>'+esc(e.o.title)+'</small><p>'+esc(e.t.name)+'</p><small>'+avatar(e.o.sellerId,e.o.owner)+esc(e.o.owner)+'</small><small>'+esc(fmt(e.t.date))+' · '+label+'</small><div><button data-open-task="'+index+'">Abrir oportunidade</button>'+(can?'<button data-edit-task="'+index+'">Editar / reagendar</button>'+(!e.t.done?'<button data-done-task="'+index+'">Concluir</button>':''):'')+'</div></article>';
 }).join('')+'</section>'}).join('')+'</div>';
 view.querySelector('[data-client-filter]').onchange=e=>{taskClient=e.target.value;render()};$('#newTask').onclick=()=>taskEditor(null,-1,writable);
 view.querySelectorAll('[data-open-task]').forEach(b=>b.onclick=()=>edit(entries[b.dataset.openTask].o));
 view.querySelectorAll('[data-edit-task]').forEach(b=>b.onclick=()=>{const {o,i}=entries[b.dataset.editTask];taskEditor(o,i)});
 view.querySelectorAll('[data-done-task]').forEach(b=>b.onclick=()=>{entries[b.dataset.doneTask].t.done=true;save()});
 let moving;view.querySelectorAll('[draggable=true]').forEach(c=>c.ondragstart=e=>{e.stopPropagation();moving=entries[c.dataset.taskIndex];e.dataTransfer.setData('text/plain',String(c.dataset.taskIndex))});
 view.querySelectorAll('[data-task-lane]').forEach(col=>{col.ondragover=e=>{if(moving)e.preventDefault()};col.ondrop=e=>{
 e.preventDefault();e.stopPropagation();if(!moving)return;const {o,i,t}=moving;moving=null;const n=Number(col.dataset.taskLane);if(taskState(t)===n)return;
 if([0,3,4].includes(n)){taskEditor(o,i,null,n);return}t.done=n===5;if(!t.done)t.date=n===1?day():day(1);save()
 }});
}
function managementView(scope,match){
 if(area==='Tarefas'){taskBoard(scope,match);return}
 const eligible=profile.role==='Gestor'?scope:scope.filter(o=>myWallet(o.sellerId));
 if(area==='Pipeline')pipelineView(eligible.filter(match));else topView(eligible,match);
}

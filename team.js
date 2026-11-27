let profile,clients=[],listMode=false,extraView='',customerMode=false;
const clientKey=value=>String(value||'').toUpperCase().replace(/[.\/\s-]/g,'');
function table(headers,rows){return '<div class="panel"><table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}
function grid(rows){return table(['Cliente','Oportunidade','Time','Vendedor','Itens','Etapa','Previsão','Peso','Valor','Próxima tarefa',''],rows.map(o=>[esc(o.client),esc(o.title),esc(o.department),esc(o.owner),esc((o.lines||[o]).map(l=>l.item).join(', ')),esc(stages[o.stage]),fmt(o.expectedClose),kgText(o.kg),money(o.value),esc(next(o)?.name||'—'),'<button data-open="'+esc(o.id)+'">Abrir</button>']))}
function clientDetail(key){
 const c=clients.find(x=>x.cnpj===key);if(!c)return;
 const ops=data.filter(o=>clientKey(o.cnpj)===key);
 const byItem=new Map();
 for(const o of ops.flatMap(expandItems).filter(o=>o.result==='Concluído').sort((a,b)=>a.closed.localeCompare(b.closed))){
  if(!byItem.has(o.itemId))byItem.set(o.itemId,[]);byItem.get(o.itemId).push(o);
 }
 const history=[...byItem.values()].map(g=>{const last=g[g.length-1],avg=g.length>1?Math.round((Date.parse(last.closed)-Date.parse(g[0].closed))/86400000/(g.length-1)):null;
 return [esc(last.item),g.map(o=>fmt(o.closed)).join(', '),avg===null?'Uma compra':avg+' dias',avg===null?'—':fmt(new Date(Date.parse(last.closed)+avg*86400000).toISOString().slice(0,10))]});
 show('<h2>'+esc(c.name)+'</h2><p>'+esc(cnpjMask(c.cnpj))+' · '+esc(c.email)+' · '+esc(displayPhone(c.phone))+'</p><h3>Histórico de compras</h3>'+table(['Item','Datas de compra','Intervalo médio','Próxima estimativa'],history)+'<h3>Oportunidades</h3>'+grid(ops)+'<button onclick="modal.close()">Fechar</button>');
 modal.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>edit(data.find(o=>o.id===b.dataset.open)));
}
function showExtra(rows){
 if(extraView==='Clientes'){ $('#view').innerHTML=table(['Cliente','CNPJ','Contato',''],clients.map(c=>[esc(c.name),esc(cnpjMask(c.cnpj)),esc(c.email),'<button data-client="'+esc(c.cnpj)+'">Ver histórico</button>']));return}
 if(extraView==='Tarefas'){tasksView(rows);return}

 $('#view').innerHTML=grid(rows);
}
function itemCard(o){
 const mine=catalog.filter(i=>i.cnpj===clientKey(o.cnpj)&&(!i.archived||i.id===o.itemId));
 return '<div style="display:flex;align-items:end;gap:.5rem"><label style="flex:1;min-width:0">Item do cliente<select name="catalogId" required><option value="">Selecione</option>'+mine.map(i=>'<option value="'+esc(i.id)+'" '+(i.id===o.itemId?'selected':'')+'>'+esc(i.name)+'</option>').join('')+'<option value="new">Cadastrar item</option></select></label></div><fieldset data-new-product hidden><legend>Novo item</legend>'+field('Descrição','productName','','text','maxlength="200"')+'<label>Material<select name="material">'+options(['Plástico','Papel','Outro'])+'</select></label>'+field('Bobina / especificação','bobina','','text','')+'</fieldset>'+'<p data-roll-name></p>'+field('Peso desta bobina (kg)','kg',o.rolls?.[0]?.kg||o.kg||'','number','min="0.001" step="0.001" required')+'<div data-rolls></div><button type="button" data-add-roll>+ Bobina</button>';
}
function bindCard(form,o){
 const e=form.elements;
 form.querySelector('[data-roll-name]').textContent=o.bobina?'Bobina: '+o.bobina:'';
 const rolls=form.querySelector('[data-rolls]');
 function addRoll(roll={}){
   const row=document.createElement('fieldset');
   row.innerHTML='<legend>Bobina adicional</legend>'+field('Bobina / especificação','rollName',roll.name||'')+field('Peso desta bobina (kg)','rollKg',roll.kg||'','number','required min="0.001" step="0.001"')+'<button type="button">Remover bobina</button>';
   row.querySelector('button').onclick=()=>row.remove();
   rolls.append(row);
   return row;
 }
 (o.rolls||[]).slice(1).forEach(addRoll);
 form.querySelector('[data-add-roll]').onclick=()=>addRoll().querySelector('input').focus();
 function toggle(){
   const create=e.catalogId.value==='new';
   const item=catalog.find(i=>i.id===e.catalogId.value);
   form.querySelector('[data-new-product]').hidden=!create;
   e.productName.required=e.bobina.required=create;
   form.querySelector('[data-roll-name]').textContent=item?'Bobina: '+item.bobina:'';
   rolls.replaceChildren();
   e.kg.value=item?.kg||'';
   form.elements.itemCode.value=item?.name.match(/^\d+/)?.[0]||'';
 }
 e.catalogId.onchange=toggle;
 if(!o.itemId&&e.catalogId.options.length===2)e.catalogId.value='new';
 form.querySelector('[data-new-product]').hidden=e.catalogId.value!=='new';e.productName.required=e.bobina.required=e.catalogId.value==='new';
}
function cardFields(form){
 const f=form.elements,firstKg=Number(f.kg.value);
 const current=catalog.find(i=>i.id===f.catalogId.value);
 const rolls=[{name:current?.bobina||f.bobina.value.trim(),kg:firstKg}];
 for(const row of form.querySelectorAll('[data-rolls] fieldset')){
   rolls.push({name:row.querySelector('[name=rollName]').value.trim(),kg:Number(row.querySelector('[name=rollKg]').value)});
 }
 const kg=Number(rolls.reduce((sum,r)=>sum+r.kg,0).toFixed(3));
 if(f.catalogId.value==='new'){const item={id:uid(),name:f.productName.value.trim(),material:f.material.value,bobina:f.bobina.value.trim(),kg:firstKg};return {rolls,kg,item:item.name,itemId:item.id,newItem:item}}
 const i=catalog.find(i=>i.id===f.catalogId.value);return {itemId:i.id,item:i.name,rolls,kg}
}
function itemInput(){
 return '<div data-item-cards></div><button type="button" data-add-product>+ Adicionar item</button><p data-total aria-live="polite"></p>';
}
function bindProduct(form,o){
 const e=form.elements, cards=form.querySelector('[data-item-cards]');
 function add(line={}){
   const card=document.createElement('fieldset');
   card.dataset.itemCard='';
   card.style.margin='12px 0';
   card.innerHTML='<legend>Item da oportunidade</legend><button type="button" data-edit>Editar item</button>'+itemCard({...line,cnpj:e.cnpj.value})+field('Código do item','itemCode',line.code||String(line.item||'').match(/^\d+/)?.[0]||'','text','')+field('Valor do item (R$) *','lineValue',line.value??'','number','required min="0" step="0.01"')+'<button type="button" data-remove-item>Remover item</button>';
   card.querySelector('[data-edit]').onclick=()=>card.elements.catalogId.focus();
   cards.append(card);
   bindCard(card,line);
   card.querySelector('[data-remove-item]').onclick=()=>{
     if(cards.children.length>1)card.remove();
     totals();
     cards.firstElementChild.querySelector('[data-remove-item]').hidden=cards.children.length===1;
   };
   cards.firstElementChild.querySelector('[data-remove-item]').hidden=cards.children.length===1;
   return card;
 }
 function totals(){
   const boxes=[...cards.children];
   const kg=boxes.reduce((n,c)=>n+[...c.querySelectorAll('[name=kg],[name=rollKg]')].reduce((v,f)=>v+Number(f.value),0),0);
   const value=boxes.reduce((n,c)=>n+Number(c.elements.lineValue.value),0);
   e.value.value=value.toFixed(2);
   form.querySelector('[data-total]').textContent=boxes.length+' item(ns) · '+kgText(kg)+' · '+money(value);
 }
 cards.oninput=totals;
 cards.onchange=totals;
 cards.onclick=()=>totals();
 (o.lines?.length?o.lines.map(l=>({...l,value:l.value??(o.lines.length===1?o.value:undefined)})):[o]).forEach(add);
 totals();
 form.querySelector('[data-add-product]').onclick=()=>{add().elements.catalogId.focus();totals()};
 let previous=clientKey(e.cnpj.value);
 e.cnpj.onchange=()=>{const key=clientKey(e.cnpj.value),c=clients.find(x=>x.cnpj===key);if(c){e.client.value=c.name;e.email.value=c.email;e.phone.value=displayPhone(c.phone);if(c.department)e.department.value=c.department;if(c.origin)e.origin.value=c.origin}
 if(key!==previous){previous=key;cards.replaceChildren();add();totals()}
 };
}
function productFields(form){
 const lines=Array.from(form.querySelectorAll('[data-item-card]'),card=>({...cardFields(card),code:card.elements.itemCode.value.trim(),value:Number(card.elements.lineValue.value)}));
 return {...lines[0],lines,kg:Number(lines.reduce((sum,line)=>sum+line.kg,0).toFixed(3))};
}
function teamCatalog(){
 const mine=clients.filter(c=>myWallet(c.seller_id));
 $('#view').innerHTML='<div class="panel"><h2>Itens por cliente</h2>'+(!mine.length?'<p>Cadastre o primeiro cliente e item em Novo cadastro de cliente.</p>':'<form id="productForm"><label>Cliente<select name="cnpj">'+mine.map(c=>'<option value="'+esc(c.cnpj)+'">'+esc(c.name)+'</option>').join('')+'</select></label>'+field('Item','name')+'<label>Material<select name="material">'+options(['Plástico','Papel','Outro'])+'</select></label>'+field('Bobina / especificação','bobina')+'<button>Cadastrar item</button></form>')+'</div>'+table(['Cliente','Item','Bobina','KG','Tipo',''],catalog.filter(i=>!i.archived).map(i=>[esc(clients.find(c=>c.cnpj===i.cnpj)?.name||i.cnpj),esc(i.name),esc(i.bobina),esc(i.kg),i.material==='Papel'?'Terceiros':esc(i.material),mine.some(c=>c.cnpj===i.cnpj)?'<button data-archive="'+esc(i.id)+'">Excluir item</button>':'']));
 const f=$('#productForm');if(f)f.onsubmit=async ev=>{ev.preventDefault();try{const fields=Object.fromEntries(new FormData(f));await addCatalogItem({...fields,name:fields.name.trim(),id:uid()});teamCatalog()}catch(e){alert(e.message)}};
 $('#view').querySelectorAll('[data-archive]').forEach(b=>b.onclick=async()=>{if(!confirm('Retirar este item do catálogo ativo e preservar o histórico?'))return;try{await request('/rest/v1/crm_client_items?id=eq.'+b.dataset.archive,{archived:true},await accessToken(),'PATCH');await loadCatalog(await accessToken());teamCatalog()}catch(e){alert(e.message)}});
}

function registerCustomer(){
 const manager=profile.role==='Gestor';
 const seller=manager?'Carteira Agenflex':profile.name;
 const departments=manager?['Food','Pharma','Direct','Hunter']:[profile.department];
 const select=(title,name,list)=>'<label>'+title+' *<select name="'+name+'" required><option value="">Selecione</option>'+options(list,list.length===1?list[0]:null)+'</select></label>';
 show(form('Novo cadastro de cliente',
   field('Cliente (Nome fantasia) *','client')+field('CNPJ *','cnpj')+
   field('E-mail do cliente *','email','','email')+field('WhatsApp do cliente *','phone','','tel')+
   field('Vendedor *','owner',seller,'text','required readonly')+
   select('Departamento (time)','department',departments)+
   select('Origem','origin',['Marketing','Feira','Carteira','Indicação','Prospecção'])+
   '<h3>Itens do cliente</h3><div data-items></div><button type="button" data-add>+ Item</button><p role="status"></p>'));
 const f=modal.querySelector('form'), rows=f.querySelector('[data-items]');
 function add(){
   const row=document.createElement('fieldset');
   row.innerHTML='<legend>Item do cliente</legend>'+field('Descrição *','description')+
     select('Material','material',['Plástico','Papel','Outro'])+field('Bobina / especificação *','spec')+
     (rows.children.length?'<button type="button">Remover item</button>':'');
   const remove=row.querySelector('button');
   if(remove)remove.onclick=()=>row.remove();
   rows.append(row);
 }
 add(); f.querySelector('[data-add]').onclick=add;
 f.onsubmit=async ev=>{
   ev.preventDefault();
   const e=f.elements,msg=f.querySelector('[role=status]'),button=f.querySelector('.primary');
   const cnpj=formatCnpj(e.cnpj.value);
   if(!cnpj||!whatsappUrl(e.phone.value)){msg.textContent='Confira o CNPJ e o WhatsApp com DDD.';return}
   const customer={cnpj:clientKey(cnpj),name:e.client.value.trim(),email:e.email.value.trim(),phone:canonicalPhone(e.phone.value),department:e.department.value,origin:e.origin.value};
   const items=Array.from(rows.children,row=>({id:uid(),name:row.querySelector('[name=description]').value.trim(),material:row.querySelector('select').value,bobina:row.querySelector('[name=spec]').value.trim()}));
   button.disabled=true;
   try{
     await persistCustomer(customer,items);
     clients.push({...customer,seller_id:session.user.id});
     catalog.push(...items.map(i=>({...i,cnpj:customer.cnpj})));
     render();
     show('<h2>Cliente cadastrado</h2><p>'+esc(customer.name)+' · '+esc(cnpj)+'</p><button class="primary" id="startDeal">+ Criar oportunidade</button> <button onclick="modal.close()">Concluir</button>');
     $('#startDeal').onclick=()=>{
       edit({client:customer.name,cnpj,email:customer.email,phone:customer.phone,department:customer.department,origin:customer.origin,itemId:items[0].id,title:'',value:0,stage:0,tasks:[]});
       modal.querySelector('[name=existing]').value=customer.cnpj;
     };
   }catch(err){msg.textContent=/duplicate|unique/i.test(err.message)?'CNPJ ou item já cadastrado. Confira os dados.':err.message;button.disabled=false}
 };
}

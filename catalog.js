let catalog=[], catalogOpen=false;
const cleanName=name=>String(name||'').trim().replace(/\s+/g,' ');
const nameKey=name=>cleanName(name).toLocaleLowerCase('pt-BR');
function findItem(op){
 return catalog.find(i=>i.id===op.itemId)||catalog.find(i=>op.item&&nameKey(i.name)===nameKey(op.item));
}
function itemSelector(op){
 const selected=findItem(op);
 const historical=op.item&&!selected?'<option selected value="legacy">'+esc(op.item)+'</option>':'';
 return '<label>Item do catálogo<select name="catalogId"><option value="">Selecione um item</option>'+historical+catalog.map(i=>'<option value="'+esc(i.id)+'" '+(selected?.id===i.id?'selected':'')+'>'+esc(i.name)+'</option>').join('')+'</select></label>';
}
function itemFields(form,op){
 const id=form.elements.catalogId.value;
 const selected=catalog.find(i=>i.id===id);
 return {itemId:selected?.id||null,item:selected?.name||(id==='legacy'?op.item:'')};
}
function showCatalog(){
 const view=$('#view');
 view.innerHTML='<section class="panel"><h2>Base de itens</h2><form id="createItem" class="row"><label>Nome do item<input name="name" maxlength="200" placeholder="Sacola de papel 18x25x9,5" required></label><button class="primary">Cadastrar item</button></form><p id="catalogMessage" role="status"></p><ul>'+catalog.map(i=>'<li>'+esc(i.name)+'</li>').join('')+'</ul></section>';
 $('#createItem').onsubmit=async e=>{
  e.preventDefault();const form=e.target,button=form.querySelector('button'),name=cleanName(form.elements.name.value);
  if(!name||catalog.some(i=>nameKey(i.name)===nameKey(name))){$('#catalogMessage').textContent=name?'Este item já está cadastrado.':'Informe o nome do item.';return}
  button.disabled=true;
  try{await addCatalogItem({id:uid(),name});showCatalog();$('#catalogMessage').textContent='Item cadastrado.';$('#createItem input').focus()}
  catch(error){$('#catalogMessage').textContent=error.message.includes('duplicate')?'Este item já está cadastrado.':error.message}
  finally{button.disabled=false}
 };
}
function expandItems(op){
 return op.lines?.length?op.lines.map(line=>({...op,...line})): [op];
}
function itemSummary(rows,onlyThirdParty=false){
 rows=rows.flatMap(expandItems).filter(l=>!onlyThirdParty||l.thirdParty);

 const weights=new Map();
 for(const op of rows.filter(o=>o.result==='Concluído')){
   const rolls=op.rolls?.length?op.rolls:[{name:op.bobina||findItem(op)?.bobina,kg:op.kg}];
   for(const roll of rolls){
     const key=JSON.stringify([op.cnpj,op.itemId||op.item,roll.name]);
     const line=weights.get(key)||{client:op.client,item:op.item,bobina:roll.name,kg:0};
     line.kg+=Number(roll.kg)||0;
     weights.set(key,line);
   }
 }
 const weightReport='<div class="panel"><h2>Kg vendidos por item e bobina</h2>'+table(['Cliente','Item','Bobina','Kg vendidos'],[...weights.values()].map(r=>[esc(r.client),esc(r.item),esc(r.bobina||'Sem informação'),r.kg.toLocaleString('pt-BR',{maximumFractionDigits:3})]))+'</div>';
 const groups=new Map();
 for(const op of rows){
  const item=findItem(op),key=item?.id||nameKey(op.item),g=groups.get(key)||{name:item?.name||op.item||'Sem item informado',won:0,lost:0,value:0,shared:false};
  if(op.result==='Concluído'){g.won++;if(op.lines?.length>1&&!op.lines.every(l=>l.value!=null))g.shared=true;else g.value+=Number(op.value)}else if(op.result==='Perdido'){g.lost++}
  groups.set(key,g);
 }
 const body=[...groups.values()].sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,'pt-BR')).map(g=>'<tr><td>'+esc(g.name)+'</td><td>'+g.won+'</td><td>'+g.lost+'</td><td>'+(g.shared?'Sem rateio por item':money(g.value))+'</td></tr>').join('');
 return weightReport+'<div class="panel"><h2>Resultado por item</h2><table><tr><th>Item</th><th>Vendas concluídas</th><th>Perdidas</th><th>Total vendido</th></tr>'+body+'</table></div>';
}

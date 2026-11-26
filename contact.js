function validCnpj(value){
 const k=clientKey(value);
 if(!/^[A-Z0-9]{12}\d{2}$/.test(k)||k===k[0].repeat(14))return false;
 for(let n=12;n<=13;n++){
   let sum=0;for(let i=0;i<n;i++)sum+=(k.charCodeAt(i)-48)*(2+(n-1-i)%8);
   if(Number(k[n])!==((11-sum%11)%11)%10)return false;
 }
 return true;
}
function cnpjMask(v){
 const k=clientKey(v);
 return k.slice(0,2)+(k.length>2?'.'+k.slice(2,5):'')+(k.length>5?'.'+k.slice(5,8):'')+(k.length>8?'/'+k.slice(8,12):'')+(k.length>12?'-'+k.slice(12):'');
}
function localDigits(v){
 let d=String(v||'').replace(/\D/g,'');
 if((String(v).trim().startsWith('+55')||d.length===12||d.length===13)&&d.startsWith('55'))d=d.slice(2);
 return d;
}
function canonicalPhone(v){
 if(!/^[+\d() .-]+$/.test(v)||String(v).trim().startsWith('+')&&!String(v).trim().startsWith('+55'))return '';
 const d=localDigits(v);return /^[1-9][1-9]([2-5]\d{7}|9\d{8})$/.test(d)?'55'+d:'';
}
function phoneMask(v){
 if(!v)return '';
 if(['+','+5','+55'].includes(v))return v;
 const d=localDigits(v),cut=d.length>10?7:6;
 return '('+d.slice(0,2)+(d.length>2?') '+d.slice(2,cut):'')+(d.length>cut?'-'+d.slice(cut):'');
}
function displayPhone(v){return canonicalPhone(v)?phoneMask(v):v||'—'}
function maskInput(input){
 const old=input.value,caret=input.selectionStart??old.length;
 const tax=input.name==='cnpj',pattern=tax?/[A-Z0-9]/ig:/\d/g;
 if(!tax&&/[^+\d() .-]/.test(old)||!tax&&old.startsWith('+')&&!old.startsWith('+55')){input.setCustomValidity('Informe um telefone brasileiro com DDD.');return}
 const next=tax?cnpjMask(old):phoneMask(old);
 let count=(old.slice(0,caret).match(pattern)||[]).length;
 if(!tax&&localDigits(old).length<old.replace(/\D/g,'').length)count=Math.max(0,count-2);
 input.value=next;
 if(caret<old.length){let i=0;while(i<next.length&&count){if(next[i].match(pattern))count--;i++}input.setSelectionRange(i,i)}
 input.setCustomValidity(!next||(tax?validCnpj(next):canonicalPhone(next))?'':tax?'Confira os dígitos verificadores do CNPJ.':'Confira o DDD e o número do WhatsApp.');
}
document.addEventListener('input',e=>{if(e.target.matches?.('input[name=cnpj],input[name=phone]'))maskInput(e.target)},true);
function maskedForm(root){root.querySelectorAll('input[name=cnpj],input[name=phone]').forEach(i=>{if(i.value)maskInput(i)});}
function summaryDetails(o){
 const details=[['Cliente',o.client],['CNPJ',cnpjMask(o.cnpj)],['E-mail',o.email],['WhatsApp',displayPhone(o.phone)],['Oportunidade',o.title],['Vendedor',o.owner],['Time',o.department],['Origem',o.origin],['Etapa',stages[o.stage]],['Previsão',fmt(o.expectedClose)],['Resultado',o.result],['Fechamento',fmt(o.closed)]];
 return '<dl class="order-facts">'+details.filter(([,v])=>v).map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>'+itemDetails(o)+'<p><b>Total da oportunidade</b> · '+kgText(o.kg)+' · '+money(o.value)+'</p><h3>Tarefas</h3>'+table(['Tarefa','Prazo','Status'],o.tasks.map(t=>[esc(t.name),fmt(t.date),t.done?'Concluída':'Pendente']));
}
async function orderHistory(o,section){
 section.innerHTML='<h3>Histórico da oportunidade</h3>';
 if(!o?.id){section.append('O histórico começa ao salvar.');return}
 const events=[];
 if(o.parent)events.push('Recompra vinculada à oportunidade de origem.');
 if(o.closed)events.push('Fechamento em '+fmt(o.closed)+' · '+o.result);
 try{
   if(typeof fetchRows==='function'){
     const list=await request('/rest/v1/crm_op_history?select=at,event&op_id=eq.'+encodeURIComponent(o.id)+'&order=at.desc',null,await accessToken());
     for(const h of list)events.push(new Date(h.at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · '+h.event);
   }
 }catch{events.push('Não foi possível carregar os eventos.')}
 section.innerHTML+=events.length?'<ul>'+events.map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>':'<p>Sem movimentações registradas desde a ativação do histórico.</p>';
}
function wideOpportunity(o,review=false){
 modal.classList.add('order-window');
 const f=modal.querySelector('form'),root=f||modal;
 const header=document.createElement('div');header.className='order-head';
 const title=root.querySelector('h2');if(title)header.append(title);
 const close=document.createElement('button');close.type='button';close.textContent='Fechar ×';close.onclick=()=>modal.close();header.append(close);
 const scroll=document.createElement('div');scroll.className='order-body';
 const footer=document.createElement('div');footer.className='order-actions';
 for(const b of [...modal.querySelectorAll('button')]){
   if(b.hasAttribute('onclick')&&b.getAttribute('onclick').includes('modal.close')){b.remove();continue}
   if(b===f?.querySelector('.primary')||b.matches('#duplicate,#clientDetails')||b.parentElement===modal){footer.append(b)}
 }
 while(root.firstChild)scroll.append(root.firstChild);
 if(!f||review){scroll.querySelectorAll('.panel').forEach(el=>el.remove());const sum=document.createElement('section');sum.innerHTML=summaryDetails(o);scroll.prepend(sum)}
 const history=document.createElement('section');scroll.append(history);orderHistory(o,history);
 root.append(header,scroll,footer);maskedForm(scroll);
}

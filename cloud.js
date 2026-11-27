const endpoint='https://gnnlhovyeozlvqmxdtxs.supabase.co';
const publicKey='sb_publishable_iA2Z6bMnvxYuq40eilvrhA_6kTqMjag';
let session=null, baseline=new Map(),busy=false;
async function request(path, body, token, method){
 const response=await fetch(endpoint+path,{method:method||(body?'POST':'GET'),headers:{apikey:publicKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const text=await response.text();
 const result=text?JSON.parse(text):null;
 if(!response.ok)throw Error(result?.message||result?.msg||result?.error_description||'Falha na conexão.');
 return result;
}
async function accessToken(){
 if(session.expires_at*1000<Date.now()+60000)session=await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token});
 return session.access_token;
}
async function loadBoard(){
 const token=await accessToken();
 await Promise.all([loadCatalog(token),loadManagement(token)]);
 audit=profile?.role==='Gestor'?await fetchRows('crm_removals','*','requested_at.desc,id',token):[];
 clients=await fetchRows('crm_clients','*','cnpj',token);
 const rows=[];
 let page;
 do{
  page=await request('/rest/v1/crm_opportunities?select=id,record,revision,seller_id&order=id&limit=500&offset='+rows.length,null,token);
  rows.push(...page);
 }while(page.length===500);
 baseline=new Map(rows.map(r=>[r.id,{revision:r.revision,json:JSON.stringify({...r.record,sellerId:r.seller_id})}]));
 data=rows.map(r=>({...r.record,sellerId:r.seller_id}));
 render();
}
async function save(){
 if(busy)return;
 busy=true;document.querySelector('main').inert=true;
 const changes=data.filter(o=>JSON.stringify(o)!==baseline.get(o.id)?.json).map(record=>({record,revision:baseline.get(record.id)?.revision||0}));
 try{
  if(changes.length)await request('/rest/v1/rpc/crm_save_changes',{changes},await accessToken());
  await loadBoard();
 }catch(error){
  alert('Verifique o quadro atualizado antes de tentar novamente. '+error.message);
  try{await loadBoard()}catch{location.reload()}
 }finally{busy=false;document.querySelector('main').inert=false}
}
function loginScreen(){
 document.querySelector('main').hidden=true;
 show('<form><span role="img" aria-label="Agenflex packing solutions" class="brand-official login-brand"></span><h2>Entrar no CRM</h2>'+field('E-mail','email','','email')+field('Senha','password','','password')+'<p role="status"></p><button class="primary">Entrar</button> <button type="button" id="recover">Primeiro acesso / esqueci a senha</button> <button type="button" id="receivedLink">Já recebi o link por e-mail</button></form>');
 modal.oncancel=e=>{if(!session)e.preventDefault()};
 const fragment=new URLSearchParams(location.hash.slice(1));
 if(['recovery','signup','invite'].includes(fragment.get('type'))&&fragment.get('access_token')){
  history.replaceState(null,'',location.pathname+location.search);
  passwordScreen(fragment.get('access_token'));return;
 }
 modal.querySelector('#receivedLink').onclick=()=>passwordScreen();
 modal.querySelector('#recover').onclick=()=>recoveryScreen(modal.querySelector('[name=email]').value);

 modal.querySelector('form').onsubmit=async e=>{
  e.preventDefault();
  const f=e.target,b=f.querySelector('button'),msg=f.querySelector('[role=status]');
  b.disabled=true;
  try{
   session=await request('/auth/v1/token?grant_type=password',{email:f.elements.email.value.trim(),password:f.elements.password.value});
   const members=await request('/rest/v1/crm_members?select=user_id',null,session.access_token);
   if(!members.length)throw Error('Solicite a liberação do seu usuário para o CRM.');
   const profiles=await request('/rest/v1/crm_pilot_profiles?select=display_name,is_manager,department&user_id=eq.'+session.user.id,null,session.access_token);profile=profiles[0]&&{name:profiles[0].display_name,department:profiles[0].department,role:profiles[0].is_manager?"Gestor":"Vendedor"};if(!profile)throw Error('Vincule o login ao time do CRM.');
   await loadBoard();modal.close();document.querySelector('main').hidden=false;
  }catch(error){session=null;msg.textContent=error.message==='Invalid login credentials'?'E-mail ou senha incorretos.':error.message}
  finally{b.disabled=false}
 };
}

async function fetchRows(table,columns,order,token){
 const rows=[];let page;
 do{page=await request('/rest/v1/'+table+'?select='+columns+'&order='+order+'&limit=500&offset='+rows.length,null,token);rows.push(...page)}while(page.length===500);
 return rows;
}
async function loadCatalog(token){catalog=await fetchRows('crm_client_items','*','name,id',token)}
async function addCatalogItem(item){
 const token=await accessToken();
 await request('/rest/v1/crm_client_items',item,token);
 await Promise.all([loadCatalog(token),loadManagement(token)]);
}

function recoveryScreen(email){
 show('<form><h2>Primeiro acesso / recuperar senha</h2>'+field('E-mail cadastrado','email',email,'email')+'<p role="status"></p><button class="primary">Enviar e-mail de acesso</button> <button type="button" id="backLogin">Voltar</button></form>');
 modal.querySelector('#backLogin').onclick=loginScreen;
 modal.querySelector('form').onsubmit=async e=>{
  e.preventDefault();const f=e.target,b=f.querySelector('button');b.disabled=true;
  try{
   await request('/auth/v1/recover?redirect_to='+encodeURIComponent(location.origin+location.pathname),{email:f.elements.email.value.trim()});
   passwordScreen();
  }catch(error){f.querySelector('[role=status]').textContent=error.message}
  finally{b.disabled=false}
 };
}
function passwordScreen(access){
 const verifyField=access?'':'<p>Abra seu e-mail e copie o endereço do botão de confirmação ou recuperação. Cole o link aqui para confirmar sua identidade.</p>'+field('Link recebido por e-mail','link','','url','required autocomplete="off"');
 show('<form><h2>Definir senha</h2>'+verifyField+field('Nova senha','password','','password','required minlength="8" autocomplete="new-password"')+field('Confirmar nova senha','confirmation','','password','required autocomplete="new-password"')+'<p role="status"></p><button class="primary">Salvar senha</button> <button type="button" id="backLogin">Voltar</button></form>');
 modal.querySelector('#backLogin').onclick=loginScreen;
 modal.querySelector('form').onsubmit=async e=>{
  e.preventDefault();const f=e.target,b=f.querySelector('button'),msg=f.querySelector('[role=status]');
  if(f.elements.password.value!==f.elements.confirmation.value){msg.textContent='As senhas precisam ser iguais.';return}
  b.disabled=true;
  try{
   if(!access){
    const link=new URL(f.elements.link.value);
    const hash=link.searchParams.get('token')||link.searchParams.get('token_hash');
    if(link.origin!==endpoint||link.pathname!=='/auth/v1/verify'||!['recovery','signup','invite'].includes(link.searchParams.get('type'))||!hash)throw Error('Copie o endereço do botão do e-mail de recuperação mais recente.');
    const verified=await request('/auth/v1/verify',{type:link.searchParams.get('type'),token_hash:hash});
    access=verified.access_token;
   }
   await request('/auth/v1/user',{password:f.elements.password.value},access,'PUT');
   loginScreen();modal.querySelector('[role=status]').textContent='Senha definida. Entre com seu e-mail e a nova senha.';
  }catch(error){msg.textContent=error.message}
  finally{b.disabled=false}
 };
}
async function persistCustomer(customer,items){
 await request('/rest/v1/rpc/crm_register_client',{customer,items},await accessToken());
}
async function removalAction(oid,action,reason){
 await request('/rest/v1/rpc/crm_removal_action',{oid,action,reason},await accessToken());
}

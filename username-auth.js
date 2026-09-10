// CHAMADO T.I. 3.0 — autenticação por usuário + senha
// O Supabase Auth usa internamente um identificador no formato e-mail,
// mas o usuário nunca precisa informar ou conhecer esse valor.

const USERNAME_DOMAIN = (window.CHAMADO_TI_CONFIG && window.CHAMADO_TI_CONFIG.USERNAME_DOMAIN) || 'chamado-ti.local';

function normalizeUsername(value){
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');
}

function usernameToInternalEmail(username){
  const clean = normalizeUsername(username);
  return clean ? `${clean}@${USERNAME_DOMAIN}` : '';
}

window.handleLogin = async function(event){
  event.preventDefault();
  if(!ONLINE || !db){ toast('O banco online ainda não está configurado.','error'); return; }
  const button = event.submitter;
  setButtonLoading(button,true,'Entrando...');
  if($('loginStatus')) $('loginStatus').textContent='';
  try{
    const username = normalizeUsername($('loginEmail')?.value);
    const password = $('loginPassword')?.value || '';
    if(!username) throw new Error('Informe seu nome de usuário.');
    const {data,error} = await db.auth.signInWithPassword({
      email: usernameToInternalEmail(username),
      password
    });
    if(error) throw error;
    await enterOnline(data.session);
  }catch(error){
    if($('loginStatus')) $('loginStatus').textContent = error?.message === 'Invalid login credentials'
      ? 'Usuário ou senha inválidos.'
      : (error?.message || friendlyAuthError(error));
  }finally{
    setButtonLoading(button,false,'Entrar na Central');
  }
};

window.openNewUserModal = function(){
  if(!isAdmin()) return;
  const deptOptions = departments.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');
  $('modalRoot').innerHTML=`<div class="modal-backdrop" data-close-modal><div class="modal sm"><div class="modal-head"><div class="modal-title"><span>ADMINISTRAÇÃO</span><h3>Novo usuário</h3></div><button class="icon-btn" data-modal-close>×</button></div><form id="newUserForm"><div class="modal-body"><div class="user-form"><label class="field full"><span>Nome completo *</span><input name="full_name" required></label><label class="field full"><span>Nome de usuário *</span><input name="username" required minlength="3" maxlength="40" autocomplete="off" placeholder="Ex.: saude01"></label><label class="field"><span>Senha inicial *</span><input name="password" type="password" minlength="8" required></label><label class="field"><span>Perfil *</span><select name="role" required><option value="requester">Solicitante</option><option value="technician">Técnico</option><option value="admin">Administrador</option></select></label><label class="field full"><span>Secretaria / Setor *</span><select name="department_id" required><option value="">Selecione</option>${deptOptions}</select></label></div></div><div class="modal-footer"><button class="btn" type="button" data-modal-close>Cancelar</button><button class="btn primary" type="submit">Criar usuário</button></div></form></div></div>`;
  bindModalClose();
  $('newUserForm')?.addEventListener('submit',createUser);
};

window.createUser = async function(event){
  event.preventDefault();
  const button=event.submitter, fd=new FormData(event.currentTarget);
  const payload={
    full_name:String(fd.get('full_name')||'').trim(),
    username:normalizeUsername(fd.get('username')),
    password:String(fd.get('password')||''),
    role:fd.get('role'),
    department_id:fd.get('department_id')
  };
  if(payload.username.length < 3){ toast('O usuário deve ter pelo menos 3 caracteres.','error'); return; }
  setButtonLoading(button,true,'Criando...');
  try{
    if(demoMode){
      users.push({id:`demo-user-${crypto.randomUUID()}`,full_name:payload.full_name,username:payload.username,role:payload.role,active:true,department_id:payload.department_id,department:departments.find(d=>d.id===payload.department_id),created_at:new Date().toISOString()});
    }else{
      const {data,error}=await db.functions.invoke('create-user',{body:payload});
      if(error) throw error;
      if(data?.error) throw new Error(data.error);
      await loadUsers();
    }
    renderUsers(); closeModal(); toast('Usuário criado com sucesso.','success');
  }catch(error){
    console.error(error); toast(error.message||'Não foi possível criar o usuário.','error');
  }finally{
    setButtonLoading(button,false,'Criar usuário');
  }
};

window.addEventListener('DOMContentLoaded',()=>{
  const input=$('loginEmail');
  if(input){
    input.type='text';
    input.placeholder='Seu usuário';
    input.autocomplete='username';
    const label=input.closest('label');
    if(label && label.firstChild) label.firstChild.textContent='Usuário\n            ';
  }
  const head=document.querySelector('.login-card-head p');
  if(head) head.textContent='Use seu nome de usuário e senha cadastrada.';
});

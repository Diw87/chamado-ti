// CHAMADO T.I. 3.0 — autenticação por nome de usuário
// O e-mail técnico do Supabase fica totalmente invisível para os usuários.

function normalizeUsername(value){
  return String(value || '').trim().toLowerCase();
}

handleLogin = async function(event){
  event.preventDefault();
  if(!ONLINE || !db){ toast('O banco online ainda não está configurado.','error'); return; }

  const button = event.submitter;
  const username = normalizeUsername(document.getElementById('loginEmail')?.value);
  const password = String(document.getElementById('loginPassword')?.value || '');
  const status = document.getElementById('loginStatus');
  if(status) status.textContent='';

  if(!/^[a-z0-9._-]{3,32}$/.test(username)){
    if(status) status.textContent='Informe um nome de usuário válido.';
    return;
  }

  setButtonLoading(button,true,'Entrando...');
  try{
    const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/login-user`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':CONFIG.SUPABASE_ANON_KEY
      },
      body:JSON.stringify({username,password})
    });
    const result = await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(result.error || 'Usuário ou senha inválidos.');

    // Impede que o listener de autenticação tente abrir a sessão duas vezes.
    authSession = { pending:true };
    const {data,error} = await db.auth.setSession({
      access_token:result.access_token,
      refresh_token:result.refresh_token
    });
    if(error || !data.session) throw error || new Error('Não foi possível iniciar a sessão.');

    authSession = data.session;
    await enterOnline(data.session);
  }catch(error){
    authSession = null;
    if(status) status.textContent = error?.message || 'Usuário ou senha inválidos.';
  }finally{
    setButtonLoading(button,false,'Entrar na Central');
  }
};

loadUsers = async function(){
  if(!db || !isAdmin()) return;
  const {data,error}=await db.from('profiles')
    .select('id,username,full_name,role,active,department_id,created_at,department:departments(id,name,acronym)')
    .order('full_name');
  if(error) throw error;
  users=data||[];
};

openNewUserModal = function(){
  if(!isAdmin()) return;
  const deptOptions=departments.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');
  $('modalRoot').innerHTML=`<div class="modal-backdrop" data-close-modal><div class="modal sm">
    <div class="modal-head"><div class="modal-title"><span>ADMINISTRAÇÃO</span><h3>Novo usuário</h3></div><button class="icon-btn" data-modal-close>×</button></div>
    <form id="newUserForm">
      <div class="modal-body"><div class="user-form">
        <label class="field full"><span>Nome completo *</span><input name="full_name" required maxlength="120" placeholder="Nome do servidor"></label>
        <label class="field full"><span>Nome de usuário *</span><input name="username" required minlength="3" maxlength="32" autocomplete="off" placeholder="Ex.: saude01"><small>Use letras minúsculas, números, ponto, hífen ou underline.</small></label>
        <label class="field"><span>Senha inicial *</span><input name="password" type="password" minlength="8" required autocomplete="new-password"></label>
        <label class="field"><span>Perfil *</span><select name="role" required><option value="requester">Solicitante</option><option value="technician">Técnico</option><option value="admin">Administrador</option></select></label>
        <label class="field full"><span>Secretaria / Setor *</span><select name="department_id" required><option value="">Selecione</option>${deptOptions}</select></label>
      </div></div>
      <div class="modal-footer"><button class="btn" type="button" data-modal-close>Cancelar</button><button class="btn primary" type="submit">Criar usuário</button></div>
    </form>
  </div></div>`;
  bindModalClose();
  $('newUserForm')?.addEventListener('submit',createUser);
};

createUser = async function(event){
  event.preventDefault();
  const button=event.submitter,fd=new FormData(event.currentTarget);
  const payload={
    full_name:String(fd.get('full_name')||'').trim(),
    username:normalizeUsername(fd.get('username')),
    password:String(fd.get('password')||''),
    role:fd.get('role'),
    department_id:fd.get('department_id')
  };

  if(!/^[a-z0-9._-]{3,32}$/.test(payload.username)){
    toast('Nome de usuário inválido.','error');return;
  }

  setButtonLoading(button,true,'Criando...');
  try{
    if(demoMode){
      users.push({id:`demo-user-${crypto.randomUUID()}`,username:payload.username,full_name:payload.full_name,role:payload.role,active:true,department_id:payload.department_id,department:departments.find(d=>d.id===payload.department_id),created_at:new Date().toISOString()});
    }else{
      const {data,error}=await db.functions.invoke('create-user',{body:payload});
      if(error) throw error;
      if(data?.error) throw new Error(data.error);
      await loadUsers();
    }
    renderUsers();
    closeModal();
    toast(`Usuário ${payload.username} criado com sucesso.`,'success');
  }catch(error){
    console.error(error);
    toast(error?.message||'Não foi possível criar o usuário.','error');
  }finally{
    setButtonLoading(button,false,'Criar usuário');
  }
};

renderUsers = function(){
  const body=$('usersTableBody');
  if(!body||!isAdmin()) return;
  const search=($('userSearch')?.value||'').trim().toLowerCase(),role=$('userRoleFilter')?.value||'';
  const filtered=users.filter(u=>{
    const hay=[u.username,u.full_name,u.department?.name,ROLE_LABEL[u.role]].join(' ').toLowerCase();
    return(!search||hay.includes(search))&&(!role||u.role===role);
  });

  body.innerHTML=filtered.length?filtered.map(u=>`<tr>
    <td><div class="subject-title">${esc(u.full_name)}</div><div class="subline">@${esc(u.username||'usuario')}</div></td>
    <td>${esc(u.department?.name||'—')}</td>
    <td><span class="badge prio-media">${esc(ROLE_LABEL[u.role]||u.role)}</span></td>
    <td><span class="badge ${u.active?'status-resolvido':'status-cancelado'}">${u.active?'Ativo':'Inativo'}</span></td>
    <td><span class="subline">${formatDate(u.created_at)}</span></td>
  </tr>`).join(''):emptyRow(5,'Nenhum usuário encontrado');
};

window.addEventListener('DOMContentLoaded',()=>{
  const input=document.getElementById('loginEmail');
  if(input){
    input.type='text';
    input.placeholder='Ex.: dill';
    input.autocomplete='username';
    input.setAttribute('autocapitalize','none');
    input.setAttribute('spellcheck','false');
    const label=input.closest('label');
    if(label && label.firstChild) label.firstChild.textContent='Usuário\n            ';
  }
  const head=document.querySelector('.login-card-head p');
  if(head) head.textContent='Use seu nome de usuário e senha cadastrada.';
});

// CHAMADO T.I. — primeiro acesso e redefinição segura de credenciais
(function(){
  function normalizeUser(value){return String(value||'').trim().toLowerCase();}
  function normalizeCode(value){return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/(.{4})(?=.)/g,'$1-').slice(0,14);}

  function ensureAccessCss(){
    if(document.querySelector('link[href="access-management.css"]')) return;
    const link=document.createElement('link');link.rel='stylesheet';link.href='access-management.css?v=20260910-1';document.head.appendChild(link);
  }

  window.addEventListener('DOMContentLoaded',()=>{
    ensureAccessCss();
    const form=$('loginForm');
    if(form && !$('firstAccessBtn')){
      const btn=document.createElement('button');
      btn.id='firstAccessBtn';btn.type='button';btn.className='btn subtle wide first-access-btn';btn.textContent='Primeiro acesso / Criar senha';
      form.insertAdjacentElement('afterend',btn);
      btn.addEventListener('click',openFirstAccessModal);
    }
  });

  // Substitui o cadastro antigo: o administrador não define senha.
  openNewUserModal = function(){
    if(!isAdmin()) return;
    const deptOptions=departments.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');
    $('modalRoot').innerHTML=`<div class="modal-backdrop" data-close-modal><div class="modal sm">
      <div class="modal-head"><div class="modal-title"><span>ADMINISTRAÇÃO</span><h3>Novo usuário</h3></div><button class="icon-btn" data-modal-close>×</button></div>
      <form id="newUserForm">
        <div class="modal-body"><div class="user-form">
          <label class="field full"><span>Nome completo *</span><input name="full_name" required maxlength="120" placeholder="Nome do servidor"></label>
          <label class="field full"><span>Nome de usuário *</span><input name="username" required minlength="3" maxlength="32" autocomplete="off" placeholder="Ex.: saude01"><small>Use letras minúsculas, números, ponto, hífen ou underline.</small></label>
          <label class="field"><span>Perfil *</span><select name="role" required><option value="requester">Solicitante</option><option value="technician">Técnico</option><option value="admin">Administrador</option></select></label>
          <label class="field"><span>Secretaria / Setor *</span><select name="department_id" required><option value="">Selecione</option>${deptOptions}</select></label>
          <div class="field full access-info-box"><b>Senha criada pelo próprio usuário</b><span>Após o cadastro, o sistema vai gerar um Código de Primeiro Acesso. O servidor usa esse código uma única vez para cadastrar a própria senha.</span></div>
        </div></div>
        <div class="modal-footer"><button class="btn" type="button" data-modal-close>Cancelar</button><button class="btn primary" type="submit">Cadastrar usuário</button></div>
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
      username:normalizeUser(fd.get('username')),
      role:fd.get('role'),
      department_id:fd.get('department_id')
    };
    if(!/^[a-z0-9._-]{3,32}$/.test(payload.username)){toast('Nome de usuário inválido.','error');return;}
    setButtonLoading(button,true,'Cadastrando...');
    try{
      if(demoMode){
        const code='DEMO-2026-TI01';
        users.push({id:`demo-user-${crypto.randomUUID()}`,username:payload.username,full_name:payload.full_name,role:payload.role,active:false,must_set_password:true,department_id:payload.department_id,department:departments.find(d=>d.id===payload.department_id),created_at:new Date().toISOString()});
        renderUsers();
        showAccessCodeModal({...payload,access_code:code,expires_at:new Date(Date.now()+7*86400000).toISOString()},'Usuário cadastrado');
        return;
      }
      const {data,error}=await db.functions.invoke('create-user',{body:payload});
      if(error) throw error;if(data?.error) throw new Error(data.error);
      await loadUsers();renderUsers();
      showAccessCodeModal(data,'Usuário cadastrado');
    }catch(error){console.error(error);toast(error?.message||'Não foi possível cadastrar o usuário.','error');}
    finally{setButtonLoading(button,false,'Cadastrar usuário');}
  };

  loadUsers = async function(){
    if(!db||!isAdmin()) return;
    const {data,error}=await db.from('profiles')
      .select('id,username,full_name,role,active,must_set_password,department_id,created_at,deleted_at,department:departments(id,name,acronym)')
      .is('deleted_at',null).order('full_name');
    if(error) throw error;users=data||[];
  };

  renderUsers = function(){
    const body=$('usersTableBody');if(!body||!isAdmin())return;
    const search=($('userSearch')?.value||'').trim().toLowerCase(),role=$('userRoleFilter')?.value||'';
    const filtered=users.filter(u=>{const hay=[u.full_name,u.username,u.department?.name,ROLE_LABEL[u.role]].join(' ').toLowerCase();return(!search||hay.includes(search))&&(!role||u.role===role);});
    ensureAdminHeader();
    body.innerHTML=filtered.length?filtered.map(u=>{
      const self=u.id===currentProfile?.id;
      const state=u.must_set_password?'<span class="badge status-atendimento">Primeiro acesso</span>':(u.active?'<span class="badge status-resolvido">Ativo</span>':'<span class="badge status-cancelado">Inativo</span>');
      const access=u.must_set_password?'<span class="access-state pending">Senha ainda não criada</span>':'<span class="access-state ok">Senha definida</span>';
      const actions=self?'<span class="subline">Conta atual</span>':`<div class="user-action-group"><button type="button" class="btn compact" data-reset-access="${u.id}">Redefinir acesso</button><button type="button" class="btn danger compact" data-delete-user="${u.id}">Excluir</button></div>`;
      return `<tr><td><div class="subject-title">${esc(u.full_name)}</div><div class="subline">@${esc(u.username||'sem-usuario')}</div></td><td>${esc(u.department?.name||'—')}</td><td><span class="badge prio-media">${esc(ROLE_LABEL[u.role]||u.role)}</span></td><td>${state}</td><td>${access}</td><td><span class="subline">${formatDate(u.created_at)}</span></td><td>${actions}</td></tr>`;
    }).join(''):emptyRow(7,'Nenhum usuário encontrado');
    body.querySelectorAll('[data-reset-access]').forEach(b=>b.addEventListener('click',()=>confirmResetAccess(b.dataset.resetAccess)));
    body.querySelectorAll('[data-delete-user]').forEach(b=>b.addEventListener('click',()=>openDeleteUserModal(b.dataset.deleteUser)));
  };

  function ensureAdminHeader(){
    const row=$('usersTableBody')?.closest('table')?.querySelector('thead tr');if(!row)return;
    row.innerHTML='<th>Usuário</th><th>Secretaria</th><th>Perfil</th><th>Situação</th><th>Acesso</th><th>Cadastro</th><th>Ações</th>';
  }

  function confirmResetAccess(userId){
    const user=users.find(u=>u.id===userId);if(!user||user.id===currentProfile?.id)return;
    $('modalRoot').innerHTML=`<div class="modal-backdrop" data-close-modal><div class="modal sm"><div class="modal-head"><div class="modal-title"><span>ADMINISTRAÇÃO</span><h3>Redefinir acesso</h3></div><button class="icon-btn" data-modal-close>×</button></div><div class="modal-body"><div class="detail-description">O acesso de <b>${esc(user.full_name)}</b> será reiniciado. A senha atual deixará de funcionar e o sistema gerará um novo Código de Primeiro Acesso para o usuário criar outra senha.</div></div><div class="modal-footer"><button class="btn" data-modal-close>Cancelar</button><button class="btn primary" id="doResetAccessBtn">Gerar novo código</button></div></div></div>`;
    bindModalClose();$('doResetAccessBtn')?.addEventListener('click',e=>resetUserAccess(user,e.currentTarget));
  }

  async function resetUserAccess(user,button){
    setButtonLoading(button,true,'Gerando...');
    try{
      if(demoMode){showAccessCodeModal({username:user.username,full_name:user.full_name,access_code:'DEMO-RESET-01',expires_at:new Date(Date.now()+7*86400000).toISOString()},'Acesso redefinido');return;}
      const {data,error}=await db.functions.invoke('reset-user-access',{body:{user_id:user.id}});if(error)throw error;if(data?.error)throw new Error(data.error);
      await loadUsers();renderUsers();showAccessCodeModal(data,'Acesso redefinido');
    }catch(error){console.error(error);toast(error?.message||'Não foi possível redefinir o acesso.','error');}
    finally{setButtonLoading(button,false,'Gerar novo código');}
  }

  function showAccessCodeModal(data,title){
    const expires=data.expires_at?formatDateTime(data.expires_at):'7 dias';
    $('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal sm"><div class="modal-head"><div class="modal-title"><span>ACESSO DO USUÁRIO</span><h3>${esc(title)}</h3></div></div><div class="modal-body"><div class="access-code-card"><span>Usuário</span><b>@${esc(data.username||'')}</b><span>Código de Primeiro Acesso</span><strong id="generatedAccessCode">${esc(data.access_code||'')}</strong><button class="btn" type="button" id="copyAccessCodeBtn">Copiar código</button><small>Válido até ${esc(expires)}. Este código é exibido agora para ser entregue ao usuário; ele será usado uma única vez.</small></div><div class="access-info-box"><b>Importante</b><span>A senha não é criada nem visualizada pelo Administrador. O próprio usuário define a senha no botão “Primeiro acesso / Criar senha”.</span></div></div><div class="modal-footer"><button class="btn primary" type="button" id="finishAccessCodeBtn">Concluir</button></div></div></div>`;
    $('copyAccessCodeBtn')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(data.access_code||'');toast('Código copiado.','success');}catch{toast('Copie o código exibido na tela.');}});
    $('finishAccessCodeBtn')?.addEventListener('click',()=>closeModal());
  }

  function openFirstAccessModal(){
    $('modalRoot').innerHTML=`<div class="modal-backdrop" data-close-modal><div class="modal sm"><div class="modal-head"><div class="modal-title"><span>PRIMEIRO ACESSO</span><h3>Crie sua senha</h3></div><button class="icon-btn" data-modal-close>×</button></div><form id="firstAccessForm"><div class="modal-body"><div class="user-form"><label class="field full"><span>Usuário *</span><input name="username" required minlength="3" maxlength="32" autocomplete="username" placeholder="Ex.: saude01"></label><label class="field full"><span>Código de Primeiro Acesso *</span><input name="access_code" required maxlength="14" autocomplete="one-time-code" placeholder="XXXX-XXXX-XXXX"></label><label class="field"><span>Nova senha *</span><input name="password" type="password" minlength="8" required autocomplete="new-password"></label><label class="field"><span>Confirmar senha *</span><input name="confirm_password" type="password" minlength="8" required autocomplete="new-password"></label><div class="field full access-info-box"><b>Defina uma senha pessoal</b><span>Use no mínimo 8 caracteres. O Administrador não poderá visualizar sua senha depois.</span></div></div></div><div class="modal-footer"><button class="btn" type="button" data-modal-close>Cancelar</button><button class="btn primary" type="submit">Criar senha e entrar</button></div></form></div></div>`;
    bindModalClose();
    const codeInput=$('firstAccessForm')?.querySelector('[name="access_code"]');codeInput?.addEventListener('input',e=>e.target.value=normalizeCode(e.target.value));
    $('firstAccessForm')?.addEventListener('submit',submitFirstAccess);
  }

  async function submitFirstAccess(event){
    event.preventDefault();
    if(!ONLINE||!db){toast('Banco online indisponível.','error');return;}
    const button=event.submitter,fd=new FormData(event.currentTarget),username=normalizeUser(fd.get('username')),access_code=String(fd.get('access_code')||''),password=String(fd.get('password')||''),confirm=String(fd.get('confirm_password')||'');
    if(password!==confirm){toast('As senhas não conferem.','error');return;}
    setButtonLoading(button,true,'Criando senha...');
    try{
      const response=await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/first-access`,{method:'POST',headers:{'Content-Type':'application/json','apikey':CONFIG.SUPABASE_ANON_KEY},body:JSON.stringify({username,access_code,password})});
      const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Não foi possível concluir o primeiro acesso.');
      closeModal();
      if(result.access_token&&result.refresh_token){authSession={pending:true};const {data,error}=await db.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token});if(error||!data.session)throw error||new Error('Senha criada. Entre normalmente com seu usuário.');authSession=data.session;await enterOnline(data.session);toast('Senha criada com sucesso. Bem-vindo!','success');}
      else{toast('Senha criada. Entre normalmente com seu usuário e nova senha.','success');}
    }catch(error){console.error(error);toast(error?.message||'Não foi possível criar a senha.','error');}
    finally{setButtonLoading(button,false,'Criar senha e entrar');}
  }
})();

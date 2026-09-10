// CHAMADO T.I. — edição administrativa de usuário e senha de 4 dígitos
(function(){
  const baseRenderUsers = renderUsers;

  renderUsers = function(){
    baseRenderUsers();
    if(!isAdmin()) return;

    const body = $('usersTableBody');
    if(!body) return;

    body.querySelectorAll('[data-reset-access]').forEach(btn=>{
      const id = btn.dataset.resetAccess;
      const group = btn.closest('.user-action-group');
      if(group && !group.querySelector('[data-edit-user]')){
        const edit = document.createElement('button');
        edit.type='button';
        edit.className='btn compact';
        edit.textContent='Editar';
        edit.dataset.editUser=id;
        group.prepend(edit);
      }
    });

    const me = users.find(u=>u.id===currentProfile?.id);
    if(me){
      [...body.querySelectorAll('tr')].forEach(row=>{
        const userLine=[...row.querySelectorAll('.subline')].find(el=>el.textContent.trim()===`@${me.username}`);
        if(userLine){
          const last=row.lastElementChild;
          if(last && !last.querySelector('[data-edit-user]')){
            last.innerHTML='';
            const edit=document.createElement('button');
            edit.type='button';edit.className='btn compact';edit.textContent='Editar';edit.dataset.editUser=me.id;
            last.appendChild(edit);
          }
        }
      });
    }

    body.querySelectorAll('[data-edit-user]').forEach(btn=>{
      btn.addEventListener('click',()=>openEditUserModal(btn.dataset.editUser));
    });
  };

  function openEditUserModal(userId){
    if(!isAdmin()) return;
    const user=users.find(u=>u.id===userId);
    if(!user) return;

    $('modalRoot').innerHTML=`<div class="modal-backdrop" data-close-modal><div class="modal sm">
      <div class="modal-head"><div class="modal-title"><span>ADMINISTRAÇÃO</span><h3>Editar acesso</h3></div><button class="icon-btn" data-modal-close>×</button></div>
      <form id="editUserForm">
        <div class="modal-body"><div class="user-form">
          <div class="field full access-info-box"><b>${esc(user.full_name)}</b><span>${esc(user.department?.name||'Sem setor')} • ${esc(ROLE_LABEL[user.role]||user.role)}</span></div>
          <label class="field full"><span>Nome de usuário *</span><input name="username" required minlength="3" maxlength="32" autocomplete="off" value="${esc(user.username||'')}" placeholder="Ex.: saude01"><small>Este será o nome usado na tela de login.</small></label>
          <label class="field"><span>Nova senha — 4 dígitos</span><input name="password" type="password" minlength="4" maxlength="4" inputmode="numeric" pattern="[0-9]{4}" autocomplete="new-password" placeholder="0000"></label>
          <label class="field"><span>Confirmar senha</span><input name="confirm_password" type="password" minlength="4" maxlength="4" inputmode="numeric" pattern="[0-9]{4}" autocomplete="new-password" placeholder="0000"></label>
          <div class="field full access-info-box"><b>Senha numérica</b><span>A senha deve conter exatamente 4 números. Se os campos ficarem vazios, apenas o nome de usuário será alterado.</span></div>
        </div></div>
        <div class="modal-footer"><button class="btn" type="button" data-modal-close>Cancelar</button><button class="btn primary" type="submit">Salvar alterações</button></div>
      </form>
    </div></div>`;

    bindModalClose();
    const form=$('editUserForm');
    form?.querySelectorAll('input[name="password"],input[name="confirm_password"]').forEach(input=>{
      input.addEventListener('input',()=>{input.value=input.value.replace(/\D/g,'').slice(0,4);});
    });
    form?.addEventListener('submit',e=>saveUserAccess(e,user));
  }

  async function saveUserAccess(event,user){
    event.preventDefault();
    const button=event.submitter,fd=new FormData(event.currentTarget);
    const username=String(fd.get('username')||'').trim().toLowerCase();
    const password=String(fd.get('password')||'');
    const confirm=String(fd.get('confirm_password')||'');

    if(!/^[a-z0-9._-]{3,32}$/.test(username)){
      toast('Nome de usuário inválido.','error');return;
    }
    if(password && !/^\d{4}$/.test(password)){
      toast('A nova senha deve ter exatamente 4 números.','error');return;
    }
    if(password!==confirm){toast('As senhas não conferem.','error');return;}

    setButtonLoading(button,true,'Salvando...');
    try{
      if(demoMode){
        user.username=username;
        if(password){user.must_set_password=false;user.active=true;user.pin_login=true;}
        if(user.id===currentProfile?.id) currentProfile.username=username;
        renderUsers();closeModal();toast('Usuário atualizado no modo demonstração.','success');return;
      }

      const {data,error}=await db.functions.invoke('update-user',{body:{user_id:user.id,username,password}});
      if(error) throw error;
      if(data?.error) throw new Error(data.error);

      if(user.id===currentProfile?.id) currentProfile.username=username;
      await loadUsers();renderUsers();closeModal();
      toast(data?.message||'Usuário atualizado com sucesso.','success');
    }catch(error){
      console.error(error);
      toast(error?.message||'Não foi possível editar o usuário.','error');
    }finally{
      setButtonLoading(button,false,'Salvar alterações');
    }
  }
})();

// CHAMADO T.I. 3.0 — ações administrativas de usuários

const baseLoadUsers = loadUsers;
loadUsers = async function(){
  if(!db || !isAdmin()) return;
  const { data, error } = await db
    .from('profiles')
    .select('id,username,full_name,role,active,department_id,created_at,deleted_at,department:departments(id,name,acronym)')
    .is('deleted_at', null)
    .order('full_name');
  if(error) throw error;
  users = data || [];
};

renderUsers = function(){
  const body = $('usersTableBody');
  if(!body || !isAdmin()) return;

  const search = ($('userSearch')?.value || '').trim().toLowerCase();
  const role = $('userRoleFilter')?.value || '';
  const filtered = users.filter(u => {
    const hay = [u.full_name, u.username, u.department?.name, ROLE_LABEL[u.role]].join(' ').toLowerCase();
    return (!search || hay.includes(search)) && (!role || u.role === role);
  });

  body.innerHTML = filtered.length ? filtered.map(u => {
    const self = u.id === currentProfile?.id;
    const action = self
      ? '<span class="subline">Conta atual</span>'
      : `<button type="button" class="btn danger compact user-delete-btn" data-delete-user="${u.id}">Excluir</button>`;

    return `<tr>
      <td><div class="subject-title">${esc(u.full_name)}</div><div class="subline">@${esc(u.username || 'sem-usuario')}</div></td>
      <td>${esc(u.department?.name || '—')}</td>
      <td><span class="badge prio-media">${esc(ROLE_LABEL[u.role] || u.role)}</span></td>
      <td><span class="badge ${u.active ? 'status-resolvido' : 'status-cancelado'}">${u.active ? 'Ativo' : 'Inativo'}</span></td>
      <td><span class="subline">${formatDate(u.created_at)}</span></td>
      <td>${action}</td>
    </tr>`;
  }).join('') : emptyRow(6, 'Nenhum usuário encontrado');

  body.querySelectorAll('[data-delete-user]').forEach(button => {
    button.addEventListener('click', () => openDeleteUserModal(button.dataset.deleteUser));
  });
};

function ensureUserActionsHeader(){
  const table = $('usersTableBody')?.closest('table');
  const row = table?.querySelector('thead tr');
  if(row && !row.querySelector('[data-user-actions-head]')){
    const th = document.createElement('th');
    th.textContent = 'Ações';
    th.dataset.userActionsHead = '1';
    row.appendChild(th);
  }
}

function openDeleteUserModal(userId){
  if(!isAdmin()) return;
  const user = users.find(u => u.id === userId);
  if(!user) return;
  if(user.id === currentProfile?.id){
    toast('Você não pode excluir sua própria conta.','error');
    return;
  }

  $('modalRoot').innerHTML = `<div class="modal-backdrop" data-close-modal>
    <div class="modal sm">
      <div class="modal-head">
        <div class="modal-title"><span>ADMINISTRAÇÃO</span><h3>Excluir usuário</h3></div>
        <button class="icon-btn" data-modal-close>×</button>
      </div>
      <div class="modal-body">
        <div class="detail-description">
          Você está prestes a excluir o acesso de <b>${esc(user.full_name)}</b>${user.username ? ` (@${esc(user.username)})` : ''}.
          <br><br>
          Se esse usuário já possuir chamados no histórico, o sistema preservará os registros para auditoria, mas removerá o acesso e esconderá o cadastro da lista de usuários.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" type="button" data-modal-close>Cancelar</button>
        <button class="btn danger" id="confirmDeleteUserBtn" type="button">Excluir usuário</button>
      </div>
    </div>
  </div>`;

  bindModalClose();
  $('confirmDeleteUserBtn')?.addEventListener('click', e => deleteUserAccount(user, e.currentTarget));
}

async function deleteUserAccount(user, button){
  if(!isAdmin() || !user || user.id === currentProfile?.id) return;
  setButtonLoading(button, true, 'Excluindo...');

  try{
    if(demoMode){
      users = users.filter(u => u.id !== user.id);
      renderUsers();
      closeModal();
      toast('Usuário removido no modo demonstração.','success');
      return;
    }

    const { data, error } = await db.functions.invoke('delete-user', {
      body: { user_id: user.id }
    });

    if(error) throw error;
    if(data?.error) throw new Error(data.error);

    await loadUsers();
    renderUsers();
    closeModal();
    toast(data?.message || 'Usuário excluído com sucesso.','success');
  }catch(error){
    console.error(error);
    toast(error?.message || 'Não foi possível excluir o usuário.','error');
  }finally{
    setButtonLoading(button, false, 'Excluir usuário');
  }
}

window.addEventListener('DOMContentLoaded', ensureUserActionsHeader);

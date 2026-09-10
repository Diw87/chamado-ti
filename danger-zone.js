// CHAMADO T.I. — Zona de segurança / zerar dados operacionais
(function(){
  window.addEventListener('DOMContentLoaded', setupDangerZone);

  function setupDangerZone(){
    const settings = document.getElementById('settings');
    const grid = settings?.querySelector('.settings-grid');
    if(!grid || document.getElementById('systemResetCard')) return;

    const card = document.createElement('article');
    card.id = 'systemResetCard';
    card.className = 'panel span-2 admin-only';
    card.innerHTML = `
      <div class="panel-head"><div><span class="panel-kicker">ZONA DE SEGURANÇA</span><h3>Zerar dados do sistema</h3></div></div>
      <div class="panel-body">
        <div style="display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap">
          <div style="max-width:760px">
            <p class="muted-copy" style="margin:0 0 7px"><b style="color:#a12020">Ação irreversível.</b> Apaga todos os chamados, históricos, anexos e todo o controle de estoque.</p>
            <p class="muted-copy" style="margin:0">Usuários, perfis, setores e acessos são preservados. O próximo chamado volta ao início da numeração.</p>
          </div>
          <button class="btn danger" id="resetSystemBtn" type="button">Zerar chamados e estoque</button>
        </div>
      </div>`;
    grid.appendChild(card);
    document.getElementById('resetSystemBtn')?.addEventListener('click', openResetModal);
  }

  function openResetModal(){
    if(!isAdmin()) return;
    if(demoMode){
      toast('A limpeza total está disponível somente no sistema online.','error');
      return;
    }

    const root = document.getElementById('modalRoot');
    if(!root) return;
    root.innerHTML = `<div class="modal-backdrop" data-close-modal><div class="modal sm">
      <div class="modal-head"><div class="modal-title"><span>ZONA DE SEGURANÇA</span><h3>Zerar sistema</h3></div><button class="icon-btn" data-modal-close>×</button></div>
      <form id="resetSystemForm">
        <div class="modal-body">
          <div class="access-info-box" style="border-color:#efcaca;background:#fff7f7;margin-bottom:14px">
            <b style="color:#9f1d1d">Esta ação não pode ser desfeita</b>
            <span>Serão excluídos todos os chamados, histórico dos chamados, anexos, itens do estoque e movimentações. Os usuários continuarão cadastrados.</span>
          </div>
          <label class="field full"><span>Senha atual do Administrador *</span><input id="resetAdminPassword" name="password" type="password" required autocomplete="current-password" placeholder="Digite sua senha para confirmar"></label>
          <p class="muted-copy" style="font-size:11px;margin-top:10px">A exclusão só será executada se a senha da conta Administrador atualmente conectada estiver correta.</p>
        </div>
        <div class="modal-footer"><button class="btn" type="button" data-modal-close>Cancelar</button><button class="btn danger" type="submit">Zerar definitivamente</button></div>
      </form>
    </div></div>`;
    bindModalClose();
    document.getElementById('resetSystemForm')?.addEventListener('submit', resetSystem);
    setTimeout(()=>document.getElementById('resetAdminPassword')?.focus(),0);
  }

  async function resetSystem(event){
    event.preventDefault();
    if(!isAdmin() || !db || demoMode) return;

    const button = event.submitter;
    const fd = new FormData(event.currentTarget);
    const password = String(fd.get('password') || '');
    if(!password){ toast('Digite sua senha de Administrador.','error'); return; }

    setButtonLoading(button,true,'Validando e apagando...');
    try{
      const {data,error} = await db.functions.invoke('reset-system',{body:{password}});
      if(error) throw error;
      if(data?.error) throw new Error(data.error);

      tickets = [];
      if(typeof inventoryItems !== 'undefined') inventoryItems = [];
      if(typeof inventoryMovements !== 'undefined') inventoryMovements = [];

      await loadTickets();
      if(typeof loadInventoryData === 'function') await loadInventoryData();
      renderAll();
      if(typeof renderInventoryAll === 'function') renderInventoryAll();
      closeModal();

      const totalTickets = Number(data?.tickets_deleted || 0);
      const totalItems = Number(data?.inventory_items_deleted || 0);
      toast(`Sistema zerado: ${totalTickets} chamado(s) e ${totalItems} item(ns) de estoque removidos.`,'success');
    }catch(error){
      console.error(error);
      const message = error?.context?.body?.error || error?.message || 'Não foi possível zerar o sistema.';
      toast(message,'error');
    }finally{
      setButtonLoading(button,false,'Zerar definitivamente');
    }
  }
})();

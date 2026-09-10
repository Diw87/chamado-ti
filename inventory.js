// CHAMADO T.I. 3.0 — Controle de estoque (somente Administrador)

let inventoryItems = [];
let inventoryMovements = [];
const INVENTORY_DEMO_KEY = 'chamado-ti-v3-inventory-demo';
const INVENTORY_CATEGORIES = ['Cabos e conectores','Armazenamento','Memória','Fontes','Periféricos','Impressão','Rede','Ferramentas','Limpeza / manutenção','Outros'];
const INVENTORY_UNITS = ['un','cx','pct','m','rolo','kit'];

const originalGoToInventory = goTo;
goTo = function(page){
  originalGoToInventory(page);
  if(page === 'inventory'){
    setText('pageTitle','Controle de estoque');
    setText('breadcrumbPage','Estoque');
    loadInventoryData();
  }
};

const originalApplyRoleUIInventory = applyRoleUI;
applyRoleUI = function(){
  originalApplyRoleUIInventory();
  document.querySelectorAll('.inventory-admin-ui').forEach(el=>el.classList.toggle('hidden-role',!isAdmin()));
};

window.addEventListener('DOMContentLoaded', setupInventoryUI);

function setupInventoryUI(){
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'inventory.css';
  document.head.appendChild(css);

  const usersButton = document.querySelector('[data-page="users"]');
  const managementNav = usersButton?.closest('.nav-list');
  if(managementNav && !document.querySelector('[data-page="inventory"]')){
    const button = document.createElement('button');
    button.className = 'nav-item admin-only inventory-admin-ui';
    button.dataset.page = 'inventory';
    button.innerHTML = '<span class="nav-icon">▦</span><span>Estoque</span>';
    const settingsButton = managementNav.querySelector('[data-page="settings"]');
    managementNav.insertBefore(button, settingsButton || null);
    button.addEventListener('click',()=>goTo('inventory'));
  }

  const container = document.querySelector('.page-container');
  if(container && !document.getElementById('inventory')){
    const section = document.createElement('section');
    section.id = 'inventory';
    section.className = 'page admin-only inventory-admin-ui';
    section.innerHTML = `
      <div class="page-heading">
        <div><span class="eyebrow dark">ADMINISTRAÇÃO</span><h2>Controle de estoque</h2><p>Cadastre materiais de T.I., registre entradas e dê baixa com histórico completo.</p></div>
        <div class="heading-actions"><button class="btn" id="inventoryHistoryBtn" type="button">Histórico</button><button class="btn primary" id="inventoryNewItemBtn" type="button">＋ Cadastrar item</button></div>
      </div>

      <div class="metrics-grid inventory-metrics">
        <article class="metric-card"><div class="metric-head"><span>Itens cadastrados</span><i class="metric-icon blue">▦</i></div><strong id="inventoryMetricItems">0</strong><small>Materiais ativos</small></article>
        <article class="metric-card"><div class="metric-head"><span>Unidades em estoque</span><i class="metric-icon green">＋</i></div><strong id="inventoryMetricUnits">0</strong><small>Somatório dos saldos</small></article>
        <article class="metric-card"><div class="metric-head"><span>Estoque baixo</span><i class="metric-icon red">!</i></div><strong id="inventoryMetricLow">0</strong><small>No mínimo ou abaixo</small></article>
        <article class="metric-card"><div class="metric-head"><span>Movimentações</span><i class="metric-icon violet">↕</i></div><strong id="inventoryMetricMoves">0</strong><small>Entradas e baixas</small></article>
      </div>

      <article class="panel">
        <div class="panel-head"><div><span class="panel-kicker">ALMOXARIFADO T.I.</span><h3>Materiais e equipamentos</h3></div></div>
        <div class="panel-body">
          <div class="inventory-toolbar">
            <div class="search-box"><span>⌕</span><input id="inventorySearch" placeholder="Pesquisar item, categoria ou local..."></div>
            <select id="inventoryCategoryFilter"><option value="">Todas as categorias</option></select>
            <select id="inventoryStockFilter"><option value="">Todos os saldos</option><option value="low">Estoque baixo</option><option value="zero">Sem estoque</option></select>
          </div>
        </div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Item</th><th>Categoria</th><th>Local</th><th>Estoque mínimo</th><th>Saldo atual</th><th>Situação</th><th>Ações</th></tr></thead><tbody id="inventoryTableBody"></tbody></table></div>
      </article>

      <article class="panel" style="margin-top:16px">
        <div class="panel-head"><div><span class="panel-kicker">MOVIMENTAÇÃO</span><h3>Últimas entradas e baixas</h3></div><button class="text-btn" id="inventoryFullHistoryBtn" type="button">Ver histórico →</button></div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Item</th><th>Movimento</th><th>Quantidade</th><th>Saldo</th><th>Destino / observação</th><th>Responsável</th></tr></thead><tbody id="inventoryRecentMovesBody"></tbody></table></div>
      </article>`;
    const settingsPage = document.getElementById('settings');
    container.insertBefore(section, settingsPage || null);
  }

  $('inventoryNewItemBtn')?.addEventListener('click',openInventoryItemModal);
  $('inventoryHistoryBtn')?.addEventListener('click',openInventoryHistoryModal);
  $('inventoryFullHistoryBtn')?.addEventListener('click',openInventoryHistoryModal);
  $('inventorySearch')?.addEventListener('input',renderInventoryItems);
  $('inventoryCategoryFilter')?.addEventListener('change',renderInventoryItems);
  $('inventoryStockFilter')?.addEventListener('change',renderInventoryItems);
  applyRoleUI();
}

async function loadInventoryData(){
  if(!isAdmin()) return;
  try{
    if(demoMode){
      const saved = readLocal(INVENTORY_DEMO_KEY,null);
      inventoryItems = saved?.items || [];
      inventoryMovements = saved?.movements || [];
    }else{
      const [itemsResult,movesResult] = await Promise.all([
        db.from('inventory_items').select('*').eq('active',true).order('name'),
        db.from('inventory_movements').select('*,item:inventory_items(name,unit),creator:profiles!inventory_movements_created_by_fkey(full_name)').order('created_at',{ascending:false}).limit(500)
      ]);
      if(itemsResult.error) throw itemsResult.error;
      if(movesResult.error) throw movesResult.error;
      inventoryItems = itemsResult.data || [];
      inventoryMovements = movesResult.data || [];
    }
    populateInventoryCategories();
    renderInventoryAll();
  }catch(error){
    console.error(error);
    toast('Não foi possível carregar o estoque.','error');
  }
}

function persistInventoryDemo(){
  if(demoMode) localStorage.setItem(INVENTORY_DEMO_KEY,JSON.stringify({items:inventoryItems,movements:inventoryMovements}));
}

function populateInventoryCategories(){
  const select = $('inventoryCategoryFilter');
  if(!select) return;
  const current = select.value;
  const values = [...new Set([...INVENTORY_CATEGORIES,...inventoryItems.map(i=>i.category).filter(Boolean)])].sort((a,b)=>a.localeCompare(b));
  select.innerHTML = '<option value="">Todas as categorias</option>'+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  if(values.includes(current)) select.value=current;
}

function renderInventoryAll(){
  renderInventoryMetrics();
  renderInventoryItems();
  renderInventoryRecentMovements();
}

function renderInventoryMetrics(){
  const active = inventoryItems.filter(i=>i.active!==false);
  const total = active.reduce((sum,i)=>sum+Number(i.current_quantity||0),0);
  const low = active.filter(i=>Number(i.current_quantity||0)<=Number(i.minimum_quantity||0)).length;
  setText('inventoryMetricItems',active.length);
  setText('inventoryMetricUnits',total);
  setText('inventoryMetricLow',low);
  setText('inventoryMetricMoves',inventoryMovements.length);
}

function renderInventoryItems(){
  const body = $('inventoryTableBody');
  if(!body) return;
  const search = ($('inventorySearch')?.value||'').trim().toLowerCase();
  const category = $('inventoryCategoryFilter')?.value||'';
  const stock = $('inventoryStockFilter')?.value||'';
  const filtered = inventoryItems.filter(item=>{
    const q=Number(item.current_quantity||0),min=Number(item.minimum_quantity||0);
    const hay=[item.name,item.category,item.location,item.notes].join(' ').toLowerCase();
    const stockOk=!stock || (stock==='low'&&q<=min) || (stock==='zero'&&q===0);
    return (!search||hay.includes(search)) && (!category||item.category===category) && stockOk;
  });

  body.innerHTML = filtered.length ? filtered.map(item=>{
    const q=Number(item.current_quantity||0),min=Number(item.minimum_quantity||0),low=q<=min;
    return `<tr>
      <td><div class="subject-title">${esc(item.name)}</div><div class="subline">${esc(item.notes||'')}</div></td>
      <td>${esc(item.category||'Outros')}</td>
      <td>${esc(item.location||'—')}</td>
      <td>${min} <span class="stock-unit">${esc(item.unit||'un')}</span></td>
      <td><span class="stock-number ${low?'low':''}">${q}</span><span class="stock-unit">${esc(item.unit||'un')}</span></td>
      <td>${low?'<span class="stock-alert">Estoque baixo</span>':'<span class="stock-ok">Normal</span>'}</td>
      <td><div class="inventory-actions"><button class="btn compact stock-in" data-stock-in="${item.id}" type="button">Entrada</button><button class="btn compact stock-out" data-stock-out="${item.id}" type="button">Dar baixa</button></div></td>
    </tr>`;
  }).join('') : emptyRow(7,'Nenhum item encontrado');

  body.querySelectorAll('[data-stock-in]').forEach(b=>b.addEventListener('click',()=>openStockMovementModal(b.dataset.stockIn,'entrada')));
  body.querySelectorAll('[data-stock-out]').forEach(b=>b.addEventListener('click',()=>openStockMovementModal(b.dataset.stockOut,'baixa')));
}

function renderInventoryRecentMovements(){
  const body=$('inventoryRecentMovesBody');
  if(!body) return;
  const list=inventoryMovements.slice(0,10);
  body.innerHTML=list.length?list.map(m=>inventoryMovementRow(m)).join(''):emptyRow(7,'Ainda não há movimentações');
}

function inventoryMovementRow(m){
  const itemName=m.item?.name||inventoryItems.find(i=>i.id===m.item_id)?.name||'Item';
  const unit=m.item?.unit||inventoryItems.find(i=>i.id===m.item_id)?.unit||'un';
  const info=[m.destination,m.note].filter(Boolean).join(' • ')||'—';
  return `<tr><td>${formatDateTime(m.created_at)}</td><td><div class="subject-title">${esc(itemName)}</div></td><td><span class="inventory-history-type ${esc(m.movement_type)}">${m.movement_type==='entrada'?'Entrada':'Baixa'}</span></td><td>${Number(m.quantity||0)} ${esc(unit)}</td><td>${Number(m.previous_quantity||0)} → <b>${Number(m.new_quantity||0)}</b></td><td>${esc(info)}</td><td>${esc(m.creator?.full_name||currentProfile?.full_name||'—')}</td></tr>`;
}

function openInventoryItemModal(){
  if(!isAdmin()) return;
  $('modalRoot').innerHTML=`<div class="modal-backdrop" data-close-modal><div class="modal sm"><div class="modal-head"><div class="modal-title"><span>ESTOQUE</span><h3>Cadastrar item</h3></div><button class="icon-btn" data-modal-close>×</button></div><form id="inventoryItemForm"><div class="modal-body"><div class="inventory-form-grid">
    <label class="field full"><span>Nome do item *</span><input name="name" required maxlength="120" placeholder="Ex.: SSD SATA 1 TB"></label>
    <label class="field"><span>Categoria *</span><select name="category" required>${INVENTORY_CATEGORIES.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>
    <label class="field"><span>Unidade *</span><select name="unit" required>${INVENTORY_UNITS.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></label>
    <label class="field"><span>Quantidade inicial</span><input name="initial_quantity" type="number" min="0" step="1" value="0"></label>
    <label class="field"><span>Estoque mínimo</span><input name="minimum_quantity" type="number" min="0" step="1" value="0"></label>
    <label class="field full"><span>Local de armazenamento</span><input name="location" maxlength="120" placeholder="Ex.: Sala do T.I. / Armário 02"></label>
    <label class="field full"><span>Observações</span><textarea name="notes" maxlength="500" style="min-height:90px" placeholder="Marca, especificação ou observação do material"></textarea></label>
  </div></div><div class="modal-footer"><button class="btn" type="button" data-modal-close>Cancelar</button><button class="btn primary" type="submit">Cadastrar item</button></div></form></div></div>`;
  bindModalClose();
  $('inventoryItemForm')?.addEventListener('submit',createInventoryItem);
}

async function createInventoryItem(event){
  event.preventDefault();
  const button=event.submitter,fd=new FormData(event.currentTarget);
  const initial=Math.max(0,Number(fd.get('initial_quantity')||0));
  const payload={name:String(fd.get('name')||'').trim(),category:String(fd.get('category')||'Outros'),unit:String(fd.get('unit')||'un'),minimum_quantity:Math.max(0,Number(fd.get('minimum_quantity')||0)),location:String(fd.get('location')||'').trim()||null,notes:String(fd.get('notes')||'').trim()||null,created_by:currentProfile.id};
  setButtonLoading(button,true,'Cadastrando...');
  try{
    let item;
    if(demoMode){
      item={id:`demo-inv-${crypto.randomUUID()}`,...payload,current_quantity:0,active:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      inventoryItems.push(item);
      if(initial>0) createDemoMovement(item,'entrada',initial,null,'Estoque inicial');
      persistInventoryDemo();
    }else{
      const {data,error}=await db.from('inventory_items').insert(payload).select('*').single();
      if(error) throw error;
      item=data;
      if(initial>0){
        const {error:moveError}=await db.rpc('move_inventory_stock',{p_item_id:item.id,p_movement_type:'entrada',p_quantity:initial,p_destination:null,p_note:'Estoque inicial'});
        if(moveError) throw moveError;
      }
      await loadInventoryData();
    }
    closeModal();
    renderInventoryAll();
    toast('Item cadastrado no estoque.','success');
  }catch(error){console.error(error);toast(error.message||'Não foi possível cadastrar o item.','error');}
  finally{setButtonLoading(button,false,'Cadastrar item');}
}

function openStockMovementModal(itemId,type){
  if(!isAdmin()) return;
  const item=inventoryItems.find(i=>i.id===itemId); if(!item)return;
  const isOut=type==='baixa';
  $('modalRoot').innerHTML=`<div class="modal-backdrop" data-close-modal><div class="modal sm"><div class="modal-head"><div class="modal-title"><span>ESTOQUE</span><h3>${isOut?'Dar baixa':'Registrar entrada'}</h3></div><button class="icon-btn" data-modal-close>×</button></div><form id="inventoryMoveForm"><div class="modal-body"><div class="inventory-note"><b>${esc(item.name)}</b><br>Saldo atual: <b>${Number(item.current_quantity||0)} ${esc(item.unit||'un')}</b></div><div class="inventory-form-grid" style="margin-top:14px">
    <label class="field"><span>Quantidade *</span><input name="quantity" type="number" min="1" step="1" required autofocus></label>
    <label class="field"><span>${isOut?'Destino / setor':'Origem / fornecedor'}</span><input name="destination" maxlength="160" placeholder="${isOut?'Ex.: Secretaria de Saúde':'Ex.: Compra / fornecedor'}"></label>
    <label class="field full"><span>Observação</span><textarea name="note" maxlength="500" style="min-height:90px" placeholder="Motivo, equipamento, patrimônio ou observação"></textarea></label>
  </div></div><div class="modal-footer"><button class="btn" type="button" data-modal-close>Cancelar</button><button class="btn ${isOut?'danger':'primary'}" type="submit">${isOut?'Confirmar baixa':'Confirmar entrada'}</button></div></form></div></div>`;
  bindModalClose();
  $('inventoryMoveForm')?.addEventListener('submit',e=>saveStockMovement(e,item,type));
}

async function saveStockMovement(event,item,type){
  event.preventDefault();
  const button=event.submitter,fd=new FormData(event.currentTarget),quantity=Number(fd.get('quantity')||0),destination=String(fd.get('destination')||'').trim()||null,note=String(fd.get('note')||'').trim()||null;
  if(quantity<=0)return;
  if(type==='baixa'&&quantity>Number(item.current_quantity||0)){toast('A quantidade da baixa é maior que o saldo disponível.','error');return;}
  setButtonLoading(button,true,type==='baixa'?'Dando baixa...':'Registrando...');
  try{
    if(demoMode){createDemoMovement(item,type,quantity,destination,note);persistInventoryDemo();}
    else{
      const {error}=await db.rpc('move_inventory_stock',{p_item_id:item.id,p_movement_type:type,p_quantity:quantity,p_destination:destination,p_note:note});
      if(error)throw error;
      await loadInventoryData();
    }
    closeModal();renderInventoryAll();toast(type==='baixa'?'Baixa registrada com sucesso.':'Entrada registrada com sucesso.','success');
  }catch(error){console.error(error);toast(error.message||'Não foi possível movimentar o estoque.','error');}
  finally{setButtonLoading(button,false,type==='baixa'?'Confirmar baixa':'Confirmar entrada');}
}

function createDemoMovement(item,type,quantity,destination,note){
  const previous=Number(item.current_quantity||0),next=type==='entrada'?previous+quantity:previous-quantity;
  if(next<0)throw new Error('Estoque insuficiente.');
  item.current_quantity=next;item.updated_at=new Date().toISOString();
  inventoryMovements.unshift({id:`demo-move-${crypto.randomUUID()}`,item_id:item.id,item:{name:item.name,unit:item.unit},movement_type:type,quantity,previous_quantity:previous,new_quantity:next,destination,note,created_by:currentProfile.id,creator:{full_name:currentProfile.full_name},created_at:new Date().toISOString()});
}

function openInventoryHistoryModal(){
  if(!isAdmin())return;
  $('modalRoot').innerHTML=`<div class="modal-backdrop" data-close-modal><div class="modal"><div class="modal-head"><div class="modal-title"><span>ESTOQUE</span><h3>Histórico de movimentações</h3></div><button class="icon-btn" data-modal-close>×</button></div><div class="modal-body"><div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Item</th><th>Movimento</th><th>Quantidade</th><th>Saldo</th><th>Destino / observação</th><th>Responsável</th></tr></thead><tbody>${inventoryMovements.length?inventoryMovements.map(m=>inventoryMovementRow(m)).join(''):emptyRow(7,'Ainda não há movimentações')}</tbody></table></div></div></div></div>`;
  bindModalClose();
}

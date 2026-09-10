const STORAGE='chamado-ti-v2';
const LEGACY_STORAGE='chamado-ti-v1';
const LEGACY_ACTIVITY='chamado-ti-activity-v1';
const SLA_HOURS={Crítica:4,Alta:8,Média:24,Baixa:48};
const departments=['Gabinete','Administração','Saúde','Educação','Assistência Social','Finanças','Agricultura','Cultura','Infraestrutura','RH','Licitação','Tributos','Contabilidade','Comunicação','Outros'];
const categories=['Computador / Notebook','Impressora','Internet / Rede','Sistema / Software','E-mail / Acesso','Câmeras / CFTV','Telefonia','Instalação','Manutenção preventiva','Periféricos','Servidor','Outros'];
let tickets=[];
let activities=[];

function load(){
  const current=readJson(STORAGE,[]);
  if(current.length){tickets=current.map(normalizeTicket);activities=buildActivitiesFromTickets();}
  else{
    const legacy=readJson(LEGACY_STORAGE,[]);
    if(legacy.length){
      tickets=legacy.map(normalizeTicket);
      activities=readJson(LEGACY_ACTIVITY,[]);
      persist();
    }else seed(false);
  }
  populateDepartments();
  renderAll();
  goTo('dashboard',false);
}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}}
function normalizeTicket(t){
  const created=t.created||new Date().toISOString();
  const history=Array.isArray(t.history)&&t.history.length?t.history:[{type:'created',text:'Chamado registrado na Central de Serviços',time:created,author:t.requester||'Solicitante'}];
  return {...t,requester:t.requester||'Não informado',dept:t.dept||'Outros',category:t.category||'Outros',priority:t.priority||'Média',status:t.status||'Aberto',tech:t.tech||'Dill',location:t.location||'',equipment:t.equipment||'',asset:t.asset||'',contact:t.contact||'',description:t.description||'',resolution:t.resolution||'',created,updated:t.updated||created,history,notes:Array.isArray(t.notes)?t.notes:[]};
}
function persist(){localStorage.setItem(STORAGE,JSON.stringify(tickets));}
function save(message){persist();if(message)toast(message);renderAll();}
function buildActivitiesFromTickets(){
  return tickets.flatMap(t=>(t.history||[]).map(h=>({text:`${t.id} • ${h.text}`,time:h.time}))).sort((a,b)=>new Date(b.time)-new Date(a.time));
}
function seed(force=true){
  if(!force && tickets.length)return;
  const now=new Date();
  const ago=(hours)=>{const d=new Date(now);d.setHours(d.getHours()-hours);return d.toISOString();};
  const history=(created,events=[])=>[{type:'created',text:'Chamado registrado na Central de Serviços',time:created,author:'Solicitante'},...events];
  const a=ago(70),b=ago(7),c=ago(3),d=ago(19),e=ago(1.5),f=ago(30),g=ago(10);
  tickets=[
    {id:'CH-2026-0001',subject:'Computador não liga na recepção',requester:'Recepção UBS Centro',contact:'',dept:'Saúde',category:'Computador / Notebook',priority:'Alta',status:'Resolvido',tech:'Dill',location:'UBS Centro • Recepção',equipment:'Desktop recepção',asset:'',description:'O computador não inicia e não apresenta vídeo. Foram testados cabo de energia e tomada.',resolution:'Fonte de alimentação substituída e equipamento testado com sucesso.',created:a,updated:ago(58),history:history(a,[{type:'status',text:'Atendimento iniciado',time:ago(66),author:'Dill'},{type:'resolution',text:'Fonte substituída e chamado concluído',time:ago(58),author:'Dill'}]),notes:[]},
    {id:'CH-2026-0002',subject:'Impressora aparece offline',requester:'Secretaria de Educação',contact:'',dept:'Educação',category:'Impressora',priority:'Média',status:'Em atendimento',tech:'Dill',location:'Secretaria de Educação',equipment:'Impressora Epson',asset:'',description:'Impressora aparece offline nos computadores do setor e não recebe trabalhos da fila.',resolution:'',created:b,updated:ago(2),history:history(b,[{type:'status',text:'Atendimento iniciado',time:ago(5),author:'Dill'},{type:'note',text:'Em análise de conectividade e fila de impressão',time:ago(2),author:'Dill'}]),notes:[{text:'Verificar IP fixo e reinstalar a fila nos computadores afetados.',time:ago(2),author:'Dill'}]},
    {id:'CH-2026-0003',subject:'Internet instável durante expediente',requester:'Recepção CRAS',contact:'',dept:'Assistência Social',category:'Internet / Rede',priority:'Alta',status:'Aberto',tech:'Dill',location:'CRAS',equipment:'Switch / rede local',asset:'',description:'Quedas frequentes de internet durante o expediente, afetando os computadores da recepção.',resolution:'',created:c,updated:c,history:history(c),notes:[]},
    {id:'CH-2026-0004',subject:'Instalação de certificado digital',requester:'Setor de Compras',contact:'',dept:'Administração',category:'Sistema / Software',priority:'Baixa',status:'Aguardando',tech:'Dill',location:'Prefeitura • Compras',equipment:'PC Compras',asset:'',description:'Instalar e validar certificado digital no computador principal do setor.',resolution:'',created:d,updated:ago(8),history:history(d,[{type:'status',text:'Aguardando disponibilidade do certificado',time:ago(8),author:'Dill'}]),notes:[]},
    {id:'CH-2026-0005',subject:'Servidor sem acesso à rede interna',requester:'Setor de T.I.',contact:'',dept:'Administração',category:'Servidor',priority:'Crítica',status:'Em atendimento',tech:'Dill',location:'CPD',equipment:'Servidor principal',asset:'',description:'Servidor perdeu conectividade com a rede interna. Estações dependentes não conseguem acessar o recurso compartilhado.',resolution:'',created:e,updated:ago(.5),history:history(e,[{type:'status',text:'Atendimento crítico iniciado',time:ago(1.2),author:'Dill'}]),notes:[]},
    {id:'CH-2026-0006',subject:'Configurar novo ponto de rede',requester:'RH',contact:'',dept:'RH',category:'Internet / Rede',priority:'Média',status:'Resolvido',tech:'Dill',location:'Prefeitura • RH',equipment:'Ponto de rede',asset:'',description:'Ativar ponto de rede para novo computador instalado no setor.',resolution:'Ponto ativado, testado e identificado.',created:f,updated:ago(26),history:history(f,[{type:'resolution',text:'Ponto de rede ativado e testado',time:ago(26),author:'Dill'}]),notes:[]},
    {id:'CH-2026-0007',subject:'Sistema não abre em uma estação',requester:'Finanças',contact:'',dept:'Finanças',category:'Sistema / Software',priority:'Média',status:'Aberto',tech:'Dill',location:'Prefeitura • Finanças',equipment:'Estação 03',asset:'',description:'Aplicativo do setor fecha logo após iniciar em uma das estações.',resolution:'',created:g,updated:g,history:history(g),notes:[]}
  ].map(normalizeTicket);
  persist();renderAll();if(force)toast('Dados de demonstração restaurados.');
}
function clearAll(){if(confirm('Deseja realmente apagar todos os chamados salvos neste navegador?')){tickets=[];persist();renderAll();toast('Todos os chamados foram removidos.');}}

function populateDepartments(){
  const el=document.getElementById('filterDept');
  if(el)el.innerHTML='<option value="">Todos os setores</option>'+departments.map(x=>`<option>${escapeHtml(x)}</option>`).join('');
}
function formatDate(iso,withTime=true){
  if(!iso)return '—';
  const opt=withTime?{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'2-digit',year:'numeric'};
  return new Date(iso).toLocaleString('pt-BR',opt);
}
function relativeTime(iso){
  const ms=Date.now()-new Date(iso).getTime();const mins=Math.max(0,Math.floor(ms/60000));
  if(mins<1)return 'agora';if(mins<60)return `${mins} min`;const h=Math.floor(mins/60);if(h<24)return `${h}h`;const d=Math.floor(h/24);return `${d}d`;
}
function hoursBetween(a,b){return Math.max(0,(new Date(b)-new Date(a))/3600000);}
function statusClass(x){return {'Aberto':'status-aberto','Em atendimento':'status-atendimento','Aguardando':'status-aguardando','Resolvido':'status-resolvido'}[x]||'';}
function priorityClass(x){return {'Baixa':'prio-baixa','Média':'prio-media','Alta':'prio-alta','Crítica':'prio-critica'}[x]||'';}
function badge(x,type){return `<span class="badge ${type==='status'?statusClass(x):priorityClass(x)}">${escapeHtml(x)}</span>`;}
function slaInfo(t){
  const limit=SLA_HOURS[t.priority]||24;
  const end=t.status==='Resolvido'?new Date(t.updated):new Date();
  const elapsed=hoursBetween(t.created,end);
  const remaining=limit-elapsed;
  if(t.status==='Resolvido')return {state:elapsed<=limit?'ok':'late',class:'sla-done',label:elapsed<=limit?'Concluído no SLA':'Concluído fora',elapsed,limit};
  if(remaining<0)return {state:'late',class:'sla-late',label:`Atrasado ${humanHours(Math.abs(remaining))}`,elapsed,limit};
  if(elapsed/limit>=.75)return {state:'risk',class:'sla-risk',label:`Restam ${humanHours(remaining)}`,elapsed,limit};
  return {state:'ok',class:'sla-ok',label:`Restam ${humanHours(remaining)}`,elapsed,limit};
}
function humanHours(h){if(h<1)return `${Math.max(1,Math.round(h*60))}min`;if(h<24)return `${Math.round(h)}h`;return `${Math.round(h/24)}d`;}
function slaHtml(t){const s=slaInfo(t);return `<span class="sla ${s.class}">${s.label}</span>`;}
function isToday(iso){const d=new Date(iso),n=new Date();return d.toDateString()===n.toDateString();}

function renderAll(){renderStats();renderPriorityQueue();renderTickets();renderActivity();renderReports();}
function renderStats(){
  const open=tickets.filter(t=>t.status==='Aberto').length;
  const doing=tickets.filter(t=>t.status==='Em atendimento').length;
  const active=tickets.filter(t=>t.status!=='Resolvido');
  const risks=active.filter(t=>['risk','late'].includes(slaInfo(t).state)).length;
  const resolved=tickets.filter(t=>t.status==='Resolvido').length;
  const critical=active.filter(t=>t.priority==='Crítica').length;
  const slaOk=tickets.length?tickets.filter(t=>slaInfo(t).state!=='late').length:0;
  const slaPct=tickets.length?Math.round(slaOk/tickets.length*100):100;
  const resPct=tickets.length?Math.round(resolved/tickets.length*100):0;
  const avg=active.length?active.reduce((s,t)=>s+hoursBetween(t.created,new Date()),0)/active.length:0;
  setText('statOpen',open);setText('statDoing',doing);setText('statSlaRisk',risks);setText('statDone',resolved);setText('statCritical',critical);setText('openToday',`${tickets.filter(t=>t.status==='Aberto'&&isToday(t.created)).length} hoje`);setText('resolutionRate',`${resPct}%`);setText('scoreValue',`${slaPct}%`);setText('avgOpenTime',humanHours(avg));setText('navOpenCount',active.length);
  const ring=document.getElementById('scoreRing');if(ring)ring.style.setProperty('--score',`${slaPct*3.6}deg`);
}
function setText(id,value){const e=document.getElementById(id);if(e)e.textContent=value;}
function priorityScore(t){const p={Crítica:4,Alta:3,Média:2,Baixa:1}[t.priority]||0;const s=slaInfo(t).state==='late'?3:slaInfo(t).state==='risk'?2:0;return p*10+s;}
function renderPriorityQueue(){
  const body=document.getElementById('recentBody');if(!body)return;
  const data=tickets.filter(t=>t.status!=='Resolvido').sort((a,b)=>priorityScore(b)-priorityScore(a)||new Date(a.created)-new Date(b.created)).slice(0,7);
  body.innerHTML=data.length?data.map(t=>rowHtml(t,true)).join(''):'<tr><td colspan="6" class="empty">Nenhum chamado pendente.</td></tr>';
}
function rowHtml(t,compact=false){
  const s=slaInfo(t);const danger=s.state==='late'||(t.priority==='Crítica'&&t.status!=='Resolvido');
  if(compact)return `<tr class="${danger?'danger-row':''}" onclick="openDetails('${t.id}')"><td><span class="ticket-code">${t.id}</span></td><td><div class="ticket-subject">${escapeHtml(t.subject)}</div><div class="ticket-meta">${escapeHtml(t.category)}</div></td><td>${escapeHtml(t.dept)}</td><td>${badge(t.priority,'priority')}</td><td>${slaHtml(t)}</td><td>${badge(t.status,'status')}</td></tr>`;
  return `<tr class="${danger?'danger-row':''}" onclick="openDetails('${t.id}')"><td><span class="ticket-code">${t.id}</span></td><td><div class="ticket-subject">${escapeHtml(t.subject)}</div><div class="ticket-meta">${escapeHtml(t.category)} • ${escapeHtml(t.location||'Local não informado')}</div></td><td>${escapeHtml(t.requester)}</td><td>${escapeHtml(t.dept)}</td><td>${badge(t.priority,'priority')}</td><td>${slaHtml(t)}</td><td>${badge(t.status,'status')}</td><td><span class="ticket-meta">${relativeTime(t.updated)}</span></td></tr>`;
}
function getFilteredTickets(){
  const q=(document.getElementById('search')?.value||'').trim().toLowerCase();
  const status=document.getElementById('filterStatus')?.value||'';
  const priority=document.getElementById('filterPriority')?.value||'';
  const dept=document.getElementById('filterDept')?.value||'';
  return tickets.filter(t=>{
    const text=[t.id,t.subject,t.requester,t.dept,t.category,t.location,t.equipment,t.asset,t.contact].join(' ').toLowerCase();
    return(!q||text.includes(q))&&(!status||t.status===status)&&(!priority||t.priority===priority)&&(!dept||t.dept===dept);
  }).sort((a,b)=>{
    if(a.status==='Resolvido'&&b.status!=='Resolvido')return 1;if(a.status!=='Resolvido'&&b.status==='Resolvido')return -1;
    return priorityScore(b)-priorityScore(a)||new Date(b.updated)-new Date(a.updated);
  });
}
function renderTickets(){
  const body=document.getElementById('ticketsBody');if(!body)return;
  const data=getFilteredTickets();
  body.innerHTML=data.length?data.map(t=>rowHtml(t,false)).join(''):'<tr><td colspan="8" class="empty">Nenhum chamado encontrado com esses filtros.</td></tr>';
  setText('countTickets',`${data.length} ${data.length===1?'registro':'registros'}`);
}
function clearFilters(){['search','filterStatus','filterPriority','filterDept'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});renderTickets();}
function setQuickFilter(status){const e=document.getElementById('filterStatus');if(e){e.value=status;renderTickets();}}
function renderActivity(){
  const el=document.getElementById('activityList');if(!el)return;
  activities=buildActivitiesFromTickets();
  const data=activities.slice(0,5);
  el.innerHTML=data.length?data.map(a=>`<div class="activity"><span class="activity-dot"></span><div><strong>${escapeHtml(a.text)}</strong><p>${formatDate(a.time)}</p></div></div>`).join(''):'<div class="empty">Nenhuma atividade registrada.</div>';
}

function formHtml(id='ticketForm'){
  return `<form id="${id}" onsubmit="createTicket(event,'${id}')">
    <div class="form-grid">
      <div class="field"><label>Solicitante <span>*</span></label><input name="requester" required placeholder="Nome do servidor ou responsável"></div>
      <div class="field"><label>Contato / Ramal</label><input name="contact" placeholder="Telefone, ramal ou e-mail"></div>
      <div class="field"><label>Secretaria / Setor <span>*</span></label><select name="dept" required><option value="">Selecione o setor</option>${departments.map(x=>`<option>${escapeHtml(x)}</option>`).join('')}</select></div>
      <div class="field"><label>Local de atendimento</label><input name="location" placeholder="Prédio, unidade, sala..."></div>
      <div class="field full"><label>Assunto do chamado <span>*</span></label><input name="subject" required maxlength="120" placeholder="Resumo objetivo do problema"></div>
      <div class="field"><label>Categoria <span>*</span></label><select name="category" required><option value="">Selecione a categoria</option>${categories.map(x=>`<option>${escapeHtml(x)}</option>`).join('')}</select></div>
      <div class="field"><label>Prioridade <span>*</span></label><select name="priority" required><option>Média</option><option>Baixa</option><option>Alta</option><option>Crítica</option></select><div class="field-hint">O prazo de SLA é calculado automaticamente.</div></div>
      <div class="field"><label>Equipamento</label><input name="equipment" placeholder="PC, impressora, switch, servidor..."></div>
      <div class="field"><label>Patrimônio / Identificação</label><input name="asset" placeholder="Número do patrimônio ou identificação"></div>
      <div class="field full"><label>Descrição detalhada <span>*</span></label><textarea name="description" required placeholder="Descreva o problema, quando começou, mensagens de erro e o que já foi tentado."></textarea></div>
    </div>
    <div class="form-footer"><button type="reset" class="btn btn-secondary">Limpar</button><button class="btn btn-primary">＋ Registrar chamado</button></div>
  </form>`;
}
function openNewTicket(){
  document.getElementById('modalRoot').innerHTML=`<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-header"><div><div class="modal-title-line"><h3>Novo chamado de T.I.</h3><span class="badge status-aberto">NOVO</span></div><div class="modal-sub">Central de Serviços • Registro de solicitação</div></div><button class="close-btn" onclick="closeModal()">×</button></div><div class="modal-body">${formHtml('modalTicketForm')}</div></div></div>`;
}
function closeModal(){document.getElementById('modalRoot').innerHTML='';}
function nextTicketId(){
  const y=new Date().getFullYear();
  const nums=tickets.filter(t=>t.id.startsWith(`CH-${y}-`)).map(t=>parseInt(t.id.split('-').pop())||0);
  return `CH-${y}-${String(Math.max(0,...nums)+1).padStart(4,'0')}`;
}
function createTicket(e,id){
  e.preventDefault();const f=new FormData(document.getElementById(id));const now=new Date().toISOString();const ticketId=nextTicketId();
  const t=normalizeTicket({id:ticketId,requester:f.get('requester').trim(),contact:f.get('contact').trim(),dept:f.get('dept'),subject:f.get('subject').trim(),category:f.get('category'),priority:f.get('priority'),location:f.get('location').trim(),equipment:f.get('equipment').trim(),asset:f.get('asset').trim(),description:f.get('description').trim(),status:'Aberto',tech:'Dill',created:now,updated:now,history:[{type:'created',text:'Chamado registrado na Central de Serviços',time:now,author:f.get('requester').trim()}],notes:[]});
  tickets.unshift(t);persist();e.target.reset();closeModal();renderAll();toast(`${ticketId} registrado com sucesso.`);goTo('chamados');
}

function openDetails(id){
  const t=tickets.find(x=>x.id===id);if(!t)return;const sla=slaInfo(t);
  const timeline=[...(t.history||[])].sort((a,b)=>new Date(b.time)-new Date(a.time));
  document.getElementById('modalRoot').innerHTML=`<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal modal-wide">
    <div class="modal-header"><div><div class="modal-title-line"><span class="ticket-code">${t.id}</span><h3>${escapeHtml(t.subject)}</h3></div><div class="modal-sub">Aberto em ${formatDate(t.created)} • Atualizado ${relativeTime(t.updated)} atrás</div></div><button class="close-btn" onclick="closeModal()">×</button></div>
    <div class="modal-body"><div class="ticket-detail-grid">
      <div class="detail-main">
        <div class="detail-section"><div class="detail-section-title">Descrição da solicitação</div><div class="detail-description">${escapeHtml(t.description||'Sem descrição.')}</div></div>
        ${t.resolution?`<div class="detail-section"><div class="detail-section-title">Solução registrada</div><div class="detail-description">${escapeHtml(t.resolution)}</div></div>`:''}
        <div class="detail-section"><div class="detail-section-title">Informações do chamado</div><div class="meta-grid">
          <div class="meta-item"><span>Solicitante</span><strong>${escapeHtml(t.requester)}</strong></div><div class="meta-item"><span>Contato</span><strong>${escapeHtml(t.contact||'—')}</strong></div>
          <div class="meta-item"><span>Secretaria / Setor</span><strong>${escapeHtml(t.dept)}</strong></div><div class="meta-item"><span>Local</span><strong>${escapeHtml(t.location||'—')}</strong></div>
          <div class="meta-item"><span>Categoria</span><strong>${escapeHtml(t.category)}</strong></div><div class="meta-item"><span>Equipamento</span><strong>${escapeHtml(t.equipment||'—')}</strong></div>
          <div class="meta-item"><span>Patrimônio</span><strong>${escapeHtml(t.asset||'—')}</strong></div><div class="meta-item"><span>Técnico responsável</span><strong>${escapeHtml(t.tech||'Dill')}</strong></div>
        </div></div>
        <div class="detail-section"><div class="detail-section-title">Histórico do atendimento</div><div class="timeline">${timeline.length?timeline.map(h=>`<div class="timeline-item"><strong>${escapeHtml(h.text)}</strong><p>${escapeHtml(h.author||'Sistema')} • ${formatDate(h.time)}</p></div>`).join(''):'<div class="empty">Sem histórico.</div>'}</div></div>
      </div>
      <aside class="detail-side">
        <div class="control-card"><label>Status</label><select onchange="updateTicketField('${t.id}','status',this.value)"><option ${sel(t.status,'Aberto')}>Aberto</option><option ${sel(t.status,'Em atendimento')}>Em atendimento</option><option ${sel(t.status,'Aguardando')}>Aguardando</option><option ${sel(t.status,'Resolvido')}>Resolvido</option></select></div>
        <div class="control-card"><label>Prioridade</label><select onchange="updateTicketField('${t.id}','priority',this.value)"><option ${sel(t.priority,'Baixa')}>Baixa</option><option ${sel(t.priority,'Média')}>Média</option><option ${sel(t.priority,'Alta')}>Alta</option><option ${sel(t.priority,'Crítica')}>Crítica</option></select></div>
        <div class="control-card"><label>SLA do chamado</label><div style="margin:4px 0 7px">${slaHtml(t)}</div><div class="ticket-meta">Prazo de referência: ${sla.limit}h</div></div>
        <div class="control-card"><label>Solução / encerramento</label><textarea id="resolutionText" placeholder="Descreva a solução aplicada...">${escapeHtml(t.resolution||'')}</textarea><button class="btn btn-primary" style="width:100%;margin-top:8px" onclick="saveResolution('${t.id}')">Salvar solução</button></div>
        <div class="control-card"><label>Adicionar nota técnica</label><div class="note-form"><textarea id="noteText" placeholder="Diagnóstico, teste realizado, pendência..."></textarea><button class="btn btn-secondary" onclick="addNote('${t.id}')">＋ Adicionar nota</button></div></div>
      </aside>
    </div></div>
  </div></div>`;
}
function sel(a,b){return a===b?'selected':'';}
function updateTicketField(id,field,value){
  const t=tickets.find(x=>x.id===id);if(!t)return;const old=t[field];if(old===value)return;const now=new Date().toISOString();t[field]=value;t.updated=now;
  const label=field==='status'?'Status':'Prioridade';t.history.push({type:field,text:`${label} alterado de ${old} para ${value}`,time:now,author:'Dill'});
  persist();renderAll();toast(`${label} atualizado.`);openDetails(id);
}
function addNote(id){
  const text=document.getElementById('noteText')?.value.trim();if(!text){toast('Digite uma nota antes de adicionar.');return;}
  const t=tickets.find(x=>x.id===id);if(!t)return;const now=new Date().toISOString();t.notes.push({text,time:now,author:'Dill'});t.history.push({type:'note',text:`Nota técnica: ${text}`,time:now,author:'Dill'});t.updated=now;persist();renderAll();toast('Nota técnica adicionada.');openDetails(id);
}
function saveResolution(id){
  const text=document.getElementById('resolutionText')?.value.trim()||'';const t=tickets.find(x=>x.id===id);if(!t)return;
  const now=new Date().toISOString();const changed=text!==t.resolution;t.resolution=text;t.updated=now;
  if(changed)t.history.push({type:'resolution',text:text?'Solução do atendimento registrada':'Solução do atendimento removida',time:now,author:'Dill'});
  if(text&&t.status!=='Resolvido'){const old=t.status;t.status='Resolvido';t.history.push({type:'status',text:`Status alterado de ${old} para Resolvido`,time:now,author:'Dill'});}
  persist();renderAll();toast(text?'Solução salva e chamado concluído.':'Alteração salva.');openDetails(id);
}

function groupCount(key){const map={};tickets.forEach(t=>map[t[key]]=(map[t[key]]||0)+1);return Object.entries(map).sort((a,b)=>b[1]-a[1]);}
function drawBars(id,data){const el=document.getElementById(id);if(!el)return;const max=Math.max(1,...data.map(x=>x[1]));el.innerHTML=data.length?data.map(([label,value])=>`<div class="bar-row"><span class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(value/max*100)}%"></div></div><span class="bar-value">${value}</span></div>`).join(''):'<div class="empty">Sem dados suficientes.</div>';}
function renderReports(){
  drawBars('deptReport',groupCount('dept').slice(0,10));drawBars('catReport',groupCount('category').slice(0,10));
  const resolved=tickets.filter(t=>t.status==='Resolvido').length;const slaOk=tickets.length?tickets.filter(t=>slaInfo(t).state!=='late').length:0;const slaPct=tickets.length?Math.round(slaOk/tickets.length*100):100;const depts=new Set(tickets.map(t=>t.dept)).size;
  setText('reportTotal',tickets.length);setText('reportResolved',resolved);setText('reportSla',`${slaPct}%`);setText('reportDepts',depts);
  const el=document.getElementById('statusReport');if(el){const sts=['Aberto','Em atendimento','Aguardando','Resolvido'];el.innerHTML=sts.map(s=>`<div class="status-mini"><span>${s}</span><strong>${tickets.filter(t=>t.status===s).length}</strong></div>`).join('');}
}

function goTo(page,scroll=true){
  document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));const target=document.getElementById(page);if(target)target.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===page));
  const titles={dashboard:'Painel de atendimento',chamados:'Gestão de chamados',novo:'Abrir novo chamado',relatorios:'Relatórios e indicadores',config:'Configurações'};
  const crumbs={dashboard:'PAINEL',chamados:'CHAMADOS',novo:'NOVO CHAMADO',relatorios:'RELATÓRIOS',config:'CONFIGURAÇÕES'};
  setText('pageTitle',titles[page]||'CHAMADO T.I.');setText('breadcrumbCurrent',crumbs[page]||'PAINEL');
  if(page==='novo'){const el=document.getElementById('inlineForm');if(el)el.innerHTML=formHtml('inlineTicketForm');}
  closeSidebar();if(scroll)window.scrollTo({top:0,behavior:'smooth'});
}
function openSidebar(){document.getElementById('sidebar')?.classList.add('open');document.getElementById('mobileOverlay')?.classList.add('show');}
function closeSidebar(){document.getElementById('sidebar')?.classList.remove('open');document.getElementById('mobileOverlay')?.classList.remove('show');}
function exportCSV(){
  const cols=['Número','Assunto','Solicitante','Contato','Setor','Categoria','Prioridade','Status','SLA','Técnico','Local','Equipamento','Patrimônio','Descrição','Solução','Criado','Atualizado'];
  const csvValue=v=>`"${String(v??'').replaceAll('"','""')}"`;
  const rows=tickets.map(t=>[t.id,t.subject,t.requester,t.contact,t.dept,t.category,t.priority,t.status,slaInfo(t).label,t.tech,t.location,t.equipment,t.asset,t.description,t.resolution,formatDate(t.created),formatDate(t.updated)]);
  const blob=new Blob(['\ufeff'+[cols,...rows].map(r=>r.map(csvValue).join(';')).join('\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`chamados-ti-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function toast(message){const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.classList.remove('hidden');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.classList.add('hidden'),2800);}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}

document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>goTo(btn.dataset.page)));
document.getElementById('menuBtn')?.addEventListener('click',openSidebar);
load();
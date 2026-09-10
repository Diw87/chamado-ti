const STORAGE='chamado-ti-v1';
const ACTIVITY='chamado-ti-activity-v1';
const depts=['Gabinete','Administração','Saúde','Educação','Assistência Social','Finanças','Agricultura','Cultura','Infraestrutura','RH','Licitação','Outros'];
const categories=['Computador / Notebook','Impressora','Internet / Rede','Sistema / Software','E-mail / Acesso','Câmeras','Instalação','Manutenção preventiva','Outros'];
let tickets=[];
let activities=[];

function load(){
  tickets=JSON.parse(localStorage.getItem(STORAGE)||'[]');
  activities=JSON.parse(localStorage.getItem(ACTIVITY)||'[]');
  if(!tickets.length) seed(false); else renderAll();
  populateDepts();
}
function save(){
  localStorage.setItem(STORAGE,JSON.stringify(tickets));
  localStorage.setItem(ACTIVITY,JSON.stringify(activities));
  renderAll();
}
function seed(force){
  if(!force && tickets.length) return;
  const now=new Date();
  const ago=(days,h=9)=>{const d=new Date(now);d.setDate(d.getDate()-days);d.setHours(h,15,0,0);return d.toISOString();};
  tickets=[
    {id:'CH-2026-0001',subject:'Computador não liga',requester:'UBS Centro',dept:'Saúde',category:'Computador / Notebook',priority:'Alta',status:'Resolvido',tech:'Dill',location:'UBS Centro',equipment:'Desktop recepção',description:'Equipamento não inicia e não apresenta vídeo.',created:ago(8),updated:ago(7)},
    {id:'CH-2026-0002',subject:'Impressora sem imprimir',requester:'Secretaria de Educação',dept:'Educação',category:'Impressora',priority:'Média',status:'Em atendimento',tech:'Dill',location:'Secretaria de Educação',equipment:'Impressora Epson',description:'Impressora aparece offline nos computadores do setor.',created:ago(2),updated:ago(0)},
    {id:'CH-2026-0003',subject:'Internet instável',requester:'Recepção',dept:'Assistência Social',category:'Internet / Rede',priority:'Alta',status:'Aberto',tech:'Dill',location:'CRAS',equipment:'Rede local',description:'Quedas frequentes de internet durante o expediente.',created:ago(1),updated:ago(1)},
    {id:'CH-2026-0004',subject:'Instalação de certificado',requester:'Setor de Compras',dept:'Administração',category:'Sistema / Software',priority:'Baixa',status:'Aguardando',tech:'Dill',location:'Prefeitura',equipment:'PC Compras',description:'Instalar e validar certificado digital no computador do setor.',created:ago(0,8),updated:ago(0,8)},
    {id:'CH-2026-0005',subject:'Servidor sem acesso à rede',requester:'TI',dept:'Administração',category:'Internet / Rede',priority:'Crítica',status:'Em atendimento',tech:'Dill',location:'CPD',equipment:'Servidor principal',description:'Servidor perdeu conectividade com a rede interna.',created:ago(0,9),updated:ago(0,9)}
  ];
  activities=[
    {text:'CH-2026-0005 entrou em atendimento',time:new Date().toISOString()},
    {text:'CH-2026-0002 teve o status atualizado',time:ago(0,8)},
    {text:'CH-2026-0001 foi resolvido',time:ago(1,16)}
  ];
  save();
  if(force) toast('Dados de exemplo restaurados.');
}
function clearAll(){
  if(confirm('Deseja apagar todos os chamados deste navegador?')){
    tickets=[];activities=[];save();toast('Chamados apagados.');
  }
}
function populateDepts(){
  const s=document.getElementById('filterDept');
  if(s) s.innerHTML='<option value="">Todos os setores</option>'+depts.map(x=>`<option>${x}</option>`).join('');
}
function dateBR(iso){return new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function statusClass(x){return {'Aberto':'status-aberto','Em atendimento':'status-atendimento','Aguardando':'status-aguardando','Resolvido':'status-resolvido'}[x]||'';}
function prioClass(x){return {'Baixa':'prio-baixa','Média':'prio-media','Alta':'prio-alta','Crítica':'prio-critica'}[x]||'';}
function badge(x,type){return `<span class="badge ${type==='s'?statusClass(x):prioClass(x)}">${escapeHtml(x)}</span>`;}
function renderAll(){renderStats();renderRecent();renderTickets();renderActivity();renderReports();}
function renderStats(){
  document.getElementById('statOpen').textContent=tickets.filter(t=>t.status==='Aberto').length;
  document.getElementById('statDoing').textContent=tickets.filter(t=>t.status==='Em atendimento').length;
  document.getElementById('statCritical').textContent=tickets.filter(t=>t.priority==='Crítica'&&t.status!=='Resolvido').length;
  document.getElementById('statDone').textContent=tickets.filter(t=>t.status==='Resolvido').length;
}
function rowHtml(t,full=false){
  return `<tr onclick="openDetails('${t.id}')"><td class="ticketid">${t.id}</td><td><div class="subject">${escapeHtml(t.subject)}</div><div class="small">${escapeHtml(t.location||'')}</div></td>${full?`<td>${escapeHtml(t.requester)}</td>`:''}<td>${escapeHtml(t.dept)}</td>${full?`<td>${escapeHtml(t.category)}</td>`:''}<td>${badge(t.priority,'p')}</td><td>${badge(t.status,'s')}</td><td>${dateBR(t.created)}</td></tr>`;
}
function renderRecent(){
  const body=document.getElementById('recentBody'); if(!body) return;
  const data=[...tickets].sort((a,b)=>new Date(b.updated)-new Date(a.updated)).slice(0,6);
  body.innerHTML=data.length?data.map(t=>rowHtml(t,false)).join(''):'<tr><td colspan="6" class="empty">Nenhum chamado.</td></tr>';
}
function renderTickets(){
  const body=document.getElementById('ticketsBody'); if(!body) return;
  const q=(document.getElementById('search')?.value||'').toLowerCase();
  const st=document.getElementById('filterStatus')?.value||'';
  const pr=document.getElementById('filterPriority')?.value||'';
  const dp=document.getElementById('filterDept')?.value||'';
  const data=[...tickets].filter(t=>{
    const hay=[t.id,t.subject,t.requester,t.dept,t.category,t.location].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(!st||t.status===st)&&(!pr||t.priority===pr)&&(!dp||t.dept===dp);
  }).sort((a,b)=>new Date(b.created)-new Date(a.created));
  body.innerHTML=data.length?data.map(t=>rowHtml(t,true)).join(''):'<tr><td colspan="8" class="empty">Nenhum chamado encontrado.</td></tr>';
  const count=document.getElementById('countTickets'); if(count) count.textContent=`${data.length} chamado(s)`;
}
function renderActivity(){
  const el=document.getElementById('activityList'); if(!el) return;
  const arr=[...activities].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,7);
  el.innerHTML=arr.length?arr.map(a=>`<div class="activity"><span class="dot"></span><div><strong>${escapeHtml(a.text)}</strong><p>${dateBR(a.time)}</p></div></div>`).join(''):'<div class="empty">Sem atividade.</div>';
}
function groupCount(key){const o={};tickets.forEach(t=>o[t[key]]=(o[t[key]]||0)+1);return Object.entries(o).sort((a,b)=>b[1]-a[1]);}
function drawReport(id,data){
  const el=document.getElementById(id); if(!el) return;
  const max=Math.max(1,...data.map(x=>x[1]));
  el.innerHTML=data.length?data.map(([k,v])=>`<div class="barrow"><span>${escapeHtml(k)}</span><div class="bar"><div class="fill" style="width:${Math.round(v/max*100)}%"></div></div><b>${v}</b></div>`).join(''):'<div class="empty">Sem dados.</div>';
}
function renderReports(){drawReport('deptReport',groupCount('dept'));drawReport('catReport',groupCount('category'));}
function formHtml(id='ticketForm'){
  return `<form id="${id}" onsubmit="createTicket(event,'${id}')"><div class="formgrid"><div class="field"><label>Solicitante *</label><input name="requester" required placeholder="Nome do solicitante"></div><div class="field"><label>Secretaria / Setor *</label><select name="dept" required><option value="">Selecione</option>${depts.map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field full"><label>Assunto do chamado *</label><input name="subject" required placeholder="Ex.: Computador não liga"></div><div class="field"><label>Categoria *</label><select name="category" required><option value="">Selecione</option>${categories.map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Prioridade *</label><select name="priority" required><option>Média</option><option>Baixa</option><option>Alta</option><option>Crítica</option></select></div><div class="field"><label>Local</label><input name="location" placeholder="Prédio / sala / unidade"></div><div class="field"><label>Equipamento</label><input name="equipment" placeholder="PC, impressora, patrimônio..."></div><div class="field full"><label>Descrição *</label><textarea name="description" required placeholder="Descreva o problema, mensagens de erro e o que já foi tentado."></textarea></div></div><div class="actions" style="justify-content:flex-end;margin-top:16px"><button type="reset" class="btn">Limpar</button><button class="btn primary">Registrar chamado</button></div></form>`;
}
function openNewTicket(){
  document.getElementById('modalRoot').innerHTML=`<div class="modalback" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modalhead"><h3>Abrir novo chamado</h3><button class="close" onclick="closeModal()">×</button></div><div class="modalbody">${formHtml('modalTicketForm')}</div></div></div>`;
}
function closeModal(){document.getElementById('modalRoot').innerHTML='';}
function createTicket(e,id){
  e.preventDefault();
  const f=new FormData(document.getElementById(id));
  const n=(Math.max(0,...tickets.map(t=>parseInt(t.id.split('-').pop())||0))+1).toString().padStart(4,'0');
  const now=new Date().toISOString();
  const t={id:`CH-${new Date().getFullYear()}-${n}`,requester:f.get('requester'),dept:f.get('dept'),subject:f.get('subject'),category:f.get('category'),priority:f.get('priority'),location:f.get('location'),equipment:f.get('equipment'),description:f.get('description'),status:'Aberto',tech:'Dill',created:now,updated:now};
  tickets.push(t);activities.push({text:`${t.id} foi aberto por ${t.requester}`,time:now});save();e.target.reset();closeModal();toast(`Chamado ${t.id} registrado com sucesso.`);goTo('chamados');
}
function openDetails(id){
  const t=tickets.find(x=>x.id===id); if(!t) return;
  document.getElementById('modalRoot').innerHTML=`<div class="modalback" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modalhead"><div><h3>${t.id} · ${escapeHtml(t.subject)}</h3><div class="small">${dateBR(t.created)}</div></div><button class="close" onclick="closeModal()">×</button></div><div class="modalbody"><div class="details"><div class="detail"><b>Solicitante</b>${escapeHtml(t.requester)}</div><div class="detail"><b>Setor</b>${escapeHtml(t.dept)}</div><div class="detail"><b>Categoria</b>${escapeHtml(t.category)}</div><div class="detail"><b>Prioridade</b>${badge(t.priority,'p')}</div><div class="detail"><b>Status</b>${badge(t.status,'s')}</div><div class="detail"><b>Técnico</b>${escapeHtml(t.tech||'Dill')}</div><div class="detail"><b>Local</b>${escapeHtml(t.location||'—')}</div><div class="detail"><b>Equipamento</b>${escapeHtml(t.equipment||'—')}</div></div><div class="description">${escapeHtml(t.description)}</div><div class="status-actions"><button class="btn" onclick="setStatus('${t.id}','Aberto')">Aberto</button><button class="btn" onclick="setStatus('${t.id}','Em atendimento')">Em atendimento</button><button class="btn" onclick="setStatus('${t.id}','Aguardando')">Aguardando</button><button class="btn primary" onclick="setStatus('${t.id}','Resolvido')">Resolver</button></div></div></div></div>`;
}
function setStatus(id,status){
  const t=tickets.find(x=>x.id===id); if(!t) return;
  t.status=status;t.updated=new Date().toISOString();activities.push({text:`${id} alterado para ${status}`,time:t.updated});save();openDetails(id);toast('Status atualizado.');
}
function goTo(page){
  document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));
  document.getElementById(page).classList.add('active');
  document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===page));
  const titles={dashboard:'Painel de atendimento',chamados:'Central de chamados',novo:'Abrir chamado',relatorios:'Relatórios',config:'Configurações'};
  document.getElementById('pageTitle').textContent=titles[page]||'CHAMADO T.I.';
  if(page==='novo') document.getElementById('inlineForm').innerHTML=formHtml('inlineTicketForm');
  document.getElementById('sidebar').classList.remove('open');
}
function exportCSV(){
  const cols=['Número','Assunto','Solicitante','Setor','Categoria','Prioridade','Status','Técnico','Local','Equipamento','Descrição','Criado','Atualizado'];
  const val=s=>`"${String(s??'').replaceAll('"','""')}"`;
  const lines=[cols.map(val).join(';'),...tickets.map(t=>[t.id,t.subject,t.requester,t.dept,t.category,t.priority,t.status,t.tech,t.location,t.equipment,t.description,dateBR(t.created),dateBR(t.updated)].map(val).join(';'))];
  const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='chamados-ti.csv';a.click();URL.revokeObjectURL(a.href);
}
function toast(msg){const e=document.getElementById('toast');e.textContent=msg;e.classList.remove('hidden');setTimeout(()=>e.classList.add('hidden'),2600);}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}

document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>goTo(b.dataset.page)));
document.getElementById('menuBtn').onclick=()=>document.getElementById('sidebar').classList.toggle('open');
load();
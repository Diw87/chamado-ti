const CONFIG = window.CHAMADO_TI_CONFIG || {};
const ONLINE = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase);
const DEMO_KEY = 'chamado-ti-v3-demo';
const SLA_HOURS = { critica: 4, alta: 8, media: 24, baixa: 48 };
const PRIORITY_LABEL = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const STATUS_LABEL = { aberto: 'Aberto', atendimento: 'Em atendimento', aguardando: 'Aguardando', resolvido: 'Resolvido', cancelado: 'Cancelado' };
const ROLE_LABEL = { requester: 'Solicitante', technician: 'Técnico', admin: 'Administrador' };
const CATEGORIES = ['Computador / Notebook','Impressora','Internet / Rede','Sistema / Software','E-mail / Acesso','Câmeras / CFTV','Telefonia','Instalação','Manutenção preventiva','Periféricos','Servidor','Outros'];

let db = null, authSession = null, currentProfile = null, departments = [], tickets = [], users = [];
let realtimeChannel = null, demoMode = false, booted = false;
const $ = id => document.getElementById(id);
const qsa = sel => [...document.querySelectorAll(sel)];

window.addEventListener('DOMContentLoaded', init);

async function init(){
  bindStaticEvents(); setDateLabels(); populateCategories(); updateSlaPreview();
  try{
    if(ONLINE){
      db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      const {data:{session},error}=await db.auth.getSession(); if(error) throw error;
      if(session) await enterOnline(session); else showLogin(false);
      db.auth.onAuthStateChange(async(event,sessionNow)=>{
        if(!booted) return;
        if(event==='SIGNED_OUT') showLogin(false);
        if(event==='SIGNED_IN' && sessionNow && !authSession) await enterOnline(sessionNow);
      });
    }else showLogin(true);
  }catch(error){console.error(error);showLogin(true,'Não foi possível conectar ao banco. O modo demonstração está disponível.');}
  finally{booted=true;setTimeout(()=>$('bootScreen')?.classList.add('hidden'),180);}
}

function bindStaticEvents(){
  $('loginForm')?.addEventListener('submit',handleLogin); $('demoLoginBtn')?.addEventListener('click',enterDemo);
  $('togglePassword')?.addEventListener('click',()=>{const i=$('loginPassword');if(i)i.type=i.type==='password'?'text':'password';});
  $('logoutBtn')?.addEventListener('click',logout); $('menuBtn')?.addEventListener('click',()=>$('sidebar')?.classList.toggle('open'));
  $('topNewTicketBtn')?.addEventListener('click',()=>goTo('new-ticket')); $('exportCsvBtn')?.addEventListener('click',exportCSV); $('reportExportBtn')?.addEventListener('click',exportCSV);
  $('clearFiltersBtn')?.addEventListener('click',clearTicketFilters); $('newTicketForm')?.addEventListener('submit',createTicket); $('newUserBtn')?.addEventListener('click',openNewUserModal);
  ['ticketSearch','statusFilter','priorityFilter','departmentFilter'].forEach(id=>$(id)?.addEventListener(id==='ticketSearch'?'input':'change',renderTickets));
  ['userSearch','userRoleFilter'].forEach(id=>$(id)?.addEventListener(id==='userSearch'?'input':'change',renderUsers));
  document.querySelector('select[name="priority"]')?.addEventListener('change',updateSlaPreview);
  qsa('[data-page]').forEach(b=>b.addEventListener('click',()=>goTo(b.dataset.page))); qsa('[data-go]').forEach(b=>b.addEventListener('click',()=>goTo(b.dataset.go)));
}

function showLogin(allowDemo=false,message=''){
  demoMode=false;authSession=null;currentProfile=null;$('appShell')?.classList.add('hidden');$('loginView')?.classList.remove('hidden');$('demoLoginBtn')?.classList.toggle('hidden',!allowDemo);
  if($('loginStatus')) $('loginStatus').textContent=message||(allowDemo?'Banco online ainda não conectado. Você pode visualizar o sistema em modo demonstração.':'');
}

async function handleLogin(event){
  event.preventDefault(); if(!ONLINE||!db){toast('O banco online ainda não está configurado.','error');return;}
  const button=event.submitter;setButtonLoading(button,true,'Entrando...');$('loginStatus').textContent='';
  try{const {data,error}=await db.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error)throw error;await enterOnline(data.session);}
  catch(error){$('loginStatus').textContent=friendlyAuthError(error);}finally{setButtonLoading(button,false,'Entrar na Central');}
}

async function enterOnline(session){
  authSession=session;demoMode=false;
  const {data:profile,error}=await db.from('profiles').select('id,full_name,role,active,department_id,created_at,department:departments(id,name,acronym)').eq('id',session.user.id).single();
  if(error||!profile){authSession=null;await db.auth.signOut();showLogin(false,'Seu acesso existe, mas o perfil ainda não foi configurado pelo administrador do T.I.');return;}
  if(!profile.active){authSession=null;await db.auth.signOut();showLogin(false,'Este usuário está inativo. Procure o administrador do T.I.');return;}
  currentProfile=profile;await Promise.all([loadDepartments(),loadTickets()]);if(isAdmin())await loadUsers();enterApp();subscribeRealtime();
}

function enterDemo(){
  demoMode=true;authSession={user:{id:'demo-admin',email:'demo@chamado-ti.local'}};departments=demoDepartments();
  currentProfile={id:'demo-admin',full_name:'Dill',role:'admin',active:true,department_id:'dep-adm',department:departments.find(d=>d.id==='dep-adm')};
  const saved=readLocal(DEMO_KEY,null);tickets=saved?.tickets?.length?saved.tickets:seedDemoTickets();users=seedDemoUsers();persistDemo();enterApp();toast('Modo demonstração ativado.','success');
}

function enterApp(){$('loginView')?.classList.add('hidden');$('appShell')?.classList.remove('hidden');applyRoleUI();populateDepartmentSelects();setUserUI();setBackendUI();renderAll();goTo('dashboard');}
async function logout(){if(demoMode){showLogin(true);return;}if(db)await db.auth.signOut();if(realtimeChannel)db.removeChannel(realtimeChannel);realtimeChannel=null;showLogin(false);}

async function loadDepartments(){const {data,error}=await db.from('departments').select('id,name,acronym,active').eq('active',true).order('name');if(error)throw error;departments=data||[];}
async function loadTickets(){const {data,error}=await db.from('tickets').select('*,department:departments!tickets_department_id_fkey(id,name,acronym),requester:profiles!tickets_requester_id_fkey(id,full_name),technician:profiles!tickets_technician_id_fkey(id,full_name)').order('created_at',{ascending:false}).limit(1500);if(error)throw error;tickets=data||[];}
async function loadUsers(){if(!db||!isAdmin())return;const {data,error}=await db.from('profiles').select('id,full_name,role,active,department_id,created_at,department:departments(id,name,acronym)').order('full_name');if(error)throw error;users=data||[];}

function subscribeRealtime(){
  if(!db||demoMode)return;if(realtimeChannel)db.removeChannel(realtimeChannel);
  realtimeChannel=db.channel('chamado-ti-v3')
    .on('postgres_changes',{event:'*',schema:'public',table:'tickets'},async()=>{try{await loadTickets();renderAll();}catch(e){console.error(e);}})
    .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},async()=>{if(isAdmin()){try{await loadUsers();renderUsers();}catch(e){console.error(e);}}})
    .subscribe(status=>{if($('realtimeText'))$('realtimeText').textContent=status==='SUBSCRIBED'?'Tempo real ativo':'Conectando...';});
}

function applyRoleUI(){const staff=isStaff(),admin=isAdmin();qsa('.staff-only').forEach(el=>el.classList.toggle('hidden-role',!staff));qsa('.admin-only').forEach(el=>el.classList.toggle('hidden-role',!admin));if($('dashboardSubtitle'))$('dashboardSubtitle').textContent=staff?'Aqui está o panorama do atendimento de T.I. neste momento.':'Acompanhe seus chamados e as atualizações da equipe de T.I.';}
function setUserUI(){const name=currentProfile?.full_name||'Usuário',role=ROLE_LABEL[currentProfile?.role]||'Usuário';setText('sidebarUserName',name);setText('sidebarUserRole',role);setText('sidebarAvatar',getInitials(name));setText('welcomeName',firstName(name));setText('settingsUser',`${name} • ${role}`);}
function setBackendUI(){const online=ONLINE&&!demoMode;$('backendDot')?.classList.toggle('online',online);$('backendDot')?.classList.toggle('demo',demoMode);setText('backendLabel',online?'Supabase conectado':'Modo demonstração');setText('backendDetail',online?'PostgreSQL + Realtime':'Dados neste navegador');setText('settingsBackend',online?'Supabase PostgreSQL':'LocalStorage (demo)');setText('settingsRealtime',online?'Ativo':'Simulado');setText('realtimeText',online?'Tempo real ativo':'Modo demonstração');}
function setDateLabels(){if($('todayLabel'))$('todayLabel').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});}
function populateCategories(){if($('categorySelect'))$('categorySelect').innerHTML='<option value="">Selecione</option>'+CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');}
function populateDepartmentSelects(){const options=departments.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');if($('departmentFilter'))$('departmentFilter').innerHTML='<option value="">Todas as secretarias</option>'+options;if($('newTicketDepartment')){$('newTicketDepartment').innerHTML='<option value="">Selecione</option>'+options;if(currentProfile?.department_id)$('newTicketDepartment').value=currentProfile.department_id;}}
(() => {
  'use strict';

  const CONFIG = window.CHAMADO_TI_CONFIG;
  const supabaseLib = window.supabase;
  if (!CONFIG?.SUPABASE_URL || !CONFIG?.SUPABASE_ANON_KEY || !supabaseLib) {
    document.body.innerHTML = '<div style="padding:40px;color:white;font-family:sans-serif">WhatsD não pôde iniciar: configuração do banco indisponível.</div>';
    return;
  }

  const db = supabaseLib.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'whatsd-auth-session'
    }
  });

  const $ = id => document.getElementById(id);
  const state = {
    session: null,
    me: null,
    contacts: [],
    adminUsers: [],
    messages: [],
    selectedId: null,
    channel: null
  };

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[ch]);

  const normalizeUsername = value => String(value || '').trim().toLowerCase();
  const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase() || '?';
  const isMobile = () => window.matchMedia('(max-width:700px)').matches;

  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle('hidden', hidden);
  }

  function setButtonLoading(button, loading, text) {
    if (!button) return;
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
    button.disabled = loading;
    button.textContent = loading ? text : button.dataset.originalText;
  }

  function toast(message, type = 'success') {
    const root = $('toastRoot');
    if (!root) return;
    const item = document.createElement('div');
    item.className = `toast ${type === 'error' ? 'error' : ''}`;
    item.textContent = message;
    root.appendChild(item);
    setTimeout(() => item.remove(), 3200);
  }

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatContactTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return formatTime(iso);
    const diff = Math.floor((today - d) / 86400000);
    if (diff < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  function dayLabel(iso) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'HOJE';
    if (d.toDateString() === yesterday.toDateString()) return 'ONTEM';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
  }

  function pairMessages(contactId) {
    return state.messages.filter(m =>
      (m.sender_id === state.me.id && m.receiver_id === contactId) ||
      (m.sender_id === contactId && m.receiver_id === state.me.id)
    ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  function latestFor(contactId) {
    const list = pairMessages(contactId);
    return list[list.length - 1] || null;
  }

  function unreadFor(contactId) {
    return state.messages.filter(m => m.sender_id === contactId && m.receiver_id === state.me.id && !m.read_at).length;
  }

  async function boot() {
    bindStaticEvents();
    try {
      const { data } = await db.auth.getSession();
      if (data?.session) {
        const ok = await enterApp(data.session, true);
        if (ok) return;
      }
    } catch (error) {
      console.warn(error);
    }
    showLogin();
  }

  function showLogin() {
    setHidden($('bootScreen'), true);
    setHidden($('appView'), true);
    setHidden($('loginView'), false);
    setTimeout(() => $('loginUsername')?.focus(), 50);
  }

  function showApp() {
    setHidden($('bootScreen'), true);
    setHidden($('loginView'), true);
    setHidden($('appView'), false);
  }

  function bindStaticEvents() {
    $('loginForm')?.addEventListener('submit', handleLogin);
    $('togglePassword')?.addEventListener('click', () => {
      const input = $('loginPassword');
      input.type = input.type === 'password' ? 'text' : 'password';
    });
    $('logoutButton')?.addEventListener('click', logout);
    $('adminButton')?.addEventListener('click', openAdmin);
    $('contactSearch')?.addEventListener('input', renderContacts);
    $('messageForm')?.addEventListener('submit', sendMessage);
    $('messageInput')?.addEventListener('input', autoGrowComposer);
    $('messageInput')?.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        $('messageForm')?.requestSubmit();
      }
    });
    $('mobileBackButton')?.addEventListener('click', closeMobileChat);
    window.addEventListener('resize', () => {
      if (!isMobile()) $('sidebar')?.classList.remove('chat-open');
    });
  }

  async function handleLogin(event) {
    event.preventDefault();
    const button = $('loginButton');
    const status = $('loginStatus');
    const username = normalizeUsername($('loginUsername')?.value);
    const password = String($('loginPassword')?.value || '');
    status.textContent = '';

    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      status.textContent = 'Informe um nome de usuário válido.';
      return;
    }

    setButtonLoading(button, true, 'Entrando...');
    try {
      let result = await db.auth.signInWithPassword({ email: `${username}@whatsd.local`, password });
      if (result.error) {
        result = await db.auth.signInWithPassword({ email: `${username}@chamado-ti.local`, password });
      }
      if (result.error || !result.data?.session) throw new Error('Usuário ou senha inválidos.');

      const ok = await enterApp(result.data.session, false);
      if (!ok) throw new Error('Seu acesso ao WhatsD não está liberado.');
    } catch (error) {
      await db.auth.signOut().catch(() => {});
      status.textContent = error?.message || 'Não foi possível entrar.';
    } finally {
      setButtonLoading(button, false, 'Entrar no WhatsD');
    }
  }

  async function enterApp(session, silent) {
    state.session = session;
    const { data: me, error } = await db.from('chat_profiles')
      .select('id,username,full_name,role,active,avatar_url')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error || !me?.id || !me.active) {
      if (!silent) console.warn(error);
      return false;
    }

    state.me = me;
    $('meName').textContent = me.full_name;
    $('meUsername').textContent = `@${me.username}`;
    $('meAvatar').textContent = initials(me.full_name);
    setHidden($('adminButton'), me.role !== 'admin');

    showApp();
    await Promise.all([loadContacts(), loadMessages()]);
    renderContacts();
    renderSelectedChat();
    subscribeRealtime();
    return true;
  }

  async function loadContacts() {
    const { data, error } = await db.from('chat_profiles')
      .select('id,username,full_name,role,active,avatar_url,created_at')
      .eq('active', true)
      .order('full_name');
    if (error) throw error;
    state.contacts = (data || []).filter(u => u.id !== state.me.id);
    $('contactCount').textContent = state.contacts.length;
  }

  async function loadMessages() {
    const id = state.me.id;
    const { data, error } = await db.from('chat_messages')
      .select('id,sender_id,receiver_id,body,created_at,read_at')
      .or(`sender_id.eq.${id},receiver_id.eq.${id}`)
      .order('created_at', { ascending: true })
      .limit(2000);
    if (error) throw error;
    state.messages = data || [];
  }

  function renderContacts() {
    const root = $('contactList');
    if (!root || !state.me) return;
    const search = String($('contactSearch')?.value || '').trim().toLowerCase();
    const filtered = state.contacts
      .filter(c => !search || `${c.full_name} ${c.username}`.toLowerCase().includes(search))
      .sort((a, b) => {
        const am = latestFor(a.id), bm = latestFor(b.id);
        if (am && bm) return new Date(bm.created_at) - new Date(am.created_at);
        if (am) return -1;
        if (bm) return 1;
        return a.full_name.localeCompare(b.full_name, 'pt-BR');
      });

    if (!filtered.length) {
      root.innerHTML = `<div class="contacts-empty">${search ? 'Nenhum usuário encontrado.' : 'Ainda não há outros usuários cadastrados.'}</div>`;
      return;
    }

    root.innerHTML = filtered.map(contact => {
      const last = latestFor(contact.id);
      const unread = unreadFor(contact.id);
      const mine = last?.sender_id === state.me.id;
      const preview = last ? `${mine ? 'Você: ' : ''}${esc(last.body)}` : `@${esc(contact.username)}`;
      return `<button class="contact-item ${unread ? 'unread' : ''} ${state.selectedId === contact.id ? 'active' : ''}" data-contact-id="${contact.id}" type="button">
        <div class="avatar">${esc(initials(contact.full_name))}</div>
        <div class="contact-copy">
          <div class="contact-row">
            <span class="contact-name">${esc(contact.full_name)}</span>
            <span class="contact-time">${last ? esc(formatContactTime(last.created_at)) : ''}</span>
          </div>
          <div class="contact-row">
            <span class="contact-preview">${preview}</span>
            ${unread ? `<span class="contact-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
          </div>
        </div>
      </button>`;
    }).join('');

    root.querySelectorAll('[data-contact-id]').forEach(btn => {
      btn.addEventListener('click', () => selectContact(btn.dataset.contactId));
    });
  }

  async function selectContact(id) {
    state.selectedId = id;
    renderContacts();
    renderSelectedChat();
    if (isMobile()) $('sidebar')?.classList.add('chat-open');
    await markConversationRead(id);
  }

  function closeMobileChat() {
    state.selectedId = null;
    $('sidebar')?.classList.remove('chat-open');
    renderSelectedChat();
    renderContacts();
  }

  function renderSelectedChat() {
    const contact = state.contacts.find(c => c.id === state.selectedId);
    if (!contact) {
      setHidden($('chatPanel'), true);
      setHidden($('chatEmpty'), false);
      return;
    }

    setHidden($('chatEmpty'), true);
    setHidden($('chatPanel'), false);
    $('chatName').textContent = contact.full_name;
    $('chatUsername').textContent = `@${contact.username}`;
    $('chatAvatar').textContent = initials(contact.full_name);
    renderMessages();
    setTimeout(() => $('messageInput')?.focus(), 30);
  }

  function renderMessages() {
    const root = $('messagesArea');
    if (!root || !state.selectedId) return;
    const list = pairMessages(state.selectedId);
    let lastDay = '';
    root.innerHTML = list.map(msg => {
      const day = new Date(msg.created_at).toDateString();
      const dayBreak = day !== lastDay ? `<div class="message-day"><span>${esc(dayLabel(msg.created_at))}</span></div>` : '';
      lastDay = day;
      const mine = msg.sender_id === state.me.id;
      return `${dayBreak}<div class="message-row ${mine ? 'mine' : ''}">
        <div class="bubble">
          ${esc(msg.body)}
          <div class="message-meta">
            <span>${esc(formatTime(msg.created_at))}</span>
            ${mine ? `<span class="message-check ${msg.read_at ? 'read' : ''}">${msg.read_at ? '✓✓' : '✓'}</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
    requestAnimationFrame(() => { root.scrollTop = root.scrollHeight; });
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!state.selectedId) return;
    const input = $('messageInput');
    const button = $('sendButton');
    const body = String(input.value || '').trim();
    if (!body) return;

    button.disabled = true;
    try {
      const { data, error } = await db.from('chat_messages').insert({
        sender_id: state.me.id,
        receiver_id: state.selectedId,
        body
      }).select('id,sender_id,receiver_id,body,created_at,read_at').single();
      if (error) throw error;
      upsertMessage(data);
      input.value = '';
      autoGrowComposer();
      renderMessages();
      renderContacts();
    } catch (error) {
      console.error(error);
      toast('Não foi possível enviar a mensagem.', 'error');
    } finally {
      button.disabled = false;
      input.focus();
    }
  }

  function autoGrowComposer() {
    const input = $('messageInput');
    if (!input) return;
    input.style.height = '42px';
    input.style.height = `${Math.min(input.scrollHeight, 130)}px`;
  }

  async function markConversationRead(contactId) {
    const unreadIds = state.messages
      .filter(m => m.sender_id === contactId && m.receiver_id === state.me.id && !m.read_at)
      .map(m => m.id);
    if (!unreadIds.length) return;
    const now = new Date().toISOString();
    state.messages.forEach(m => { if (unreadIds.includes(m.id)) m.read_at = now; });
    renderContacts();
    renderMessages();
    const { error } = await db.from('chat_messages')
      .update({ read_at: now })
      .eq('receiver_id', state.me.id)
      .eq('sender_id', contactId)
      .is('read_at', null);
    if (error) console.warn(error);
  }

  function upsertMessage(msg) {
    if (!msg?.id) return;
    const index = state.messages.findIndex(m => m.id === msg.id);
    if (index >= 0) state.messages[index] = { ...state.messages[index], ...msg };
    else state.messages.push(msg);
  }

  function subscribeRealtime() {
    if (state.channel) db.removeChannel(state.channel);
    state.channel = db.channel(`whatsd-${state.me.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, async payload => {
        const msg = payload.new;
        if (!msg?.id) return;
        if (msg.sender_id !== state.me.id && msg.receiver_id !== state.me.id) return;
        upsertMessage(msg);
        renderContacts();
        if (state.selectedId && (msg.sender_id === state.selectedId || msg.receiver_id === state.selectedId)) {
          renderMessages();
          if (msg.receiver_id === state.me.id && msg.sender_id === state.selectedId && !msg.read_at) {
            await markConversationRead(state.selectedId);
          }
        }
      })
      .subscribe();
  }

  async function openAdmin() {
    if (state.me?.role !== 'admin') return;
    const template = $('adminModalTemplate');
    const root = $('modalRoot');
    root.innerHTML = '';
    root.appendChild(template.content.cloneNode(true));
    root.querySelector('.modal-close')?.addEventListener('click', closeAdmin);
    root.querySelector('.modal-backdrop')?.addEventListener('click', e => {
      if (e.target.classList.contains('modal-backdrop')) closeAdmin();
    });
    root.querySelector('#createUserForm')?.addEventListener('submit', createUser);
    root.querySelector('#adminUserSearch')?.addEventListener('input', renderAdminUsers);
    await loadAdminUsers();
    renderAdminUsers();
  }

  function closeAdmin() {
    $('modalRoot').innerHTML = '';
  }

  async function loadAdminUsers() {
    const { data, error } = await db.from('chat_profiles')
      .select('id,username,full_name,role,active,created_at')
      .order('full_name');
    if (error) throw error;
    state.adminUsers = data || [];
  }

  function renderAdminUsers() {
    const root = document.querySelector('#adminUsersList');
    if (!root) return;
    const search = String(document.querySelector('#adminUserSearch')?.value || '').trim().toLowerCase();
    const users = state.adminUsers.filter(u => !search || `${u.full_name} ${u.username}`.toLowerCase().includes(search));
    root.innerHTML = users.length ? users.map(u => `<div class="admin-user-row">
      <div class="admin-user-main">
        <div class="avatar">${esc(initials(u.full_name))}</div>
        <div><strong>${esc(u.full_name)}</strong><span>@${esc(u.username)}</span></div>
      </div>
      <span class="role-pill">${u.role === 'admin' ? 'ADM' : 'USUÁRIO'}</span>
      ${u.id === state.me.id
        ? `<span class="status-pill">VOCÊ</span>`
        : `<button class="tiny-btn ${u.active ? 'danger' : ''}" type="button" data-toggle-user="${u.id}" data-active="${u.active}">${u.active ? 'Desativar' : 'Ativar'}</button>`}
    </div>`).join('') : '<div class="contacts-empty">Nenhum usuário encontrado.</div>';

    root.querySelectorAll('[data-toggle-user]').forEach(btn => {
      btn.addEventListener('click', () => toggleUser(btn.dataset.toggleUser, btn.dataset.active === 'true'));
    });
  }

  async function createUser(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = event.submitter;
    const status = document.querySelector('#createUserStatus');
    const fd = new FormData(form);
    const payload = {
      full_name: String(fd.get('full_name') || '').trim(),
      username: normalizeUsername(fd.get('username')),
      password: String(fd.get('password') || ''),
      role: String(fd.get('role') || 'user')
    };
    status.textContent = '';
    status.classList.remove('success');

    if (!/^[a-z0-9._-]{3,32}$/.test(payload.username)) {
      status.textContent = 'Usuário inválido. Use letras, números, ponto, hífen ou underline.';
      return;
    }

    setButtonLoading(button, true, 'Cadastrando...');
    try {
      const { data, error } = await db.functions.invoke('whatsd-create-user', { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      form.reset();
      status.textContent = data?.linked_existing
        ? 'Usuário existente liberado no WhatsD. Ele usará a senha que já possui.'
        : `@${payload.username} cadastrado com sucesso.`;
      status.classList.add('success');
      toast('Usuário cadastrado no WhatsD.');
      await Promise.all([loadAdminUsers(), loadContacts()]);
      renderAdminUsers();
      renderContacts();
    } catch (error) {
      console.error(error);
      status.textContent = error?.context?.body?.error || error?.message || 'Não foi possível cadastrar o usuário.';
    } finally {
      setButtonLoading(button, false, 'Cadastrar usuário');
    }
  }

  async function toggleUser(id, active) {
    try {
      const { error } = await db.from('chat_profiles')
        .update({ active: !active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast(!active ? 'Usuário ativado.' : 'Usuário desativado.');
      await Promise.all([loadAdminUsers(), loadContacts()]);
      renderAdminUsers();
      renderContacts();
      if (state.selectedId === id && active) {
        state.selectedId = null;
        renderSelectedChat();
      }
    } catch (error) {
      console.error(error);
      toast('Não foi possível alterar o usuário.', 'error');
    }
  }

  async function logout() {
    try {
      if (state.channel) await db.removeChannel(state.channel);
      await db.auth.signOut();
    } finally {
      state.session = null;
      state.me = null;
      state.contacts = [];
      state.messages = [];
      state.selectedId = null;
      closeAdmin();
      $('loginPassword').value = '';
      showLogin();
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

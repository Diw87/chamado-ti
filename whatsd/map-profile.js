(() => {
  'use strict';

  const CONFIG = window.WHATSD_CONFIG || window.CHAMADO_TI_CONFIG;
  if (!CONFIG?.SUPABASE_URL || !CONFIG?.SUPABASE_ANON_KEY || !window.supabase) return;

  const db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'whatsd-auth-session'
    }
  });

  const state = {
    session: null,
    me: null,
    profiles: [],
    map: null,
    markers: new Map(),
    selectedProfileId: null,
    profileChannel: null,
    bypassContactClick: false,
    ready: false
  };

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[ch]);
  const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase() || '?';
  const $ = id => document.getElementById(id);

  function injectAssets() {
    if (!document.querySelector('link[data-whatsd-map-style]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'map-profile.css?v=1';
      style.dataset.whatsdMapStyle = '1';
      document.head.appendChild(style);
    }

    if (!document.querySelector('link[data-leaflet-style]')) {
      const leafletStyle = document.createElement('link');
      leafletStyle.rel = 'stylesheet';
      leafletStyle.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      leafletStyle.dataset.leafletStyle = '1';
      document.head.appendChild(leafletStyle);
    }
  }

  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-leaflet-script]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.dataset.leafletScript = '1';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function init() {
    if (state.ready) return;
    injectAssets();
    const { data } = await db.auth.getSession();
    if (!data?.session) return;
    state.session = data.session;

    const { data: me } = await db.from('chat_profiles')
      .select('id,username,full_name,role,active,avatar_url,bio,position_title,location_sharing,latitude,longitude,location_accuracy,location_updated_at,updated_at')
      .eq('id', data.session.user.id)
      .maybeSingle();
    if (!me?.id || !me.active) return;
    state.me = me;

    try {
      await loadLeaflet();
      state.ready = true;
      buildMapWorkspace();
      bindGlobalEvents();
      await reloadProfiles();
      subscribeProfiles();
    } catch (error) {
      console.error('WhatsD mapa:', error);
    }
  }

  function buildMapWorkspace() {
    const host = $('chatEmpty');
    if (!host) return;
    host.classList.add('map-host');
    host.style.display = 'block';
    host.style.position = 'relative';
    host.style.textAlign = 'left';
    host.style.borderBottom = '0';
    host.innerHTML = `
      <div class="map-workspace">
        <div id="whatsdMap"></div>
        <div class="map-topbar">
          <div class="map-title"><strong>Mapa de usuários</strong><span>Veja quem está compartilhando localização no WhatsD</span></div>
          <div id="mapActions" class="map-actions"></div>
        </div>
        <div id="mapEmptyNote" class="map-empty-note hidden">
          <div class="empty-mark">D</div>
          <strong>Nenhuma localização compartilhada</strong>
          <p>Quando um usuário autorizar a localização, ele aparecerá aqui no mapa.</p>
        </div>
        <aside id="userProfileCard" class="profile-card hidden"></aside>
      </div>`;

    state.map = window.L.map('whatsdMap', { zoomControl: true, attributionControl: true }).setView([-14.235, -51.9253], 4);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(state.map);

    renderMapActions();
    ensureReturnToMapButton();
    setTimeout(() => state.map?.invalidateSize(), 80);
  }

  function ensureReturnToMapButton() {
    const header = document.querySelector('.chat-header');
    if (!header || header.querySelector('#returnToMapButton')) return;
    const button = document.createElement('button');
    button.id = 'returnToMapButton';
    button.className = 'map-return-btn';
    button.type = 'button';
    button.title = 'Voltar ao mapa';
    button.setAttribute('aria-label', 'Voltar ao mapa');
    button.textContent = '⌖';
    button.addEventListener('click', showMapHome);
    header.appendChild(button);
  }

  function showMapHome() {
    const chatPanel = $('chatPanel');
    const host = $('chatEmpty');
    if (chatPanel) chatPanel.classList.add('hidden');
    if (host) host.classList.remove('hidden');
    closeProfileCard();
    setTimeout(() => state.map?.invalidateSize(), 40);
  }

  async function reloadProfiles() {
    const { data, error } = await db.from('chat_profiles')
      .select('id,username,full_name,role,active,avatar_url,bio,position_title,location_sharing,latitude,longitude,location_accuracy,location_updated_at,updated_at')
      .eq('active', true)
      .order('full_name');
    if (error) throw error;
    state.profiles = data || [];
    state.me = state.profiles.find(p => p.id === state.me.id) || state.me;
    renderMarkers();
    renderMapActions();
    if (state.selectedProfileId) showProfile(state.selectedProfileId, false);
  }

  function renderMarkers() {
    if (!state.map || !window.L) return;
    state.markers.forEach(marker => marker.remove());
    state.markers.clear();

    const located = state.profiles.filter(p => p.location_sharing && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)));
    const bounds = [];

    located.forEach(profile => {
      const lat = Number(profile.latitude);
      const lng = Number(profile.longitude);
      const mine = profile.id === state.me?.id;
      const icon = window.L.divIcon({
        className: 'whatsd-user-marker',
        html: `<div class="whatsd-marker-inner ${mine ? 'me' : ''}">${esc(initials(profile.full_name))}</div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21]
      });
      const marker = window.L.marker([lat, lng], { icon }).addTo(state.map);
      marker.bindTooltip(esc(profile.full_name), { direction: 'top', offset: [0, -18] });
      marker.on('click', () => showProfile(profile.id));
      state.markers.set(profile.id, marker);
      bounds.push([lat, lng]);
    });

    const note = $('mapEmptyNote');
    note?.classList.toggle('hidden', located.length > 0);

    if (bounds.length === 1) state.map.setView(bounds[0], 15);
    else if (bounds.length > 1) state.map.fitBounds(bounds, { padding: [70, 70], maxZoom: 15 });
    else state.map.setView([-14.235, -51.9253], 4);
  }

  function bindGlobalEvents() {
    document.addEventListener('click', event => {
      const contact = event.target.closest?.('.contact-item[data-contact-id]');
      if (!contact || state.bypassContactClick) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showProfile(contact.dataset.contactId);
    }, true);

    document.getElementById('meAvatar')?.addEventListener('click', () => showProfile(state.me.id));
  }

  function renderMapActions() {
    const root = $('mapActions');
    if (!root || !state.me) return;
    root.innerHTML = `
      <button class="map-action-btn" type="button" data-my-profile>Meu perfil</button>
      <button class="map-action-btn primary" type="button" data-location-action>${state.me.location_sharing ? 'Atualizar localização' : 'Compartilhar localização'}</button>
      ${state.me.location_sharing ? '<button class="map-action-btn stop" type="button" data-stop-location>Parar</button>' : ''}`;
    root.querySelector('[data-my-profile]')?.addEventListener('click', () => showProfile(state.me.id));
    root.querySelector('[data-location-action]')?.addEventListener('click', shareMyLocation);
    root.querySelector('[data-stop-location]')?.addEventListener('click', stopSharingLocation);
  }

  async function shareMyLocation() {
    if (!navigator.geolocation) {
      showToast('Seu navegador não oferece localização.', 'error');
      return;
    }
    const button = document.querySelector('[data-location-action]');
    if (button) { button.disabled = true; button.textContent = 'Localizando...'; }

    navigator.geolocation.getCurrentPosition(async position => {
      try {
        const { data, error } = await db.functions.invoke('whatsd-update-profile', {
          body: {
            action: 'location',
            enabled: true,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
        });
        if (error || data?.error) throw error || new Error(data.error);
        state.me = { ...state.me, ...data.profile };
        await reloadProfiles();
        showToast('Sua localização foi atualizada.');
      } catch (error) {
        console.error(error);
        showToast('Não foi possível salvar sua localização.', 'error');
        renderMapActions();
      }
    }, error => {
      console.warn(error);
      renderMapActions();
      const message = error.code === 1 ? 'Você não autorizou o acesso à localização.' : 'Não foi possível obter sua localização.';
      showToast(message, 'error');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }

  async function stopSharingLocation() {
    try {
      const { data, error } = await db.functions.invoke('whatsd-update-profile', {
        body: { action: 'location', enabled: false }
      });
      if (error || data?.error) throw error || new Error(data.error);
      state.me = { ...state.me, ...data.profile };
      await reloadProfiles();
      showToast('Compartilhamento de localização desativado.');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível desativar a localização.', 'error');
    }
  }

  function showProfile(profileId, focusMap = true) {
    const profile = state.profiles.find(p => p.id === profileId);
    if (!profile) return;
    state.selectedProfileId = profileId;

    const host = $('chatEmpty');
    const chat = $('chatPanel');
    if (chat) chat.classList.add('hidden');
    if (host) host.classList.remove('hidden');

    const card = $('userProfileCard');
    if (!card) return;
    const mine = profile.id === state.me.id;
    const hasLocation = profile.location_sharing && Number.isFinite(Number(profile.latitude)) && Number.isFinite(Number(profile.longitude));
    const locationText = hasLocation
      ? `Localização compartilhada${profile.location_updated_at ? ` • atualizada ${formatRelative(profile.location_updated_at)}` : ''}`
      : 'Este usuário não está compartilhando localização.';

    card.innerHTML = `
      <div class="profile-card-head">
        <div class="avatar">${esc(initials(profile.full_name))}</div>
        <div class="profile-ident"><strong>${esc(profile.full_name)}</strong><span>@${esc(profile.username)}</span></div>
        <button class="profile-close" type="button" aria-label="Fechar">×</button>
      </div>
      <div class="profile-tabs">
        <button class="profile-tab active" type="button" data-profile-tab="profile">Perfil</button>
        <button class="profile-tab" type="button" data-profile-tab="message" ${mine ? 'disabled' : ''}>Mensagem</button>
      </div>
      <div class="profile-pane" data-profile-pane="profile">
        <span class="profile-role">${profile.role === 'admin' ? 'ADMINISTRADOR' : 'USUÁRIO'}</span>
        <div class="profile-field"><label>Função / cargo</label><p>${esc(profile.position_title || 'Não informado')}</p></div>
        <div class="profile-field"><label>Sobre</label><p>${esc(profile.bio || 'Nenhuma informação adicionada.')}</p></div>
        <div class="profile-location"><strong>${hasLocation ? '📍 No mapa' : '📍 Localização privada'}</strong><span>${esc(locationText)}</span></div>
        ${mine ? '<button class="profile-cta secondary" type="button" data-edit-profile>Editar meu perfil</button>' : ''}
      </div>
      <div class="profile-pane profile-message-pane hidden" data-profile-pane="message">
        <p>Abra uma conversa privada com <strong>${esc(profile.full_name)}</strong>.</p>
        <button class="profile-cta" type="button" data-open-message>Ir para mensagens</button>
      </div>`;
    card.classList.remove('hidden');

    card.querySelector('.profile-close')?.addEventListener('click', closeProfileCard);
    card.querySelectorAll('[data-profile-tab]').forEach(tab => tab.addEventListener('click', () => switchProfileTab(tab.dataset.profileTab)));
    card.querySelector('[data-open-message]')?.addEventListener('click', () => openMessage(profile.id));
    card.querySelector('[data-edit-profile]')?.addEventListener('click', openProfileEditor);

    if (focusMap && hasLocation && state.map) {
      state.map.flyTo([Number(profile.latitude), Number(profile.longitude)], Math.max(state.map.getZoom(), 15), { duration: .7 });
    }
    setTimeout(() => state.map?.invalidateSize(), 30);
  }

  function switchProfileTab(tabName) {
    const card = $('userProfileCard');
    if (!card) return;
    card.querySelectorAll('[data-profile-tab]').forEach(tab => tab.classList.toggle('active', tab.dataset.profileTab === tabName));
    card.querySelectorAll('[data-profile-pane]').forEach(pane => pane.classList.toggle('hidden', pane.dataset.profilePane !== tabName));
  }

  function closeProfileCard() {
    state.selectedProfileId = null;
    $('userProfileCard')?.classList.add('hidden');
  }

  function openMessage(profileId) {
    const button = document.querySelector(`.contact-item[data-contact-id="${CSS.escape(profileId)}"]`);
    if (!button) {
      showToast('Este usuário não está disponível na lista de conversas.', 'error');
      return;
    }
    state.bypassContactClick = true;
    button.click();
    setTimeout(() => { state.bypassContactClick = false; }, 0);
  }

  function openProfileEditor() {
    const existing = document.getElementById('whatsdProfileEdit');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'whatsdProfileEdit';
    modal.className = 'profile-edit-modal';
    modal.innerHTML = `
      <form class="profile-edit-box">
        <div class="profile-edit-head"><h3>Meu perfil</h3><button type="button" data-close-edit>×</button></div>
        <div class="profile-edit-body">
          <label>Função / cargo<input name="position_title" maxlength="80" value="${esc(state.me.position_title || '')}" placeholder="Ex.: Tecnologia da Informação"></label>
          <label>Sobre<textarea name="bio" maxlength="280" placeholder="Escreva algo sobre você">${esc(state.me.bio || '')}</textarea></label>
          <div class="profile-edit-actions"><button type="button" data-close-edit>Cancelar</button><button class="save" type="submit">Salvar perfil</button></div>
        </div>
      </form>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-close-edit]').forEach(btn => btn.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
    modal.querySelector('form')?.addEventListener('submit', saveProfile);
  }

  async function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('.save');
    const fd = new FormData(form);
    button.disabled = true;
    button.textContent = 'Salvando...';
    try {
      const { data, error } = await db.functions.invoke('whatsd-update-profile', {
        body: {
          action: 'profile',
          position_title: String(fd.get('position_title') || ''),
          bio: String(fd.get('bio') || '')
        }
      });
      if (error || data?.error) throw error || new Error(data.error);
      state.me = { ...state.me, ...data.profile };
      document.getElementById('whatsdProfileEdit')?.remove();
      await reloadProfiles();
      showProfile(state.me.id, false);
      showToast('Perfil atualizado.');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível atualizar o perfil.', 'error');
      button.disabled = false;
      button.textContent = 'Salvar perfil';
    }
  }

  function subscribeProfiles() {
    if (state.profileChannel) db.removeChannel(state.profileChannel);
    state.profileChannel = db.channel('whatsd-profile-map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_profiles' }, () => {
        window.clearTimeout(subscribeProfiles.timer);
        subscribeProfiles.timer = window.setTimeout(() => reloadProfiles().catch(console.error), 250);
      })
      .subscribe();
  }

  function formatRelative(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.max(0, Math.floor(diff / 60000));
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `há ${hours} h`;
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function showToast(message, type = 'success') {
    const root = $('toastRoot') || document.body;
    const item = document.createElement('div');
    item.className = `toast ${type === 'error' ? 'error' : ''}`;
    item.textContent = message;
    root.appendChild(item);
    setTimeout(() => item.remove(), 3500);
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => init().catch(console.error), 200);
  });
})();

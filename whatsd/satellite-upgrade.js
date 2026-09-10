(() => {
  'use strict';

  if (!window.L) return;

  const L = window.L;
  const CONFIG = window.WHATSD_CONFIG || window.CHAMADO_TI_CONFIG;
  const SATELLITE_URL = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const STREET_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const originalMap = L.map;
  const originalTileLayer = L.tileLayer;
  const originalDivIcon = L.divIcon;
  const originalBindTooltip = L.Marker.prototype.bindTooltip;
  const profilesByName = new Map();
  let profileClient = null;
  let activeMode = 'satellite';
  let observer = null;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  // Captura a instância criada pelo WhatsD para permitir troca Satélite/Mapa.
  L.map = function (...args) {
    const map = originalMap.apply(L, args);
    window.WHATSD_MAP_INSTANCE = map;
    setTimeout(() => installMapModeControl(map), 80);
    return map;
  };
  Object.assign(L.map, originalMap);

  // O mapa principal passa a nascer em visão satélite real.
  L.tileLayer = function (url, options = {}) {
    if (typeof url === 'string' && url.includes('tile.openstreetmap.org')) {
      const layer = originalTileLayer.call(L, SATELLITE_URL, {
        ...options,
        maxZoom: 19,
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics e comunidade GIS'
      });
      window.WHATSD_SATELLITE_LAYER = layer;
      return layer;
    }
    return originalTileLayer.call(L, url, options);
  };
  Object.assign(L.tileLayer, originalTileLayer);

  // Transforma os marcadores simples em pins circulares futuristas.
  L.divIcon = function (options = {}) {
    if (options?.className === 'whatsd-user-marker') {
      const raw = String(options.html || '');
      const mine = /whatsd-marker-inner\s+me/.test(raw);
      const text = raw.replace(/<[^>]*>/g, '').trim().slice(0, 3);
      options = {
        ...options,
        html: `
          <div class="wd-map-pin ${mine ? 'is-me' : ''}">
            <span class="wd-pin-pulse"></span>
            <span class="wd-pin-ring"></span>
            <span class="wd-pin-tail"></span>
            <span class="wd-pin-avatar"><span class="wd-pin-initials">${esc(text)}</span></span>
            <span class="wd-pin-status" aria-hidden="true"></span>
          </div>`,
        iconSize: [72, 78],
        iconAnchor: [36, 69],
        popupAnchor: [0, -58],
        tooltipAnchor: [0, -50]
      };
    }
    return originalDivIcon.call(L, options);
  };

  // Liga cada pin ao perfil para poder mostrar a foto, quando houver.
  L.Marker.prototype.bindTooltip = function (content, options) {
    const result = originalBindTooltip.call(this, content, options);
    const name = String(content || '').replace(/<[^>]*>/g, '').trim();
    if (name) {
      this.__whatsdProfileName = name;
      setTimeout(() => decorateMarker(this, name), 0);
    }
    return result;
  };

  function installMapModeControl(map) {
    if (!map || document.querySelector('.wd-map-mode-control')) return;

    const streetLayer = originalTileLayer.call(L, STREET_URL, {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });
    window.WHATSD_STREET_LAYER = streetLayer;

    const Control = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd() {
        const el = L.DomUtil.create('div', 'wd-map-mode-control');
        el.innerHTML = `
          <button type="button" class="active" data-map-mode="satellite">Satélite</button>
          <button type="button" data-map-mode="street">Mapa</button>`;
        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.disableScrollPropagation(el);
        el.querySelectorAll('[data-map-mode]').forEach(button => {
          button.addEventListener('click', () => setMapMode(map, button.dataset.mapMode, el));
        });
        return el;
      }
    });
    new Control().addTo(map);
  }

  function setMapMode(map, mode, control) {
    if (!map || !['satellite', 'street'].includes(mode) || activeMode === mode) return;
    const sat = window.WHATSD_SATELLITE_LAYER;
    const street = window.WHATSD_STREET_LAYER;

    if (mode === 'satellite') {
      if (street && map.hasLayer(street)) map.removeLayer(street);
      if (sat && !map.hasLayer(sat)) sat.addTo(map);
    } else {
      if (sat && map.hasLayer(sat)) map.removeLayer(sat);
      if (street && !map.hasLayer(street)) street.addTo(map);
    }
    activeMode = mode;
    control?.querySelectorAll('[data-map-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mapMode === mode);
    });
  }

  async function loadProfiles() {
    if (!CONFIG?.SUPABASE_URL || !CONFIG?.SUPABASE_ANON_KEY || !window.supabase) return;
    if (!profileClient) {
      profileClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: 'whatsd-auth-session'
        }
      });
    }

    const { data: sessionData } = await profileClient.auth.getSession();
    if (!sessionData?.session) return;

    const { data, error } = await profileClient.from('chat_profiles')
      .select('id,full_name,username,avatar_url,role,active')
      .eq('active', true);
    if (error) return;

    profilesByName.clear();
    (data || []).forEach(profile => profilesByName.set(profile.full_name, profile));
    decorateAllAvatars();
  }

  function decorateMarker(marker, name) {
    const el = marker?.getElement?.();
    if (!el) return;
    el.dataset.whatsdName = name;
    const profile = profilesByName.get(name);
    const avatar = el.querySelector('.wd-pin-avatar');
    if (!avatar || !profile?.avatar_url) return;
    setPhotoAvatar(avatar, profile.avatar_url);
  }

  function setPhotoAvatar(el, url) {
    if (!el || !url || el.dataset.photoApplied === url) return;
    el.dataset.photoApplied = url;
    el.classList.add('has-photo');
    el.textContent = '';
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => {
      el.classList.remove('has-photo');
      el.dataset.photoApplied = '';
      img.remove();
    }, { once: true });
    el.appendChild(img);
  }

  function decorateAllAvatars() {
    document.querySelectorAll('.leaflet-marker-icon[data-whatsd-name]').forEach(el => {
      const profile = profilesByName.get(el.dataset.whatsdName || '');
      if (profile?.avatar_url) setPhotoAvatar(el.querySelector('.wd-pin-avatar'), profile.avatar_url);
    });

    document.querySelectorAll('.contact-item').forEach(item => {
      const name = item.querySelector('.contact-name')?.textContent?.trim();
      const profile = profilesByName.get(name || '');
      if (profile?.avatar_url) setPhotoAvatar(item.querySelector('.avatar'), profile.avatar_url);
    });

    const myName = document.getElementById('meName')?.textContent?.trim();
    const me = profilesByName.get(myName || '');
    if (me?.avatar_url) setPhotoAvatar(document.getElementById('meAvatar'), me.avatar_url);

    const chatName = document.getElementById('chatName')?.textContent?.trim();
    const chatProfile = profilesByName.get(chatName || '');
    if (chatProfile?.avatar_url) setPhotoAvatar(document.getElementById('chatAvatar'), chatProfile.avatar_url);

    const profileName = document.querySelector('#userProfileCard .profile-ident strong')?.textContent?.trim();
    const profile = profilesByName.get(profileName || '');
    if (profile?.avatar_url) setPhotoAvatar(document.querySelector('#userProfileCard .profile-card-head .avatar'), profile.avatar_url);
  }

  function installObserver() {
    if (observer) return;
    observer = new MutationObserver(() => requestAnimationFrame(decorateAllAvatars));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    installObserver();
    setTimeout(() => loadProfiles().catch(() => {}), 600);
    setTimeout(() => loadProfiles().catch(() => {}), 1800);
  });
})();

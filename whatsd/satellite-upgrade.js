(() => {
  'use strict';

  const CONFIG = window.WHATSD_CONFIG || window.CHAMADO_TI_CONFIG;
  const SATELLITE_URL = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const STREET_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const profilesByName = new Map();
  let profileClient = null;
  let activeMode = 'satellite';
  let observer = null;
  let decorateTimer = null;
  let realtimeTimer = null;
  let realtimeChannel = null;
  let patched = false;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  function ensureLeafletAssets() {
    if (!document.querySelector('link[data-leaflet-style]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.dataset.leafletStyle = '1';
      document.head.appendChild(css);
    }

    if (window.L) {
      patchLeaflet();
      return;
    }

    let script = document.querySelector('script[data-leaflet-script]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.dataset.leafletScript = '1';
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', patchLeaflet, { once: true });
  }

  function patchLeaflet() {
    if (patched || !window.L) return;
    patched = true;

    const L = window.L;
    const originalMap = L.map;
    const originalTileLayer = L.tileLayer;
    const originalDivIcon = L.divIcon;
    const originalBindTooltip = L.Marker.prototype.bindTooltip;

    L.map = function (id, options = {}) {
      const map = originalMap.call(L, id, {
        preferCanvas: true,
        fadeAnimation: false,
        markerZoomAnimation: false,
        zoomAnimation: true,
        ...options
      });
      window.WHATSD_MAP_INSTANCE = map;
      map.whenReady(() => installMapModeControl(map, originalTileLayer));
      map.on('movestart zoomstart', () => map.getContainer()?.classList.add('wd-map-moving'));
      map.on('moveend zoomend', () => map.getContainer()?.classList.remove('wd-map-moving'));
      return map;
    };
    Object.assign(L.map, originalMap);

    L.tileLayer = function (url, options = {}) {
      if (typeof url === 'string' && url.includes('tile.openstreetmap.org')) {
        const layer = originalTileLayer.call(L, SATELLITE_URL, {
          ...options,
          maxZoom: 18,
          maxNativeZoom: 18,
          updateWhenIdle: true,
          updateWhenZooming: false,
          keepBuffer: 1,
          detectRetina: false,
          crossOrigin: true,
          attribution: 'Imagery © Esri, Maxar, Earthstar Geographics e comunidade GIS'
        });
        layer.on('loading', () => layer._map?.getContainer()?.classList.add('wd-map-tiles-loading'));
        layer.on('load', () => layer._map?.getContainer()?.classList.remove('wd-map-tiles-loading'));
        window.WHATSD_SATELLITE_LAYER = layer;
        return layer;
      }
      return originalTileLayer.call(L, url, {
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 1,
        detectRetina: false,
        ...options
      });
    };
    Object.assign(L.tileLayer, originalTileLayer);

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

    L.Marker.prototype.bindTooltip = function (content, options) {
      const result = originalBindTooltip.call(this, content, options);
      const name = String(content || '').replace(/<[^>]*>/g, '').trim();
      if (name) {
        this.__whatsdProfileName = name;
        requestAnimationFrame(() => decorateMarker(this, name));
      }
      return result;
    };
  }

  function installMapModeControl(map, originalTileLayer) {
    if (!map || document.querySelector('.wd-map-mode-control')) return;
    const L = window.L;

    const streetLayer = originalTileLayer.call(L, STREET_URL, {
      maxZoom: 18,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 1,
      detectRetina: false,
      crossOrigin: true,
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

  function getProfileClient() {
    if (!CONFIG?.SUPABASE_URL || !CONFIG?.SUPABASE_ANON_KEY || !window.supabase) return null;
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
    return profileClient;
  }

  async function loadProfiles() {
    const client = getProfileClient();
    if (!client) return;
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData?.session) return;

    const { data, error } = await client.from('chat_profiles')
      .select('id,full_name,username,avatar_url,role,active')
      .eq('active', true);
    if (error) return;

    profilesByName.clear();
    (data || []).forEach(profile => profilesByName.set(profile.full_name, profile));
    scheduleDecorate();
    subscribeAvatarChanges(client);
  }

  function subscribeAvatarChanges(client) {
    if (realtimeChannel) return;
    realtimeChannel = client.channel('whatsd-avatar-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_profiles' }, () => {
        clearTimeout(realtimeTimer);
        realtimeTimer = setTimeout(() => loadProfiles().catch(() => {}), 220);
      })
      .subscribe();
  }

  function decorateMarker(marker, name) {
    const el = marker?.getElement?.();
    if (!el) return;
    el.dataset.whatsdName = name;
    const profile = profilesByName.get(name);
    const avatar = el.querySelector('.wd-pin-avatar');
    if (!avatar) return;
    if (profile?.avatar_url) setPhotoAvatar(avatar, profile.avatar_url);
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
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => {
      el.classList.remove('has-photo');
      el.dataset.photoApplied = '';
      img.remove();
    }, { once: true });
    el.appendChild(img);
  }

  function scheduleDecorate() {
    if (decorateTimer) return;
    decorateTimer = setTimeout(() => {
      decorateTimer = null;
      decorateAllAvatars();
    }, 90);
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
    observer = new MutationObserver(scheduleDecorate);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function scheduleInitialProfiles() {
    const run = () => loadProfiles().catch(() => {});
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1300 });
    else setTimeout(run, 700);
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureLeafletAssets();
    installObserver();
    scheduleInitialProfiles();
  });
})();

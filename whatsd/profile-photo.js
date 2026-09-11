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

  let me = null;
  let modalObserver = null;
  let injectTimer = null;

  const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase() || '?';

  async function init() {
    const { data } = await db.auth.getSession();
    if (!data?.session) return;
    const { data: profile } = await db.from('chat_profiles')
      .select('id,full_name,username,avatar_url,active')
      .eq('id', data.session.user.id)
      .maybeSingle();
    if (!profile?.id || !profile.active) return;
    me = profile;
    installObserver();
    applyCurrentAvatar();
  }

  function installObserver() {
    if (modalObserver) return;
    modalObserver = new MutationObserver(() => {
      clearTimeout(injectTimer);
      injectTimer = setTimeout(() => {
        injectPhotoEditor();
        applyCurrentAvatar();
      }, 60);
    });
    modalObserver.observe(document.body, { childList: true, subtree: true });
  }

  function injectPhotoEditor() {
    const modal = document.getElementById('whatsdProfileEdit');
    const body = modal?.querySelector('.profile-edit-body');
    if (!body || body.querySelector('.wd-photo-editor')) return;

    const box = document.createElement('div');
    box.className = 'wd-photo-editor';
    box.innerHTML = `
      <div class="wd-photo-preview">${avatarMarkup()}</div>
      <div class="wd-photo-copy">
        <strong>Foto de perfil</strong>
        <span>Aparece no perfil, conversas e no marcador do mapa.</span>
        <div class="wd-photo-actions">
          <label class="wd-photo-pick">Escolher foto<input type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
          ${me.avatar_url ? '<button type="button" class="wd-photo-remove">Remover</button>' : ''}
        </div>
        <small class="wd-photo-status"></small>
      </div>`;
    body.prepend(box);

    box.querySelector('input[type=file]')?.addEventListener('change', handlePhotoPick);
    box.querySelector('.wd-photo-remove')?.addEventListener('click', removePhoto);
  }

  function avatarMarkup() {
    if (me?.avatar_url) return `<img src="${escapeAttr(me.avatar_url)}" alt="Foto de ${escapeAttr(me.full_name)}">`;
    return `<span>${escapeHtml(initials(me?.full_name))}</span>`;
  }

  async function handlePhotoPick(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const status = document.querySelector('.wd-photo-status');
    const picker = document.querySelector('.wd-photo-pick');

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      if (status) status.textContent = 'Use uma imagem JPG, PNG ou WebP.';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      if (status) status.textContent = 'A imagem original deve ter no máximo 10 MB.';
      return;
    }

    if (picker) picker.classList.add('is-loading');
    if (status) status.textContent = 'Preparando foto...';

    try {
      const blob = await compressAvatar(file);
      if (blob.size > 2 * 1024 * 1024) throw new Error('A foto ficou grande demais após o processamento.');

      const path = `${me.id}/avatar.webp`;
      if (status) status.textContent = 'Enviando foto...';
      const { error: uploadError } = await db.storage.from('whatsd-avatars').upload(path, blob, {
        upsert: true,
        contentType: 'image/webp',
        cacheControl: '3600'
      });
      if (uploadError) throw uploadError;

      const { data: publicData } = db.storage.from('whatsd-avatars').getPublicUrl(path);
      const publicUrl = `${publicData.publicUrl}?v=${Date.now()}`;
      const { data, error } = await db.functions.invoke('whatsd-update-profile', {
        body: { action: 'avatar', avatar_url: publicUrl }
      });
      if (error || data?.error) throw error || new Error(data.error);

      me = { ...me, ...data.profile };
      refreshPhotoEditor();
      applyCurrentAvatar();
      if (status) status.textContent = 'Foto atualizada.';
      toast('Foto de perfil atualizada.');
    } catch (error) {
      console.error(error);
      if (status) status.textContent = error?.message || 'Não foi possível atualizar a foto.';
      toast('Não foi possível atualizar a foto.', 'error');
    } finally {
      picker?.classList.remove('is-loading');
    }
  }

  async function removePhoto() {
    const status = document.querySelector('.wd-photo-status');
    try {
      if (status) status.textContent = 'Removendo foto...';
      await db.storage.from('whatsd-avatars').remove([`${me.id}/avatar.webp`]);
      const { data, error } = await db.functions.invoke('whatsd-update-profile', {
        body: { action: 'avatar', avatar_url: null }
      });
      if (error || data?.error) throw error || new Error(data.error);
      me = { ...me, ...data.profile, avatar_url: null };
      refreshPhotoEditor();
      clearCurrentAvatar();
      toast('Foto removida.');
    } catch (error) {
      console.error(error);
      if (status) status.textContent = 'Não foi possível remover a foto.';
      toast('Não foi possível remover a foto.', 'error');
    }
  }

  function refreshPhotoEditor() {
    const editor = document.querySelector('.wd-photo-editor');
    if (!editor) return;
    editor.querySelector('.wd-photo-preview').innerHTML = avatarMarkup();
    const actions = editor.querySelector('.wd-photo-actions');
    if (actions) {
      let remove = actions.querySelector('.wd-photo-remove');
      if (me.avatar_url && !remove) {
        remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'wd-photo-remove';
        remove.textContent = 'Remover';
        remove.addEventListener('click', removePhoto);
        actions.appendChild(remove);
      } else if (!me.avatar_url && remove) {
        remove.remove();
      }
    }
  }

  function applyCurrentAvatar() {
    if (!me?.avatar_url) return;
    const targets = [document.getElementById('meAvatar')];
    const profileName = document.querySelector('#userProfileCard .profile-ident strong')?.textContent?.trim();
    if (profileName === me.full_name) targets.push(document.querySelector('#userProfileCard .profile-card-head .avatar'));
    document.querySelectorAll(`.leaflet-marker-icon[data-whatsd-name="${cssEscape(me.full_name)}"] .wd-pin-avatar`).forEach(el => targets.push(el));
    targets.filter(Boolean).forEach(el => setImage(el, me.avatar_url));
  }

  function clearCurrentAvatar() {
    const name = me?.full_name || '';
    const value = initials(name);
    const targets = [document.getElementById('meAvatar')];
    const profileName = document.querySelector('#userProfileCard .profile-ident strong')?.textContent?.trim();
    if (profileName === name) targets.push(document.querySelector('#userProfileCard .profile-card-head .avatar'));
    document.querySelectorAll(`.leaflet-marker-icon[data-whatsd-name="${cssEscape(name)}"] .wd-pin-avatar`).forEach(el => targets.push(el));
    targets.filter(Boolean).forEach(el => {
      el.classList.remove('has-photo');
      el.dataset.photoApplied = '';
      el.textContent = value;
    });
  }

  function setImage(el, url) {
    if (!el || !url || el.dataset.photoApplied === url) return;
    el.dataset.photoApplied = url;
    el.classList.add('has-photo');
    el.textContent = '';
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    el.appendChild(img);
  }

  async function compressAvatar(file) {
    const bitmap = await createBitmap(file);
    const sourceW = bitmap.width;
    const sourceH = bitmap.height;
    const side = Math.min(sourceW, sourceH);
    const sx = Math.floor((sourceW - side) / 2);
    const sy = Math.floor((sourceH - side) / 2);
    const size = Math.min(512, side);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
    bitmap.close?.();
    return await new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao processar imagem.')), 'image/webp', .82);
    });
  }

  async function createBitmap(file) {
    if (window.createImageBitmap) return await window.createImageBitmap(file);
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const node = new Image();
        node.onload = () => resolve(node);
        node.onerror = reject;
        node.src = url;
      });
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function toast(message, type = 'success') {
    const root = document.getElementById('toastRoot') || document.body;
    const item = document.createElement('div');
    item.className = `toast ${type === 'error' ? 'error' : ''}`;
    item.textContent = message;
    root.appendChild(item);
    setTimeout(() => item.remove(), 3200);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[ch]);
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(String(value || ''));
    return String(value || '').replace(/["\\]/g, '\\$&');
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(() => init().catch(console.error), 450));
})();

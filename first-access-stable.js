// CHAMADO T.I. — Primeiro Acesso estável, isolado do modal geral
(function(){
  function $(id){ return document.getElementById(id); }
  function normalizeUser(v){ return String(v||'').trim().toLowerCase(); }
  function normalizeCode(v){
    const raw=String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);
    return raw.replace(/(.{4})(?=.)/g,'$1-');
  }
  function pinOnly(input){
    input.value=String(input.value||'').replace(/\D/g,'').slice(0,4);
  }

  function ensureStyles(){
    if(document.getElementById('firstAccessStableStyle')) return;
    const s=document.createElement('style');
    s.id='firstAccessStableStyle';
    s.textContent=`
      .fa-overlay{position:fixed;inset:0;z-index:10000;background:rgba(5,12,24,.56);display:flex;align-items:center;justify-content:center;padding:18px}
      .fa-card{width:min(460px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 30px 80px rgba(5,12,24,.30)}
      .fa-head{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 22px;border-bottom:1px solid #e6ebf2}
      .fa-head small{display:block;font-size:10px;font-weight:800;letter-spacing:.08em;color:#6e7a90;margin-bottom:4px}.fa-head h3{margin:0;font-size:20px;color:#1f2b3d}
      .fa-close{width:34px;height:34px;border:0;border-radius:9px;background:#f1f4f8;font-size:20px;cursor:pointer;color:#42506a}
      .fa-body{padding:20px 22px;display:grid;gap:14px}.fa-field{display:grid;gap:6px}.fa-field span{font-size:12px;font-weight:700;color:#334158}
      .fa-field input{width:100%;height:44px;border:1px solid #d9e1ec;border-radius:10px;padding:0 12px;font:inherit;outline:none}.fa-field input:focus{border-color:#5b8def;box-shadow:0 0 0 3px rgba(45,111,232,.10)}
      .fa-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fa-info{font-size:11px;line-height:1.55;color:#647189;background:#f7faff;border:1px solid #dfe7f3;border-radius:11px;padding:11px 12px}
      .fa-status{min-height:18px;font-size:12px;color:#b42318}.fa-footer{padding:16px 22px;border-top:1px solid #e6ebf2;display:flex;justify-content:flex-end;gap:9px}
      .fa-btn{border:1px solid #d7deea;background:#fff;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer}.fa-btn.primary{background:#2563eb;border-color:#2563eb;color:#fff}.fa-btn:disabled{opacity:.65;cursor:wait}
      @media(max-width:560px){.fa-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function close(){ $('firstAccessStableRoot')?.remove(); }

  function open(){
    ensureStyles();
    close();
    const root=document.createElement('div');
    root.id='firstAccessStableRoot';
    root.className='fa-overlay';
    root.innerHTML=`<div class="fa-card" role="dialog" aria-modal="true" aria-labelledby="faTitle">
      <div class="fa-head"><div><small>PRIMEIRO ACESSO</small><h3 id="faTitle">Crie sua senha</h3></div><button type="button" class="fa-close" id="faClose" aria-label="Fechar">×</button></div>
      <form id="faForm">
        <div class="fa-body">
          <label class="fa-field"><span>Usuário *</span><input name="username" required minlength="3" maxlength="32" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Ex.: saude01"></label>
          <label class="fa-field"><span>Código de Primeiro Acesso *</span><input name="access_code" required maxlength="14" autocomplete="one-time-code" placeholder="XXXX-XXXX-XXXX"></label>
          <div class="fa-grid">
            <label class="fa-field"><span>Senha de 4 dígitos *</span><input name="password" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" required autocomplete="new-password" placeholder="0000"></label>
            <label class="fa-field"><span>Confirmar senha *</span><input name="confirm_password" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" required autocomplete="new-password" placeholder="0000"></label>
          </div>
          <div class="fa-info">Digite o usuário e o código fornecidos pelo Administrador. Sua senha deve ter exatamente <b>4 números</b>.</div>
          <div id="faStatus" class="fa-status"></div>
        </div>
        <div class="fa-footer"><button type="button" class="fa-btn" id="faCancel">Cancelar</button><button type="submit" class="fa-btn primary" id="faSubmit">Criar senha e entrar</button></div>
      </form>
    </div>`;
    document.body.appendChild(root);

    const form=$('faForm');
    const code=form.elements.access_code;
    const p1=form.elements.password;
    const p2=form.elements.confirm_password;
    code.addEventListener('input',()=>{ code.value=normalizeCode(code.value); });
    p1.addEventListener('input',()=>pinOnly(p1));
    p2.addEventListener('input',()=>pinOnly(p2));
    $('faClose').addEventListener('click',close);
    $('faCancel').addEventListener('click',close);
    root.addEventListener('click',e=>{ if(e.target===root) close(); });
    form.addEventListener('submit',submit);
    form.elements.username.focus();
  }

  async function submit(event){
    event.preventDefault();
    const form=event.currentTarget;
    const status=$('faStatus');
    const button=$('faSubmit');
    const username=normalizeUser(form.elements.username.value);
    const access_code=form.elements.access_code.value;
    const password=String(form.elements.password.value||'');
    const confirm=String(form.elements.confirm_password.value||'');

    if(!/^[a-z0-9._-]{3,32}$/.test(username)){ status.textContent='Informe um nome de usuário válido.'; return; }
    if(!/^\d{4}$/.test(password)){ status.textContent='A senha deve ter exatamente 4 números.'; return; }
    if(password!==confirm){ status.textContent='As senhas não conferem.'; return; }
    if(typeof ONLINE==='undefined' || !ONLINE || typeof db==='undefined' || !db){ status.textContent='Banco online indisponível.'; return; }

    status.textContent='';
    button.disabled=true;button.textContent='Criando senha...';
    try{
      const response=await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/first-access`,{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':CONFIG.SUPABASE_ANON_KEY},
        body:JSON.stringify({username,access_code,password})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(result.error||'Não foi possível concluir o primeiro acesso.');

      close();
      if(result.access_token && result.refresh_token){
        authSession={pending:true};
        const {data,error}=await db.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token});
        if(error || !data.session) throw error || new Error('Senha criada. Entre normalmente.');
        authSession=data.session;
        await enterOnline(data.session);
        if(typeof toast==='function') toast('Senha criada com sucesso. Bem-vindo!','success');
      }else if(typeof toast==='function'){
        toast('Senha criada. Entre normalmente com seu usuário e senha.','success');
      }
    }catch(error){
      console.error(error);
      status.textContent=error?.message||'Não foi possível criar a senha.';
    }finally{
      if(document.body.contains(button)){button.disabled=false;button.textContent='Criar senha e entrar';}
    }
  }

  function replaceButton(){
    const old=$('firstAccessBtn');
    if(!old) return;
    const fresh=old.cloneNode(true);
    old.replaceWith(fresh);
    fresh.addEventListener('click',open);
  }

  window.addEventListener('DOMContentLoaded',()=>{
    // access-management.js cria o botão no mesmo DOMContentLoaded; agenda para o fim da fila.
    setTimeout(replaceButton,0);
  });
})();

// CHAMADO T.I. — trava definitiva de navegação por estado de autenticação
(function(){
  const style = document.createElement('style');
  style.id = 'auth-shell-hardening';
  style.textContent = `
    /* Sem login, nenhuma parte da navegação interna pode aparecer. */
    body:not(.ti-authenticated) #appShell,
    body:not(.ti-authenticated) #sidebar,
    body:not(.ti-authenticated) #tiMenuToggle,
    body:not(.ti-authenticated) .drawer-backdrop {
      display:none !important;
      visibility:hidden !important;
      opacity:0 !important;
      pointer-events:none !important;
    }

    /* O botão externo T.I. desaparece completamente com o menu aberto. */
    #tiMenuToggle[hidden],
    #tiMenuToggle.menu-open,
    body.ti-menu-open #tiMenuToggle {
      display:none !important;
      visibility:hidden !important;
      opacity:0 !important;
      pointer-events:none !important;
    }
  `;
  document.head.appendChild(style);

  function lockShell(){
    document.body.classList.remove('ti-authenticated','ti-menu-open');
    const shell = document.getElementById('appShell');
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('tiMenuToggle');
    const backdrop = document.querySelector('.drawer-backdrop');

    if(sidebar) sidebar.classList.remove('drawer-open','open');
    if(toggle){
      toggle.hidden = true;
      toggle.classList.remove('menu-open');
      toggle.style.setProperty('display','none','important');
    }
    if(backdrop) backdrop.classList.remove('show');
    if(shell){
      shell.hidden = true;
      shell.classList.add('hidden');
      shell.style.setProperty('display','none','important');
    }
  }

  function unlockShell(){
    document.body.classList.add('ti-authenticated');
    const shell = document.getElementById('appShell');
    const toggle = document.getElementById('tiMenuToggle');
    if(shell){
      shell.hidden = false;
      shell.classList.remove('hidden');
      shell.style.removeProperty('display');
    }
    if(toggle){
      toggle.hidden = false;
      toggle.style.removeProperty('display');
    }
  }

  // Mantém compatibilidade com o fluxo atual do sistema.
  if(typeof showLogin === 'function'){
    const originalShowLogin = showLogin;
    showLogin = function(...args){
      lockShell();
      const result = originalShowLogin.apply(this,args);
      lockShell();
      return result;
    };
  }

  if(typeof enterApp === 'function'){
    const originalEnterApp = enterApp;
    enterApp = function(...args){
      const result = originalEnterApp.apply(this,args);
      unlockShell();
      return result;
    };
  }

  function syncMenuState(){
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('tiMenuToggle');
    if(!sidebar || !toggle) return;

    const opened = sidebar.classList.contains('drawer-open');
    document.body.classList.toggle('ti-menu-open', opened);
    toggle.classList.toggle('menu-open', opened);
    toggle.hidden = opened || !document.body.classList.contains('ti-authenticated');

    if(opened || !document.body.classList.contains('ti-authenticated')){
      toggle.style.setProperty('display','none','important');
    }else{
      toggle.style.removeProperty('display');
    }
  }

  window.addEventListener('DOMContentLoaded',()=>{
    // Estado inicial: login/boot, portanto navegação bloqueada.
    const shell = document.getElementById('appShell');
    if(shell?.classList.contains('hidden')) lockShell();

    const observer = new MutationObserver(syncMenuState);
    const sidebar = document.getElementById('sidebar');
    if(sidebar) observer.observe(sidebar,{attributes:true,attributeFilter:['class']});

    // O botão é criado por ui-shell.js; observa o shell para capturá-lo quando surgir.
    if(shell) observer.observe(shell,{childList:true,subtree:false});
    setTimeout(syncMenuState,0);
  });
})();
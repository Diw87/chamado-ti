// CHAMADO T.I. — menu lateral oculto + favicon
(function prepareShellAssets(){
  if(!document.querySelector('link[href^="ui-shell.css"]')){
    const css=document.createElement('link');
    css.rel='stylesheet';css.href='ui-shell.css?v=20260910-2';document.head.appendChild(css);
  }
  let favicon=document.querySelector('link[rel~="icon"]');
  if(!favicon){favicon=document.createElement('link');favicon.rel='icon';document.head.appendChild(favicon);}
  favicon.type='image/svg+xml';favicon.href='favicon.svg?v=20260910-2';
})();

window.addEventListener('DOMContentLoaded',()=>{
  const shell=$('appShell');
  const sidebar=$('sidebar');
  if(!shell||!sidebar)return;

  const toggle=document.createElement('button');
  toggle.id='tiMenuToggle';
  toggle.className='ti-menu-toggle';
  toggle.type='button';
  toggle.textContent='T.I.';
  toggle.setAttribute('aria-label','Abrir menu lateral');

  const backdrop=document.createElement('div');
  backdrop.className='drawer-backdrop';

  shell.appendChild(toggle);
  shell.appendChild(backdrop);

  let menuOpen=false;
  const shellVisible=()=>!shell.classList.contains('hidden');

  const renderMenuState=()=>{
    const open=menuOpen && shellVisible();
    sidebar.classList.toggle('drawer-open',open);
    backdrop.classList.toggle('show',open);

    const showToggle=shellVisible() && !open;
    toggle.hidden=!showToggle;
    toggle.classList.toggle('menu-open',open);
    toggle.style.display=showToggle?'grid':'none';
    toggle.setAttribute('aria-hidden',showToggle?'false':'true');
  };

  const setOpen=open=>{
    menuOpen=Boolean(open) && shellVisible();
    renderMenuState();
  };

  // Começa fechado e invisível enquanto a tela de login estiver ativa.
  setOpen(false);

  toggle.addEventListener('click',()=>setOpen(true));
  backdrop.addEventListener('click',()=>setOpen(false));
  sidebar.querySelector('.brandmark')?.addEventListener('click',()=>setOpen(false));
  sidebar.addEventListener('click',event=>{
    if(event.target.closest('.nav-item')) setOpen(false);
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape') setOpen(false);
  });

  // Quando o login entra/sai de cena, sincroniza automaticamente o drawer.
  new MutationObserver(()=>{
    if(!shellVisible()) menuOpen=false;
    renderMenuState();
  }).observe(shell,{attributes:true,attributeFilter:['class']});
});

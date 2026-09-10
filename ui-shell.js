// CHAMADO T.I. — menu lateral oculto + favicon
window.addEventListener('DOMContentLoaded',()=>{
  const css=document.createElement('link');
  css.rel='stylesheet';css.href='ui-shell.css';document.head.appendChild(css);

  let favicon=document.querySelector('link[rel~="icon"]');
  if(!favicon){favicon=document.createElement('link');favicon.rel='icon';document.head.appendChild(favicon);}
  favicon.type='image/svg+xml';favicon.href='favicon.svg';

  const shell=$('appShell');
  const sidebar=$('sidebar');
  if(!shell||!sidebar)return;

  const toggle=document.createElement('button');
  toggle.id='tiMenuToggle';toggle.className='ti-menu-toggle';toggle.type='button';toggle.textContent='T.I.';toggle.setAttribute('aria-label','Abrir menu lateral');
  const backdrop=document.createElement('div');backdrop.className='drawer-backdrop';
  shell.appendChild(toggle);shell.appendChild(backdrop);

  const setOpen=open=>{
    sidebar.classList.toggle('drawer-open',open);
    toggle.classList.toggle('open',open);
    backdrop.classList.toggle('show',open);
    toggle.setAttribute('aria-label',open?'Fechar menu lateral':'Abrir menu lateral');
  };

  toggle.addEventListener('click',()=>setOpen(!sidebar.classList.contains('drawer-open')));
  backdrop.addEventListener('click',()=>setOpen(false));
  sidebar.querySelector('.brandmark')?.addEventListener('click',()=>setOpen(false));
  sidebar.addEventListener('click',event=>{if(event.target.closest('.nav-item'))setOpen(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')setOpen(false);});
});

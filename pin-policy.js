// CHAMADO T.I. — política visual de senha/PIN com 4 dígitos
(function(){
  function configurePinInput(input){
    if(!input || input.dataset.pin4Configured==='1') return;
    input.dataset.pin4Configured='1';
    input.minLength=4;
    input.maxLength=4;
    input.inputMode='numeric';
    input.pattern='[0-9]{4}';
    input.placeholder='0000';
    input.addEventListener('input',()=>{
      input.value=String(input.value||'').replace(/\D/g,'').slice(0,4);
    });
  }

  function apply(){
    const first=$('firstAccessForm');
    if(first){
      configurePinInput(first.querySelector('input[name="password"]'));
      configurePinInput(first.querySelector('input[name="confirm_password"]'));
      const box=[...first.querySelectorAll('.access-info-box span')].find(el=>/mínimo 8|administrador não poderá visualizar/i.test(el.textContent||''));
      if(box) box.textContent='A senha deve ter exatamente 4 números. O Administrador não poderá visualizar sua senha depois.';
    }

    const edit=$('editUserForm');
    if(edit){
      configurePinInput(edit.querySelector('input[name="password"]'));
      configurePinInput(edit.querySelector('input[name="confirm_password"]'));
    }
  }

  window.addEventListener('DOMContentLoaded',()=>{
    const login=$('loginPassword');
    if(login){
      login.placeholder='Sua senha';
      login.setAttribute('aria-description','Contas configuradas no novo padrão usam senha de 4 dígitos.');
    }
    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.body,{childList:true,subtree:true});
  });
})();

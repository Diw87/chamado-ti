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
    input.autocomplete='new-password';
    input.addEventListener('input',()=>{
      const clean=String(input.value||'').replace(/\D/g,'').slice(0,4);
      if(input.value!==clean) input.value=clean;
    });
  }

  function configureFirstAccess(){
    const first=document.getElementById('firstAccessForm');
    if(!first) return;
    configurePinInput(first.querySelector('input[name="password"]'));
    configurePinInput(first.querySelector('input[name="confirm_password"]'));
    const info=first.querySelector('.access-info-box span');
    if(info && info.dataset.pinTextConfigured!=='1'){
      info.dataset.pinTextConfigured='1';
      info.textContent='A senha deve ter exatamente 4 números. O Administrador não poderá visualizar sua senha depois.';
    }
  }

  function configureEditUser(){
    const edit=document.getElementById('editUserForm');
    if(!edit) return;
    configurePinInput(edit.querySelector('input[name="password"]'));
    configurePinInput(edit.querySelector('input[name="confirm_password"]'));
  }

  function apply(){
    configureFirstAccess();
    configureEditUser();
  }

  window.addEventListener('DOMContentLoaded',()=>{
    const login=document.getElementById('loginPassword');
    if(login){
      login.placeholder='Sua senha';
      login.setAttribute('inputmode','numeric');
    }

    apply();

    // Observa apenas a área de modais. Evita o loop infinito que travava a página.
    const modalRoot=document.getElementById('modalRoot');
    if(modalRoot){
      const observer=new MutationObserver(()=>requestAnimationFrame(apply));
      observer.observe(modalRoot,{childList:true,subtree:false});
    }
  });
})();

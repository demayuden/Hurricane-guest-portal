/* Background orbs + portal actions */
(function(){
  // --- orb canvas animation (subtle) ---
  const canvas = document.getElementById('orbCanvas');
  const dpr = window.devicePixelRatio || 1;
  if(canvas){
    const ctx = canvas.getContext('2d');
    let w, h, orbs;
    function resize(){
      w = canvas.width = innerWidth * dpr;
      h = canvas.height = innerHeight * dpr;
      canvas.style.width = innerWidth + 'px';
      canvas.style.height = innerHeight + 'px';
      ctx.scale(dpr, dpr);
    }
    function rand(min,max){ return Math.random()*(max-min)+min }
    function createOrbs(){
      orbs = Array.from({length:12}).map(()=>({
        x: rand(0, innerWidth),
        y: rand(0, innerHeight),
        r: rand(18,120),
        vx: rand(-0.1,0.1),
        vy: rand(-0.05,0.05),
        hue: rand(180,260),
        alpha: rand(0.03,0.12)
      }));
    }
    function draw(){
      ctx.clearRect(0,0,innerWidth,innerHeight);
      for(const o of orbs){
        o.x += o.vx; o.y += o.vy;
        if(o.x < -200) o.x = innerWidth + 200;
        if(o.x > innerWidth + 200) o.x = -200;
        if(o.y < -200) o.y = innerHeight + 200;
        if(o.y > innerHeight + 200) o.y = -200;
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, `hsla(${o.hue},95%,60%,${o.alpha})`);
        g.addColorStop(0.4, `hsla(${o.hue},90%,45%,${o.alpha*0.6})`);
        g.addColorStop(1, `hsla(${o.hue},80%,25%,0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI*2);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    resize();
    createOrbs();
    draw();
    window.addEventListener('resize', ()=>{
      ctx.setTransform(1,0,0,1,0,0);
      resize();
      createOrbs();
    }, {passive:true});
  }

  // --- Portal form UX ---
  const emailInput = document.getElementById('email');
  const otpInput = document.getElementById('otp');
  const getOtpBtn = document.getElementById('getOtp');
  const loginBtn = document.getElementById('loginBtn');
  const msg = document.getElementById('msg');

  function showMessage(text, type='error'){
    msg.textContent = text;
    msg.style.color = type === 'success' ? '#7ef6d6' : '#ff8b8b';
  }
  function clearMessage(){ msg.textContent = ''; }

  // simple timer for OTP
  function startTimer(btn, seconds=60){
    let s = seconds;
    btn.disabled = true;
    const prev = btn.textContent;
    const iv = setInterval(()=>{
      btn.textContent = `${s--}s`;
      if(s < 0){ clearInterval(iv); btn.disabled = false; btn.textContent = prev; }
    }, 1000);
  }

  getOtpBtn.addEventListener('click', async () => {
    clearMessage();
    const email = emailInput.value.trim();
    if(!email || !/^\S+@\S+\.\S+$/.test(email)){ showMessage('Enter a valid email'); emailInput.focus(); return; }

    getOtpBtn.disabled = true;
    getOtpBtn.textContent = 'Sending...';

    try{
      const res = await fetch('/api/request-otp', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email })
      });
      const data = await res.json().catch(()=>({}));
      if(res.ok){ showMessage('OTP sent — check your inbox', 'success'); startTimer(getOtpBtn, 50); }
      else showMessage(data.message || 'Failed to send OTP');
    } catch(e){
      showMessage('No backend — give this to your network admin', 'error');
    }

    getOtpBtn.disabled = false;
    getOtpBtn.textContent = 'Get OTP';
  });

  loginBtn.addEventListener('click', async () => {
    clearMessage();
    const agree = document.getElementById('agree').checked;
    const email = emailInput.value.trim();
    const otp = otpInput.value.trim();
    if(!agree){ showMessage('Please accept the terms'); return; }
    if(!email || !otp){ showMessage('Email & OTP required'); return; }

    loginBtn.disabled = true;
    const prev = loginBtn.textContent;
    loginBtn.textContent = 'Verifying...';

    try{
      const res = await fetch('/api/verify-otp', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, otp })
      });
      const data = await res.json().catch(()=>({}));
      if(res.ok){ showMessage('Welcome — redirecting', 'success'); setTimeout(()=>{ window.location.href = data.redirect || '/connected'; }, 900); }
      else showMessage(data.message || 'Invalid code');
    } catch(e){
      showMessage('No backend — give this file to the network admin', 'error');
    }

    loginBtn.disabled = false;
    loginBtn.textContent = prev;
  });

  // nice focus on load
  setTimeout(()=>{ emailInput && emailInput.focus(); }, 300);

})();

// TERMS MODAL logic (accessible + keyboard friendly)
(function(){
  const modal = document.getElementById('termsModal');
  if(!modal) return;

  const openSelectors = document.querySelectorAll('[data-open-terms], #termsLink'); // both ways
  const closeBtn = document.getElementById('termsCloseBtn');
  const backdrop = modal.querySelector('.terms-backdrop');
  const acceptBtn = document.getElementById('acceptTermsBtn');
  const declineBtn = document.getElementById('declineTermsBtn');
  const firstFocusable = closeBtn;
  const lastFocusable = declineBtn || acceptBtn;

  // open modal
  function openTerms(){
    modal.setAttribute('aria-hidden', 'false');
    // save active element to restore focus later
    modal._previouslyFocused = document.activeElement;
    // trap focus on panel
    setTimeout(()=> {
      firstFocusable.focus();
    }, 50);
    document.body.style.overflow = 'hidden'; // prevent background scroll
    document.addEventListener('keydown', onKeyDown);
  }

  // close modal
  function closeTerms(){
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if(modal._previouslyFocused) modal._previouslyFocused.focus();
    document.removeEventListener('keydown', onKeyDown);
  }

  // keyboard handling
  function onKeyDown(e){
    if(e.key === 'Escape') { closeTerms(); return; }
    // basic focus trap (Tab / Shift+Tab)
    if(e.key === 'Tab'){
      const focusables = modal.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
      if(focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  }

  // attach open handlers
  openSelectors.forEach(el => {
    if(!el) return;
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      openTerms();
    });
  });

  // attach close handlers
  closeBtn.addEventListener('click', closeTerms);
  backdrop.addEventListener('click', closeTerms);
  declineBtn && declineBtn.addEventListener('click', () => {
    closeTerms();
    // optionally uncheck Terms checkbox
    const agree = document.getElementById('agree');
    if(agree) agree.checked = false;
  });

  acceptBtn && acceptBtn.addEventListener('click', () => {
    // if user accepts, we can check the checkbox automatically and close
    const agree = document.getElementById('agree');
    if(agree) agree.checked = true;
    closeTerms();
  });

})();


(function(){
  var d=document,w=window;
  var sh=d.getElementById('site-head'),mb=sh&&sh.querySelector('.sh-menu-btn'),mp=d.getElementById('site-menu');
  var reduce=w.matchMedia&&w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function onScroll(){
    if(sh)sh.classList.toggle('stuck',w.scrollY>8);
    if(tt)tt.classList.toggle('show',w.scrollY>Math.max(1400,w.innerHeight*1.8));
  }
  function menu(open){if(!mb||!mp)return;mb.setAttribute('aria-expanded',open?'true':'false');mp.hidden=!open}
  if(mb&&mp){
    mb.addEventListener('click',function(){menu(mb.getAttribute('aria-expanded')!=='true')});
    mp.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('a'))menu(false)});
    d.addEventListener('keydown',function(e){if(e.key==='Escape'&&!mp.hidden){menu(false);mb.focus()}});
    w.matchMedia('(min-width:861px)').addEventListener('change',function(){menu(false)});
  }
  // Scroll-to-top button
  var tt=d.createElement('button');
  tt.type='button';tt.className='to-top'+(sh&&sh.classList.contains('sh-dark')?' on-dark':'');
  tt.setAttribute('aria-label','Back to top');
  tt.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  tt.addEventListener('click',function(){
    w.scrollTo({top:0,behavior:reduce?'auto':'smooth'});
    var t=d.querySelector('.sh-logo');if(t)setTimeout(function(){t.focus({preventScroll:true})},reduce?0:400);
  });
  d.body.appendChild(tt);
  onScroll();w.addEventListener('scroll',onScroll,{passive:true});
})();

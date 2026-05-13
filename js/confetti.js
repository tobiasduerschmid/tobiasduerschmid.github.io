// Site-wide confetti burst. Spawns ~36 coloured paper pieces from the
// perimeter of an anchor element and lets them fly outward and fall under
// "gravity". Guarded by the site-wide reduced-motion helper.
(function () {
  var cssInjected = false;

  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    var style = document.createElement('style');
    style.textContent = [
      '.site-confetti{position:fixed;pointer-events:none;z-index:9999;}',
      '.site-confetti-piece{',
        'position:absolute;',
        'width:10px;height:14px;',
        'margin-left:-5px;margin-top:-7px;',
        'box-shadow:0 1px 1px rgba(0,0,0,0.15);',
        'transform:translate(0,0) rotate(0) rotateY(0) scale(0.5);',
        'opacity:0;',
        'animation:site-confetti-fly 1600ms ease-out forwards;',
      '}',
      '@keyframes site-confetti-fly{',
        '0%{transform:translate(0px,0px) rotate(0deg) rotateY(0deg) scale(0.5);opacity:0;}',
        '6%{opacity:1;}',
        '25%{transform:translate(calc(var(--tx)*0.55),calc(var(--ty)*0.7 - 18px)) rotate(calc(var(--rot)*0.25)) rotateY(180deg) scale(1);}',
        '45%{transform:translate(calc(var(--tx)*0.9),calc(var(--ty)*0.95 - 8px)) rotate(calc(var(--rot)*0.55)) rotateY(360deg) scale(1);}',
        '65%{transform:translate(var(--tx),calc(var(--ty) + 40px)) rotate(calc(var(--rot)*0.8)) rotateY(560deg) scale(1);opacity:1;}',
        '88%{transform:translate(calc(var(--tx) + var(--drift,0px)),calc(var(--ty) + 150px)) rotate(calc(var(--rot)*0.95)) rotateY(800deg) scale(0.95);opacity:1;}',
        '100%{transform:translate(calc(var(--tx) + var(--drift,0px)),calc(var(--ty) + 220px)) rotate(var(--rot)) rotateY(960deg) scale(0.85);opacity:0;}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
        '.site-confetti{display:none !important;}',
        '.site-confetti-piece{animation:none !important;}',
      '}'
    ].join('');
    document.head.appendChild(style);
  }

  function prefersReducedMotion() {
    if (typeof window.__prefersReducedMotion === 'function') return window.__prefersReducedMotion();
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  window.spawnConfetti = function spawnConfetti(anchor) {
    if (!anchor || !anchor.getBoundingClientRect) return;
    if (prefersReducedMotion()) return;
    injectCSS();

    var rect = anchor.getBoundingClientRect();
    var host = document.createElement('div');
    host.className = 'site-confetti';
    host.style.left  = rect.left   + 'px';
    host.style.top   = rect.top    + 'px';
    host.style.width = rect.width  + 'px';
    host.style.height = rect.height + 'px';

    var colors = ['#ff5252','#ffeb3b','#4ade80','#4a9fd9','#e0b24e','#f1948a','#b18ef0','#ffffff'];
    var shapes = ['strip','strip','strip','square','round'];
    var count = 36;
    var perimeter = 2 * (rect.width + rect.height);

    for (var i = 0; i < count; i++) {
      var piece = document.createElement('div');
      piece.className = 'site-confetti-piece';

      var pos = Math.random() * perimeter;
      var x, y, nx, ny;
      if      (pos < rect.width)                          { x = pos;                                              y = 0;                                               nx =  0; ny = -1; }
      else if (pos < rect.width + rect.height)            { x = rect.width;                                       y = pos - rect.width;                                nx =  1; ny =  0; }
      else if (pos < 2 * rect.width + rect.height)        { x = rect.width - (pos - rect.width - rect.height);   y = rect.height;                                     nx =  0; ny =  1; }
      else                                                { x = 0;                                                y = rect.height - (pos - 2*rect.width - rect.height); nx = -1; ny =  0; }

      piece.style.left = x + 'px';
      piece.style.top  = y + 'px';

      var shape = shapes[Math.floor(Math.random() * shapes.length)];
      var w, h, br;
      if      (shape === 'strip')  { w = 4 + Math.random() * 3;  h = 10 + Math.random() * 8; br = 1;   }
      else if (shape === 'square') { w = 8 + Math.random() * 4;  h = 8  + Math.random() * 4; br = 2;   }
      else                         { w = 7 + Math.random() * 5;  h = w;                       br = 999; }

      piece.style.width        = w.toFixed(1) + 'px';
      piece.style.height       = h.toFixed(1) + 'px';
      piece.style.marginLeft   = (-w / 2).toFixed(1) + 'px';
      piece.style.marginTop    = (-h / 2).toFixed(1) + 'px';
      piece.style.borderRadius = br + 'px';

      var distance   = 60 + Math.random() * 90;
      var tangential = (Math.random() - 0.5) * 80;
      var tx    = nx * distance + (nx === 0 ? tangential : 0);
      var ty    = ny * distance + (ny === 0 ? tangential : 0);
      var rot   = Math.random() * 720 - 360;
      var drift = (Math.random() - 0.5) * 60;

      piece.style.setProperty('--tx',    tx.toFixed(1)    + 'px');
      piece.style.setProperty('--ty',    ty.toFixed(1)    + 'px');
      piece.style.setProperty('--rot',   rot.toFixed(0)   + 'deg');
      piece.style.setProperty('--drift', drift.toFixed(1) + 'px');
      piece.style.backgroundColor  = colors[i % colors.length];
      piece.style.animationDelay    = (Math.random() * 70)          + 'ms';
      piece.style.animationDuration = (1500 + Math.random() * 400)  + 'ms';
      host.appendChild(piece);
    }

    document.body.appendChild(host);
    setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 1700);
  };

  window.isMoreConfettiEnabled = function () {
    return /(?:^|; )more-confetti=true(?:;|$)/.test(document.cookie || '');
  };

  window.spawnConfettiIfMore = function (anchor) {
    if (!anchor) return;
    if (!window.isMoreConfettiEnabled()) return;
    window.spawnConfetti(anchor);
  };
}());

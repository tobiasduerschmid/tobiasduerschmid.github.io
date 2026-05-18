// Site-wide confetti burst. Spawns polished paper pieces from the
// perimeter of an anchor element and lets them fly outward and fall under
// "gravity". Guarded by the site-wide reduced-motion helper.
(function () {
  var cssInjected = false;

  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    var style = document.createElement('style');
    style.textContent = [
      '.site-confetti{position:fixed;pointer-events:none;z-index:9999;overflow:visible;contain:layout style;}',
      '.site-confetti-piece{',
        'position:absolute;',
        'width:10px;height:14px;',
        'margin-left:-5px;margin-top:-7px;',
        'overflow:hidden;',
        'background:var(--piece-bg,#fff);',
        'border:1px solid rgba(18,24,38,0.14);',
        'box-shadow:0 1px 1px rgba(18,24,38,0.16),0 7px 18px rgba(18,24,38,0.12);',
        'transform:translate3d(0,0,0) rotateZ(0deg) rotateY(0deg) scale(0.5);',
        'transform-origin:50% 50%;',
        'backface-visibility:visible;',
        'will-change:transform,opacity;',
        'opacity:0;',
        'animation:site-confetti-fly var(--duration,1800ms) cubic-bezier(.16,.84,.32,1) forwards;',
        'animation-delay:var(--delay,0ms);',
      '}',
      '.site-confetti-piece::after{',
        'content:"";',
        'position:absolute;',
        'inset:1px;',
        'border-radius:inherit;',
        'background:linear-gradient(135deg,rgba(255,255,255,0.82),rgba(255,255,255,0.16) 38%,rgba(0,0,0,0.12));',
        'opacity:0.72;',
        'pointer-events:none;',
      '}',
      '@keyframes site-confetti-fly{',
        '0%{transform:translate3d(0,0,0) rotateZ(0deg) rotateX(0deg) rotateY(0deg) scale(0.45);opacity:0;}',
        '7%{opacity:1;}',
        '18%{transform:translate3d(calc(var(--tx)*0.22),calc(var(--ty)*0.24 - var(--lift,18px)),0) rotateZ(calc(var(--rz)*0.18)) rotateX(calc(var(--rx)*0.25)) rotateY(calc(var(--ry)*0.25)) scale(1.04);opacity:1;}',
        '38%{transform:translate3d(calc(var(--tx)*0.62 + var(--sway,0px)),calc(var(--ty)*0.66 - calc(var(--lift,18px)*0.7)),0) rotateZ(calc(var(--rz)*0.48)) rotateX(calc(var(--rx)*0.55)) rotateY(calc(var(--ry)*0.58)) scale(1);}',
        '62%{transform:translate3d(var(--tx),calc(var(--ty) + 26px),0) rotateZ(calc(var(--rz)*0.78)) rotateX(calc(var(--rx)*0.84)) rotateY(calc(var(--ry)*0.86)) scale(0.98);opacity:1;}',
        '84%{transform:translate3d(calc(var(--tx) + var(--drift,0px)),calc(var(--ty) + var(--fall,140px)),0) rotateZ(calc(var(--rz)*0.94)) rotateX(calc(var(--rx)*1.05)) rotateY(calc(var(--ry)*1.04)) scale(0.92);opacity:0.88;}',
        '100%{transform:translate3d(calc(var(--tx) + var(--drift,0px) + var(--sway,0px)),calc(var(--ty) + var(--fall,200px)),0) rotateZ(var(--rz)) rotateX(var(--rx)) rotateY(var(--ry)) scale(0.82);opacity:0;}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
        '.site-confetti{display:none !important;}',
        '.site-confetti-piece{animation:none !important;}',
      '}',
      'html.prm-reduce .site-confetti{display:none !important;}',
      'html.prm-reduce .site-confetti-piece{animation:none !important;}',
      'html.dark-mode .site-confetti-piece{',
        'border-color:rgba(255,255,255,0.18);',
        'box-shadow:0 1px 1px rgba(0,0,0,0.34),0 8px 22px rgba(0,0,0,0.28);',
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
    host.setAttribute('aria-hidden', 'true');
    host.style.left  = rect.left   + 'px';
    host.style.top   = rect.top    + 'px';
    host.style.width = rect.width  + 'px';
    host.style.height = rect.height + 'px';

    var colors = ['#ff4f6d','#ffb000','#ffd84d','#43d17d','#14b8a6','#3b82f6','#8b5cf6','#ec4899','#f97316','#ffffff'];
    var shapes = ['ribbon','ribbon','ribbon','ticket','circle','triangle','spark'];
    var count = Math.max(30, Math.min(52, Math.round((rect.width + rect.height) / 16)));
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
      var w, h, br, clip;
      if (shape === 'ribbon') {
        w = 4.5 + Math.random() * 3.5;
        h = 14 + Math.random() * 12;
        br = 2;
      } else if (shape === 'ticket') {
        w = 8 + Math.random() * 5;
        h = 8 + Math.random() * 5;
        br = 3;
      } else if (shape === 'circle') {
        w = 7 + Math.random() * 5;
        h = w;
        br = 999;
      } else if (shape === 'triangle') {
        w = 10 + Math.random() * 4;
        h = 10 + Math.random() * 5;
        br = 1;
        clip = 'polygon(50% 0, 100% 100%, 0 100%)';
      } else {
        w = 10 + Math.random() * 5;
        h = w;
        br = 2;
        clip = 'polygon(50% 0, 62% 36%, 100% 50%, 62% 64%, 50% 100%, 38% 64%, 0 50%, 38% 36%)';
      }

      piece.style.width        = w.toFixed(1) + 'px';
      piece.style.height       = h.toFixed(1) + 'px';
      piece.style.marginLeft   = (-w / 2).toFixed(1) + 'px';
      piece.style.marginTop    = (-h / 2).toFixed(1) + 'px';
      piece.style.borderRadius = br + 'px';
      if (clip) piece.style.clipPath = clip;

      var distance   = 70 + Math.random() * 105;
      var tangential = (Math.random() - 0.5) * 96;
      var tx    = nx * distance + (nx === 0 ? tangential : 0);
      var ty    = ny * distance + (ny === 0 ? tangential : 0);
      var rz    = (Math.random() * 900 - 450);
      var rx    = (Math.random() * 760 + 240) * (Math.random() < 0.5 ? -1 : 1);
      var ry    = (Math.random() * 840 + 280) * (Math.random() < 0.5 ? -1 : 1);
      var drift = (Math.random() - 0.5) * 82;
      var sway  = (Math.random() - 0.5) * 46;
      var lift  = 18 + Math.random() * 28;
      var fall  = 165 + Math.random() * 95;
      var color = colors[i % colors.length];

      piece.style.setProperty('--tx',    tx.toFixed(1)    + 'px');
      piece.style.setProperty('--ty',    ty.toFixed(1)    + 'px');
      piece.style.setProperty('--rz',    rz.toFixed(0)    + 'deg');
      piece.style.setProperty('--rx',    rx.toFixed(0)    + 'deg');
      piece.style.setProperty('--ry',    ry.toFixed(0)    + 'deg');
      piece.style.setProperty('--drift', drift.toFixed(1) + 'px');
      piece.style.setProperty('--sway',  sway.toFixed(1)  + 'px');
      piece.style.setProperty('--lift',  lift.toFixed(1)  + 'px');
      piece.style.setProperty('--fall',  fall.toFixed(1)  + 'px');
      piece.style.setProperty('--delay', (Math.random() * 110).toFixed(0) + 'ms');
      piece.style.setProperty('--duration', (1650 + Math.random() * 520).toFixed(0) + 'ms');
      piece.style.setProperty('--piece-bg', 'linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,255,255,0.18) 24%,' + color + ' 46%,' + color + ' 74%,rgba(0,0,0,0.16))');
      host.appendChild(piece);
    }

    document.body.appendChild(host);
    setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 2850);
  };

  function readCookie(name) {
    var nameEQ = name + '=';
    var ca = (document.cookie || '').split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i].trim();
      if (c.indexOf(nameEQ) === 0) {
        try { return decodeURIComponent(c.substring(nameEQ.length)); }
        catch (e) { return c.substring(nameEQ.length); }
      }
    }
    return null;
  }

  window.isMoreConfettiEnabled = function () {
    return readCookie('more-confetti') !== 'false';
  };

  window.spawnConfettiIfMore = function (anchor) {
    if (!anchor) return;
    if (!window.isMoreConfettiEnabled()) return;
    window.spawnConfetti(anchor);
  };
}());

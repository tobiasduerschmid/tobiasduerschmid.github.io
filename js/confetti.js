// Site-wide confetti burst. Spawns polished paper pieces from the
// perimeter of an anchor element and lets them fly outward and fall under
// "gravity". Guarded by the site-wide reduced-motion helper.
(function () {
  var cssInjected = false;
  var layer = null;
  var activePieces = [];
  var cleanupTimer = null;
  var MAX_ACTIVE_PIECES = 260;
  var CLEANUP_PADDING_MS = 700;

  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    var style = document.createElement('style');
    style.textContent = [
      '.site-confetti-layer{position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;contain:layout style paint;}',
      '.site-confetti-piece{',
        'position:absolute;',
        'width:10px;height:14px;',
        'margin-left:-5px;margin-top:-7px;',
        'overflow:hidden;',
        'background:var(--piece-bg,#fff);',
        'border:1px solid rgba(18,24,38,0.16);',
        'box-shadow:0 1px 1px rgba(18,24,38,0.18),0 10px 24px rgba(18,24,38,0.14);',
        'filter:saturate(1.08);',
        'transform:translate3d(0,0,0) rotateZ(0deg) rotateY(0deg) scale(0.52);',
        'transform-origin:50% 50%;',
        'backface-visibility:visible;',
        'will-change:transform,opacity;',
        'opacity:0;',
        'animation:site-confetti-fly var(--duration,3800ms) cubic-bezier(.17,.84,.31,1) forwards;',
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
        '0%{transform:translate3d(0,0,0) rotateZ(0deg) rotateX(0deg) rotateY(0deg) scale(0.52);opacity:0;}',
        '8%{opacity:1;}',
        '20%{transform:translate3d(calc(var(--tx)*0.28),calc(var(--ty)*0.28 - var(--lift,34px)),0) rotateZ(calc(var(--rz)*0.22)) rotateX(calc(var(--rx)*0.28)) rotateY(calc(var(--ry)*0.28)) scale(1.08);opacity:1;}',
        '43%{transform:translate3d(calc(var(--tx)*0.72 + var(--sway,0px)),calc(var(--ty)*0.74 - calc(var(--lift,34px)*0.58)),0) rotateZ(calc(var(--rz)*0.56)) rotateX(calc(var(--rx)*0.62)) rotateY(calc(var(--ry)*0.64)) scale(1);}',
        '67%{transform:translate3d(var(--tx),calc(var(--ty) + 52px),0) rotateZ(calc(var(--rz)*0.82)) rotateX(calc(var(--rx)*0.92)) rotateY(calc(var(--ry)*0.9)) scale(0.98);opacity:1;}',
        '88%{transform:translate3d(calc(var(--tx) + var(--drift,0px)),calc(var(--ty) + var(--fall,230px)),0) rotateZ(calc(var(--rz)*0.96)) rotateX(calc(var(--rx)*1.08)) rotateY(calc(var(--ry)*1.06)) scale(0.9);opacity:0.76;}',
        '100%{transform:translate3d(calc(var(--tx) + var(--drift,0px) + var(--sway,0px)),calc(var(--ty) + var(--fall,320px)),0) rotateZ(var(--rz)) rotateX(var(--rx)) rotateY(var(--ry)) scale(0.78);opacity:0;}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
        '.site-confetti-layer{display:none !important;}',
        '.site-confetti-piece{animation:none !important;}',
      '}',
      'html.prm-reduce .site-confetti-layer{display:none !important;}',
      'html.prm-reduce .site-confetti-piece{animation:none !important;}',
      'html.dark-mode .site-confetti-piece{',
        'border-color:rgba(255,255,255,0.18);',
        'box-shadow:0 1px 1px rgba(0,0,0,0.34),0 8px 22px rgba(0,0,0,0.28);',
      '}'
    ].join('');
    document.head.appendChild(style);
  }

  function getLayer() {
    if (layer && layer.parentNode) return layer;
    layer = document.createElement('div');
    layer.className = 'site-confetti-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    return layer;
  }

  function removePiece(piece) {
    if (!piece) return;
    if (piece.parentNode) piece.parentNode.removeChild(piece);
    var index = activePieces.indexOf(piece);
    if (index !== -1) activePieces.splice(index, 1);
  }

  function trimToBudget(incomingCount) {
    var excess = activePieces.length + incomingCount - MAX_ACTIVE_PIECES;
    while (excess > 0 && activePieces.length) {
      removePiece(activePieces[0]);
      excess--;
    }
  }

  function cleanupExpiredPieces() {
    cleanupTimer = null;
    var now = Date.now();
    for (var i = activePieces.length - 1; i >= 0; i--) {
      if (activePieces[i].__siteConfettiExpiresAt <= now) {
        removePiece(activePieces[i]);
      }
    }
    scheduleCleanup();
  }

  function scheduleCleanup() {
    if (cleanupTimer || !activePieces.length) return;
    var now = Date.now();
    var nextAt = activePieces[0].__siteConfettiExpiresAt;
    for (var i = 1; i < activePieces.length; i++) {
      if (activePieces[i].__siteConfettiExpiresAt < nextAt) {
        nextAt = activePieces[i].__siteConfettiExpiresAt;
      }
    }
    cleanupTimer = window.setTimeout(cleanupExpiredPieces, Math.max(0, nextAt - now));
  }

  function prefersReducedMotion() {
    if (typeof window.__prefersReducedMotion === 'function') return window.__prefersReducedMotion();
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  window.spawnConfetti = function spawnConfetti(anchor) {
    if (!anchor || !anchor.getBoundingClientRect) return;
    if (prefersReducedMotion()) return;
    if (document.visibilityState === 'hidden') return;
    injectCSS();

    var rect = anchor.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    var colors = ['#ff4f6d','#ffb000','#ffd84d','#43d17d','#14b8a6','#3b82f6','#8b5cf6','#ec4899','#f97316','#ffffff'];
    var shapes = ['ribbon','ribbon','ribbon','ribbon','ticket','ticket','circle','triangle','spark'];
    var count = clamp(Math.round((rect.width + rect.height) / 9), 72, 110);
    var perimeter = 2 * (rect.width + rect.height);
    var confettiLayer = getLayer();
    var fragment = document.createDocumentFragment();

    trimToBudget(count);

    for (var i = 0; i < count; i++) {
      var piece = document.createElement('div');
      piece.className = 'site-confetti-piece';

      var pos = Math.random() * perimeter;
      var x, y, nx, ny;
      if      (pos < rect.width)                          { x = pos;                                              y = 0;                                               nx =  0; ny = -1; }
      else if (pos < rect.width + rect.height)            { x = rect.width;                                       y = pos - rect.width;                                nx =  1; ny =  0; }
      else if (pos < 2 * rect.width + rect.height)        { x = rect.width - (pos - rect.width - rect.height);   y = rect.height;                                     nx =  0; ny =  1; }
      else                                                { x = 0;                                                y = rect.height - (pos - 2*rect.width - rect.height); nx = -1; ny =  0; }

      piece.style.left = (rect.left + x) + 'px';
      piece.style.top  = (rect.top + y)  + 'px';

      var shape = shapes[Math.floor(Math.random() * shapes.length)];
      var w, h, br, clip;
      if (shape === 'ribbon') {
        w = rand(6, 10);
        h = rand(20, 34);
        br = 2;
      } else if (shape === 'ticket') {
        w = rand(12, 18);
        h = rand(10, 16);
        br = 3;
      } else if (shape === 'circle') {
        w = rand(10, 16);
        h = w;
        br = 999;
      } else if (shape === 'triangle') {
        w = rand(13, 18);
        h = rand(13, 20);
        br = 1;
        clip = 'polygon(50% 0, 100% 100%, 0 100%)';
      } else {
        w = rand(14, 20);
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

      var distance   = rand(125, 230);
      var tangential = rand(-150, 150);
      var tx    = nx * distance + (nx === 0 ? tangential : 0);
      var ty    = ny * distance + (ny === 0 ? tangential : 0);
      var rz    = rand(-720, 720);
      var rx    = rand(420, 1120) * (Math.random() < 0.5 ? -1 : 1);
      var ry    = rand(520, 1220) * (Math.random() < 0.5 ? -1 : 1);
      var drift = rand(-150, 150);
      var sway  = rand(-90, 90);
      var lift  = rand(42, 86);
      var fall  = rand(260, 430);
      var color = colors[i % colors.length];
      var duration = rand(3200, 4700);
      var delay = Math.random() * 180;

      piece.style.setProperty('--tx',    tx.toFixed(1)    + 'px');
      piece.style.setProperty('--ty',    ty.toFixed(1)    + 'px');
      piece.style.setProperty('--rz',    rz.toFixed(0)    + 'deg');
      piece.style.setProperty('--rx',    rx.toFixed(0)    + 'deg');
      piece.style.setProperty('--ry',    ry.toFixed(0)    + 'deg');
      piece.style.setProperty('--drift', drift.toFixed(1) + 'px');
      piece.style.setProperty('--sway',  sway.toFixed(1)  + 'px');
      piece.style.setProperty('--lift',  lift.toFixed(1)  + 'px');
      piece.style.setProperty('--fall',  fall.toFixed(1)  + 'px');
      piece.style.setProperty('--delay', delay.toFixed(0) + 'ms');
      piece.style.setProperty('--duration', duration.toFixed(0) + 'ms');
      piece.style.setProperty('--piece-bg', 'linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,255,255,0.18) 24%,' + color + ' 46%,' + color + ' 74%,rgba(0,0,0,0.16))');
      piece.addEventListener('animationend', function (event) {
        removePiece(event.currentTarget);
      }, { once: true });
      piece.__siteConfettiExpiresAt = Date.now() + delay + duration + CLEANUP_PADDING_MS;
      activePieces.push(piece);
      fragment.appendChild(piece);
    }

    confettiLayer.appendChild(fragment);
    scheduleCleanup();
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

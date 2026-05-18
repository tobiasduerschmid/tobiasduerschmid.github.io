// Site-wide confetti burst. Spawns polished paper pieces from around an
// anchor element and animates each piece along a small physics-inspired
// toss path. Guarded by the site-wide reduced-motion helper.
(function () {
  var cssInjected = false;
  var layer = null;
  var activePieces = [];
  var cleanupTimer = null;
  var MAX_ACTIVE_PIECES = 176;
  var CLEANUP_PADDING_MS = 360;

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
        'box-shadow:0 1px 1px rgba(18,24,38,0.18),0 8px 18px rgba(18,24,38,0.12);',
        'transform:translate3d(0,0,0) rotateZ(0deg) rotateY(0deg) scale(0.52);',
        'transform-origin:50% 50%;',
        'backface-visibility:visible;',
        'will-change:transform,opacity;',
        'opacity:0;',
        'animation:site-confetti-fly var(--duration,4200ms) linear forwards;',
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
        '0%{transform:translate3d(0,0,0) rotateZ(var(--rz0)) rotateX(var(--rx0)) rotateY(var(--ry0)) scale(0.64);opacity:0;}',
        '6%{opacity:1;}',
        '15%{transform:translate3d(var(--x1),var(--y1),0) rotateZ(var(--rz1)) rotateX(var(--rx1)) rotateY(var(--ry1)) scale(1.04);opacity:1;}',
        '31%{transform:translate3d(var(--x2),var(--y2),0) rotateZ(var(--rz2)) rotateX(var(--rx2)) rotateY(var(--ry2)) scale(1);opacity:1;}',
        '54%{transform:translate3d(var(--x3),var(--y3),0) rotateZ(var(--rz3)) rotateX(var(--rx3)) rotateY(var(--ry3)) scale(0.96);opacity:0.98;}',
        '76%{transform:translate3d(var(--x4),var(--y4),0) rotateZ(var(--rz4)) rotateX(var(--rx4)) rotateY(var(--ry4)) scale(0.9);opacity:0.78;}',
        '100%{transform:translate3d(var(--x5),var(--y5),0) rotateZ(var(--rz5)) rotateX(var(--rx5)) rotateY(var(--ry5)) scale(0.78);opacity:0;}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
        '.site-confetti-layer{display:none !important;}',
        '.site-confetti-piece{animation:none !important;}',
      '}',
      'html.prm-reduce .site-confetti-layer{display:none !important;}',
      'html.prm-reduce .site-confetti-piece{animation:none !important;}',
      'html.dark-mode .site-confetti-piece{',
        'border-color:rgba(255,255,255,0.18);',
        'box-shadow:0 1px 1px rgba(0,0,0,0.34),0 6px 16px rgba(0,0,0,0.24);',
      '}'
    ].join('');
    document.head.appendChild(style);
  }

  function getLayer() {
    if (layer && layer.parentNode) return layer;
    layer = document.createElement('div');
    layer.className = 'site-confetti-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.addEventListener('animationend', function (event) {
      if (event.target && event.target.classList.contains('site-confetti-piece')) {
        removePiece(event.target);
      }
    });
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

  function px(value) {
    return value.toFixed(1) + 'px';
  }

  function deg(value) {
    return value.toFixed(0) + 'deg';
  }

  function ballisticY(t, peakTime, peakHeight, drop) {
    var a = (peakHeight + drop * peakTime) / (peakTime * (1 - peakTime));
    var b = drop - a;
    return a * t * t + b * t;
  }

  function driftX(t, velocity, wind, flutter, phase, cycles) {
    var wave = Math.sin(phase + t * cycles * Math.PI * 2);
    return velocity * t + wind * t * t + wave * flutter * (0.15 + t * 0.85);
  }

  function tumbleAt(start, spin, flutter, phase, t) {
    return start + spin * t + Math.sin(phase + t * Math.PI * 2) * flutter;
  }

  window.spawnConfetti = function spawnConfetti(anchor) {
    if (!anchor || !anchor.getBoundingClientRect) return;
    if (prefersReducedMotion()) return;
    if (document.visibilityState === 'hidden') return;
    injectCSS();

    var rect = anchor.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    var colors = ['#ff4f6d','#ffb000','#ffd84d','#43d17d','#14b8a6','#3b82f6','#8b5cf6','#ec4899','#f97316','#ffffff'];
    var shapes = ['ribbon','ribbon','ribbon','ribbon','ticket','ticket','circle'];
    var count = clamp(Math.round((rect.width + rect.height) / 9), 64, 88);
    var confettiLayer = getLayer();
    var fragment = document.createDocumentFragment();
    var centerX = rect.left + rect.width / 2;
    var centerY = rect.top + rect.height * 0.45;
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 720;
    var sourceSpreadX = Math.min(84, rect.width * 0.26);
    var sourceSpreadY = Math.min(46, rect.height * 0.18);
    var maxPeakHeight = Math.max(24, Math.min(240, centerY - 28));
    var timeStops = [0.15, 0.31, 0.54, 0.76, 1];

    trimToBudget(count);

    for (var i = 0; i < count; i++) {
      var piece = document.createElement('div');
      piece.className = 'site-confetti-piece';

      piece.style.left = px(centerX + rand(-sourceSpreadX, sourceSpreadX));
      piece.style.top  = px(centerY + rand(-sourceSpreadY, sourceSpreadY));

      var shape = shapes[Math.floor(Math.random() * shapes.length)];
      var w, h, br;
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
      }

      piece.style.width        = w.toFixed(1) + 'px';
      piece.style.height       = h.toFixed(1) + 'px';
      piece.style.marginLeft   = (-w / 2).toFixed(1) + 'px';
      piece.style.marginTop    = (-h / 2).toFixed(1) + 'px';
      piece.style.borderRadius = br + 'px';

      var direction = Math.random() < 0.5 ? -1 : 1;
      var velocity = direction * rand(100, 415) + rand(-85, 85);
      var wind = rand(-180, 180);
      var flutter = rand(12, 48);
      var phase = rand(0, Math.PI * 2);
      var cycles = rand(1.1, 2.4);
      var peakTime = rand(0.2, 0.34);
      var peakHeight = rand(Math.max(24, maxPeakHeight * 0.62), maxPeakHeight);
      var drop = Math.max(520, viewportHeight - centerY + rand(120, 320));
      var rzStart = rand(-80, 80);
      var rxStart = rand(-70, 70);
      var ryStart = rand(-70, 70);
      var rzSpin = rand(290, 960) * (Math.random() < 0.5 ? -1 : 1);
      var rxSpin = rand(780, 1860) * (Math.random() < 0.5 ? -1 : 1);
      var rySpin = rand(700, 1780) * (Math.random() < 0.5 ? -1 : 1);
      var rzFlutter = rand(18, 54);
      var rxFlutter = rand(70, 150);
      var ryFlutter = rand(80, 170);
      var color = colors[i % colors.length];
      var duration = rand(3400, 4600);
      var delay = Math.random() * 110;

      piece.style.setProperty('--rz0', deg(rzStart));
      piece.style.setProperty('--rx0', deg(rxStart));
      piece.style.setProperty('--ry0', deg(ryStart));

      for (var stopIndex = 0; stopIndex < timeStops.length; stopIndex++) {
        var stop = timeStops[stopIndex];
        var varIndex = stopIndex + 1;
        piece.style.setProperty('--x' + varIndex, px(driftX(stop, velocity, wind, flutter, phase, cycles)));
        piece.style.setProperty('--y' + varIndex, px(ballisticY(stop, peakTime, peakHeight, drop)));
        piece.style.setProperty('--rz' + varIndex, deg(tumbleAt(rzStart, rzSpin, rzFlutter, phase, stop)));
        piece.style.setProperty('--rx' + varIndex, deg(tumbleAt(rxStart, rxSpin, rxFlutter, phase + 1.7, stop)));
        piece.style.setProperty('--ry' + varIndex, deg(tumbleAt(ryStart, rySpin, ryFlutter, phase + 3.1, stop)));
      }

      piece.style.setProperty('--delay', delay.toFixed(0) + 'ms');
      piece.style.setProperty('--duration', duration.toFixed(0) + 'ms');
      piece.style.setProperty('--piece-bg', 'linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,255,255,0.18) 24%,' + color + ' 46%,' + color + ' 74%,rgba(0,0,0,0.16))');
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

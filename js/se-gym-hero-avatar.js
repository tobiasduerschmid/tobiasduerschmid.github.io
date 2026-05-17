(function () {
  'use strict';

  var STORAGE_KEY = 'se-gym-hero-avatar';
  var SCHEMA_VERSION = 1;

  var ENUMS = {
    hairStyle: ['short', 'long', 'curly', 'wavy', 'locs', 'braids', 'afro', 'bun', 'ponytail', 'pigtails', 'mohawk', 'undercut', 'top-knot', 'pixie', 'cornrows', 'bowl-cut', 'bob', 'pompadour', 'side-swept', 'dreads-bun', 'bald', 'fade', 'buzz', 'shoulder-length', 'center-part', 'shag', 'coils', 'twist-out', 'box-braids', 'low-bun', 'messy-bun', 'half-up'],
    eyebrowStyle: ['arched', 'straight', 'thick', 'thin', 'rounded', 'angular'],
    bodyType: ['petite', 'slim', 'lean', 'average', 'athletic', 'muscular', 'broad', 'tall', 'curvy', 'hourglass', 'pear', 'voluptuous', 'plus-size'],
    outfitStyle: ['super-suit', 'hoodie', 'varsity-jacket', 'denim-jacket', 'windbreaker', 'lab-coat'],
    accessory: ['none', 'glasses', 'visor', 'headband', 'spectacles', 'mask', 'monocle', 'eyepatch', 'earrings', 'beanie', 'crown', 'halo', 'baseball-cap', 'bucket-hat', 'headwrap', 'hijab', 'turban']
  };

  // Silhouette overlays per body type — combine to suggest feminine/masculine/athletic shapes
  var BODY_SILHOUETTES = {
    'petite':      [],
    'slim':        [],
    'lean':        [],
    'average':     [],
    'athletic':    ['shoulder'],
    'muscular':    ['shoulder'],
    'broad':       ['shoulder'],
    'tall':        [],
    'curvy':       ['bust', 'hip'],
    'hourglass':   ['bust', 'waist', 'hip'],
    'pear':        ['hip'],
    'voluptuous':  ['bust', 'hip'],
    'plus-size':   ['bust', 'hip']
  };
  var ALL_SILHOUETTE_FEATURES = ['bust', 'waist', 'hip', 'shoulder'];
  var HAIR_COVERING_ACCESSORIES = { headwrap: true, hijab: true, turban: true };

  var DEFAULTS = {
    version: SCHEMA_VERSION,
    appearance: {
      skin: '#dfa07a',
      hairColor: '#1f140c',
      hairStyle: 'short',
      eyeColor: '#1f140c',
      eyebrowStyle: 'arched'
    },
    body: { type: 'athletic' },
    outfit: {
      style: 'super-suit',
      suit: '#1F6EBD',
      capeOuter: '#15538f',
      capeInner: '#FFD100',
      accessory: 'none',
      emblem: ''
    }
  };

  var PALETTES = {
    skin: ['#fce0c0', '#f0c294', '#dfa07a', '#c08660', '#a06840', '#7a4e2f', '#5c3a22', '#3d2515'],
    hair: ['#1f140c', '#3d2818', '#6a4830', '#a07050', '#c08555', '#d8b074', '#e8d090', '#704530', '#1a1a1a', '#2e2e2e', '#5e3a2f', '#854a3a', '#b85a3a', '#9a3a2a', '#d8b074', '#7a4a2f'],
    eye: ['#1f140c', '#3a2818', '#5a4030', '#3a5a3a', '#3a5a7a', '#5a3a7a', '#7a4a3a', '#2a2a4a'],
    suit: ['#1F6EBD', '#1F8FBD', '#1FBD8F', '#5A1FBD', '#BD1F6E', '#BD8F1F', '#8FBD1F', '#1FBD1F', '#bd2a2a', '#2a4abd', '#222244', '#2a2a2a'],
    cape: ['#15538f', '#8f1515', '#15568f', '#558f15', '#558f15', '#8f8f15', '#5a158f', '#0f0f0f', '#5a5a5a', '#8f4a15', '#15568f', '#3a3a3a'],
    capeInner: ['#FFD100', '#FF8F00', '#FF1F1F', '#1FFF8F', '#8F1FFF', '#FFFFFF', '#0a0a0a', '#FFE470']
  };

  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randomAvatar() {
    return {
      version: SCHEMA_VERSION,
      appearance: {
        skin: randomFrom(PALETTES.skin),
        hairColor: randomFrom(PALETTES.hair),
        hairStyle: randomFrom(ENUMS.hairStyle),
        eyeColor: randomFrom(PALETTES.eye),
        eyebrowStyle: randomFrom(ENUMS.eyebrowStyle)
      },
      body: { type: randomFrom(ENUMS.bodyType) },
      outfit: {
        style: randomFrom(ENUMS.outfitStyle),
        suit: randomFrom(PALETTES.suit),
        capeOuter: randomFrom(PALETTES.cape),
        capeInner: randomFrom(PALETTES.capeInner),
        accessory: randomFrom(ENUMS.accessory),
        emblem: ''
      }
    };
  }

  function clampByte(n) { return Math.max(0, Math.min(255, Math.round(n))); }

  function lighten(hex, pct) {
    var c = hex.replace('#', '');
    var r = parseInt(c.substr(0, 2), 16);
    var g = parseInt(c.substr(2, 2), 16);
    var b = parseInt(c.substr(4, 2), 16);
    var lr = clampByte(r + (255 - r) * pct);
    var lg = clampByte(g + (255 - g) * pct);
    var lb = clampByte(b + (255 - b) * pct);
    return '#' + [lr, lg, lb].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }

  function darken(hex, pct) {
    var c = hex.replace('#', '');
    var r = parseInt(c.substr(0, 2), 16);
    var g = parseInt(c.substr(2, 2), 16);
    var b = parseInt(c.substr(4, 2), 16);
    var dr = clampByte(r * (1 - pct));
    var dg = clampByte(g * (1 - pct));
    var db = clampByte(b * (1 - pct));
    return '#' + [dr, dg, db].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }

  function setSlot(svg, slotName, option) {
    var groups = svg.querySelectorAll('[data-hero-slot="' + slotName + '"]');
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var opt = g.getAttribute('data-hero-option');
      g.setAttribute('display', opt === option ? 'inline' : 'none');
    }
  }

  function applyToSvg(svg, state) {
    svg.style.setProperty('--hero-skin-light', state.appearance.skin);
    svg.style.setProperty('--hero-skin', darken(state.appearance.skin, 0.22));
    svg.style.setProperty('--hero-hair', state.appearance.hairColor);
    svg.style.setProperty('--hero-hair-light', lighten(state.appearance.hairColor, 0.35));
    svg.style.setProperty('--hero-hair-dark', darken(state.appearance.hairColor, 0.35));
    svg.style.setProperty('--hero-eye', state.appearance.eyeColor);
    svg.style.setProperty('--hero-eyebrow', state.appearance.hairColor);
    svg.style.setProperty('--hero-suit-light', lighten(state.outfit.suit, 0.35));
    svg.style.setProperty('--hero-suit', state.outfit.suit);
    svg.style.setProperty('--hero-suit-dark', darken(state.outfit.suit, 0.4));
    svg.style.setProperty('--hero-cape-light', lighten(state.outfit.capeOuter, 0.3));
    svg.style.setProperty('--hero-cape', state.outfit.capeOuter);
    svg.style.setProperty('--hero-cape-dark', darken(state.outfit.capeOuter, 0.55));
    svg.style.setProperty('--hero-cape-inner-light', lighten(state.outfit.capeInner, 0.4));
    svg.style.setProperty('--hero-cape-inner', state.outfit.capeInner);

    svg.setAttribute('data-hero-body', state.body.type);

    setSlot(svg, 'hair', HAIR_COVERING_ACCESSORIES[state.outfit.accessory] ? 'bald' : state.appearance.hairStyle);
    setSlot(svg, 'eyebrow', state.appearance.eyebrowStyle);
    setSlot(svg, 'outfit-style', state.outfit.style || DEFAULTS.outfit.style);
    setSlot(svg, 'accessory', state.outfit.accessory);

    // Silhouette overlays — show only those mapped to this body type
    var features = BODY_SILHOUETTES[state.body.type] || [];
    for (var f = 0; f < ALL_SILHOUETTE_FEATURES.length; f++) {
      var feat = ALL_SILHOUETTE_FEATURES[f];
      var groups = svg.querySelectorAll('[data-hero-slot="silhouette"][data-hero-feature="' + feat + '"]');
      var show = features.indexOf(feat) !== -1;
      for (var i = 0; i < groups.length; i++) {
        groups[i].setAttribute('display', show ? 'inline' : 'none');
      }
    }

    var emblemGroup = svg.querySelector('[data-hero-slot="emblem"]');
    var emblemText = svg.querySelector('[data-hero-emblem-text]');
    var defaultBuckle = svg.querySelector('[data-hero-buckle-default]');
    var hasEmblem = !!(state.outfit.emblem || '');
    if (emblemGroup && emblemText) {
      emblemText.textContent = state.outfit.emblem || '';
      emblemGroup.setAttribute('display', hasEmblem ? 'inline' : 'none');
    }
    if (defaultBuckle) {
      defaultBuckle.style.display = hasEmblem ? 'none' : '';
    }
  }

  function applyAvatarToScope(state, scope) {
    var svgs = scope.querySelectorAll('[data-gym-hero-svg]');
    for (var i = 0; i < svgs.length; i++) applyToSvg(svgs[i], state);
  }

  var HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
  function isHex(v) { return typeof v === 'string' && HEX_COLOR.test(v); }
  function inEnum(v, key) { return typeof v === 'string' && ENUMS[key].indexOf(v) !== -1; }

  function countGraphemes(s) {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      var seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
      var count = 0;
      var it = seg.segment(s)[Symbol.iterator]();
      while (!it.next().done) count++;
      return count;
    }
    return Array.from(s).length;
  }

  function isValidEmblem(v) {
    if (typeof v !== 'string') return false;
    if (v === '') return true;
    // Accept any single grapheme cluster — covers Extended_Pictographic emoji,
    // flag emojis (Regional_Indicator pairs), ZWJ sequences, skin-tone modifiers,
    // and keycap sequences which Intl.Segmenter correctly groups as one grapheme.
    if (countGraphemes(v) !== 1) return false;
    try {
      // Reject plain ASCII letters/digits — must contain an emoji-class codepoint
      return /\p{Extended_Pictographic}|\p{Regional_Indicator}|[⃣️]/u.test(v);
    } catch (e) {
      // Fallback for older browsers: accept if string is non-trivial in length (most emojis are 2-8 code units)
      return v.length >= 1 && v.length <= 8;
    }
  }

  function validateAvatar(obj) {
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'Invalid JSON object.' };
    if (obj.version !== SCHEMA_VERSION) return { ok: false, error: 'Unsupported version (expected ' + SCHEMA_VERSION + ').' };
    var a = obj.appearance, b = obj.body, o = obj.outfit;
    if (!a || typeof a !== 'object') return { ok: false, error: 'Missing appearance section.' };
    if (!b || typeof b !== 'object') return { ok: false, error: 'Missing body section.' };
    if (!o || typeof o !== 'object') return { ok: false, error: 'Missing outfit section.' };
    if (!isHex(a.skin)) return { ok: false, error: 'Invalid skin color (expected #rrggbb).' };
    if (!isHex(a.hairColor)) return { ok: false, error: 'Invalid hair color.' };
    if (!isHex(a.eyeColor)) return { ok: false, error: 'Invalid eye color.' };
    if (!inEnum(a.hairStyle, 'hairStyle')) return { ok: false, error: 'Invalid hair style.' };
    if (!inEnum(a.eyebrowStyle, 'eyebrowStyle')) return { ok: false, error: 'Invalid eyebrow style.' };
    if (!inEnum(b.type, 'bodyType')) return { ok: false, error: 'Invalid body type.' };
    if (o.style !== undefined && !inEnum(o.style, 'outfitStyle')) return { ok: false, error: 'Invalid outfit style.' };
    if (!isHex(o.suit)) return { ok: false, error: 'Invalid suit color.' };
    if (!isHex(o.capeOuter)) return { ok: false, error: 'Invalid cape outer color.' };
    if (!isHex(o.capeInner)) return { ok: false, error: 'Invalid cape inner color.' };
    if (!inEnum(o.accessory, 'accessory')) return { ok: false, error: 'Invalid accessory.' };
    if (!isValidEmblem(o.emblem)) return { ok: false, error: 'Emblem must be empty or a single emoji.' };
    return { ok: true };
  }

  function loadAvatar() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!validateAvatar(parsed).ok) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function saveAvatar(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function clearAvatar() {
    localStorage.removeItem(STORAGE_KEY);
  }

  window.HeroAvatar = {
    STORAGE_KEY: STORAGE_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    ENUMS: ENUMS,
    DEFAULTS: DEFAULTS,
    randomAvatar: randomAvatar,
    validateAvatar: validateAvatar,
    loadAvatar: loadAvatar,
    saveAvatar: saveAvatar,
    clearAvatar: clearAvatar,
    applyAvatarToScope: applyAvatarToScope,
    applyToSvg: applyToSvg,
    isValidEmblem: isValidEmblem
  };

  function initAvatar() {
    var saved = loadAvatar();
    var state = saved || randomAvatar();
    applyAvatarToScope(state, document);
  }

  function initModal() {
    var modal = document.getElementById('hero-customizer-modal');
    var openBtn = document.getElementById('customize-hero-btn');
    if (!modal || !openBtn) return;

    var previousFocus = null;

    function $(id) { return modal.querySelector('#' + id); }

    function readForm() {
      var bodyChoice = modal.querySelector('input[name="hero-cust-body"]:checked');
      return {
        version: SCHEMA_VERSION,
        appearance: {
          skin: $('hero-cust-skin').value,
          hairColor: $('hero-cust-hair-color').value,
          hairStyle: $('hero-cust-hair-style').value,
          eyeColor: $('hero-cust-eye-color').value,
          eyebrowStyle: $('hero-cust-eyebrow').value
        },
        body: { type: bodyChoice ? bodyChoice.value : 'athletic' },
        outfit: {
          style: $('hero-cust-outfit-style').value,
          suit: $('hero-cust-suit').value,
          capeOuter: $('hero-cust-cape-outer').value,
          capeInner: $('hero-cust-cape-inner').value,
          accessory: $('hero-cust-accessory').value,
          emblem: $('hero-cust-emblem').value
        }
      };
    }

    function writeForm(state) {
      $('hero-cust-skin').value = state.appearance.skin;
      $('hero-cust-hair-color').value = state.appearance.hairColor;
      $('hero-cust-hair-style').value = state.appearance.hairStyle;
      $('hero-cust-eye-color').value = state.appearance.eyeColor;
      $('hero-cust-eyebrow').value = state.appearance.eyebrowStyle;
      var bodyInput = modal.querySelector('input[name="hero-cust-body"][value="' + state.body.type + '"]');
      if (bodyInput) bodyInput.checked = true;
      $('hero-cust-outfit-style').value = state.outfit.style || DEFAULTS.outfit.style;
      $('hero-cust-suit').value = state.outfit.suit;
      $('hero-cust-cape-outer').value = state.outfit.capeOuter;
      $('hero-cust-cape-inner').value = state.outfit.capeInner;
      $('hero-cust-accessory').value = state.outfit.accessory;
      $('hero-cust-emblem').value = state.outfit.emblem;
    }

    function refreshPreview() {
      var s = readForm();
      var preview = modal.querySelector('[data-gym-hero-svg]');
      if (preview) applyToSvg(preview, s);
    }

    function setStatus(msg, isError) {
      var status = $('hero-cust-status');
      if (!status) return;
      status.textContent = msg;
      status.classList.toggle('hero-cust-status-error', !!isError);
    }

    function openModal() {
      previousFocus = document.activeElement;
      var initial = loadAvatar() || randomAvatar();
      writeForm(initial);
      refreshPreview();
      setStatus('');
      modal.hidden = false;
      document.body.classList.add('hero-cust-modal-open');
      modal.classList.add('hero-cust-open');
      var first = $('hero-cust-skin');
      if (first) first.focus();
    }

    function closeModal() {
      modal.hidden = true;
      document.body.classList.remove('hero-cust-modal-open');
      modal.classList.remove('hero-cust-open');
      if (previousFocus && document.contains(previousFocus) && typeof previousFocus.focus === 'function') previousFocus.focus();
    }

    function onKeydown(e) {
      if (modal.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key !== 'Tab') return;
      var focusables = modal.querySelectorAll('input:not([type="file"]), select, button, [tabindex]:not([tabindex="-1"])');
      var visible = [];
      for (var i = 0; i < focusables.length; i++) {
        var el = focusables[i];
        if (!el.disabled && el.offsetParent !== null && !el.hidden) visible.push(el);
      }
      if (visible.length === 0) return;
      var first = visible[0], last = visible[visible.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    function saveAndClose() {
      var state = readForm();
      var v = validateAvatar(state);
      if (!v.ok) { setStatus(v.error, true); return; }
      saveAvatar(state);
      applyAvatarToScope(state, document);
      closeModal();
    }

    function doRandomize() {
      var r = randomAvatar();
      writeForm(r);
      refreshPreview();
      setStatus('Randomized — press Save to keep it.');
    }

    function doReset() {
      writeForm(DEFAULTS);
      refreshPreview();
      setStatus('Reset to defaults — press Save to keep it.');
    }

    function doDownload() {
      var state = readForm();
      var v = validateAvatar(state);
      if (!v.ok) { setStatus(v.error, true); return; }
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'se-gym-hero-avatar.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      setStatus('Downloaded hero avatar JSON.');
    }

    function doUpload(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var parsed = JSON.parse(String(e.target.result));
          var v = validateAvatar(parsed);
          if (!v.ok) { setStatus(v.error, true); return; }
          writeForm(parsed);
          refreshPreview();
          setStatus('Avatar loaded into preview — press Save to keep it.');
        } catch (err) {
          setStatus('Could not parse JSON file.', true);
        }
      };
      reader.onerror = function () { setStatus('Could not read file.', true); };
      reader.readAsText(file);
    }

    openBtn.addEventListener('click', openModal);

    modal.querySelectorAll('input[type="color"], select').forEach(function (el) {
      el.addEventListener('input', refreshPreview);
      el.addEventListener('change', refreshPreview);
    });

    modal.querySelectorAll('input[name="hero-cust-body"]').forEach(function (el) {
      el.addEventListener('change', refreshPreview);
    });

    var emblemInput = $('hero-cust-emblem');
    emblemInput.addEventListener('input', function () {
      var v = emblemInput.value;
      if (!isValidEmblem(v)) {
        setStatus('Emblem must be a single emoji.', true);
        return;
      }
      setStatus('');
      refreshPreview();
    });

    modal.querySelectorAll('[data-emblem-quickpick]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        emblemInput.value = btn.getAttribute('data-emblem-quickpick');
        setStatus('');
        refreshPreview();
      });
    });

    var clearBtn = $('hero-cust-emblem-clear');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      emblemInput.value = '';
      setStatus('');
      refreshPreview();
    });

    $('hero-cust-cancel').addEventListener('click', closeModal);
    $('hero-cust-close').addEventListener('click', closeModal);
    $('hero-cust-save').addEventListener('click', saveAndClose);
    $('hero-cust-randomize').addEventListener('click', doRandomize);
    $('hero-cust-reset').addEventListener('click', doReset);
    $('hero-cust-download').addEventListener('click', doDownload);

    var uploadBtn = $('hero-cust-upload');
    var uploadInput = $('hero-cust-upload-input');
    uploadBtn.addEventListener('click', function () { uploadInput.click(); });
    uploadInput.addEventListener('change', function (e) {
      doUpload(e.target.files && e.target.files[0]);
      uploadInput.value = '';
    });

    document.addEventListener('keydown', onKeydown);

    var backdrop = modal.querySelector('.hero-cust-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeModal);
  }

  function updateCustomizeButtonVisibility() {
    var btn = document.getElementById('customize-hero-btn');
    if (!btn) return;
    var active = !!(window.PersonalGym && typeof window.PersonalGym.isPersonalGymActive === 'function' && window.PersonalGym.isPersonalGymActive());
    btn.hidden = !active;
  }

  function initButtonVisibility() {
    updateCustomizeButtonVisibility();
    var toggle = document.getElementById('activatePersonalGymToggle');
    if (toggle) toggle.addEventListener('change', updateCustomizeButtonVisibility);
  }

  function start() {
    initAvatar();
    initModal();
    initButtonVisibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

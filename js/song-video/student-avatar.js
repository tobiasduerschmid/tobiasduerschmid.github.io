/* Saved SE Gym character or default Bruin, posed at a laptop on the song's clock,
 * and a human or Prof hero's head (the saved one, else the Gym's default
 * human), neck up, for a song character to wear.
 * The saved descriptor and shared renderer remain owned by HeroAvatar.
 */
(function (root) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  let rendererPromise;

  function loadRenderer(scriptUrl, templateUrl) {
    if (root.HeroAvatar) return Promise.resolve(root.HeroAvatar);
    if (!rendererPromise) {
      rendererPromise = new Promise((resolve, reject) => {
        root.SEGymHeroTemplateUrl = templateUrl;
        const script = document.createElement('script');
        script.src = scriptUrl;
        script.async = true;
        script.onload = () => resolve(root.HeroAvatar);
        script.onerror = () => reject(new Error('The optional student avatar could not load.'));
        document.head.appendChild(script);
      });
    }
    return rendererPromise;
  }

  function props(laptopLogo) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 260 300');
    svg.setAttribute('class', 'song-student-props');
    svg.innerHTML = `
      <ellipse class="student-ground" cx="130" cy="291" rx="117" ry="9"/>
      <g class="student-arms">
        <g data-student-motion="arm-left">
          <path class="student-sleeve" d="M79 156 C65 157 56 174 51 190 C45 207 40 227 44 238 C48 251 66 255 85 251 L94 236 C79 239 66 237 65 230 C64 218 71 201 77 188 C84 174 91 162 79 156Z"/>
          <path class="student-sleeve-light" d="M70 169 C58 187 52 213 51 229 C52 238 60 243 71 245 C54 246 47 237 49 225 C51 206 58 181 70 169Z"/>
          <path class="student-sleeve-fold" d="M48 235 Q56 229 64 231"/>
        </g>
        <g data-student-motion="arm-right">
          <path class="student-sleeve" d="M181 156 C195 157 204 174 209 190 C215 207 220 227 216 238 C212 251 194 255 175 251 L166 236 C181 239 194 237 195 230 C196 218 189 201 183 188 C176 174 169 162 181 156Z"/>
          <path class="student-sleeve-light" d="M190 169 C202 187 208 213 209 229 C208 238 200 243 189 245 C206 246 213 237 211 225 C209 206 202 181 190 169Z"/>
          <path class="student-sleeve-fold" d="M212 235 Q204 229 196 231"/>
        </g>
      </g>
      <rect class="student-desk-edge" x="9" y="279" width="242" height="8" rx="4"/>
      <rect class="student-desk" x="6" y="272" width="248" height="9" rx="4.5"/>
      <ellipse class="student-contact-shadow" cx="130" cy="274" rx="85" ry="2.5"/>
      <!-- The keyboard extends away from us, behind this single metal lid.
           Its tapered silhouette, hinge and embossed mark identify the back. -->
      <path class="student-laptop-base" d="M52 263 H208 L213 271 Q213 273 209 273 H51 Q47 273 47 271Z"/>
      <path class="student-laptop-rear" d="M54 190 H206 Q213 190 212 197 L207 267 Q207 270 203 270 H57 Q53 270 53 267 L48 197 Q47 190 54 190Z"/>
      <path class="student-laptop-sheen" d="M54 193 H206 Q209 193 209 197 L207 219 C163 208 102 207 51 214 L51 197 Q51 193 54 193Z"/>
      <path class="student-laptop-top-edge" d="M54 191 H206"/>
      <path class="student-laptop-hinge" d="M91 270 H169"/>
      <g class="student-laptop-mark">
        <path d="M124 220 V239 M124 226 C124 230 138 228 138 234"/>
        <circle cx="124" cy="218" r="3"/><circle cx="124" cy="242" r="3"/><circle cx="138" cy="237" r="3"/>
      </g>`;
    if (laptopLogo) {
      const emblem = document.createElementNS(SVG_NS, 'image');
      emblem.setAttribute('class', 'student-laptop-logo');
      emblem.setAttribute('href', laptopLogo);
      emblem.setAttribute('x', '111');
      emblem.setAttribute('y', '211');
      emblem.setAttribute('width', '38');
      emblem.setAttribute('height', '38');
      svg.querySelector('.student-laptop-mark').replaceWith(emblem);
    }
    return svg;
  }

  function motionWrapper(element, name) {
    if (!element) return null;
    const group = document.createElementNS(SVG_NS, 'g');
    group.dataset.studentMotion = name;
    element.before(group);
    group.appendChild(element);
    return group;
  }

  /**
   * Two brief, unequally spaced blinks per 9.6 s cycle, from 0 (open) to 1
   * (shut). Song time is the entire state, so seeking backward restores
   * open or closed eyes too.
   */
  function blinkAt(time) {
    const phase = time % 9.6;
    const elapsed = phase - (phase >= 6.8 ? 6.8 : 2.4);
    return Math.max(0, Math.min(1, elapsed / 0.06, (0.2 - elapsed) / 0.1));
  }

  /**
   * A hero's eye layers: open eyes, lashes, closed lids, and the parts that
   * glance. Contact shading and the eye opening stay fixed; only each iris,
   * pupil, its fibers and catchlights move inside their clips.
   */
  function eyeParts(svg) {
    const kind = svg.getAttribute('data-hero-kind');
    const attribute = kind === 'bruin' ? 'data-hero-bruin-expression' : kind === 'tobias' ? 'data-hero-tobias' : 'data-hero-motion';
    const open = svg.querySelector(`[${attribute}="${kind === 'human' ? 'eye-blink' : 'eyes-open'}"]`);
    const closed = svg.querySelector(`[${attribute}="${kind === 'human' ? 'closed-eyelids' : 'eyes-closed'}"]`);
    const lashes = kind === 'human' ? svg.querySelector('[data-hero-motion="eyelash-blink"]') : null;
    const gaze = [];
    open?.querySelectorAll('g[clip-path]').forEach((clip) => {
      // Keep the renderer's direct-child CSS selectors and paint order.
      // Motion composes onto each part's saved transform instead of adding
      // a wrapper between the clip and its iris/pupil artwork.
      for (const part of clip.children) {
        if (['circle', 'ellipse', 'g'].includes(part.localName) ||
          (part.localName === 'path' && (part.getAttribute('stroke') || '').includes('--hero-eye-light'))) {
          gaze.push({ node: part, transform: part.getAttribute('transform') || '' });
        }
      }
    });
    return { open, closed, lashes, gaze };
  }

  /** Moves every gazing part by (dx, dy) hero units over its own transform. */
  function glance(gaze, dx, dy) {
    for (const { node, transform } of gaze) node.setAttribute('transform', `translate(${dx} ${dy}) ${transform}`.trim());
  }

  /** Compose outside the shared fit transforms; move pupils inside fixed clips. */
  function portraitMotion(svg) {
    const isBruin = svg.getAttribute('data-hero-kind') === 'bruin';
    const head = motionWrapper(svg.querySelector(isBruin ? '[data-hero-bruin-anatomy="head"]' : '[data-hero-head-assembly]'), 'head');
    const { open, closed, lashes, gaze } = eyeParts(svg);
    if (open) open.dataset.studentMotion = 'blink-open';
    if (closed) closed.dataset.studentMotion = 'blink-closed';
    for (const { node } of gaze) node.dataset.studentMotion = 'gaze';
    return (time, reduced) => {
      const nod = reduced ? 0 : Math.sin(time * 1.23) * 2.2;
      const tilt = reduced ? 0 : Math.sin(time * 0.79) * 1.2;
      if (head) {
        const pivot = isBruin ? 257 : 236;
        head.setAttribute('transform', `translate(0 ${2.4 + nod}) rotate(${tilt} 400 ${pivot}) translate(400 ${pivot}) scale(1 .975) translate(-400 -${pivot})`);
      }
      // The eyes track the student's screen.
      const across = reduced ? 0 : Math.sin(time * 0.91) * 0.7;
      const down = (isBruin ? 2.3 : 1.3) + (reduced ? 0 : Math.sin(time * 0.63) * 0.3);
      glance(gaze, across, down);
      const blink = reduced ? 0 : blinkAt(time);
      if (open) open.setAttribute('opacity', String(1 - blink));
      if (closed) closed.setAttribute('opacity', String(blink));
      if (lashes) lashes.setAttribute('opacity', String(1 - blink));
    };
  }

  /** Song time drives every pose: stop the copy's own clock for good. */
  function stopOwnMotion(svg) {
    if (typeof svg.pauseAnimations === 'function') svg.pauseAnimations();
    if (svg._seGymStandaloneMotionTimer) root.clearTimeout(svg._seGymStandaloneMotionTimer);
    svg._seGymStandaloneMotionTimer = null;
    svg._seGymStandaloneMotionStopped = true;
    svg.querySelectorAll('animate, animateTransform, animateMotion, set').forEach((node) => node.remove());
  }

  /** Removes a layer, or only hides it: a kept clip or use may name an ID inside. */
  function discard(node) {
    if (node.id || node.querySelector('[id]')) node.setAttribute('display', 'none');
    else node.remove();
  }

  /**
   * Discard unselected options only after the shared renderer has resolved
   * body/head fitting, accessories, and fine tuning. Definitions stay.
   */
  function dropUnselected(svg) {
    svg.querySelectorAll('[data-hero-slot][display="none"], [data-hero-kind-layer][display="none"]').forEach((node) => {
      if (!node.closest('defs')) discard(node);
    });
  }

  /** The renderer's colour tokens, for artwork drawn outside the hero's SVG. */
  function heroTokens(svg) {
    return Array.from(svg.style).filter((name) => name.startsWith('--hero-'))
      .map((name) => [name, svg.style.getPropertyValue(name)]);
  }

  /** Modify only the newly mounted copy; the Gym template stays unchanged. */
  function preparePortrait(svg, host) {
    stopOwnMotion(svg);
    svg.querySelectorAll('[data-hero-human-arms], [data-hero-slot="mascot-arms"], [data-hero-motion="barbell-lift"], [data-hero-motion="cape-rock"]').forEach((node) => node.remove());
    // Gym stage glows/rings are siblings of the figure. Cropping them to a
    // portrait produces a rectangular aura, so keep only the character here.
    Array.from(svg.children).forEach((child) => {
      if (child.getAttribute('pointer-events') === 'none' || child.getAttribute('data-hero-slot') === 'milestone-power') child.remove();
    });
    dropUnselected(svg);
    svg.setAttribute('viewBox', '210 40 380 365');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    for (const [name, value] of heroTokens(svg)) host.style.setProperty(name, value);
    host.dataset.heroKind = svg.getAttribute('data-hero-kind');
    return portraitMotion(svg);
  }

  // ------------------------------------------------------------------
  // A hero's head, neck up, for another song character to wear
  // ------------------------------------------------------------------

  // The default face in the Gym's own coordinates: centred on x = 400, chin
  // at y = 240.6, and 100 units wide (with the head assembly's 1.16 scale).
  // Saved head shapes and fine tuning keep their offsets from it.
  const FACE = { x: 400, chin: 240.6, width: 100 };

  /**
   * Keeps everything neck up: the head assembly (face, hair, ears, and head
   * accessories) and the neck beneath it. Body-bound accessories inside the
   * assembly (pendants, lanyards, bags, companions) leave with the body.
   * Returns false when the template has no head assembly.
   */
  function pruneToHead(svg, bodyBound) {
    const kept = [svg.querySelector('[data-hero-head-assembly]'), svg.querySelector('[data-hero-neck-base]')];
    if (!kept[0]) return false;
    const ancestors = new Set();
    for (const node of kept) for (let up = node?.parentElement; up && up !== svg; up = up.parentElement) ancestors.add(up);
    (function keepHead(parent) {
      for (const child of Array.from(parent.children)) {
        if (kept.includes(child) || child.localName === 'defs' || child.localName === 'style') continue;
        if (ancestors.has(child)) keepHead(child);
        else discard(child);
      }
    })(svg);
    svg.querySelectorAll('[data-hero-slot="accessory"]').forEach((group) => {
      if (bodyBound.includes(group.getAttribute('data-hero-option'))) discard(group);
    });
    dropUnselected(svg);
    return true;
  }

  // A paint, clip, mask, or use reference to an ID: url(#id), or "#id".
  const REFERENCE = /url\((["']?)#([^"')\s]+)\1\)|^#(\S+)$/g;

  /**
   * Removes definitions and hidden layers that nothing shown refers to, so a
   * copy carries only its own artwork. References are followed through
   * referenced definitions; style sheets and <defs> elements stay.
   */
  function dropUnreferenced(svg) {
    const byId = new Map(Array.from(svg.querySelectorAll('[id]'), (node) => [node.id, node]));
    const referenced = new Set();
    const pending = [svg, ...Array.from(svg.querySelectorAll('*')).filter((node) =>
      node.localName === 'style' || !node.closest('defs, [display="none"]'))];
    while (pending.length) {
      const node = pending.pop();
      const texts = Array.from(node.attributes, (attribute) => attribute.value);
      if (node.localName === 'style') texts.push(node.textContent);
      for (const text of texts) {
        for (const match of text.matchAll(REFERENCE)) {
          const id = match[2] || match[3];
          const target = byId.get(id);
          if (!target || referenced.has(id)) continue;
          referenced.add(id);
          pending.push(target, ...target.querySelectorAll('*'));
        }
      }
    }
    const holdsReference = (node) => Array.from(node.querySelectorAll('[id]')).some((child) => referenced.has(child.id));
    (function prune(parent, unseen) {
      for (const child of Array.from(parent.children)) {
        if (child.localName === 'style') continue;
        if (child.localName === 'defs') prune(child, true);
        else if (!unseen && child.getAttribute('display') !== 'none') prune(child, false);
        else if (referenced.has(child.id)) continue;
        else if (holdsReference(child)) prune(child, true);
        else child.remove();
      }
    })(svg, false);
  }

  /**
   * One copy's eyes. Masks split the open and closed eye layers at the
   * face's centre line, x = 400 in the head assembly's own units, so a wink
   * shuts one eye while a blink shuts both. Returns shut(left, right), each
   * 0 (open) to 1 (shut), for the eye on that side of the picture.
   */
  function eyelids(svg, { open, closed, lashes }) {
    const defs = svg.querySelector('defs');
    const scope = svg.getAttribute('data-hero-style-scope');
    const element = (name, attributes, parent) => {
      const node = document.createElementNS(SVG_NS, name);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
      parent.appendChild(node);
      return node;
    };
    // Both eyes start open, until the wearer's first frame.
    const split = (name, layers, shown) => {
      const mask = element('mask', { id: `${scope}-${name}`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 800, height: 480 }, defs);
      const halves = [0, 400].map((x) => element('rect', { x, y: 0, width: 400, height: 480, fill: '#fff', 'fill-opacity': shown }, mask));
      for (const layer of layers) {
        // A wrapper applies the mask in the assembly's units; the layer
        // keeps its own transform (the blink pivot).
        const wrapper = document.createElementNS(SVG_NS, 'g');
        wrapper.setAttribute('mask', `url(#${mask.id})`);
        layer.before(wrapper);
        wrapper.appendChild(layer);
        layer.setAttribute('opacity', '1');
      }
      return halves;
    };
    const opened = split('eyes-open', [open, lashes].filter(Boolean), 1);
    const shut = split('eyes-shut', [closed].filter(Boolean), 0);
    return (left, right) => {
      [left, right].forEach((amount, side) => {
        opened[side].setAttribute('fill-opacity', String(1 - amount));
        shut[side].setAttribute('fill-opacity', String(amount));
      });
    };
  }

  /**
   * Splits a copy's brows into a group per side of the face's centre line,
   * so each can move on its own: every brow part starts on its own side.
   * Returns [left, right] in the picture, or null without brows.
   */
  function browSides(svg) {
    const slot = svg.querySelector('[data-hero-slot="eyebrow"]:not([display="none"])');
    if (!slot) return null;
    const sides = [0, 1].map(() => document.createElementNS(SVG_NS, 'g'));
    for (const part of Array.from(slot.children)) {
      const start = parseFloat((part.getAttribute('d') || '').replace(/^\s*M\s*/i, ''));
      if (!Number.isNaN(start)) sides[start < FACE.x ? 0 : 1].appendChild(part);
    }
    slot.append(...sides);
    return sides;
  }

  /**
   * A copy's mouth in a wrapper that can draw it in to a small pucker about
   * its own centre (measured once it is on screen). Returns pucker(amount),
   * 0 (as drawn) to 1, or null without a mouth slot (the Prof's portrait).
   */
  function mouthPucker(svg) {
    const mouth = svg.querySelector('[data-hero-slot="mouth-style"]:not([display="none"])');
    if (!mouth) return null;
    const wrapper = document.createElementNS(SVG_NS, 'g');
    mouth.before(wrapper);
    wrapper.appendChild(mouth);
    let centre = null;
    return (amount) => {
      if (!centre) {
        if (!amount) return;
        const box = wrapper.getBBox();
        if (!box.width) return;
        centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      }
      const { x, y } = centre;
      wrapper.setAttribute('transform', `translate(${x} ${y}) scale(${(1 - 0.6 * amount).toFixed(3)} ${(1 - 0.35 * amount).toFixed(3)}) translate(${-x} ${-y})`);
    };
  }

  /**
   * The worn head's motion at song time: it blinks by itself (not under
   * reduced motion), look −1 … 1 glances to the picture's left … right,
   * down 0–1 looks down, wink 0–1 shuts the character's left eye (the
   * picture's right), its brow dipping, brow 0–1 raises the other brow, and
   * hush 0–1 purses the lips.
   */
  function wornMotion(svg) {
    const eyes = eyeParts(svg);
    const shut = eyelids(svg, eyes);
    const brows = browSides(svg);
    const pucker = mouthPucker(svg);
    let drawn = '';
    return (time, { look = 0, down = 0, wink = 0, brow = 0, hush = 0 } = {}, reduced = false) => {
      const blink = reduced ? 0 : blinkAt(time);
      const state = `${look}|${down}|${blink}|${wink}|${brow}|${hush}`;
      if (state === drawn) return;
      drawn = state;
      glance(eyes.gaze, look * 2.8, down * 2.4);
      shut(blink, Math.max(blink, wink));
      brows?.[0].setAttribute('transform', `translate(0 ${(-6 * brow).toFixed(2)})`);
      brows?.[1].setAttribute('transform', `translate(0 ${(2 * wink).toFixed(2)})`);
      pucker?.(hush);
    };
  }

  /**
   * A hero's head as a source for wearers. wear(layers, face) adds private
   * copies (their own IDs) whose default face is centred on face.x with its
   * chin at face.chin, face.width wide, in the wearer's units: the neck in
   * layers.underCollar, beneath the wearer's collar, and the face with its
   * hair, beard, and head accessories in layers.overCollar, so a beard or
   * long hair falls over the collar. The Prof's fixed portrait paints its
   * own neck as part of the face (and has no beard or long hair), so all of
   * it goes under the collar. wear returns the eyes' motion; tokens are the
   * hero's colour tokens, for the wearer's own skin (hands) to match.
   */
  function wearableHead(avatar, master) {
    const ownNeck = master.getAttribute('data-hero-kind') === 'tobias';
    const neck = ownNeck ? null : master.cloneNode(true);
    if (neck) {
      neck.querySelector('[data-hero-head-assembly]').remove();
      neck.dataset.testid = 'song-hero-neck';
      master.querySelector('[data-hero-neck-base]')?.remove();
      dropUnreferenced(neck);
    }
    master.dataset.testid = 'song-hero-head';
    dropUnreferenced(master);
    const box = master.viewBox.baseVal;
    return {
      kind: master.getAttribute('data-hero-kind'),
      tokens: heroTokens(master),
      wear({ underCollar, overCollar }, { x, chin, width }) {
        const scale = width / FACE.width;
        const placed = (layer) => {
          const copy = avatar.cloneSvg(layer, 'song-head');
          copy.setAttribute('x', String(x + (box.x - FACE.x) * scale));
          copy.setAttribute('y', String(chin + (box.y - FACE.chin) * scale));
          copy.setAttribute('width', String(box.width * scale));
          copy.setAttribute('height', String(box.height * scale));
          return copy;
        };
        const face = placed(master);
        const motion = wornMotion(face);
        if (neck) underCollar.appendChild(placed(neck));
        (ownNeck ? underCollar : overCollar).appendChild(face);
        return motion;
      },
    };
  }

  /** One portrait is reused for every scheduled cameo. Never saves. */
  function create(parent, stage, { laptopLogo } = {}) {
    const node = document.createElement('div');
    node.className = 'song-student-avatar is-laptop-only';
    node.dataset.testid = 'song-student-avatar';
    node.dataset.avatarState = 'fallback';
    node.setAttribute('aria-hidden', 'true');
    node.hidden = true;
    const portrait = document.createElement('div');
    portrait.className = 'song-student-portrait';
    node.append(portrait, props(laptopLogo));
    parent.appendChild(node);
    const cameos = [];
    let disposed = false;
    let lastTime = 0;
    let sourceHost;
    let posePortrait;
    const reducedMotion = root.matchMedia('(prefers-reduced-motion: reduce)');
    const leftArm = node.querySelector('[data-student-motion="arm-left"]');
    const rightArm = node.querySelector('[data-student-motion="arm-right"]');

    function draw(time) {
      lastTime = time;
      const cue = cameos.find(({ from, to }) => time >= from && time < to);
      node.hidden = !cue;
      if (!cue) return;
      // A cue may glide to a second placement: move = { at, duration, x, y, scale }.
      let { x, y, scale } = cue;
      if (cue.move) {
        const u = Math.min(1, Math.max(0, (time - cue.move.at) / cue.move.duration));
        const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        x += (cue.move.x - x) * e;
        y += (cue.move.y - y) * e;
        scale += (cue.move.scale - scale) * e;
      }
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.style.transform = `scale(${scale})`;
      node.style.opacity = String(Math.min(1, (time - cue.from) / 0.35, (cue.to - time) / 0.35));
      const localTime = time - cue.from;
      const reduced = reducedMotion.matches;
      if (posePortrait) posePortrait(localTime, reduced);
      // Small alternating shoulder/forearm motions imply typing behind the
      // lid. The arm attachment points stay fixed and no hand crosses it.
      const typing = reduced ? 0 : Math.sin(localTime * 8.2) * 1.2 + Math.sin(localTime * 3.3) * 0.6;
      leftArm.setAttribute('transform', `rotate(${typing} 80 160)`);
      rightArm.setAttribute('transform', `rotate(${-typing * 0.8} 180 160)`);
    }

    // Share one validated, read-only snapshot with other characters in this scene.
    // Export stages omit these URLs and never read personal browser data.
    const { avatarScript, avatarTemplate } = stage.dataset;
    const savedAvatar = avatarScript && avatarTemplate
      ? loadRenderer(avatarScript, avatarTemplate)
        .then((avatar) => avatar ? { avatar, saved: avatar.loadAvatar() } : null)
        .catch(() => null)
      : Promise.resolve(null);
    const savedAppearance = savedAvatar.then((result) => {
      if (!result || !result.saved) return null;
      const { avatar, saved } = result;
      const { skin, hairColor: hair } = saved.appearance;
      const tones = avatar.avatarContrastTokens(skin, hair);
      const darkInk = '#1b1640';
      const lightInk = '#ffffff';
      const ink = avatar.contrastRatio(skin, darkInk) >= avatar.contrastRatio(skin, lightInk) ? darkInk : lightInk;
      return {
        kind: saved.kind, skin, ink, glint: ink === darkInk ? lightInk : darkInk,
        skinShadow: tones.skinShadow, skinHighlight: tones.skinHighlightSoft,
        skinIsDark: avatar.contrastRatio(skin, lightInk) >= 4.5,
        hair, hairIsDark: avatar.contrastRatio(hair, lightInk) >= 3,
      };
    });

    async function hydrate() {
      try {
        const result = await savedAvatar;
        if (disposed || !result) return;
        const { avatar, saved } = result;
        sourceHost = document.createElement('div');
        sourceHost.className = 'song-student-source';
        sourceHost.setAttribute('aria-hidden', 'true');
        document.body.appendChild(sourceHost);
        const mounted = await avatar.mountSavedAvatar(sourceHost, { variant: 'song-student', fallbackKind: 'bruin' });
        const svg = sourceHost.querySelector('svg');
        if (!mounted || !svg) return;
        posePortrait = preparePortrait(svg, node);
        if (disposed) return;
        portrait.appendChild(svg);
        node.classList.remove('is-laptop-only');
        node.dataset.avatarState = saved ? 'saved' : 'default';
        draw(lastTime);
      } catch (_) {
        // Personalization is optional; the laptop and the song remain usable.
      } finally {
        if (sourceHost) sourceHost.remove();
      }
    }

    // A hero's head for song characters to wear, rendered once on the first
    // request: the saved human or Prof hero's, else (no saved hero, or the
    // Bruin) the SE Gym's default human hero's, which is never saved. It
    // resolves to null on export stages, which never load the renderer, or
    // if the renderer fails.
    let wearable;
    function heroHead() {
      if (!wearable) {
        wearable = savedAvatar.then(async (result) => {
          if (disposed || !result) return null;
          const { avatar, saved } = result;
          const state = saved && ['human', 'tobias'].includes(saved.kind) ? saved : JSON.parse(JSON.stringify(avatar.DEFAULTS));
          const host = document.createElement('div');
          host.className = 'song-student-source';
          host.setAttribute('aria-hidden', 'true');
          document.body.appendChild(host);
          try {
            const master = await avatar.createSvg('song-head');
            if (!master) return null;
            host.appendChild(master);
            avatar.applyToSvg(master, state);
            stopOwnMotion(master);
            if (!pruneToHead(master, avatar.ACCESSORY_COMPATIBILITY.bodyBoundAccessories)) return null;
            // Scope-wide renderer updates must never re-dress the pruned head.
            master.removeAttribute('data-gym-hero-svg');
            master.classList.add('song-hero-head');
            return wearableHead(avatar, master);
          } finally {
            host.remove();
          }
        }).catch(() => null);
      }
      return wearable;
    }

    root.Timeline.onFrame(draw);
    root.Timeline.onDispose(() => {
      disposed = true;
      if (sourceHost) sourceHost.remove();
      node.remove();
    });
    // Promise work is deliberately detached from SongScene.build/playback.
    void hydrate();
    return { appear: (cue) => cameos.push(cue), savedAppearance, heroHead };
  }

  root.SongStudentAvatar = { create };
})(window);

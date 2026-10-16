/* Saved SE Gym character or default Bruin, posed at a laptop on the song's clock.
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

  /** Compose outside the shared fit transforms; move pupils inside fixed clips. */
  function portraitMotion(svg) {
    const kind = svg.getAttribute('data-hero-kind');
    const isBruin = kind === 'bruin';
    const head = motionWrapper(svg.querySelector(isBruin ? '[data-hero-bruin-anatomy="head"]' : '[data-hero-head-assembly]'), 'head');
    const eyeAttribute = isBruin ? 'data-hero-bruin-expression' : kind === 'tobias' ? 'data-hero-tobias' : 'data-hero-motion';
    const open = svg.querySelector(`[${eyeAttribute}="${kind === 'human' ? 'eye-blink' : 'eyes-open'}"]`);
    const closed = svg.querySelector(`[${eyeAttribute}="${kind === 'human' ? 'closed-eyelids' : 'eyes-closed'}"]`);
    const lashes = kind === 'human' ? svg.querySelector('[data-hero-motion="eyelash-blink"]') : null;
    const gaze = [];
    if (open) {
      open.dataset.studentMotion = 'blink-open';
      open.querySelectorAll('g[clip-path]').forEach((clip) => {
        // Contact shading and the eye opening stay fixed. Only the iris,
        // pupil, its fibers and catchlights track the student's screen.
        const parts = Array.from(clip.children).filter((child) =>
          ['circle', 'ellipse', 'g'].includes(child.localName) ||
          (child.localName === 'path' && (child.getAttribute('stroke') || '').includes('--hero-eye-light')));
        if (!parts.length) return;
        // Keep the renderer's direct-child CSS selectors and paint order.
        // Compose motion onto each part's saved transform instead of adding
        // a wrapper between the clip and its iris/pupil artwork.
        parts.forEach((part) => {
          part.dataset.studentMotion = 'gaze';
          gaze.push({ node: part, transform: part.getAttribute('transform') || '' });
        });
      });
    }
    if (closed) closed.dataset.studentMotion = 'blink-closed';
    return (time, reduced) => {
      const nod = reduced ? 0 : Math.sin(time * 1.23) * 2.2;
      const tilt = reduced ? 0 : Math.sin(time * 0.79) * 1.2;
      if (head) {
        const pivot = isBruin ? 257 : 236;
        head.setAttribute('transform', `translate(0 ${2.4 + nod}) rotate(${tilt} 400 ${pivot}) translate(400 ${pivot}) scale(1 .975) translate(-400 -${pivot})`);
      }
      const glance = reduced ? 0 : Math.sin(time * 0.91) * 0.7;
      const down = (isBruin ? 2.3 : 1.3) + (reduced ? 0 : Math.sin(time * 0.63) * 0.3);
      gaze.forEach(({ node, transform }) => node.setAttribute('transform', `translate(${glance} ${down}) ${transform}`.trim()));
      // Two brief, unequally spaced blinks per cycle. Absolute song time is
      // the entire state, so seeking backward restores open/closed eyes too.
      const phase = time % 9.6;
      const blinkAt = phase >= 6.8 ? 6.8 : 2.4;
      const elapsed = phase - blinkAt;
      const blink = reduced ? 0 : Math.max(0, Math.min(1, elapsed / 0.06, (0.2 - elapsed) / 0.1));
      if (open) open.setAttribute('opacity', String(1 - blink));
      if (closed) closed.setAttribute('opacity', String(blink));
      if (lashes) lashes.setAttribute('opacity', String(1 - blink));
    };
  }

  /** Modify only the newly mounted copy; the Gym template stays unchanged. */
  function preparePortrait(svg, host) {
    if (typeof svg.pauseAnimations === 'function') svg.pauseAnimations();
    if (svg._seGymStandaloneMotionTimer) root.clearTimeout(svg._seGymStandaloneMotionTimer);
    svg._seGymStandaloneMotionTimer = null;
    svg._seGymStandaloneMotionStopped = true;
    svg.querySelectorAll('animate, animateTransform, animateMotion, set').forEach((node) => node.remove());
    svg.querySelectorAll('[data-hero-human-arms], [data-hero-slot="mascot-arms"], [data-hero-motion="barbell-lift"], [data-hero-motion="cape-rock"]').forEach((node) => node.remove());
    // Gym stage glows/rings are siblings of the figure. Cropping them to a
    // portrait produces a rectangular aura, so keep only the character here.
    Array.from(svg.children).forEach((child) => {
      if (child.getAttribute('pointer-events') === 'none' || child.getAttribute('data-hero-slot') === 'milestone-power') child.remove();
    });
    // Discard unselected options only after the shared renderer has resolved
    // body/head fitting, accessories, and fine tuning. Groups with IDs may be
    // referenced by a surviving clip/use, so retain those and all definitions.
    svg.querySelectorAll('[data-hero-slot][display="none"], [data-hero-kind-layer][display="none"]').forEach((node) => {
      if (!node.closest('defs') && !node.id && !node.querySelector('[id]')) node.remove();
    });
    svg.setAttribute('viewBox', '210 40 380 365');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    for (let index = 0; index < svg.style.length; index += 1) {
      const property = svg.style[index];
      if (property.startsWith('--hero-')) host.style.setProperty(property, svg.style.getPropertyValue(property));
    }
    host.dataset.heroKind = svg.getAttribute('data-hero-kind');
    return portraitMotion(svg);
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
      node.style.left = `${cue.x}px`;
      node.style.top = `${cue.y}px`;
      node.style.transform = `scale(${cue.scale})`;
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
      const skin = saved.appearance.skin;
      const darkInk = '#1b1640';
      const lightInk = '#ffffff';
      const ink = avatar.contrastRatio(skin, darkInk) >= avatar.contrastRatio(skin, lightInk) ? darkInk : lightInk;
      return { kind: saved.kind, skin, ink, glint: ink === darkInk ? lightInk : darkInk };
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

    root.Timeline.onFrame(draw);
    root.Timeline.onDispose(() => {
      disposed = true;
      if (sourceHost) sourceHost.remove();
      node.remove();
    });
    // Promise work is deliberately detached from SongScene.build/playback.
    void hydrate();
    return { appear: (cue) => cameos.push(cue), savedAppearance };
  }

  root.SongStudentAvatar = { create };
})(window);

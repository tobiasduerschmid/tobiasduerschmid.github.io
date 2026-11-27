/* Chapter progress, checkpoint navigation, and closer-look markers, shared by
   every narration kind. The native range remains the scrubbing and keyboard
   control. */
(function () {
  'use strict';

  /** `looks` are [{ time, title }] in lesson order; `onLook(look)` opens one. */
  function bind(root, { story, timing, checkScenes = [], onCheck, looks = [], onLook }) {
    const timeline = root.querySelector('.vn-timeline');
    if (!timeline) return { update() {} }; // Cached markup without a timeline.
    const seek = timeline.querySelector('.nja-seek');
    const segments = timeline.querySelector('.vn-timeline-segments');
    const markers = timeline.querySelector('.vn-timeline-checks');
    const tooltip = timeline.querySelector('[role="tooltip"]');
    const chapter = root.querySelector('.vn-current-chapter');
    const menu = timeline.querySelector('.vn-check-menu');
    const choices = menu.querySelector('.vn-check-choices');
    const closeButton = menu.querySelector('.vn-check-close');
    const track = timeline.querySelector('.vn-timeline-track');
    let currentScene = -1;
    let menuTrigger = null;
    let markerLayout = '';

    const label = index => story.scenes[index].label;
    const clock = time => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
    function sceneAt(time) {
      let index = 0;
      while (index + 1 < timing.scenes.length && timing.scenes[index + 1].start <= time) index++;
      return index;
    }
    function hideLabel() {
      tooltip.hidden = true;
      segments.querySelector('.is-previewed')?.classList.remove('is-previewed');
    }
    function showLabel(title, time, x, index) {
      if (!menu.hidden) return;
      tooltip.querySelector('.vn-preview-title').textContent = title;
      tooltip.querySelector('.vn-preview-time').textContent = clock(time);
      tooltip.hidden = false;
      tooltip.style.left = `${Math.max(0, Math.min(timeline.clientWidth - tooltip.offsetWidth, x - tooltip.offsetWidth / 2))}px`;
      segments.querySelector('.is-previewed')?.classList.remove('is-previewed');
      if (index !== undefined) segments.children[index].classList.add('is-previewed');
    }
    function closeMenu(restoreFocus = true) {
      menu.hidden = true;
      if (!menuTrigger) return;
      const trigger = menuTrigger;
      menuTrigger = null;
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus({ preventScroll: true });
      hideLabel();
    }
    function openCheck(index) {
      closeMenu(false);
      hideLabel();
      onCheck(index);
    }
    function openMenu(button, indices) {
      closeMenu(false);
      hideLabel();
      menuTrigger = button;
      button.setAttribute('aria-expanded', 'true');
      choices.replaceChildren(...indices.map(index => {
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.className = 'vn-check-choice';
        choice.setAttribute('aria-label', `Knowledge check: ${label(index)}`);
        const title = document.createElement('span');
        title.textContent = label(index);
        const time = document.createElement('span');
        time.className = 'vn-check-time';
        time.textContent = clock(timing.scenes[index].end);
        choice.append(title, time);
        choice.addEventListener('click', () => openCheck(index));
        return choice;
      }));
      menu.hidden = false;
      choices.firstElementChild.focus({ preventScroll: true });
    }
    closeButton.addEventListener('click', () => closeMenu());
    menu.addEventListener('keydown', event => event.stopPropagation());
    markers.addEventListener('keydown', event => {
      if (event.key === ' ') event.stopPropagation(); // Native button activation.
    });
    document.addEventListener('pointerdown', event => {
      if (!menu.hidden && !menu.contains(event.target) && !menuTrigger.contains(event.target)) closeMenu(false);
    });

    for (const scene of timing.scenes) {
      const segment = document.createElement('span');
      segment.style.flexGrow = String(scene.end - scene.start);
      segments.appendChild(segment);
    }

    // Dense checkpoints share a dot with an explicit choice list. The timeline
    // stays a single quiet row at phone widths, with full-size touch targets.
    function layoutMarkers() {
      if (!checkScenes.length) return;
      const width = markers.clientWidth;
      if (!width) return;
      const groups = [];
      for (const index of checkScenes) {
        const x = Math.max(12, Math.min(width - 12, timing.scenes[index].end / timing.duration * width));
        const previous = groups.at(-1);
        if (previous && x - previous.x < 28) previous.indices.push(index);
        else groups.push({ x, indices: [index] });
      }
      const layout = JSON.stringify(groups);
      if (layout === markerLayout) return;
      markerLayout = layout;
      const focused = menuTrigger || (markers.contains(document.activeElement) ? document.activeElement : null);
      const focusedScene = focused ? Number(focused.dataset.checkSceneIndex) : null;
      closeMenu(false);
      markers.replaceChildren(...groups.map(({ x, indices }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'vn-timeline-check';
        button.dataset.checkSceneIndex = String(indices[0]);
        button.style.left = `${x - 12}px`;
        const title = indices.length === 1 ? `Knowledge check: ${label(indices[0])}` : `${indices.length} knowledge checks: ${indices.map(label).join(', ')}`;
        button.setAttribute('aria-label', title);
        if (indices.length > 1) {
          button.classList.add('is-grouped');
          button.setAttribute('aria-expanded', 'false');
          button.setAttribute('aria-controls', menu.id);
        }
        const preview = () => showLabel(indices.length > 1 ? `${indices.length} knowledge checks` : title,
          timing.scenes[indices[0]].end, markers.offsetLeft + x);
        button.addEventListener('pointerenter', preview);
        button.addEventListener('focus', preview);
        button.addEventListener('click', () => indices.length === 1 ? openCheck(indices[0]) : openMenu(button, indices));
        return button;
      }));
      if (focusedScene !== null) {
        const index = groups.findIndex(group => group.indices.includes(focusedScene));
        markers.children[index]?.focus({ preventScroll: true });
      }
    }
    markers.hidden = !checkScenes.length;
    new ResizeObserver(layoutMarkers).observe(markers);
    layoutMarkers();

    // Closer looks get their own row, so a marker never covers a check dot.
    const lookRow = timeline.querySelector('.vn-timeline-looks');
    if (lookRow && looks.length) {
      lookRow.hidden = false;
      const icon = lookRow.querySelector('template').content;
      const lookButtons = looks.map(look => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'vn-timeline-look';
        const title = `Closer look: ${look.title}`;
        button.setAttribute('aria-label', `${title}, at ${clock(look.time)}`);
        button.append(icon.cloneNode(true));
        const preview = () => showLabel(title, look.time, lookRow.offsetLeft + button.offsetLeft + 12);
        button.addEventListener('pointerenter', preview);
        button.addEventListener('focus', preview);
        button.addEventListener('click', () => { hideLabel(); onLook(look); });
        return button;
      });
      lookRow.replaceChildren(...lookButtons);
      const layoutLooks = () => {
        const width = lookRow.clientWidth;
        if (!width) return;
        let previous = -Infinity;
        lookButtons.forEach((button, index) => {
          // Keep 24-pixel targets apart when two looks are close together.
          const x = Math.max(12, Math.min(width - 12, Math.max(previous + 26, looks[index].time / timing.duration * width)));
          button.style.left = `${x - 12}px`;
          previous = x;
        });
      };
      new ResizeObserver(layoutLooks).observe(lookRow);
      layoutLooks();
    }

    seek.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      const bounds = seek.getBoundingClientRect();
      const rotated = root.querySelector('[data-vn-video]').classList.contains('is-rotated');
      const fraction = Math.max(0, Math.min(1, rotated ? (event.clientY - bounds.top) / bounds.height : (event.clientX - bounds.left) / bounds.width));
      const time = fraction * timing.duration;
      showLabel(label(sceneAt(time)), time, track.offsetLeft + fraction * track.clientWidth, sceneAt(time));
    });
    function previewPosition() {
      const time = Number(seek.value);
      showLabel(label(sceneAt(time)), time, track.offsetLeft + time / timing.duration * track.clientWidth, sceneAt(time));
    }
    seek.addEventListener('focus', previewPosition);
    seek.addEventListener('input', previewPosition);
    timeline.addEventListener('pointerleave', hideLabel);
    timeline.addEventListener('focusout', event => {
      if (!timeline.contains(event.relatedTarget)) { closeMenu(false); hideLabel(); }
    });
    root.addEventListener('narration-fullscreenchange', () => { closeMenu(false); hideLabel(); });
    const checkpoint = root.querySelector('.narration-check');
    if (checkpoint) new MutationObserver(() => {
      if (!checkpoint.hidden) { closeMenu(false); hideLabel(); }
    }).observe(checkpoint, { attributes: true, attributeFilter: ['hidden'] });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || (tooltip.hidden && menu.hidden)) return;
      closeMenu();
      hideLabel();
      event.preventDefault();
      event.stopPropagation();
    }, { capture: true });

    return {
      update(time) {
        const index = sceneAt(time);
        if (currentScene !== index) {
          currentScene = index;
          chapter.textContent = label(index);
          chapter.title = `${index + 1} / ${story.scenes.length} · ${label(index)}`;
        }
        Array.from(segments.children).forEach((segment, number) => {
          const scene = timing.scenes[number];
          const progress = Math.max(0, Math.min(1, (time - scene.start) / (scene.end - scene.start)));
          segment.style.setProperty('--segment-progress', `${progress * 100}%`);
        });
        seek.setAttribute('aria-valuetext', `${seek.getAttribute('aria-valuetext')} · ${label(currentScene)}`);
      },
    };
  }

  window.NarrationTimeline = { bind };
})();

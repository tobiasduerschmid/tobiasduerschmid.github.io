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
    const markers = timeline.querySelector('.vn-timeline-markers');
    if (!markers) return { update() {} };
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
    const stops = [
      ...checkScenes.map(index => ({ id: `check-${index}`, type: 'check', index,
        title: `Knowledge check: ${label(index)}`, time: timing.scenes[index].end })),
      ...looks.map((look, index) => ({ id: `look-${index}`, type: 'look', look,
        title: `Closer look: ${look.title}`, time: look.time })),
    ].sort((a, b) => a.time - b.time);
    const stopLabel = stop => stop.type === 'look' ? `${stop.title}, at ${clock(stop.time)}` : stop.title;
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
    function openStop(stop) {
      closeMenu(false);
      hideLabel();
      if (stop.type === 'check') onCheck(stop.index);
      else onLook(stop.look);
    }
    function openMenu(button, entries) {
      closeMenu(false);
      hideLabel();
      menuTrigger = button;
      button.setAttribute('aria-expanded', 'true');
      const checksOnly = entries.every(stop => stop.type === 'check');
      menu.setAttribute('aria-label', checksOnly ? 'Choose a knowledge check' : 'Choose a knowledge check or closer look');
      menu.querySelector('strong').textContent = checksOnly ? 'Knowledge checks' : 'Explore this point';
      closeButton.setAttribute('aria-label', checksOnly ? 'Close knowledge checks' : 'Close timeline choices');
      choices.replaceChildren(...entries.map(stop => {
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.className = 'vn-check-choice';
        choice.setAttribute('aria-label', stopLabel(stop));
        const title = document.createElement('span');
        title.textContent = checksOnly ? label(stop.index) : stop.title;
        const time = document.createElement('span');
        time.className = 'vn-check-time';
        time.textContent = clock(stop.time);
        choice.append(title, time);
        choice.addEventListener('click', () => openStop(stop));
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

    // Checks and closer looks share one lane. Nearby stops share a choice
    // list instead of overlapping targets, including at the very end of a
    // narrow timeline. Both kinds remain in chronological keyboard order.
    function layoutMarkers() {
      if (!stops.length) return;
      const width = markers.clientWidth;
      if (!width) return;
      const groups = [];
      for (const stop of stops) {
        const x = Math.max(12, Math.min(width - 12, stop.time / timing.duration * width));
        const previous = groups.at(-1);
        if (previous && x - previous.x < 28) previous.entries.push(stop);
        else groups.push({ x, entries: [stop] });
      }
      const layout = JSON.stringify(groups.map(({ x, entries }) => [x, entries.map(stop => stop.id)]));
      if (layout === markerLayout) return;
      markerLayout = layout;
      const focused = menuTrigger || (markers.contains(document.activeElement) ? document.activeElement : null);
      const focusedStop = focused?.dataset.timelineStop;
      closeMenu(false);
      markers.replaceChildren(...groups.map(({ x, entries }) => {
        const button = document.createElement('button');
        button.type = 'button';
        const hasLook = entries.some(stop => stop.type === 'look');
        button.className = hasLook ? 'vn-timeline-look' : 'vn-timeline-check';
        if (hasLook) button.append(timeline.querySelector('.vn-timeline-look-icon').content.cloneNode(true));
        button.dataset.timelineStop = entries[0].id;
        button.style.left = `${x - 12}px`;
        const groupTitle = `${entries.length} ${hasLook ? 'timeline stops' : 'knowledge checks'}`;
        const title = entries.length === 1 ? stopLabel(entries[0]) : `${groupTitle}: ${entries.map(stopLabel).join(', ')}`;
        button.setAttribute('aria-label', title);
        if (entries.length > 1) {
          button.classList.add('is-grouped');
          button.setAttribute('aria-expanded', 'false');
          button.setAttribute('aria-controls', menu.id);
        }
        const preview = () => showLabel(entries.length > 1 ? groupTitle : title,
          entries[0].time, markers.offsetLeft + x);
        button.addEventListener('pointerenter', preview);
        button.addEventListener('focus', preview);
        button.addEventListener('click', () => entries.length === 1 ? openStop(entries[0]) : openMenu(button, entries));
        return button;
      }));
      if (focusedStop) {
        const index = groups.findIndex(group => group.entries.some(stop => stop.id === focusedStop));
        markers.children[index]?.focus({ preventScroll: true });
      }
    }
    markers.hidden = !stops.length;
    new ResizeObserver(layoutMarkers).observe(markers);
    layoutMarkers();

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

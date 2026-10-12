/* Pointer reordering is an enhancement to the queue's native Move up/down buttons.
 * Commit once on a valid drop; cancellation never changes the order or Undo state. */
(function () {
  'use strict';

  function bind({ list, signal, onMove }) {
    let drag = null;
    let animation = null;
    const listen = (target, type, handler) => target.addEventListener(type, handler, { signal });
    const rows = () => [...list.children];

    function clearMarkers() {
      for (const row of rows()) row.classList.remove('is-drop-before', 'is-drop-after');
    }
    function cancel() {
      if (animation !== null) cancelAnimationFrame(animation);
      animation = null;
      const previous = drag;
      drag = null;
      clearMarkers();
      previous?.row.classList.remove('is-dragging');
      if (previous?.handle.hasPointerCapture(previous.pointerId)) previous.handle.releasePointerCapture(previous.pointerId);
    }
    function destination() {
      const bounds = list.getBoundingClientRect();
      if (drag.x < bounds.left || drag.x > bounds.right || drag.y < bounds.top || drag.y > bounds.bottom) return null;
      const others = rows().filter((row) => row !== drag.row);
      const index = others.findIndex((row) => {
        const rect = row.getBoundingClientRect();
        return drag.y < rect.top + rect.height / 2;
      });
      return index < 0 ? others.length : index;
    }
    function showDestination() {
      clearMarkers();
      drag.index = destination();
      if (drag.index === null || drag.index === rows().indexOf(drag.row)) return;
      const others = rows().filter((row) => row !== drag.row);
      const before = others[drag.index];
      (before || others.at(-1)).classList.add(before ? 'is-drop-before' : 'is-drop-after');
    }
    function scrollFrame() {
      animation = null;
      if (!drag?.active) return;
      const bounds = list.getBoundingClientRect();
      if (drag.x >= bounds.left && drag.x <= bounds.right) {
        const margin = 60;
        const amount = drag.y < margin ? -12 : drag.y > window.innerHeight - margin ? 12 : 0;
        if (amount) window.scrollBy(0, amount);
      }
      showDestination();
      animation = requestAnimationFrame(scrollFrame);
    }
    listen(list, 'pointerdown', (event) => {
      const handle = event.target.closest('.song-playlist-drag-handle');
      if (!handle || !event.isPrimary || event.button !== 0 || list.children.length < 2) return;
      cancel();
      event.preventDefault();
      list.focus({ preventScroll: true }); // Escape must leave any previously focused player iframe.
      drag = { handle, row: handle.closest('[data-id]'), pointerId: event.pointerId,
        x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY,
        active: false, index: null };
      handle.setPointerCapture(event.pointerId);
    });
    listen(list, 'pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.x = event.clientX;
      drag.y = event.clientY;
      if (!drag.active && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) >= 6) {
        drag.active = true;
        drag.row.classList.add('is-dragging');
        animation = requestAnimationFrame(scrollFrame);
      }
      if (drag.active) { event.preventDefault(); showDestination(); }
    });
    listen(list, 'pointerup', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.x = event.clientX;
      drag.y = event.clientY;
      const index = drag.active ? destination() : null;
      const id = drag.row.dataset.id;
      const changed = index !== null && index !== rows().indexOf(drag.row);
      cancel();
      if (changed) onMove(id, index);
    });
    listen(list, 'pointercancel', cancel);
    listen(list, 'lostpointercapture', cancel);
    listen(document, 'keydown', (event) => {
      if (event.key === 'Escape' && drag) { event.preventDefault(); cancel(); }
    });
    listen(window, 'blur', cancel);
    listen(window, 'pagehide', cancel);
    signal.addEventListener('abort', cancel, { once: true });
    return { cancel };
  }
  window.SongPlaylistReorder = { bind };
})();

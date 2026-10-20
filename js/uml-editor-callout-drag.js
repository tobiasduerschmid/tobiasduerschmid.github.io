/* Pointer interaction for callouts; the authoring panel owns source changes. */
(function () {
  'use strict';

  function pathDistance(element, x, y) {
    const length = element.getTotalLength();
    const matrix = element.getScreenCTM();
    let start = element.getPointAtLength(0).matrixTransform(matrix);
    let distance = Infinity;
    for (let step = 1; step <= 24; step++) {
      const end = element.getPointAtLength(length * step / 24).matrixTransform(matrix);
      const dx = end.x - start.x, dy = end.y - start.y;
      const t = Math.max(0, Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / (dx * dx + dy * dy || 1)));
      distance = Math.min(distance, Math.hypot(x - start.x - t * dx, y - start.y - t * dy));
      start = end;
    }
    return distance;
  }

  function nearestTarget(targets, x, y) {
    let nearest = null;
    for (const target of targets) {
      if (!target.element?.isConnected) continue;
      const box = target.element.getBoundingClientRect();
      if (!box.width && !box.height) continue;
      const distance = target.path ? pathDistance(target.element, x, y) :
        Math.hypot(Math.max(box.left - x, 0, x - box.right), Math.max(box.top - y, 0, y - box.bottom));
      const nestedElement = nearest && distance === nearest.distance &&
        box.width * box.height < nearest.box.width * nearest.box.height;
      if (nearest && nearest.distance <= distance && !nestedElement) continue;
      const dx = (x - (box.left + box.width / 2)) / Math.max(box.width, 1);
      const dy = (y - (box.top + box.height / 2)) / Math.max(box.height, 1);
      nearest = { target, box, distance, side: Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'top' : 'bottom') };
    }
    return nearest;
  }

  function install({ svg, targets, callouts, onEdit, onMove }) {
    let drag = null;
    const groups = [...svg.querySelectorAll('.uml-callout')];
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    highlight.setAttribute('class', 'uml-pg-callout-snap-target');
    highlight.setAttribute('aria-hidden', 'true');

    function clearDrag() {
      const previous = drag;
      drag = null;
      if (!previous) return;
      previous.group.removeAttribute('transform');
      previous.group.classList.remove('is-dragging');
      highlight.remove();
      document.removeEventListener('keydown', onEscape, true);
      if (previous.group.hasPointerCapture(previous.pointerId)) previous.group.releasePointerCapture(previous.pointerId);
      return previous;
    }

    function onEscape(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      const previous = clearDrag();
      previous?.group.focus();
    }

    function point(x, y, inverse) {
      return new DOMPoint(x, y).matrixTransform(inverse);
    }

    function showSnap(candidate) {
      if (!candidate) return highlight.remove();
      const inverse = svg.getScreenCTM().inverse();
      const start = point(candidate.box.left, candidate.box.top, inverse);
      const end = point(candidate.box.right, candidate.box.bottom, inverse);
      highlight.setAttribute('x', start.x - 3);
      highlight.setAttribute('y', start.y - 3);
      highlight.setAttribute('width', end.x - start.x + 6);
      highlight.setAttribute('height', end.y - start.y + 6);
      svg.appendChild(highlight);
    }

    groups.forEach((group, index) => {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', 'Edit callout: ' + callouts[index].text);
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.setAttribute('class', 'uml-pg-callout-hint');
      title.textContent = 'Drag to attach to the nearest element. Click or press Enter to edit the target, position, or text.';
      group.appendChild(title);
      group.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          // Keep workspace undo/fullscreen shortcuts, but never act on an old
          // node selection while the user is interacting with a callout.
          const undo = (event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase());
          if (!undo && !['f', 'F', 'Escape'].includes(event.key)) event.stopPropagation();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onEdit(index);
      });
      group.addEventListener('contextmenu', event => {
        event.preventDefault();
        event.stopPropagation();
        onEdit(index);
      });
      group.addEventListener('pointerdown', event => {
        if (event.button !== 0 || drag) return;
        event.preventDefault();
        event.stopPropagation();
        group.focus();
        drag = { group, index, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
          inverse: group.parentNode.getScreenCTM().inverse(), moved: false };
        group.setPointerCapture(event.pointerId);
        document.addEventListener('keydown', onEscape, true);
      });
      group.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.stopPropagation();
        if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4 && !drag.moved) return;
        drag.moved = true;
        group.classList.add('is-dragging');
        const start = point(drag.x, drag.y, drag.inverse);
        const end = point(event.clientX, event.clientY, drag.inverse);
        group.setAttribute('transform', 'translate(' + (end.x - start.x) + ' ' + (end.y - start.y) + ')');
        showSnap(nearestTarget(targets, event.clientX, event.clientY));
      });
      group.addEventListener('pointerup', event => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const previous = clearDrag();
        if (!previous.moved) return onEdit(index);
        const bounds = svg.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
        const candidate = nearestTarget(targets, event.clientX, event.clientY);
        if (candidate) onMove(index, candidate.target.value, candidate.side);
      });
      group.addEventListener('pointercancel', clearDrag);
      group.addEventListener('lostpointercapture', clearDrag);
      group.addEventListener('click', event => event.stopPropagation());
    });
    // A host render can replace the SVG during an interrupted gesture.
    return clearDrag;
  }

  window.UMLCalloutDrag = { install };
})();

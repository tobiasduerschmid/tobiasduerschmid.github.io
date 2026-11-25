/*
 * Checks of a video narration's animated stage, run in the page with
 * page.evaluate at one pose of the stage (docs/video-narration.md, "No
 * overlaps, no occlusion, visible gaps" and "Light and dark mode"). Each
 * function is self-contained, because page.evaluate sends its source.
 * Used by every video narration's spec.
 */

// The wall kit's pieces that sit over or against artwork on purpose, so the
// gap check leaves them out: stickers, stamps, arrows, brackets, frames,
// slots, loops, and structures built from touching parts. A topic adds its
// own (crowdedBoxes(`${WALL_SKIPPED}, .my-piece`)).
const WALL_SKIPPED = '.sticker, .stamp, .kinetic, .confetti-layer, .sk-overlay, .sk-arrow, .sk-bracket, .sk-frame, .sk-slot, .sk-loop, .sk-loop-dot, .sk-loop-label, .sk-dot, .sk-roof, .sk-base, .sk-pillar, .sk-balance-post, .sk-balance-beam, .sk-topic';

// Finds text that another piece's text overlaps, text that a piece drawn after
// it covers, and text outside the stage, in the pose the stage shows now.
function stageTextProblems() {
  const stageNode = document.getElementById('stage');
  const stage = stageNode.getBoundingClientRect();
  const shown = (node) => {
    for (let n = node; n && n !== stageNode; n = n.parentElement) {
      const style = getComputedStyle(n);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.35) return false;
    }
    return true;
  };
  const pieceOf = (node) => {
    let n = node;
    while (n.parentElement && !n.parentElement.matches('.scene, .sk-body')) n = n.parentElement;
    return n.parentElement ? n : null;
  };
  const texts = [];
  const walker = document.createTreeWalker(stageNode, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const piece = node.textContent.trim() && shown(node.parentElement) && pieceOf(node.parentElement);
    if (!piece) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const box of range.getClientRects()) {
      if (box.width > 2 && box.height > 2) texts.push({ piece, text: node.textContent.trim().slice(0, 28), box });
    }
  }
  const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const painted = (piece) => {
    const style = getComputedStyle(piece);
    return style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backgroundImage !== 'none' || [...piece.querySelectorAll('*')].some(shown);
  };
  const problems = new Set();
  texts.forEach((a, i) => {
    if (a.box.left < stage.left - 2 || a.box.right > stage.right + 2 || a.box.top < stage.top - 2 || a.box.bottom > stage.bottom + 2) problems.add(`off stage: ${a.text}`);
    for (const b of texts.slice(i + 1)) {
      if (a.piece !== b.piece && !a.piece.contains(b.piece) && !b.piece.contains(a.piece) && overlap(a.box, b.box) > 30) problems.add(`text on text: ${a.text} / ${b.text}`);
    }
  });
  for (const scene of stageNode.querySelectorAll('.scene')) {
    if (!shown(scene)) continue;
    const pieces = [...scene.children].flatMap((child) => (child.matches('.sk-body') ? [...child.children] : [child])).filter((piece) => shown(piece) && painted(piece) && !piece.matches('.confetti-layer, .sk-overlay'));
    pieces.forEach((cover, i) => {
      const box = cover.getBoundingClientRect();
      for (const t of texts) {
        const index = pieces.indexOf(t.piece);
        // Even one hidden letter counts; the floor ignores the empty corner of a
        // rotated sticker's bounding box.
        if (index >= 0 && index < i && overlap(t.box, box) > Math.max(30, 0.04 * t.box.width * t.box.height)) problems.add(`covered: ${t.text} by ${cover.className}`);
      }
    });
  }
  return [...problems];
}

// Finds painted boxes (cards, badges, notes, panels, chips, days) closer than
// a small gap to another box without one containing the other, in the pose
// the stage shows now. Stickers, stamps, arrows, and structures built from
// touching parts (a temple, a balance, a loop) sit over or against artwork
// on purpose and are left out.
function crowdedBoxes(skipped) {
  const GAP = 4;
  const stageNode = document.getElementById('stage');
  const shown = (node) => {
    for (let n = node; n && n !== stageNode; n = n.parentElement) {
      const style = getComputedStyle(n);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.35) return false;
    }
    return true;
  };
  const painted = (node) => {
    const style = getComputedStyle(node);
    return style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backgroundImage !== 'none' || parseFloat(style.borderTopWidth) > 0;
  };
  const name = (node) => `${node.classList[0]} "${node.textContent.trim().slice(0, 20)}"`;
  const crowded = [];
  for (const scene of stageNode.querySelectorAll('.scene')) {
    if (!shown(scene)) continue;
    const boxes = [...scene.children].flatMap((child) => (child.matches('.sk-body') ? [...child.children] : [child]))
      .filter((piece) => !piece.matches(skipped) && shown(piece) && painted(piece))
      .map((piece) => ({ piece, box: piece.getBoundingClientRect() }));
    boxes.forEach((a, i) => {
      for (const b of boxes.slice(i + 1)) {
        const inside = (outer, inner) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
        if (inside(a.box, b.box) || inside(b.box, a.box)) continue;
        const dx = Math.max(b.box.left - a.box.right, a.box.left - b.box.right);
        const dy = Math.max(b.box.top - a.box.bottom, a.box.top - b.box.bottom);
        if (dx < GAP && dy < GAP) crowded.push(`${name(a.piece)} / ${name(b.piece)}`);
      }
    });
  }
  return crowded;
}

// Finds stage text below 4.5:1 against what is painted behind it, in the pose
// the stage shows now. A translucent fill is blended over the wall's color; a
// gradient counts as its first color stop.
function stageContrastProblems() {
  const stageNode = document.getElementById('stage');
  const parse = (value) => (value.match(/rgba?\(([^)]+)\)/) || [])[1]?.split(',').map(Number);
  // The wall's own color, from the stage's --bg token.
  const wall = (() => {
    const probe = document.createElement('div');
    probe.style.color = getComputedStyle(stageNode).getPropertyValue('--bg');
    stageNode.append(probe);
    const color = parse(getComputedStyle(probe).color);
    probe.remove();
    return color;
  })();
  const luminance = ([r, g, b]) => [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const over = (top, bottom) => {
    const alpha = top[3] ?? 1;
    return [0, 1, 2].map((i) => top[i] * alpha + bottom[i] * (1 - alpha));
  };
  const shown = (node) => {
    for (let n = node; n && n !== stageNode; n = n.parentElement) {
      const style = getComputedStyle(n);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.35) return false;
    }
    return true;
  };
  const behind = (node) => {
    const fills = [];
    for (let n = node; n && n !== stageNode; n = n.parentElement) {
      const style = getComputedStyle(n);
      // The bottom gradient layer is the fill; a layer with transparent stops is only marks on top.
      const layers = style.backgroundImage.split(/,\s*(?=(?:linear|radial|repeating)-gradient)/);
      const base = layers[layers.length - 1];
      const image = base.includes('gradient') && !base.includes('rgba(0, 0, 0, 0)') ? parse(base) : null;
      const color = parse(style.backgroundColor);
      const fill = image || (color && (color[3] ?? 1) > 0 ? color : null);
      if (fill) {
        fills.push(fill);
        if ((fill[3] ?? 1) >= 1) break;
      }
    }
    return fills.reduceRight((under, fill) => over(fill, under), wall);
  };
  const problems = new Set();
  const walker = document.createTreeWalker(stageNode, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const element = node.parentElement;
    if (!node.textContent.trim() || !shown(element) || element.closest('.confetti-layer')) continue;
    const text = over(parse(getComputedStyle(element).color), behind(element));
    const [light, dark] = [luminance(text), luminance(behind(element))].sort((a, b) => b - a);
    const ratio = (light + 0.05) / (dark + 0.05);
    if (ratio < 4.5) problems.add(`${node.textContent.trim().slice(0, 28)}: ${ratio.toFixed(2)}`);
  }
  return [...problems];
}

// Every stage element's painted colors, in document order: what the viewer
// sees, without the pixel noise a GPU-rasterized screenshot carries.
function stagePaint() {
  const props = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'outlineColor', 'fill', 'stroke'];
  return [...document.querySelectorAll('#stage *')].map((node, index) => {
    const style = getComputedStyle(node);
    return `${index} ${node.getAttribute('class') || node.tagName}: ${props.map((prop) => style[prop]).join(' ')}`;
  });
}

module.exports = { WALL_SKIPPED, stageTextProblems, crowdedBoxes, stageContrastProblems, stagePaint };

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

// Finds UML diagrams (js/video-narration/uml-kit.js) on show that break the
// notation: a frame whose tab doesn't state its view after the UML keyword
// that matches it (cmp: C&C view, or its full name on a view's first frame;
// pkg: module view; deployment: allocation view), a frame with no key, and a
// note whose contents paint a background of their own, which would hide its
// outline (a note's paper is the note's own background, under its outline).
function diagramNotationProblems() {
  const stageNode = document.getElementById('stage');
  const VIEWS = { cmp: ['C&C view', 'Component-and-connector (C&C) view'], pkg: ['Module view'], deployment: ['Allocation view'] };
  const shown = (node) => {
    for (let n = node; n && n !== stageNode; n = n.parentElement) {
      const style = getComputedStyle(n);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.35) return false;
    }
    return true;
  };
  const problems = [...stageNode.querySelectorAll('.uk-frame')].filter(shown).flatMap((frame) => {
    const keyword = frame.querySelector('.uk-frame-keyword')?.textContent.trim();
    const name = frame.querySelector('.uk-frame-name')?.textContent.trim() || '';
    const found = [];
    if (!VIEWS[keyword] || !VIEWS[keyword].some((view) => name.startsWith(view))) found.push(`tab names no view: ${keyword} ${name}`);
    if (!frame.querySelector('.uk-key .uk-key-item')) found.push(`no key: ${keyword} ${name}`);
    return found;
  });
  for (const note of stageNode.querySelectorAll('.uk-note')) {
    if (!shown(note)) continue;
    const painted = [...note.querySelectorAll('*')].filter((part) => !part.closest('svg')
      && !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(getComputedStyle(part).backgroundColor));
    if (painted.length) problems.push(`note paints over its outline: ${note.textContent.trim().slice(0, 40)}`);
  }
  return problems;
}

// Finds words that spill out of the piece they are written on, in any kit: a
// card, tag, plaque, tab, label, slot, or note. Each run of text must lie
// inside the nearest element around it that paints a surface: a fill, or a
// border on all four sides (an open bracket's label sits beside its line on
// purpose). Any sideways overflow counts; up or down, only when more than a
// quarter of the text's line box leaves the shape, since a font's ascent and
// descent may exceed a tight shape that still holds every glyph.
function textSpillProblems() {
  const stageNode = document.getElementById('stage');
  const shown = (node) => {
    for (let n = node; n && n !== stageNode; n = n.parentElement) {
      const style = getComputedStyle(n);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.35) return false;
    }
    return true;
  };
  const paints = (element) => {
    const style = getComputedStyle(element);
    if (style.backgroundImage !== 'none') return true;
    if (!/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(style.backgroundColor)) return true;
    return ['Top', 'Right', 'Bottom', 'Left'].every((side) => parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== 'none');
  };
  const problems = new Set();
  const walker = document.createTreeWalker(stageNode, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent.trim() || !shown(node.parentElement)) continue;
    let surface = node.parentElement;
    while (surface && surface !== stageNode && !paints(surface)) surface = surface.parentElement;
    if (!surface || surface === stageNode) continue;
    const box = surface.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(node);
    const spills = [...range.getClientRects()].some((r) => r.width > 0 && r.height > 0
      && (r.left < box.left - 1 || r.right > box.right + 1
        || Math.max(0, box.top - r.top) + Math.max(0, r.bottom - box.bottom) > r.height / 4));
    if (spills) problems.add(`spills out of ${surface.className.baseVal ?? surface.className}: ${node.textContent.trim().slice(0, 40)}`);
  }
  return [...problems];
}

// Non-text contrast (WCAG 1.4.11) for the UML kit's lines: wherever a
// connector runs, its ink, or the casing drawn around it, stands 3:1 apart
// from the ground under it: the sheet, a frame's film, or a paper element.
// Each line is sampled every few pixels, and so is each arrowhead's middle;
// the ground at a point is composited from the stage pieces there, as
// stageContrastProblems composites a text's ground from its ancestors.
function lineContrastProblems() {
  const stageNode = document.getElementById('stage');
  const parse = (value) => (value.match(/rgba?\(([^)]+)\)/) || [])[1]?.split(',').map(Number);
  const wall = (() => {
    const probe = document.createElement('div');
    probe.style.color = getComputedStyle(stageNode).getPropertyValue('--bg');
    stageNode.append(probe);
    const color = parse(getComputedStyle(probe).color);
    probe.remove();
    return color;
  })();
  const luminance = ([r, g, b]) => [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };
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
  const fillOf = (node) => {
    const style = getComputedStyle(node);
    if (node instanceof SVGElement) return node instanceof SVGGraphicsElement && !(node instanceof SVGSVGElement || node instanceof SVGGElement) ? parse(style.fill) : null;
    // The bottom gradient layer is the fill; a layer with transparent stops is only marks on top.
    const layers = style.backgroundImage.split(/,\s*(?=(?:linear|radial|repeating)-gradient)/);
    const base = layers[layers.length - 1];
    return (base.includes('gradient') && !base.includes('rgba(0, 0, 0, 0)') ? parse(base) : null) || parse(style.backgroundColor);
  };
  // The ground under a connector at a screen point: the stage pieces painted
  // beneath it there (not a token passing over it), down to the first opaque one.
  const ground = (piece, x, y) => {
    const fills = [];
    let name = 'the sheet';
    const stack = document.elementsFromPoint(x, y);
    for (const node of stack.slice(stack.findIndex((each) => piece.contains(each)) + 1)) {
      if (node === stageNode || !stageNode.contains(node)) break;
      if (node.closest('.uk-connector') || !shown(node)) continue;
      const fill = fillOf(node);
      if (!fill || (fill[3] ?? 1) === 0) continue;
      if (!fills.length) name = node.getAttribute('class') || node.tagName;
      fills.push(fill);
      if ((fill[3] ?? 1) >= 1) break;
    }
    return { color: fills.reduceRight((under, fill) => over(fill, under), wall), name };
  };
  // Stage pieces ignore the pointer; let them answer elementsFromPoint while sampling.
  const lift = document.createElement('style');
  lift.textContent = '#stage, #stage * { pointer-events: auto !important; }';
  document.head.append(lift);
  const problems = new Set();
  try {
    for (const piece of [...stageNode.querySelectorAll('.uk-connector')].filter(shown)) {
      const art = piece.querySelector('.uk-connector-art');
      const matrix = art.getScreenCTM();
      const casingNode = art.querySelector('.uk-casing');
      const casing = casingNode && getComputedStyle(casingNode).display !== 'none' ? parse(getComputedStyle(casingNode).stroke) : null;
      const check = (ink, local, what) => {
        const point = new DOMPoint(local.x, local.y).matrixTransform(matrix);
        const under = ground(piece, point.x, point.y);
        const best = Math.max(ratio(ink, under.color), casing ? ratio(casing, under.color) : 0);
        if (best < 3) problems.add(`${what} over ${under.name}: ${best.toFixed(2)}`);
        return best >= 3;
      };
      const line = art.querySelector('.uk-line');
      const ink = parse(getComputedStyle(line).stroke);
      const length = line.getTotalLength();
      for (let along = Math.min(2, length / 2); along <= length; along += 6) {
        if (!check(ink, line.getPointAtLength(along), 'a line')) break;
      }
      const head = art.querySelector('.uk-arrow, .uk-note-anchor');
      if (head) {
        const style = getComputedStyle(head);
        const box = head.getBBox();
        check(parse(head.matches('.uk-arrow--filled') ? style.fill : style.stroke), { x: box.x + box.width / 2, y: box.y + box.height / 2 }, 'an arrowhead');
      }
    }
  } finally {
    lift.remove();
  }
  return [...problems];
}

// The C&C rule for attachments: a component meets every attachment at a
// port, and a topic, being a connector, has none. A port straddles the
// outline where its line ends, so a line that ends on a component's outline
// needs a port centred on that end, and no port may sit on a topic's
// channel. (A line drawn to a port's outer face ends clear of the outline.)
function attachmentPortProblems() {
  const stageNode = document.getElementById('stage');
  const shown = (node) => {
    for (let n = node; n && n !== stageNode; n = n.parentElement) {
      const style = getComputedStyle(n);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.35) return false;
    }
    return true;
  };
  const visible = (selector) => [...stageNode.querySelectorAll(selector)].filter(shown);
  const middle = (box) => [box.left + box.width / 2, box.top + box.height / 2];
  const near = (box, [px, py], pad) => px >= box.left - pad && px <= box.right + pad && py >= box.top - pad && py <= box.bottom + pad;
  // A port is 14 stage pixels wide, so its drawn size gives the picture's scale.
  const ports = visible('.uk-port, .uk-end-port').map((port) => {
    const box = port.getBoundingClientRect();
    return { at: middle(box), scale: box.width / 14 };
  });
  const topics = visible('.ak-topic-channel').map((channel) => ({
    name: channel.parentElement.querySelector('.ak-topic-name')?.textContent.trim(), box: channel.getBoundingClientRect(),
  }));
  const components = visible('.uk-component').map((node) => ({
    name: node.querySelector('.uk-name')?.textContent.trim(), box: node.getBoundingClientRect(),
  }));
  const problems = new Set();
  for (const port of ports) {
    const topic = topics.find(({ box }) => near(box, port.at, 3 * port.scale));
    if (topic) problems.add(`a port sits on the topic ${topic.name}`);
  }
  // Each piece of a connector: where its line starts, and where it ends (an arrow's tip).
  for (const piece of visible('.uk-connector:not(.uk-connector--note)')) {
    const art = piece.querySelector('.uk-connector-art');
    const matrix = art.getScreenCTM();
    const scale = Math.hypot(matrix.a, matrix.b);
    const points = (path) => (path?.getAttribute('d').match(/-?[\d.]+/g) || []).map(Number)
      .reduce((all, value, i, list) => (i % 2 ? all : [...all, [value, list[i + 1]]]), [])
      .map(([x, y]) => { const point = new DOMPoint(x, y).matrixTransform(matrix); return [point.x, point.y]; });
    const line = points(art.querySelector('.uk-line'));
    const arrow = points(art.querySelector('.uk-arrow'));
    // An arrow stops at the outer face of its port, half a port from its centre.
    const band = 3 * scale;
    const reach = 14 / 2 * scale + band;
    for (const end of [line[0], arrow.length ? arrow[1] : line[line.length - 1]]) {
      const touched = components.find(({ box }) => near(box, end, band) && !near(box, end, -band));
      if (touched && !ports.some((port) => Math.hypot(port.at[0] - end[0], port.at[1] - end[1]) <= reach)) {
        problems.add(`an attachment meets ${touched.name} without a port`);
      }
    }
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

module.exports = { WALL_SKIPPED, stageTextProblems, crowdedBoxes, stageContrastProblems, diagramNotationProblems, textSpillProblems, attachmentPortProblems, lineContrastProblems, stagePaint };

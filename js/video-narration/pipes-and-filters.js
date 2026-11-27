/*
 * Choreography for the Pipes and Filters video narration (script:
 * _data/narrations/pipes_and_filters.yml; artwork: pipes-and-filters-kit.js
 * on the architecture kit, the UML kit, and the wall kit). The narration
 * reaches this stage as a song: each scene is a section and each cue a line,
 * and `at(cue, word)` is the estimated time the narrator says that word
 * (repeated words are word2, word3, ...). Cues are named by their stable
 * script ids ('intro/sideline'), looked up in the storyboard, so reordering
 * the script never misplaces a picture.
 *
 * The teaching rule for the pictures: show the mechanism the cue names, on
 * the student paper's game-day photos. The architecture is a UML diagram in
 * a frame that names its view: in the C&C view each filter is a component
 * with an input and an output port, and each pipe a straight connector from
 * port to port that photos ride along, beside its line and never across a
 * filter's name; the frame's key says what a component is, so only
 * sources and sinks carry a stereotype after the definition. In the
 * allocation view, filters run on processor cores. A rule of the style is a
 * numbered rule card that arrives as its cue begins, before the narrator
 * names it, and stays up while the scene applies it; every consequence is a
 * quality card that says Promoted or Inhibited in words, beside the rule it
 * follows from. Stamps never shake the stage, and nothing large changes
 * brightness quickly (WCAG 2.3.1). Layout: the 960x540 picture body; nothing
 * readable within 12px of an edge.
 */
(function () {
  'use strict';

  const TOPICS = {
    intro: { kind: 'Example', name: 'Game-day photos', iconName: 'camera' },
    monolith: { kind: 'Problem', name: 'One script does it all', iconName: 'warning' },
    filters: { kind: 'Style', name: 'Filters, pipes, source, sink', iconName: 'merge' },
    alone: { kind: 'Rules', name: 'Filters work alone', iconName: 'lock' },
    stream: { kind: 'Rules', name: 'A stream, one way', iconName: 'forward' },
    order: { kind: 'Rule', name: 'Building the pipeline', iconName: 'list' },
    buys: { kind: 'Promotes', name: 'Reuse, change, throughput', iconName: 'sparkle' },
    costs: { kind: 'Inhibits', name: 'Interactive usability, latency, robustness', iconName: 'warning' },
    limits: { kind: 'Trade-off', name: 'When rules bend', iconName: 'target' },
    in_practice: { kind: 'In practice', name: 'Real-world examples', iconName: 'globe' },
    summary: { kind: 'Recap', name: 'Do one thing, pass it on', iconName: 'check' },
  };

  /** The four rules, as their cards name them: the names the narrator says. */
  const RULES = {
    1: { name: 'Independence', text: 'No shared state: filters interact only through pipes.' },
    2: { name: 'Agnosticism', text: 'A filter doesn’t know its neighbors: item in, item out.' },
    3: { name: 'Incremental processing', text: 'Pass each item on as soon as it is done.' },
    4: { name: 'Acyclic flow', text: 'One way, source to sink: tees and joins are fine, loops are not.' },
  };

  const NAMES = ['Denoise', 'Brighten', 'Crop', 'Blur faces', 'Watermark'];
  /** What a photo looks like after each filter of the line, in order. */
  const LOOKS = [
    { noise: true, dark: true }, { dark: true }, {}, { crop: true }, { crop: true, blur: true }, { crop: true, blur: true, mark: true },
  ];
  /** The key of a C&C view of a pipeline. */
  const KEY = [['component', '«filter» component'], ['port', 'port'], ['flow', '«pipe» connector']];
  const KEY_SHORT = [['component', 'filter'], ['port', 'port'], ['flow', 'pipe']];

  /** The stage's line id for each cue ('scene/cue' to 'scene-n'), from the storyboard. */
  function lineIds() {
    const story = JSON.parse(document.getElementById('narration-storyboard').textContent);
    const ids = {};
    story.scenes.forEach((scene) => scene.cues.forEach((cue, i) => { ids[`${scene.id}/${cue.id}`] = `${scene.id}-${i + 1}`; }));
    return ids;
  }

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.pipes_and_filters = function choreograph({ song, kit, layers }) {
    const wall = window.WallKit;
    const arch = window.ArchKit;
    const uml = window.UmlKit;
    const pf = window.PipesKit;
    const FH = pf.FILTER_H;
    /**
     * The standard line: five narrow filters 128 wide, 66 apart, so each pipe
     * shows 52px of line; each name sits under its icon, and the ports sit
     * low, clear of the names.
     */
    const LINE = { x0: 28, w: 128, gap: 66, portAt: pf.LOW_PORT, variant: 'compact' };
    const { content } = layers;
    const ids = lineIds();
    const cueLine = (cue) => {
      if (!ids[cue]) throw new Error(`Unknown cue ${cue}`);
      return ids[cue];
    };
    const begin = (cue) => song.line(cueLine(cue)).start;
    const end = (cue) => song.line(cueLine(cue)).end;
    const at = (cue, word) => song.mark(cueLine(cue), word);

    /** One picture from the start of cue `from` to the end of cue `to`, headed by its scene's topic. */
    function picture(from, to = from) {
      const node = kit.scene(content, begin(from), end(to), { exit: 'fade' });
      wall.topicTag(node, { ...TOPICS[from.split('/')[0]], at: begin(from) + 0.15 });
      return wall.body(node);
    }
    const sticker = (parent, text, options) => kit.sticker(parent, text, { rotate: -3, ...options });
    const stamp = (parent, text, options) => kit.stamp(parent, text, { shake: false, from: 1.8, ...options });
    /**
     * Rule n's card, named; only where the rule is defined (`defines`) does
     * it carry its number. `full` adds its one-line statement; `crackAt`
     * breaks it at its edge.
     */
    function rule(parent, n, { full = false, defines = false, ...options }) {
      const node = arch.rule(parent, { n: defines ? n : undefined, name: RULES[n].name, text: full ? RULES[n].text : undefined, ...options });
      if (options.crackAt !== undefined) node.classList.add('pf-rule-cracked');
      return node;
    }
    /** A diagram frame naming its view (cnc by default) with its key (a pipeline's by default). */
    const frame = (parent, options) => uml.frame(parent, { view: 'cnc', key: KEY_SHORT, ...options });

    /** The standard line at height y; `specs` per box, `names` to vary it. */
    function standardLine(parent, { y, at: when, names = NAMES, specs = [], step = 0.12, until, ...layout }) {
      return pf.line(parent, { ...LINE, ...layout, y, names, at: when, specs, step, until });
    }
    /**
     * Photos sliding along every pipe of a line from `from` to `to`, each
     * looking as its upstream filter left it (`looks`, one per pipe).
     */
    function flowAll(parent, row, { from, to, every = 0.9, offset = 0, looks = LOOKS.slice(1) }) {
      row.pipes.forEach(({ from: a, to: b }, i) => pf.flow(parent, { from: a, to: b, at: from + i * 0.2 + offset, until: to, every, look: looks[i] }));
    }
    /** The frame around a line of filters at height y: its tab above the boxes, a margin below. */
    function lineFrame(parent, { y, below = 20, ...options }) {
      return frame(parent, { x: 8, y: y - 50, w: 944, h: 50 + FH + below, ...options });
    }
    /** A port's outer face on a box ({ x, y, w, h }), where a pipe's end meets it. */
    const face = (box, side, along) => pf.portFace(box, side, along);

    // ----------------------------------------------------------------
    // Motivation: game night, the batch script, and the loop that half fixes it
    // ----------------------------------------------------------------

    function intro() {
      const sideline = 'intro/sideline';
      const a = picture(sideline);
      arch.readout(a, {
        x: 24, y: 26, w: 300, label: 'Sideline camera', iconName: 'camera', at: at(sideline, 'camera'),
        values: [{ at: -1, text: '1,212 photos' }, { at: at(sideline, 'camera') + 0.6, text: '1,213 photos' }, { at: at(sideline, 'thousand'), text: '3,000 by the whistle' }],
      });
      arch.readout(a, { x: 360, y: 26, w: 270, label: 'Scoreboard', iconName: 'timer', at: begin(sideline) + 0.2, values: [{ at: -1, text: '4th quarter · 2:41' }] });
      pf.photo(a, { x: 24, y: 130, w: 520, look: LOOKS[0], caption: 'Straight off the camera', at: at(sideline, 'photos') });
      pf.gallery(a, { x: 600, y: 130, w: 336, empty: { text: 'Coming soon' }, at: at(sideline, 'online') });
      sticker(a, 'Fans want them tonight', { x: 600, y: 400, at: at(sideline, 'tonight'), variant: 'gold', iconName: 'team' });

      const steps = 'intro/steps';
      const b = picture(steps);
      [['Noisy', 'every'], ['Denoised', 'noise'], ['Brightened', 'brighten'], ['Cropped', 'crop'], ['Faces blurred', 'blur'], ['Watermarked', 'stamp']].forEach(([caption, word], i) => {
        pf.photo(b, { x: 24 + i * 153, y: 70, w: 145, look: LOOKS[i], caption, at: at(steps, word) });
      });
      arch.card(b, { x: 330, y: 300, w: 300, title: 'Published', sub: 'On the website', iconName: 'globe', at: at(steps, 'publish') });
      wall.badge(b, { x: 80, y: 330, w: 170, role: 'You', iconName: 'user', at: at(steps, 'youre') });
      wall.skill(b, { x: 40, y: 470, w: 250, text: 'Photo desk developer', at: at(steps, 'desks') });
    }

    function monolith() {
      const script = 'monolith/script';
      const a = picture(script);
      arch.code(a, {
        x: 24, y: 24, w: 580, title: 'process_all.py', at: begin(script) + 0.1,
        lines: [
          { code: 'for photo in all_photos:' },
          { code: '    save(denoise(photo), "step1/")' },
          { code: 'for photo in folder("step1/"):', at: at(script, 'two') },
          { code: '    save(brighten(photo), "step2/")', at: at(script, 'two') },
          { code: '# crop, blur faces, watermark ...', at: at(script, 'so') },
          { code: 'upload(folder("step5/"))', at: at(script, 'uploads') },
        ],
      });
      ['step1/', 'step2/', 'step3/', 'step4/', 'step5/'].forEach((name, i) => {
        arch.card(a, { x: 640, y: 24 + i * 84, w: 296, title: name, sub: '3,000 files', mono: true, iconName: 'folder', at: [at(script, 'folder'), at(script, 'another'), at(script, 'on'), at(script, 'until'), at(script, 'last')][i] });
      });
      arch.tag(a, { x: 24, y: 304, text: 'Batch sequential: each step finishes all photos first', tone: 'cyan', at: at(script, 'batch') });
      wall.listCard(a, {
        x: 24, y: 364, w: 580, title: 'Shared global settings', iconName: 'gear', at: at(script, 'global'),
        items: [{ text: 'SETTINGS, LAST_BRIGHTNESS, FACES_FOUND', at: at(script, 'settings') }],
      }).classList.add('pf-globals');

      const midnight = 'monolith/midnight';
      const b = picture(midnight);
      arch.readout(b, {
        x: 24, y: 24, w: 250, label: 'Clock', iconName: 'timer', at: begin(midnight) + 0.1,
        values: [{ at: -1, text: '10:00 p.m.' }, { at: at(midnight, 'midnight'), text: '12:00 a.m.', state: 'bad' }],
      });
      const stepsOf = ['Denoise', 'Brighten', 'Crop', 'Blur faces', 'Watermark', 'Upload'];
      pf.bars(b, {
        x: 24, y: 110, w: 560, at: at(midnight, 'step'),
        rows: stepsOf.map((label, i) => ({ label, at: at(midnight, 'every') + i * 0.55, duration: 0.5 })),
      });
      arch.tag(b, { x: 300, y: 40, text: '20 minutes per step, all photos', at: at(midnight, 'twenty') });
      pf.gallery(b, { x: 620, y: 110, w: 316, title: 'Website at midnight', at: at(midnight, 'midnight'), items: [{ at: at(midnight, 'midnight') + 0.3, look: LOOKS[5] }] });
      arch.readout(b, { x: 24, y: 420, w: 560, label: 'Touchdown catch, 2nd quarter', iconName: 'image', at: at(midnight, 'catch'), values: [{ at: -1, text: 'Waits behind 3,000 others', state: 'warn' }] });
      arch.readout(b, { x: 620, y: 330, w: 316, label: 'In-between files', iconName: 'folder', at: at(midnight, 'folders'), values: [{ at: -1, text: '5 folders · 15,000', state: 'warn' }] });
      sticker(b, 'Fans posted blurry shots', { x: 610, y: 420, at: at(midnight, 'blurry'), variant: 'red', iconName: 'phone' });

      // The quick fix moves only the loop: results arrive early, but nothing
      // else the photo desk needs follows from it. The third design is the
      // lesson's, and its column says what it offers.
      const loop = 'monolith/one_loop';
      const c = picture(loop);
      pf.compare(c, {
        x: 24, y: 8, w: 912, at: begin(loop) + 0.1,
        rows: ['Photos online early', 'Reuse a step', 'Reorder steps', 'One core per step'],
        columns: [
          { title: 'Batch script', at: begin(loop) + 0.2, cells: [false, false, false, false] },
          {
            title: 'One loop per photo', at: at(loop, 'loop'),
            cells: [{ yes: true, at: at(loop, 'early') }, { yes: false, at: at(loop, 'reused') }, { yes: false, at: at(loop, 'reordered') }, { yes: false, at: at(loop, 'core') }],
          },
          { title: 'Pipes and filters', at: at(loop, 'pipes'), cells: [true, true, true, true].map((yes, i) => ({ yes, at: at(loop, 'four') + i * 0.12 })) },
        ],
      });
      arch.code(c, {
        x: 24, y: 318, w: 600, title: 'process_all.py', at: at(loop, 'sends'),
        lines: [
          { code: 'for photo in camera_uploads():' },
          { code: '    photo = brighten(denoise(photo))' },
          { code: '    # crop, blur faces, watermark ...' },
          { code: '    upload(photo)  # reads SETTINGS too' },
        ],
      });

      const change = 'monolith/change_requests';
      const d = picture(change);
      arch.card(d, { x: 300, y: 190, w: 360, title: 'process_all.py', sub: 'One giant file', mono: true, iconName: 'file', at: begin(change) + 0.1, states: [{ at: at(change, 'surgery'), state: 'changed', sub: 'One giant file' }] });
      arch.card(d, { x: 24, y: 30, w: 400, title: 'New step', sub: 'Straighten tilted shots, after the crop', iconName: 'move', at: at(change, 'straightens') });
      arch.card(d, { x: 536, y: 30, w: 400, title: 'Reuse request', sub: 'Robotics club wants the denoiser', iconName: 'copy', at: at(change, 'robotics') });
      arch.wire(d, { from: [224, 142], to: [380, 186], at: at(change, 'surgery') });
      arch.wire(d, { from: [736, 142], to: [580, 186], at: at(change, 'surgery') + 0.2 });
      arch.tag(d, { x: 340, y: 300, text: 'Every step reads the globals', tone: 'red', at: at(change, 'global') });
      wall.banner(d, { x: 180, y: 400, w: 600, title: 'What you need', text: 'Steps that work alone and pass each photo on', at: at(change, 'need') });
    }

    // ----------------------------------------------------------------
    // Rules: the parts in a C&C view, then the four rules
    // ----------------------------------------------------------------

    function filtersScene() {
      const filterCue = 'filters/filter';
      const pipeCue = 'filters/pipe';
      const ends = 'filters/source_sink';
      const a = picture(filterCue, ends);
      // The lesson's first C&C frame spells out its view; its key runs along the bottom.
      frame(a, { x: 8, y: 6, w: 944, h: 478, key: KEY, keyAt: 'bottom', fullName: true, at: begin(filterCue) + 0.3 });
      // The line spans the frame; the source stands above its first filter
      // and the sink below its last, so both of their pipes run straight.
      const row = { x0: 24, w: 136, gap: 58, y: 200 };
      const boxOf = (i) => ({ x: row.x0 + i * (row.w + row.gap), y: row.y, w: row.w, h: FH });
      const first = boxOf(0);
      const last = boxOf(4);
      const line = pf.line(a, {
        ...row, names: NAMES, stereotype: 'filter', variant: 'compact', portAt: pf.LOW_PORT,
        at: at(filterCue, 'filters'), step: 0.12, pipesAt: at(pipeCue, 'pipes'),
        specs: [
          { ports: [{ side: 'top', along: 0.5 }, { side: 'right', along: pf.LOW_PORT }] },
          {}, {}, {},
          { ports: [{ side: 'left', along: pf.LOW_PORT }, { side: 'bottom', along: 0.5 }] },
        ],
      });
      const pipeY = line.portY;
      // Callouts name the parts as the narrator does, on Crop and Brighten's ports.
      uml.callout(a, { x: 370, y: 116, w: 220, text: 'Filter: a component', to: [line.center(2), row.y], at: at(filterCue, 'component2'), until: end(filterCue) });
      uml.callout(a, { x: 40, y: 340, w: 150, text: 'Input port', to: line.inPort(1), at: at(filterCue, 'input'), until: end(filterCue) });
      uml.callout(a, { x: 260, y: 340, w: 170, text: 'Output port', to: line.outPort(1), at: at(filterCue, 'output'), until: end(filterCue) });
      arch.tag(a, { x: 24, y: 396, text: 'A filter reads a stream, transforms each item, writes a stream', tone: 'cyan', at: at(filterCue, 'transformation'), until: begin(pipeCue) + 0.2 });
      const pipeX = (line.outPort(1)[0] + line.inPort(2)[0]) / 2;
      uml.callout(a, { x: pipeX - 110, y: 116, w: 214, text: 'Pipe: a connector', to: [pipeX, pipeY - 4], at: at(pipeCue, 'connectors'), until: end(pipeCue) });
      arch.tag(a, { x: 24, y: 396, text: 'A pipe: one way, in order, unchanged, buffered', tone: 'cyan', at: at(pipeCue, 'direction'), until: begin(ends) + 0.2 });
      flowAll(a, line, { from: at(pipeCue, 'carries'), to: end(ends) });
      // The source feeds Denoise's top port; Watermark's bottom port feeds the sink.
      const source = { x: 24, y: 60, w: 236, h: 80 };
      const sourceAlong = first.x + first.w / 2 - source.x;
      pf.filter(a, { ...source, name: 'Camera uploads', stereotype: 'source', ports: [{ side: 'bottom', along: sourceAlong }], at: at(ends, 'source') });
      const sourcePipe = [face(source, 'bottom', sourceAlong), face(first, 'top', 0.5)];
      pf.pipe(a, { from: sourcePipe[0], to: sourcePipe[1], at: at(ends, 'feeds') });
      const sink = { x: 700, y: 356, w: 236, h: 80 };
      const sinkAlong = last.x + last.w / 2 - sink.x;
      pf.filter(a, { ...sink, name: 'Website gallery', stereotype: 'sink', ports: [{ side: 'top', along: sinkAlong }], at: at(ends, 'sink') });
      pf.pipe(a, { from: face(last, 'bottom', 0.5), to: face(sink, 'top', sinkAlong), at: at(ends, 'gallery') });
      pf.flow(a, { from: sourcePipe[0], to: sourcePipe[1], at: at(ends, 'feeds') + 0.3, until: end(ends), every: 1.2, look: LOOKS[0] });
      arch.tag(a, { x: 24, y: 346, text: 'Source and sink: the system’s boundary', at: at(ends, 'boundary') });
      arch.tag(a, { x: 24, y: 396, text: 'A pipeline: a chain without branches', tone: 'cyan', at: at(ends, 'pipeline') });
    }

    function alone() {
      const independent = 'alone/independent';
      const agnostic = 'alone/agnostic';
      const format = 'alone/common_format';
      const a = picture(independent, format);
      // The rules stay up through the scene; each arrives as its cue begins, before it is named.
      rule(a, 1, { full: true, defines: true, x: 24, y: 8, w: 444, at: begin(independent) + 0.4 });
      rule(a, 2, { full: true, defines: true, x: 492, y: 8, w: 444, at: begin(agnostic) + 0.2 });
      // Where the rules first appear, the word the books use for them.
      arch.tag(a, { x: 492, y: 38, text: 'These rules are the style’s constraints', tone: 'gold', at: at(independent, 'rules'), until: begin(agnostic) });

      // Independence: a line whose settings are parameters, the shared globals struck out.
      const row = standardLine(a, { y: 186, at: begin(independent) + 0.2, step: 0.05, until: end(independent), specs: [{}, { dial: 'amount=1.3', at: begin(independent) + 0.25 }] });
      lineFrame(a, { y: 186, below: 52, at: begin(independent) + 0.15, until: end(independent) });
      flowAll(a, row, { from: at(independent, 'pipes'), to: end(independent), every: 1.2 });
      wall.listCard(a, { x: 24, y: 394, w: 420, title: 'Shared global settings', iconName: 'gear', at: begin(independent) + 0.3, until: end(independent), items: [{ text: 'SETTINGS, LAST_BRIGHTNESS' }] }).classList.add('pf-globals');
      arch.cross(a, { x: 488, y: 434, size: 64, at: at(independent, 'settings'), until: end(independent) });
      sticker(a, 'Parameters, not globals', { x: 560, y: 400, at: at(independent, 'parameters'), until: end(independent), variant: 'green', iconName: 'gear' });
      arch.tag(a, { x: 560, y: 470, text: 'Testable and reusable alone', tone: 'green', at: at(independent, 'tested'), until: end(independent) });

      // Agnosticism: Blur faces knows only its contract; to it, its neighbors have no names.
      const g = { y: 196, h: FH };
      frame(a, { x: 8, y: 126, w: 944, h: 264, at: begin(agnostic) + 0.1, until: end(agnostic) });
      const anonymous = (word) => [{ at: begin(agnostic), state: 'anonymous', light: '' }, { at: at(agnostic, word), state: 'anonymous', light: 'Unknown' }];
      pf.filter(a, { x: 40, y: g.y, w: 200, name: '?', at: begin(agnostic) + 0.2, until: end(agnostic), states: anonymous('before') });
      pf.filter(a, { x: 360, y: g.y - 20, w: 240, h: FH + 40, name: 'Blur faces', at: begin(agnostic) + 0.2, until: end(agnostic), states: [{ at: at(agnostic, 'contract'), state: 'focus', light: 'Knows: in, out' }] });
      pf.filter(a, { x: 720, y: g.y, w: 200, name: '?', at: begin(agnostic) + 0.2, until: end(agnostic), states: anonymous('after') });
      const mid = g.y + FH / 2;
      const inPipe = [[247, mid], [353, mid]];
      const outPipe = [[607, mid], [713, mid]];
      pf.pipe(a, { from: inPipe[0], to: inPipe[1], at: begin(agnostic) + 0.3, until: end(agnostic) });
      pf.pipe(a, { from: outPipe[0], to: outPipe[1], at: begin(agnostic) + 0.3, until: end(agnostic) });
      pf.flow(a, { from: inPipe[0], to: inPipe[1], at: at(agnostic, 'arrives'), until: end(agnostic), look: LOOKS[3] });
      pf.flow(a, { from: outPipe[0], to: outPipe[1], at: at(agnostic, 'leaves'), until: end(agnostic), look: LOOKS[4] });
      arch.tag(a, { x: 150, y: 338, text: 'A photo arrives', at: at(agnostic, 'arrives'), until: end(agnostic) });
      arch.tag(a, { x: 640, y: 338, text: 'A photo leaves', at: at(agnostic, 'leaves'), until: end(agnostic) });
      sticker(a, 'Insert, remove, reorder', { x: 330, y: 420, at: at(agnostic, 'inserted'), until: end(agnostic), variant: 'green', iconName: 'move' });

      // The precondition: one agreed format, so any order still connects. The
      // new order keeps Watermark last, so its photo comes out as before; the
      // next scene shows an order that does not.
      frame(a, { x: 8, y: 122, w: 944, h: 398, at: begin(format) + 0.1 });
      const first = standardLine(a, { y: 172, at: begin(format) + 0.15, step: 0.05 });
      arch.card(a, { x: 24, y: 292, w: 400, title: 'One agreed format', sub: 'Every pipe carries Image (JPEG)', iconName: 'image', at: at(format, 'pipe') });
      const order = ['Crop', 'Denoise', 'Brighten', 'Blur faces', 'Watermark'];
      const shuffled = standardLine(a, { y: 404, names: order, at: at(format, 'any'), step: 0.12 });
      flowAll(a, first, { from: at(format, 'carries'), to: end(format), every: 1.1 });
      flowAll(a, shuffled, {
        from: at(format, 'any') + 0.6, to: end(format), every: 1.1,
        looks: [{ noise: true, dark: true, crop: true }, { dark: true, crop: true }, { crop: true }, { crop: true, blur: true }],
      });
      arch.tag(a, { x: 600, y: 340, text: 'Any order still connects', tone: 'green', at: at(format, 'follow') });
    }

    function stream() {
      const incremental = 'stream/incremental';
      const predict = 'stream/predict_online';
      const seconds = 'stream/seconds';
      const acyclic = 'stream/acyclic';
      const a = picture(incremental, acyclic);
      rule(a, 3, { full: true, defines: true, x: 24, y: 8, w: 444, at: begin(incremental) + 0.3 });
      // Rule 4 arrives as its cue begins, just before the narrator names it.
      rule(a, 4, { full: true, defines: true, x: 492, y: 8, w: 444, at: begin(acyclic) + 0.1 });

      const busy = (from) => [{ at: from, state: 'busy', light: 'Busy' }];
      const row = standardLine(a, { y: 166, at: begin(incremental) + 0.2, step: 0.05, specs: NAMES.map(() => ({ states: busy(at(incremental, 'same')) })) });
      lineFrame(a, { y: 166, below: 64, at: begin(incremental) + 0.15 });
      [['Photo 5', 0], ['Photo 4', 1], ['Photo 3', 2, 'three2'], ['Photo 2', 3, 'two'], ['Photo 1', 4, 'one']].forEach(([text, i, word]) => {
        arch.tag(a, { x: row.center(i) - 46, y: 288, text, tone: 'gold', at: word ? at(incremental, word) : at(incremental, 'same'), until: begin(acyclic) });
      });
      flowAll(a, row, { from: at(incremental, 'passes'), to: end(acyclic), every: 1.0 });

      // The prediction and its answer, below the line.
      arch.readout(a, { x: 676, y: 352, w: 260, label: 'Scoreboard', iconName: 'timer', at: at(predict, 'game'), until: at(seconds, 'gallery') + 0.2, values: [{ at: -1, text: '2nd quarter · 9:12' }] });
      pf.photo(a, { x: 24, y: 352, w: 196, look: LOOKS[0], caption: 'Touchdown catch', at: at(predict, 'catch'), until: begin(acyclic) });
      wall.slot(a, { x: 240, y: 352, w: 400, h: 96, text: 'On the website when?', at: at(predict, 'predict'), until: begin(seconds) + 0.2 });
      // The catch hops pipe by pipe, half a second in each filter.
      const hop = at(seconds, 'passes');
      row.pipes.forEach(({ from, to }, i) => arch.token(a, { kind: 'photo', size: 30, path: pf.ride(from, to, 30), at: hop + i * 0.5, duration: 0.3, until: hop + i * 0.5 + 0.35, art: pf.photoToken(LOOKS[i + 1]) }));
      arch.readout(a, { x: 240, y: 352, w: 300, label: 'Shot to website', iconName: 'timer', at: at(seconds, 'gallery'), until: begin(acyclic), values: [{ at: -1, text: '2.5 seconds', state: 'ok' }] });
      pf.gallery(a, { x: 656, y: 352, w: 280, title: 'Website', at: at(seconds, 'gallery'), until: begin(acyclic), items: [{ at: at(seconds, 'gallery') + 0.2, look: LOOKS[5], caption: '2nd quarter' }] });
      // Two balanced lines fit between the photo and the gallery.
      arch.tag(a, { x: 262, y: 432, w: 330, text: 'Incremental processing: first result early, all filters busy', tone: 'green', at: at(seconds, 'purpose'), until: begin(acyclic) }).classList.add('pf-label-wrap');

      // Acyclic flow: a loop back upstream is not a pipe this style allows. It would
      // still attach at ports: an extra output under Watermark, an input under Crop.
      const back = 316;
      const bottom = 166 + FH;
      uml.connector(a, { points: [[row.center(4), bottom], [row.center(4), back], [row.center(2), back], [row.center(2), bottom]], kind: 'flow', tone: 'red', dashed: true, ends: 'both', at: at(acyclic, 'loop') });
      arch.cross(a, { x: (row.center(4) + row.center(2)) / 2, y: back, size: 44, at: at(acyclic, 'loop') + 0.3 });
      uml.callout(a, { x: 24, y: 352, w: 340, text: 'A pipe back upstream: forbidden', tone: 'red', to: [row.center(2) + 40, back], at: at(acyclic, 'upstream'), until: at(acyclic, 'composition') });
      arch.code(a, { x: 24, y: 352, w: 760, title: 'The pipeline’s behavior', at: at(acyclic, 'composition'), lines: [{ code: 'photo = watermark(blur(crop(brighten(denoise(raw)))))' }] });
      arch.quality(a, { x: 24, y: 452, w: 330, name: 'Understandability', at: at(acyclic, 'understandability') });
      arch.tag(a, { x: 384, y: 466, text: 'From independence, agnosticism, and acyclic flow', tone: 'green', at: at(acyclic, 'understandability') + 0.3 });
    }

    function order() {
      const matters = 'order/order_matters';
      const cut = 'order/cut_logo';
      const a = picture(matters, cut);
      frame(a, { x: 8, y: 6, w: 690, h: 400, at: begin(matters) + 0.1 });
      // Two short pipelines that differ only in order, each ending in the
      // website; the prediction leaves a dashed slot where its photo will be.
      [['Crop, then Watermark', ['Crop', 'Watermark'], { crop: true, mark: true }, 'trims', 96, 'placing'], ['Watermark, then Crop', ['Watermark', 'Crop'], { crop: true, mark: true, markCut: true }, 'after', 278, 'cut']]
        .forEach(([label, names, look, word, y, reveal]) => {
          arch.tag(a, { x: 40, y: y - 46, text: label, at: at(matters, word) });
          const h = 88;
          const portAt = 66;
          pf.line(a, { x0: 40, y, w: 160, gap: 56, h, names: [...names, 'Website'], portAt, variant: 'compact', at: at(matters, word), step: 0.1, specs: [{}, {}, { stereotype: 'sink', variant: undefined, ports: { in: true } }] });
          wall.slot(a, { x: 716, y: y - 12, w: 220, h: 150, text: 'Result?', at: at(matters, word) + 0.4, until: at(cut, reveal) });
          pf.photo(a, { x: 716, y: y - 12, w: 220, look, at: at(cut, reveal) });
        });
      stamp(a, 'Logo cut off', { x: 706, y: 440, at: at(cut, 'logo'), color: 'red', rotate: -5, small: true });
      arch.code(a, {
        x: 24, y: 426, w: 600, at: at(cut, 'adding'),
        lines: [{ code: '3 -> add 1 -> double = 8' }, { code: '3 -> double -> add 1 = 7', at: at(cut, 'doubling2') }],
      });

      // Roles: Straighten drops in between Crop and Blur faces, and the pipe
      // that joined them gives way to two. Denoise stands before this part.
      const roles = 'order/roles';
      const b = picture(roles);
      wall.badge(b, { x: 70, y: 30, w: 210, role: 'Filter developer', iconName: 'pencil', at: at(roles, 'developer') });
      wall.skill(b, { x: 40, y: 180, w: 270, text: 'One filter, its input and output types', at: at(roles, 'types') });
      wall.badge(b, { x: 620, y: 30, w: 210, role: 'Pipeline builder', iconName: 'list', variant: 'po', at: at(roles, 'builder') });
      wall.skill(b, { x: 590, y: 180, w: 270, text: 'Picks the filters and their order', variant: 'po', at: at(roles, 'selects') });
      lineFrame(b, { y: 330, below: 24, title: 'photo desk, after Denoise', at: begin(roles) + 0.15 });
      const names = ['Brighten', 'Crop', 'Straighten', 'Blur faces', 'Watermark'];
      const inserted = at(roles, 'inserts');
      const unchanged = [{ at: at(roles, 'modified'), state: 'same', light: 'Unchanged' }];
      // Taller boxes keep each port below the word Unchanged, clear of it.
      const tall = { h: FH + 8, portAt: LINE.portAt + 12 };
      const boxX = (i) => LINE.x0 + i * (LINE.w + LINE.gap);
      const portY = 330 + tall.portAt;
      names.forEach((name, i) => pf.filter(b, {
        x: boxX(i), y: 330, w: LINE.w, ...tall, name, variant: 'compact',
        ...(name === 'Straighten'
          ? { at: inserted, how: 'drop', states: [{ at: inserted, state: 'new', light: 'New' }] }
          : { at: begin(roles) + 0.2 + i * 0.05, states: unchanged }),
      }));
      const inOf = (i) => [boxX(i) - uml.PORT / 2, portY];
      const outOf = (i) => [boxX(i) + LINE.w + uml.PORT / 2, portY];
      pf.pipe(b, { from: outOf(0), to: inOf(1), at: begin(roles) + 0.3 });
      pf.pipe(b, { from: outOf(1), to: inOf(3), at: begin(roles) + 0.35, until: inserted });
      pf.pipe(b, { from: outOf(1), to: inOf(2), at: inserted + 0.3 });
      pf.pipe(b, { from: outOf(2), to: inOf(3), at: inserted + 0.4 });
      pf.pipe(b, { from: outOf(3), to: inOf(4), at: begin(roles) + 0.4 });
    }

    // ----------------------------------------------------------------
    // Consequences, each beside the rule it follows from
    // ----------------------------------------------------------------

    function buys() {
      const reuse = 'buys/reuse';
      const a = picture(reuse);
      arch.quality(a, { x: 24, y: 8, w: 280, name: 'Reusability', at: at(reuse, 'reusability') });
      rule(a, 1, { x: 330, y: 8, w: 290, at: begin(reuse) + 0.3 });
      rule(a, 2, { x: 646, y: 8, w: 290, at: begin(reuse) + 0.4 });
      frame(a, { x: 8, y: 92, w: 944, h: 176, title: 'photo desk', at: begin(reuse) + 0.15 });
      const row = standardLine(a, { y: 138, at: begin(reuse) + 0.2, step: 0.05 });
      flowAll(a, row, { from: begin(reuse) + 0.5, to: end(reuse), every: 1.2 });
      frame(a, { x: 8, y: 280, w: 944, h: 176, title: 'robotics club', at: at(reuse, 'robotics') });
      pf.line(a, {
        x0: 40, y: 326, w: 180, gap: 60, names: ['Robot camera', 'Denoise', 'Detect obstacles', 'Steer'], at: at(reuse, 'inserts'), step: 0.15,
        specs: [{ stereotype: 'source', ports: { out: true } }, { states: [{ at: at(reuse, 'unchanged'), state: 'same', light: 'Unchanged' }] }, {}, { stereotype: 'sink', ports: { in: true } }],
      });
      arch.tag(a, { x: 140, y: 470, text: 'Independence and agnosticism: no shared state, no named neighbors', tone: 'green', at: at(reuse, 'guarantees') });

      const change = 'buys/change';
      const b = picture(change);
      arch.quality(b, { x: 24, y: 8, w: 280, name: 'Modifiability', at: at(change, 'modifiability') });
      arch.quality(b, { x: 320, y: 8, w: 280, name: 'Extensibility', at: at(change, 'extensibility') });
      rule(b, 2, { x: 616, y: 4, w: 320, at: begin(change) + 0.3 });
      rule(b, 1, { x: 616, y: 62, w: 320, at: at(change, 'testability') - 0.6 });
      frame(b, { x: 8, y: 124, w: 944, h: 190, at: begin(change) + 0.15 });
      const names = ['Auto-exposure', 'Crop', 'Straighten', 'Blur faces'];
      const changed = { x0: 60, y: 174, w: 180, gap: 56, portAt: pf.LOW_PORT, variant: 'compact' };
      pf.filter(b, { x: 60, y: 174, w: 180, name: 'Brighten', portAt: pf.LOW_PORT, variant: 'compact', at: begin(change) + 0.2, until: at(change, 'replacing') + 0.4 });
      pf.line(b, {
        ...changed, names, at: begin(change) + 0.2, step: 0.05,
        specs: [{ at: at(change, 'replacing') + 0.3, how: 'drop', states: [{ at: at(change, 'replacing') + 0.3, state: 'new', light: 'Swapped in' }] }, {}, { states: [{ at: at(change, 'inserting'), state: 'new', light: 'Inserted' }] }, {}],
      });
      arch.readout(b, { x: 24, y: 340, w: 560, label: 'Test: Blur faces alone', iconName: 'check', at: at(change, 'test'), values: [{ at: -1, text: 'In: 3 faces · Out: 3 blurred' }, { at: at(change, 'check'), text: 'In: 3 faces · Out: 3 blurred · Passed', state: 'ok' }] });
      sticker(b, 'Changed nothing else', { x: 610, y: 344, at: at(change, 'nothing'), variant: 'green', iconName: 'check' });
      arch.quality(b, { x: 24, y: 430, w: 300, name: 'Testability', at: at(change, 'testability') });

      const throughput = 'buys/throughput';
      const c = picture(throughput);
      arch.quality(c, { x: 24, y: 8, w: 400, name: 'Performance: throughput', at: at(throughput, 'throughput') });
      rule(c, 3, { x: 640, y: 8, w: 296, at: begin(throughput) + 0.3 });
      // The allocation view: each filter runs on its own processor core.
      uml.frame(c, { x: 8, y: 116, w: 944, h: 206, view: 'allocation', key: [['node', 'node: a processor core'], ['component', 'filter running on it']], at: at(throughput, 'allocation') - 0.4 });
      NAMES.forEach((name, i) => {
        const x = 24 + i * 184;
        uml.node(c, { x, y: 172, w: 164, h: 142, name: `Core ${i + 1}`, stereotype: 'core', at: at(throughput, 'allocation') + i * 0.1 });
        uml.component(c, { x: x + 8, y: 240, w: 148, h: 64, name, variant: 'compact', at: at(throughput, 'gives') + i * 0.1, states: [{ at: at(throughput, 'gives') + i * 0.1, state: 'busy' }] });
      });
      arch.readout(c, { x: 24, y: 352, w: 440, label: 'Photos per minute', iconName: 'chart', at: at(throughput, 'minute'), values: [{ at: -1, text: 'One program: 24' }, { at: at(throughput, 'completes'), text: 'The pipeline: up to 120', state: 'ok' }] });
      arch.tag(c, { x: 500, y: 368, text: 'The slowest filter sets the pace', tone: 'cyan', at: at(throughput, 'slowest') });
    }

    function costs() {
      // Interactive usability: a live edit of published photos would loop
      // them from the gallery back into Brighten, through the editor.
      const slider = 'costs/slider';
      const a = picture(slider);
      arch.quality(a, { x: 24, y: 8, w: 400, name: 'Interactive usability', effect: 'inhibited', at: at(slider, 'usability') });
      rule(a, 4, { full: true, x: 492, y: 8, w: 444, at: begin(slider) + 0.4 });
      frame(a, { x: 8, y: 124, w: 944, h: 394, key: [...KEY_SHORT, ['attempt', 'not allowed']], at: begin(slider) + 0.05 });
      const lineY = 174;
      const boxOf = (i) => ({ x: LINE.x0 + i * (LINE.w + LINE.gap), y: lineY, w: LINE.w, h: FH });
      const low = { side: 'left', along: LINE.portAt };
      const row = standardLine(a, {
        y: lineY, at: begin(slider) + 0.1, step: 0.05,
        specs: [{}, { ports: [low, { side: 'right', along: LINE.portAt }, { side: 'bottom', along: 0.5 }] }, {}, {}, { ports: [low, { side: 'bottom', along: 0.5 }] }],
      });
      flowAll(a, row, { from: begin(slider) + 0.4, to: end(slider), every: 1.1 });
      // The sink below Watermark, its pipe straight down.
      const gallery = { x: 700, y: 370, w: 236, h: 84 };
      const into = boxOf(4).x + LINE.w / 2 - gallery.x;
      pf.filter(a, { ...gallery, name: 'Website gallery', stereotype: 'sink', ports: [{ side: 'top', along: into }, { side: 'left', along: gallery.h / 2 }], at: at(slider, 'live') });
      pf.pipe(a, { from: face(boxOf(4), 'bottom', 0.5), to: face(gallery, 'top', into), at: at(slider, 'live') + 0.2 });
      // The editor holds the slider; the return path runs from the gallery
      // through the editor and up into Brighten, entering the editor's top
      // at its left end, clear of its name.
      const editor = { x: 260, y: 370, w: 340, h: 140 };
      const up = boxOf(1).x + LINE.w / 2 - editor.x;
      pf.filter(a, { ...editor, name: 'Photo editor', stereotype: 'user interface', variant: 'top', ports: [{ side: 'right', along: gallery.h / 2 }, { side: 'top', along: up }], at: at(slider, 'slider') });
      pf.slider(a, { x: editor.x + 20, y: editor.y + 62, w: 300, label: 'Brightness', at: at(slider, 'slider') + 0.2, moves: [{ at: at(slider, 'live'), p: 0.75 }, { at: at(slider, 'drag'), p: 0.45 }] });
      uml.connector(a, { points: [face(gallery, 'left', gallery.h / 2), face(editor, 'right', gallery.h / 2)], kind: 'flow', tone: 'red', dashed: true, at: at(slider, 'gallery') });
      const back = [face(editor, 'top', up), face(boxOf(1), 'bottom', 0.5)];
      uml.connector(a, { points: back, kind: 'flow', tone: 'red', dashed: true, at: at(slider, 'brighten') });
      // The cross sits on the return pipe's lower half, clear of its arrowhead.
      arch.cross(a, { x: back[0][0], y: back[0][1] - 26, size: 36, at: at(slider, 'forbids') });
      arch.tag(a, { x: 318, y: back[0][1] - 44, text: 'Acyclic flow: no feedback loops', tone: 'red', at: at(slider, 'forbids') + 0.2 });

      // Latency: the agreed format makes every filter decode and re-encode.
      const latency = 'costs/latency';
      const b = picture(latency);
      arch.card(b, { x: 24, y: 8, w: 420, title: 'One agreed format', sub: 'Every pipe carries Image (JPEG)', iconName: 'image', at: begin(latency) + 0.3 });
      frame(b, { x: 8, y: 116, w: 944, h: 226, key: [['component', 'filter, with the steps it runs']], at: begin(latency) + 0.1 });
      NAMES.forEach((name, i) => {
        uml.component(b, { x: 24 + i * 184, y: 164, w: 172, h: 160, name, lines: ['decode', 'job', 'encode'], variant: 'compact', at: at(latency, 'decode') + i * 0.12 });
      });
      arch.readout(b, { x: 24, y: 360, w: 440, label: 'One photo through the pipeline', iconName: 'timer', at: at(latency, 'five'), values: [{ at: -1, text: '5 decodes, 5 encodes', state: 'warn' }, { at: at(latency, 'longer'), text: 'Slower than one program', state: 'bad' }] });
      arch.quality(b, { x: 500, y: 360, w: 380, name: 'Performance: latency', effect: 'inhibited', at: at(latency, 'latency') });

      // Robustness: after a crash, no component knows the global state.
      const errors = 'costs/errors';
      const c = picture(errors);
      rule(c, 1, { x: 24, y: 8, w: 300, at: begin(errors) + 0.3 });
      rule(c, 2, { x: 340, y: 8, w: 300, at: begin(errors) + 0.4 });
      const row3 = standardLine(c, {
        y: 138, at: begin(errors) + 0.1, step: 0.05,
        specs: [{}, {}, {}, { states: [{ at: at(errors, 'crashes'), state: 'crashed', light: 'Crashed' }] }, {}],
      });
      lineFrame(c, { y: 138, below: 80, at: begin(errors) + 0.05 });
      arch.token(c, { kind: 'photo', size: 30, path: pf.ride(row3.pipes[2].from, row3.pipes[2].to, 30), at: at(errors, 'corrupted'), duration: 0.6, until: at(errors, 'crashes'), art: (node) => { node.classList.add('pf-token', 'pf-token--garbled'); } });
      [1, 3].forEach((i) => wall.slot(c, { x: (row3.pipes[i].from[0] + row3.pipes[i].to[0]) / 2 - 36, y: 262, w: 72, h: 52, text: '?', at: at(errors, i === 1 ? 'left' : 'remain') }));
      arch.tag(c, { x: 24, y: 352, text: 'No component knows the global state', tone: 'red', at: at(errors, 'global') });
      pf.gallery(c, { x: 600, y: 352, w: 336, title: 'After a restart', at: at(errors, 'restart'), items: [{ at: at(errors, 'restart') + 0.2, look: LOOKS[5], caption: 'Posted' }, { at: at(errors, 'twice'), look: LOOKS[5], caption: 'Twice' }] });
      arch.quality(c, { x: 24, y: 420, w: 440, name: 'Robustness (error handling)', effect: 'inhibited', at: at(errors, 'robustness') });
    }

    function limits() {
      const best = 'limits/best_shot';
      const a = picture(best);
      rule(a, 3, { full: true, x: 492, y: 8, w: 444, at: begin(best) + 0.3, crackAt: at(best, 'cannot') });
      pf.tray(a, { x: 24, y: 8, w: 440, title: 'Best shot of the burst', of: 10, at: at(best, 'best'), counts: Array.from({ length: 10 }, (_, i) => ({ at: at(best, 'buffer') + i * 0.3, n: i + 1 })) });
      frame(a, { x: 488, y: 156, w: 464, h: 250, key: [['component', 'filter'], ['port', 'port']], at: at(best, 'downstream') - 0.8 });
      ['Blur faces', 'Watermark'].forEach((name, i) => pf.filter(a, { x: 540, y: 206 + i * 96, w: 360, h: 84, name, at: at(best, 'downstream') - 0.6, states: [{ at: at(best, 'idle'), state: 'idle', light: 'Waiting' }] }));
      arch.code(a, { x: 24, y: 424, w: 640, at: at(best, 'sort'), lines: [{ code: 'sort  # reads all input before writing any' }] });
      sticker(a, 'Back to a batch', { x: 700, y: 440, at: at(best, 'batch'), variant: 'red', iconName: 'hourglass' });

      const shared = 'limits/shared_state';
      const b = picture(shared);
      rule(b, 1, { full: true, x: 24, y: 8, w: 640, at: begin(shared) + 0.1, crackAt: at(shared, 'violates') });
      frame(b, { x: 8, y: 132, w: 944, h: 270, key: [['component', 'filter'], ['port', 'port'], ['dependency', 'hidden dependency']], at: begin(shared) + 0.15 });
      pf.filter(b, { x: 60, y: 186, w: 300, h: 160, name: 'Blur faces', lines: ['faces_found'], at: begin(shared) + 0.2 });
      pf.filter(b, { x: 600, y: 186, w: 300, h: 160, name: 'Caption players', at: at(shared, 'caption'), states: [{ at: at(shared, 'reads'), state: 'new', light: 'Reads its faces' }] });
      uml.connector(b, { points: [[596, 310], [366, 310]], kind: 'dependency', tone: 'red', at: at(shared, 'internal') });
      uml.label(b, { x: 380, y: 266, text: 'Shared state', stereotype: false, tone: 'red', at: at(shared, 'internal') + 0.3 });
      sticker(b, 'Can’t reuse alone', { x: 60, y: 432, at: at(shared, 'separately'), variant: 'red', iconName: 'cross' });
      sticker(b, 'Can’t reorder', { x: 560, y: 432, at: at(shared, 'reordered'), variant: 'red', iconName: 'cross' });

      const when = 'limits/when';
      const c = picture(when);
      wall.listCard(c, {
        x: 24, y: 30, w: 440, title: 'Good fit', iconName: 'check', tone: 'fix', at: at(when, 'stream'),
        items: [['Photos and video', 'photos'], ['Audio', 'audio'], ['Server logs', 'logs'], ['Sensor data', 'sensor'], ['Lines of text', 'text']].map(([text, word]) => ({ text, at: at(when, word) })),
      });
      wall.listCard(c, {
        x: 496, y: 30, w: 440, title: 'Poor fit', iconName: 'cross', tone: 'trap', at: at(when, 'poorly'),
        items: [{ text: 'Interactive applications', at: at(when, 'interactive') }, { text: 'Steps sharing lots of data', at: at(when, 'share') }],
      });
      wall.banner(c, { x: 200, y: 430, w: 560, title: 'Choose it for', text: 'Streams of items through independent steps', at: at(when, 'state') });
    }


    // ----------------------------------------------------------------
    // In practice: real pipelines from many domains
    // ----------------------------------------------------------------

    /**
     * A real system as a small C&C view: its filters in a row joined by
     * pipes, in a frame titled with the system and its domain, with the
     * rule that makes the style fit it written underneath. Only sources and
     * sinks carry a stereotype; the key names the rest. A wider `gap`
     * leaves room to label a pipe; `widths` sizes each box (equal by default).
     */
    function example(parent, { y, title, names, stereotypes = {}, mono = false, why, gap = 40, h = 100, widths, at }) {
      frame(parent, { x: 8, y, w: 944, h: h + 104, title, at });
      const even = (912 - (names.length - 1) * gap) / names.length;
      const sizes = widths || names.map(() => even);
      const xs = sizes.map((_, i) => 24 + sizes.slice(0, i).reduce((sum, size) => sum + size, 0) + i * gap);
      const top = y + 46;
      const boxes = names.map((name, i) => pf.filter(parent, {
        x: xs[i], y: top, w: sizes[i], h, name, at: at + 0.15 + i * 0.1,
        stereotype: stereotypes[i] || null, variant: mono ? 'mono' : undefined,
        ports: { in: stereotypes[i] !== 'source', out: stereotypes[i] !== 'sink' },
      }));
      const mid = top + h / 2;
      const inPort = (i) => [xs[i] - uml.PORT / 2, mid];
      const outPort = (i) => [xs[i] + sizes[i] + uml.PORT / 2, mid];
      names.slice(1).forEach((_, i) => pf.pipe(parent, { from: outPort(i), to: inPort(i + 1), at: at + 0.15 + (i + 1) * 0.1 - 0.05 }));
      arch.tag(parent, { x: 24, y: top + h + 8, text: why, tone: 'green', at: at + 0.8 });
      return { boxes, inPort, outPort, center: (i) => xs[i] + sizes[i] / 2, top, bottom: top + h };
    }

    /**
     * nf-core/rnaseq's default route, simplified: the raw reads tee into a
     * quality check (FastQC) and the trimmer (Trim Galore!); trimmed reads
     * go to STAR and on to Salmon, whose counts are the result; MultiQC joins
     * the reports of FastQC, Trim Galore!, STAR, and Salmon into one report.
     * Every pipe runs straight, and none crosses another.
     */
    function nfCore(parent, { y, at: when, why }) {
      frame(parent, { x: 8, y, w: 944, h: 306, title: 'nf-core · RNA sequencing, simplified', at: when });
      const h = 80;
      const gap = 52;
      // Upper row: the source, three filters, and a sink, each wide enough
      // that its words stay clear of its ports.
      const widths = [164, 140, 120, 120, 160];
      const xs = widths.map((_, i) => 24 + widths.slice(0, i).reduce((sum, size) => sum + size, 0) + i * gap);
      const top = y + 46;
      const lower = top + h + 48;
      const box = (i, row) => ({ x: xs[i], y: row, w: widths[i], h });
      const reads = box(0, top);
      const upper = [box(1, top), box(2, top), box(3, top)];
      const counts = box(4, top);
      const fastqc = box(0, lower);
      const multi = { x: xs[1], y: lower, w: xs[3] + widths[3] - xs[1], h };
      const report = box(4, lower);
      const step = (i) => when + 0.15 + i * 0.1;
      // Where each upper filter's report drops into MultiQC's top edge.
      const into = upper.map((b) => b.x + b.w / 2 - multi.x);
      pf.filter(parent, { ...reads, name: 'Raw reads', stereotype: 'source', ports: [{ side: 'right', along: 0.5 }, { side: 'bottom', along: 0.5 }], at: step(0) });
      ['Trim Galore!', 'STAR', 'Salmon'].forEach((name, i) => pf.filter(parent, { ...upper[i], name, ports: [{ side: 'left', along: 0.5 }, { side: 'right', along: 0.5 }, { side: 'bottom', along: 0.5 }], at: step(i + 1) }));
      pf.filter(parent, { ...counts, name: 'Gene counts', stereotype: 'sink', ports: [{ side: 'left', along: 0.5 }], at: step(4) });
      pf.filter(parent, { ...fastqc, name: 'FastQC', ports: [{ side: 'top', along: 0.5 }, { side: 'right', along: 0.5 }], at: step(1) });
      pf.filter(parent, { ...multi, name: 'MultiQC', ports: [{ side: 'left', along: 0.5 }, ...into.map((along) => ({ side: 'top', along })), { side: 'right', along: 0.5 }], at: step(3) });
      pf.filter(parent, { ...report, name: 'HTML report', stereotype: 'sink', ports: [{ side: 'left', along: 0.5 }], at: step(5) });
      const pipes = [
        [face(reads, 'right'), face(upper[0], 'left')],
        [face(reads, 'bottom'), face(fastqc, 'top')],
        [face(upper[0], 'right'), face(upper[1], 'left')],
        [face(upper[1], 'right'), face(upper[2], 'left')],
        [face(upper[2], 'right'), face(counts, 'left')],
        [face(fastqc, 'right'), face(multi, 'left')],
        ...upper.map((b, i) => [face(b, 'bottom'), face(multi, 'top', into[i])]),
        [face(multi, 'right'), face(report, 'left')],
      ];
      pipes.forEach(([from, to], i) => pf.pipe(parent, { from, to, at: step(1) + i * 0.08 }));
      // The branch and the merge, named where they happen, between the rows.
      const between = top + h + 8;
      arch.tag(parent, { x: 36, y: between, text: 'tee', tone: 'cyan', at: step(6) });
      arch.tag(parent, { x: multi.x + (into[1] + into[2]) / 2 - 28, y: between, text: 'join', tone: 'cyan', at: step(6) + 0.2 });
      arch.tag(parent, { x: 24, y: lower + h + 8, text: why, tone: 'green', at: when + 0.8 });
    }

    function inPractice() {
      const shell = 'in_practice/shell_gpu';
      const a = picture(shell);
      example(a, { y: 6, title: 'Unix shell · operating systems', names: ['tr', 'tr', 'sort', 'uniq -c', 'sort -rn', 'sed'], widths: [90, 90, 116, 150, 164, 100], mono: true, why: 'Agnosticism: tools reused in any text pipeline', at: at(shell, 'unix') });
      example(a, { y: 250, title: 'GPU · games', names: ['Input assembler', 'Vertex shader', 'Rasterizer', 'Pixel shader', 'Output merger'], why: 'Incremental processing: each stage passes pixels straight on', at: at(shell, 'graphics') });

      const search = 'in_practice/search_fraud';
      const b = picture(search);
      const analyzer = example(b, { y: 6, title: 'Elasticsearch · search', names: ['Char filter', 'Tokenizer', 'Lowercase', 'Stop words', 'Stemmer'], why: 'Reuse: indexing and search share one chain', at: at(search, 'analyzer') - 0.6 });
      uml.callout(b, { x: 560, y: 170, w: 370, text: 'Same chain for full-text queries', to: [analyzer.center(4), 156], at: at(search, 'query') });
      // Keying by account routes each payment; it is no filter, so it labels the pipe.
      const fraud = example(b, { y: 250, title: 'fraud detection · finance', names: ['Card payments', 'Fraud detector', 'Alerts'], stereotypes: { 0: 'source', 2: 'sink' }, gap: 220, why: 'Incremental processing: each payment judged as it arrives', at: at(search, 'fraud') });
      uml.label(b, { x: fraud.outPort(0)[0] + 34, y: fraud.top + 6, text: 'keyed by account', stereotype: false, at: at(search, 'fraud') + 0.5 });

      const radio = 'in_practice/radio_genomes';
      const c = picture(radio);
      // Each box wide enough that its words keep clear of its ports.
      example(c, { y: 6, h: 96, widths: [176, 132, 164, 128, 152], title: 'GNU Radio · software radio', names: ['Antenna samples', 'Channel filter', 'FM demodulator', 'Audio filter', 'Sound card'], stereotypes: { 0: 'source', 4: 'sink' }, why: 'Acyclic flow: GNU Radio 3 forbids loops', at: at(radio, 'radios') });
      nfCore(c, { y: 214, at: at(radio, 'genomics'), why: 'Independence: no shared state, so each step is tested alone' });

      const thread = 'in_practice/common_thread';
      const d = picture(thread);
      wall.listCard(d, { x: 24, y: 20, w: 912, title: 'The shared workload', text: 'A stream of items through independent steps', iconName: 'list', at: begin(thread) + 0.2 });
      rule(d, 3, { x: 24, y: 176, w: 444, at: at(thread, 'bends') - 0.4 });
      wall.listCard(d, { x: 24, y: 244, w: 444, title: 'Waits for all its input', iconName: 'hourglass', tone: 'trap', at: at(thread, 'sort'), items: [{ text: 'sort, in the Unix shell' }, { text: 'MultiQC, the quality-control report' }] });
      rule(d, 1, { x: 492, y: 176, w: 444, at: at(thread, 'bends') - 0.2 });
      wall.listCard(d, { x: 492, y: 244, w: 444, title: 'Shared buffers', iconName: 'warning', tone: 'trap', at: at(thread, 'buffers'), items: [{ text: 'The GPU’s output merger' }] });
    }

    // ----------------------------------------------------------------
    // Summary
    // ----------------------------------------------------------------

    function summary() {
      const problem = 'summary/recap_problem';
      const a = picture(problem);
      pf.bars(a, {
        x: 24, y: 8, w: 440, at: begin(problem) + 0.1,
        rows: ['Denoise', 'Brighten', 'Crop', 'Blur faces', 'Watermark', 'Upload'].map((label) => ({ label, at: -1, duration: 0.1 })),
        clock: [{ at: -1, text: 'Nothing online until midnight' }],
      });
      arch.cross(a, { x: 244, y: 148, size: 80, at: at(problem, 'midnight') });
      const row = standardLine(a, { y: 350, at: at(problem, 'filters'), step: 0.12 });
      lineFrame(a, { y: 350, below: 16, at: at(problem, 'decomposes') });
      uml.callout(a, { x: 400, y: 484, w: 236, text: 'Filter: a component', to: [row.center(2), 350 + FH], at: at(problem, 'components') });
      uml.callout(a, { x: 60, y: 484, w: 250, text: 'Pipe: a connector', to: [(row.outPort(0)[0] + row.inPort(1)[0]) / 2, row.portY + 4], at: at(problem, 'connectors') });
      flowAll(a, row, { from: at(problem, 'pipes'), to: end(problem), every: 1.0 });
      pf.gallery(a, { x: 600, y: 8, w: 336, title: 'Website', at: at(problem, 'sink'), items: [{ at: at(problem, 'sink') + 0.2, look: LOOKS[5] }, { at: at(problem, 'sink') + 0.5, look: LOOKS[5] }] });

      // One balance: what the rules promote fills its left pan as the
      // narrator names each quality, and what the style inhibits its right,
      // each quality with the rules it follows from, by name, and why. The
      // closing question takes the space under the shorter inhibited pan.
      const rules = 'summary/recap_rules';
      const costsCue = 'summary/recap_costs';
      const b = picture(rules, costsCue);
      // The promoted pan stands on its own first, its hanger hidden; the beam
      // and the inhibited pan complete the balance when the narrator turns to
      // the costs.
      const [promoted] = arch.tradeoff(b, {
        x: 480, y: 40, beam: 480, at: begin(costsCue) + 0.05,
        pans: [
          {
            w: 456, title: 'Promoted', at: begin(rules) + 0.4,
            items: [
              { name: 'Reusability, testability', rule: ['Independence', 'Agnosticism'], why: 'A filter needs only its input and output', at: at(rules, 'reusability') },
              { name: 'Modifiability, extensibility', rule: 'Agnosticism', why: 'Insert or replace one filter alone', at: at(rules, 'modifiability') },
              { name: 'Understandability', rule: ['Independence', 'Agnosticism', 'Acyclic flow'], why: 'The pipeline composes its filters', at: at(rules, 'understandability') },
              { name: 'Performance: throughput', rule: 'Incremental processing', why: 'Filters can work at once on different items', at: at(rules, 'throughput') },
            ],
          },
          {
            w: 456, title: 'Inhibited', effect: 'inhibited', at: begin(costsCue) + 0.1,
            items: [
              { name: 'Interactive usability', rule: 'Acyclic flow', why: 'No feedback flows upstream', at: at(costsCue, 'interactive') },
              { name: 'Performance: latency', rule: 'One agreed format', why: 'Every filter decodes and re-encodes', at: at(costsCue, 'latency') },
              { name: 'Robustness (error handling)', rule: ['Independence', 'Agnosticism'], why: 'No component knows the global state', at: at(costsCue, 'robustness') },
            ],
          },
        ],
      });
      arch.track(promoted, 'is-', [{ at: -1, state: 'unhung' }, { at: begin(costsCue) + 0.05, state: '' }]);
      sticker(b, 'Could each step be its own filter?', { x: 484, y: 444, at: at(costsCue, 'filter2'), variant: 'gold', iconName: 'question' });
    }

    intro();
    monolith();
    filtersScene();
    alone();
    stream();
    order();
    buys();
    costs();
    limits();
    inPractice();
    summary();
  };
})();

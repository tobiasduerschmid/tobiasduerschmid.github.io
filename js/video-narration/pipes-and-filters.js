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
 * stereotyped «filter» with an input and an output port, and each pipe a
 * connector that photos slide along, never across a filter's name; in the
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
    alone: { kind: 'Rule', name: '1 and 2 · Filters work alone', iconName: 'lock' },
    stream: { kind: 'Rule', name: '3 and 4 · A stream, one way', iconName: 'forward' },
    order: { kind: 'Rule', name: 'Building the line', iconName: 'list' },
    buys: { kind: 'Promotes', name: 'Reuse, change, throughput', iconName: 'sparkle' },
    costs: { kind: 'Inhibits', name: 'Interactivity, latency, errors', iconName: 'warning' },
    limits: { kind: 'Trade-off', name: 'When rules bend', iconName: 'target' },
    in_practice: { kind: 'In practice', name: 'Real-world examples', iconName: 'globe' },
    summary: { kind: 'Recap', name: 'Do one thing, pass it on', iconName: 'check' },
  };

  /** The four rules, as their cards name them. */
  const RULES = {
    1: { name: 'Independence', text: 'No shared state: filters interact only through pipes.' },
    2: { name: 'Agnosticism', text: 'A filter doesn’t know its neighbors: item in, item out.' },
    3: { name: 'Incremental', text: 'Pass each item on as soon as it is done.' },
    4: { name: 'Acyclic', text: 'Data flows one way, from source to sink, without loops.' },
  };

  const NAMES = ['Denoise', 'Brighten', 'Crop', 'Blur faces', 'Watermark'];
  /** What a photo looks like after each filter of the line, in order. */
  const LOOKS = [
    { noise: true, dark: true }, { dark: true }, {}, { crop: true }, { crop: true, blur: true }, { crop: true, blur: true, mark: true },
  ];
  /** The standard line: five filters 128 wide, 66 apart, so each pipe shows 52px of line. */
  const LINE = { x0: 28, w: 128, gap: 66 };
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
    /** Rule n's card; `full` adds its one-line statement. */
    const rule = (parent, n, { full = false, ...options }) => arch.rule(parent, { n, name: RULES[n].name, text: full ? RULES[n].text : undefined, ...options });
    /** A diagram frame naming its view (cnc by default) with its key (a pipeline's by default). */
    const frame = (parent, options) => uml.frame(parent, { view: 'cnc', key: KEY_SHORT, ...options });

    /** The standard line at height y; `specs` per box, `names` to vary it. */
    function standardLine(parent, { y, at: when, names = NAMES, specs = [], step = 0.12, until, ...layout }) {
      return pf.line(parent, { ...LINE, ...layout, y, names, at: when, specs, step, until });
    }
    /** Photos sliding through every pipe of a line from `from` to `to`, each looking as its upstream filter left it. */
    function flowAll(parent, row, { from, to, every = 0.9, offset = 0 }) {
      row.pipes.forEach(({ from: a, to: b }, i) => pf.flow(parent, { from: a, to: b, at: from + i * 0.2 + offset, until: to, every, look: LOOKS[i + 1] }));
    }
    /** The frame around a line of filters at height y: its tab above the boxes, a margin below. */
    function lineFrame(parent, { y, below = 20, ...options }) {
      return frame(parent, { x: 8, y: y - 50, w: 944, h: 50 + FH + below, ...options });
    }

    // ----------------------------------------------------------------
    // Motivation: game night, and the batch script
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
        arch.card(a, { x: 640, y: 24 + i * 84, w: 296, title: name, sub: '3,000 files', mono: true, iconName: 'folder', at: [at(script, 'folder'), at(script, 'folder3'), at(script, 'on'), at(script, 'until'), at(script, 'last')][i] });
      });
      wall.listCard(a, {
        x: 24, y: 320, w: 580, title: 'Shared global settings', iconName: 'gear', at: at(script, 'global'),
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

      const change = 'monolith/change_requests';
      const c = picture(change);
      arch.card(c, { x: 300, y: 190, w: 360, title: 'process_all.py', sub: 'One giant file', mono: true, iconName: 'file', at: begin(change) + 0.1, states: [{ at: at(change, 'surgery'), state: 'changed', sub: 'One giant file' }] });
      arch.card(c, { x: 24, y: 30, w: 400, title: 'New step', sub: 'Straighten tilted shots, after the crop', iconName: 'move', at: at(change, 'straightens') });
      arch.card(c, { x: 536, y: 30, w: 400, title: 'Reuse request', sub: 'Robotics club wants the denoiser', iconName: 'copy', at: at(change, 'robotics') });
      arch.wire(c, { from: [224, 142], to: [380, 186], at: at(change, 'surgery') });
      arch.wire(c, { from: [736, 142], to: [580, 186], at: at(change, 'surgery') + 0.2 });
      arch.tag(c, { x: 340, y: 300, text: 'Every step reads the globals', tone: 'red', at: at(change, 'global') });
      wall.banner(c, { x: 180, y: 400, w: 600, title: 'What you need', text: 'Steps that work alone and pass each photo on', at: at(change, 'need') });
    }

    // ----------------------------------------------------------------
    // Rules: the parts in a C&C view, then the four rules
    // ----------------------------------------------------------------

    function filtersScene() {
      const filterCue = 'filters/filter';
      const pipeCue = 'filters/pipe';
      const ends = 'filters/source_sink';
      const a = picture(filterCue, ends);
      // Room on the left and right of the line for the source's and the sink's pipes.
      const row = { x0: 80, w: 118, gap: 56, y: 172 };
      frame(a, { x: 8, y: 6, w: 944, h: 478, key: KEY, at: begin(filterCue) + 0.3 });
      // The pipes arrive with the cue that names them.
      const line = pf.line(a, { ...row, names: NAMES, at: at(filterCue, 'filters'), step: 0.12, pipesAt: at(pipeCue, 'pipes') });
      const top = row.y;
      const mid = row.y + FH / 2;
      const boxX = (i) => row.x0 + i * (row.w + row.gap);
      // Callouts name the parts as the narrator does.
      uml.callout(a, { x: 206, y: 84, w: 216, text: 'Filter: a component', to: [boxX(1) + row.w / 2, top], at: at(filterCue, 'component2'), until: end(filterCue) });
      uml.callout(a, { x: 24, y: 304, w: 144, text: 'Input port', to: [boxX(0), mid], at: at(filterCue, 'input'), until: end(filterCue) });
      uml.callout(a, { x: 186, y: 304, w: 160, text: 'Output port', to: [boxX(0) + row.w, mid], at: at(filterCue, 'output'), until: end(filterCue) });
      arch.tag(a, { x: 24, y: 420, text: 'A filter reads a stream, transforms each item, writes a stream', tone: 'cyan', at: at(filterCue, 'transformation'), until: begin(pipeCue) + 0.2 });
      const pipeX = (boxX(1) + row.w + boxX(2)) / 2;
      uml.callout(a, { x: pipeX - 110, y: 84, w: 214, text: 'Pipe: a connector', to: [pipeX, mid - 4], at: at(pipeCue, 'connectors'), until: end(pipeCue) });
      arch.tag(a, { x: 24, y: 420, text: 'A pipe: one way, in order, unchanged, buffered', tone: 'cyan', at: at(pipeCue, 'direction'), until: begin(ends) + 0.2 });
      flowAll(a, line, { from: at(pipeCue, 'carries'), to: end(ends) });
      // The source feeds Denoise's input port from above-left; the sink takes Watermark's output below-right.
      pf.filter(a, { x: 24, y: 60, w: 236, h: 80, name: 'Camera uploads', stereotype: 'source', ports: false, at: at(ends, 'source') });
      const sourcePath = [[48, 140], [48, mid], line.inPort(0)];
      uml.connector(a, { points: sourcePath, ends: 'from', at: at(ends, 'feeds') });
      const sinkX = 742;
      const sinkPath = [line.outPort(4), [928, mid], [928, 380]];
      pf.filter(a, { x: sinkX, y: 380, w: 196, h: 80, name: 'Website gallery', stereotype: 'sink', ports: false, at: at(ends, 'sink') });
      uml.connector(a, { points: sinkPath, ends: 'to', at: at(ends, 'gallery') });
      pf.flow(a, { from: sourcePath[0], to: sourcePath[1], at: at(ends, 'feeds') + 0.3, until: end(ends), every: 1.2, look: LOOKS[0] });
      [['Enrich: Watermark adds the logo', 'enriches'], ['Refine: Denoise removes noise', 'refines'], ['Transform: raw file to web image', 'transforms']].forEach(([text, word], i) => {
        arch.tag(a, { x: 24, y: 340 + i * 46, text, at: at(ends, word) });
      });
    }

    function alone() {
      const independent = 'alone/independent';
      const agnostic = 'alone/agnostic';
      const format = 'alone/common_format';
      const a = picture(independent, format);
      // The rules stay up through the scene; each arrives as its cue begins, before it is named.
      rule(a, 1, { full: true, x: 24, y: 8, w: 444, at: begin(independent) + 0.4 });
      rule(a, 2, { full: true, x: 492, y: 8, w: 444, at: begin(agnostic) + 0.2 });

      // Rule 1: a line whose settings are parameters, the shared globals struck out.
      const row = standardLine(a, { y: 186, at: begin(independent) + 0.2, step: 0.05, until: end(independent), specs: [{}, { dial: 'amount=1.3', at: begin(independent) + 0.25 }] });
      lineFrame(a, { y: 186, below: 52, at: begin(independent) + 0.15, until: end(independent) });
      flowAll(a, row, { from: at(independent, 'pipes'), to: end(independent), every: 1.2 });
      wall.listCard(a, { x: 24, y: 394, w: 420, title: 'Shared global settings', iconName: 'gear', at: begin(independent) + 0.3, until: end(independent), items: [{ text: 'SETTINGS, LAST_BRIGHTNESS' }] }).classList.add('pf-globals');
      arch.cross(a, { x: 488, y: 434, size: 64, at: at(independent, 'settings'), until: end(independent) });
      sticker(a, 'Parameters, not globals', { x: 560, y: 400, at: at(independent, 'parameters'), until: end(independent), variant: 'green', iconName: 'gear' });
      arch.tag(a, { x: 560, y: 470, text: 'Testable and reusable alone', tone: 'green', at: at(independent, 'tested'), until: end(independent) });

      // Rule 2: Blur faces knows only its contract; its neighbors are unknown to it.
      const g = { y: 196, h: FH };
      frame(a, { x: 8, y: 126, w: 944, h: 264, at: begin(agnostic) + 0.1, until: end(agnostic) });
      pf.filter(a, { x: 40, y: g.y, w: 200, name: 'Crop', at: begin(agnostic) + 0.2, until: end(agnostic), states: [{ at: at(agnostic, 'before'), state: 'unknown', light: 'Unknown' }] });
      pf.filter(a, { x: 360, y: g.y - 20, w: 240, h: FH + 40, name: 'Blur faces', at: begin(agnostic) + 0.2, until: end(agnostic), states: [{ at: at(agnostic, 'contract'), state: 'focus', light: 'Knows: in, out' }] });
      pf.filter(a, { x: 720, y: g.y, w: 200, name: 'Watermark', at: begin(agnostic) + 0.2, until: end(agnostic), states: [{ at: at(agnostic, 'after'), state: 'unknown', light: 'Unknown' }] });
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

      // The precondition: one common data type, so any order still connects.
      frame(a, { x: 8, y: 122, w: 944, h: 372, at: begin(format) + 0.1 });
      const first = standardLine(a, { y: 172, at: begin(format) + 0.15, step: 0.05 });
      arch.tag(a, { x: 24, y: 288, text: 'Every pipe carries: Image (JPEG)', tone: 'cyan', at: at(format, 'pipe') });
      const shuffled = standardLine(a, { y: 362, names: ['Brighten', 'Denoise', 'Watermark', 'Crop', 'Blur faces'], at: at(format, 'any'), step: 0.12 });
      flowAll(a, first, { from: at(format, 'carries'), to: end(format), every: 1.1 });
      flowAll(a, shuffled, { from: at(format, 'any') + 0.6, to: end(format), every: 1.1 });
      arch.tag(a, { x: 470, y: 288, text: 'Any order still connects', tone: 'green', at: at(format, 'follow') });
    }

    function stream() {
      const incremental = 'stream/incremental';
      const predict = 'stream/predict_online';
      const seconds = 'stream/seconds';
      const acyclic = 'stream/acyclic';
      const a = picture(incremental, acyclic);
      rule(a, 3, { full: true, x: 24, y: 8, w: 444, at: begin(incremental) + 0.3 });
      // Rule 4 arrives as its cue begins, just before the narrator names it.
      rule(a, 4, { full: true, x: 492, y: 8, w: 444, at: begin(acyclic) + 0.1 });

      const busy = (from) => [{ at: from, state: 'busy', light: 'Busy' }];
      const row = standardLine(a, { y: 166, at: begin(incremental) + 0.2, step: 0.05, specs: NAMES.map(() => ({ states: busy(at(incremental, 'concurrently')) })) });
      lineFrame(a, { y: 166, below: 56, at: begin(incremental) + 0.15 });
      [['Photo 5', 0], ['Photo 4', 1], ['Photo 3', 2, 'three2'], ['Photo 2', 3, 'two'], ['Photo 1', 4, 'one']].forEach(([text, i, word]) => {
        arch.tag(a, { x: row.center(i) - 46, y: 286, text, tone: 'gold', at: word ? at(incremental, word) : at(incremental, 'concurrently'), until: begin(acyclic) });
      });
      flowAll(a, row, { from: at(incremental, 'passes'), to: end(acyclic), every: 1.0 });

      // The prediction and its answer, below the line.
      arch.readout(a, { x: 676, y: 352, w: 260, label: 'Scoreboard', iconName: 'timer', at: at(predict, 'game'), until: at(seconds, 'gallery') + 0.2, values: [{ at: -1, text: '2nd quarter · 9:12' }] });
      pf.photo(a, { x: 24, y: 352, w: 196, look: LOOKS[0], caption: 'Touchdown catch', at: at(predict, 'catch'), until: begin(acyclic) });
      wall.slot(a, { x: 240, y: 352, w: 400, h: 96, text: 'On the website when?', at: at(predict, 'predict'), until: begin(seconds) + 0.2 });
      // The catch hops pipe by pipe, half a second in each filter.
      const hop = at(seconds, 'passes');
      row.pipes.forEach(({ from, to }, i) => arch.token(a, { kind: 'photo', size: 30, path: [from, to], at: hop + i * 0.5, duration: 0.3, until: hop + i * 0.5 + 0.35, art: pf.photoToken(LOOKS[i + 1]) }));
      arch.readout(a, { x: 240, y: 352, w: 300, label: 'Shot to website', iconName: 'timer', at: at(seconds, 'gallery'), until: begin(acyclic), values: [{ at: -1, text: '2.5 seconds', state: 'ok' }] });
      pf.gallery(a, { x: 656, y: 352, w: 280, title: 'Website', at: at(seconds, 'gallery'), until: begin(acyclic), items: [{ at: at(seconds, 'gallery') + 0.2, look: LOOKS[5], caption: '2nd quarter' }] });
      arch.tag(a, { x: 240, y: 440, text: 'Rule 3: first result early, all filters busy', tone: 'green', at: at(seconds, 'purpose'), until: begin(acyclic) });

      // Rule 4: a loop back upstream is not a pipe this style allows. It would
      // still attach at ports: an extra output under Watermark, an input under Crop.
      const back = 306;
      const bottom = 166 + FH;
      uml.connector(a, { points: [[row.center(4), bottom], [row.center(4), back], [row.center(2), back], [row.center(2), bottom]], kind: 'flow', tone: 'red', dashed: true, ends: 'both', at: at(acyclic, 'back') });
      arch.cross(a, { x: (row.center(4) + row.center(2)) / 2, y: back, size: 44, at: at(acyclic, 'back') + 0.3 });
      uml.callout(a, { x: 24, y: 344, w: 340, text: 'A pipe back upstream: forbidden', tone: 'red', to: [row.center(2) + 40, back], at: at(acyclic, 'upstream'), until: at(acyclic, 'composition') });
      arch.code(a, { x: 24, y: 352, w: 760, at: at(acyclic, 'composition'), lines: [{ code: 'photo = watermark(blur(crop(brighten(denoise(raw)))))' }] });
      arch.tag(a, { x: 24, y: 446, text: 'The pipeline’s behavior: a composition of its filters', tone: 'green', at: at(acyclic, 'reason') });
    }

    function order() {
      const matters = 'order/order_matters';
      const a = picture(matters);
      frame(a, { x: 8, y: 6, w: 640, h: 390, at: begin(matters) + 0.1 });
      [['Crop, then Watermark', ['Crop', 'Watermark'], { crop: true, mark: true }, 'placing', 92], ['Watermark, then Crop', ['Watermark', 'Crop'], { crop: true, mark: true, markCut: true }, 'cut', 270]]
        .forEach(([label, names, look, word, y]) => {
          arch.tag(a, { x: 300, y: y - 44, text: label, at: at(matters, word) });
          const row = pf.line(a, { x0: 40, y, w: 170, gap: 60, names, at: at(matters, word), step: 0.1 });
          pf.pipe(a, { from: row.outPort(1), to: [686, y + FH / 2], at: at(matters, word) + 0.3 });
          pf.photo(a, { x: 690, y: y - 12, w: 190, look, at: at(matters, word) + 0.5 });
        });
      stamp(a, 'Logo cut off', { x: 690, y: 420, at: at(matters, 'logo'), color: 'red', rotate: -5, small: true });
      arch.code(a, {
        x: 24, y: 420, w: 600, at: at(matters, 'adding'),
        lines: [{ code: '3 -> add 1 -> double = 8' }, { code: '3 -> double -> add 1 = 7', at: at(matters, 'doubling2') }],
      });

      const roles = 'order/roles';
      const b = picture(roles);
      wall.badge(b, { x: 70, y: 30, w: 210, role: 'Filter developer', iconName: 'pencil', at: at(roles, 'developer') });
      wall.skill(b, { x: 40, y: 180, w: 270, text: 'One filter, its input and output types', at: at(roles, 'types') });
      wall.badge(b, { x: 620, y: 30, w: 210, role: 'Pipeline builder', iconName: 'list', variant: 'po', at: at(roles, 'builder') });
      wall.skill(b, { x: 590, y: 180, w: 270, text: 'Picks the filters and their order', variant: 'po', at: at(roles, 'selects') });
      const names = ['Brighten', 'Crop', 'Straighten', 'Blur faces', 'Watermark'];
      const same = (when) => [{ at: when, state: 'same', light: 'Unchanged' }];
      lineFrame(b, { y: 330, below: 16, at: begin(roles) + 0.15 });
      standardLine(b, {
        y: 330, names, at: begin(roles) + 0.2, step: 0.05,
        specs: names.map((name) => (name === 'Straighten'
          ? { at: at(roles, 'inserts'), how: 'drop', states: [{ at: at(roles, 'inserts'), state: 'new', light: 'New' }] }
          : { states: same(at(roles, 'modified')) })),
      });
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
      frame(a, { x: 8, y: 92, w: 944, h: 190, title: 'photo desk', at: begin(reuse) + 0.15 });
      const row = standardLine(a, { y: 142, at: begin(reuse) + 0.2, step: 0.05 });
      flowAll(a, row, { from: begin(reuse) + 0.5, to: end(reuse), every: 1.2 });
      frame(a, { x: 8, y: 296, w: 944, h: 190, title: 'robotics club', at: at(reuse, 'robotics') });
      pf.line(a, {
        x0: 40, y: 346, w: 180, gap: 60, names: ['Robot camera', 'Denoise', 'Detect obstacles', 'Steer'], at: at(reuse, 'inserts'), step: 0.15,
        specs: [{ stereotype: 'source', ports: { out: true } }, { states: [{ at: at(reuse, 'unchanged'), state: 'same', light: 'Unchanged' }] }, {}, { stereotype: 'sink', ports: { in: true } }],
      });
      arch.tag(a, { x: 330, y: 496, text: 'Rules 1 and 2: no shared state, no named neighbors', tone: 'green', at: at(reuse, 'guarantees') });

      const change = 'buys/change';
      const b = picture(change);
      arch.quality(b, { x: 24, y: 8, w: 280, name: 'Modifiability', at: at(change, 'modifiability') });
      arch.quality(b, { x: 320, y: 8, w: 280, name: 'Extensibility', at: at(change, 'extensibility') });
      rule(b, 2, { x: 616, y: 4, w: 320, at: begin(change) + 0.3 });
      rule(b, 1, { x: 616, y: 62, w: 320, at: at(change, 'testability') - 0.6 });
      frame(b, { x: 8, y: 124, w: 944, h: 190, at: begin(change) + 0.15 });
      const names = ['Auto-exposure', 'Crop', 'Straighten', 'Blur faces'];
      pf.filter(b, { x: 60, y: 174, w: 180, name: 'Brighten', at: begin(change) + 0.2, until: at(change, 'replacing') + 0.4 });
      pf.line(b, {
        x0: 60, y: 174, w: 180, gap: 56, names, at: begin(change) + 0.2, step: 0.05,
        specs: [{ at: at(change, 'replacing') + 0.3, how: 'drop', states: [{ at: at(change, 'replacing') + 0.3, state: 'new', light: 'Swapped in' }] }, {}, { states: [{ at: at(change, 'inserting'), state: 'new', light: 'Inserted' }] }, {}],
      });
      arch.readout(b, { x: 24, y: 340, w: 560, label: 'Test: Blur faces alone', iconName: 'check', at: at(change, 'test'), values: [{ at: -1, text: 'In: 3 faces · Out: 3 blurred' }, { at: at(change, 'check'), text: 'In: 3 faces · Out: 3 blurred · Passed', state: 'ok' }] });
      sticker(b, 'Changed nothing else', { x: 610, y: 344, at: at(change, 'nothing'), variant: 'green', iconName: 'check' });
      arch.quality(b, { x: 24, y: 430, w: 300, name: 'Testability', at: at(change, 'testability') });

      const throughput = 'buys/throughput';
      const c = picture(throughput);
      arch.quality(c, { x: 24, y: 8, w: 400, name: 'Performance: throughput', at: at(throughput, 'throughput') });
      rule(c, 3, { x: 676, y: 8, w: 260, at: begin(throughput) + 0.3 });
      // The allocation view: each filter runs on its own processor core.
      uml.frame(c, { x: 8, y: 80, w: 944, h: 206, view: 'allocation', key: [['node', 'node: a processor core'], ['component', 'filter running on it']], at: at(throughput, 'allocation') - 0.4 });
      NAMES.forEach((name, i) => {
        const x = 24 + i * 184;
        uml.node(c, { x, y: 136, w: 164, h: 142, name: `Core ${i + 1}`, stereotype: 'core', at: at(throughput, 'allocation') + i * 0.1 });
        uml.component(c, { x: x + 8, y: 204, w: 148, h: 64, name, stereotype: 'filter', at: at(throughput, 'assigns') + i * 0.1, states: [{ at: at(throughput, 'assigns') + i * 0.1, state: 'busy' }] });
      });
      arch.readout(c, { x: 24, y: 300, w: 440, label: 'Photos per minute', iconName: 'chart', at: at(throughput, 'minute'), values: [{ at: -1, text: 'One program: 30' }, { at: at(throughput, 'completes'), text: 'The line: up to 150', state: 'ok' }] });
      arch.tag(c, { x: 500, y: 316, text: 'The slowest filter sets the pace', tone: 'cyan', at: at(throughput, 'slowest') });
      wall.listCard(c, {
        x: 24, y: 368, w: 912, title: 'Each benefit follows from a rule', iconName: 'list', at: at(throughput, 'slowest'),
        items: [
          { text: 'Reusability: Rules 1 and 2', at: at(throughput, 'slowest') + 0.2 },
          { text: 'Modifiability, testability: Rules 1 and 2, one format', at: at(throughput, 'slowest') + 0.4 },
          { text: 'Throughput: Rule 3', at: at(throughput, 'pace') },
        ],
        columns: 1,
      });
    }

    function costs() {
      const slider = 'costs/slider';
      const a = picture(slider);
      pf.slider(a, { x: 24, y: 18, w: 420, label: 'Brightness', at: at(slider, 'slider'), moves: [{ at: at(slider, 'live'), p: 0.75 }, { at: at(slider, 'adjustment'), p: 0.5 }] });
      rule(a, 4, { full: true, x: 492, y: 8, w: 444, at: begin(slider) + 0.4 });
      const row = standardLine(a, { y: 244, at: begin(slider) + 0.1, step: 0.05 });
      lineFrame(a, { y: 244, below: 16, key: [...KEY_SHORT, ['attempt', 'not allowed']], at: begin(slider) + 0.05 });
      flowAll(a, row, { from: begin(slider) + 0.4, to: end(slider), every: 1.1 });
      uml.connector(a, { points: [[230, 110], [230, 160], [row.center(1), 160], [row.center(1), 238]], kind: 'flow', tone: 'red', dashed: true, at: at(slider, 'upstream') });
      arch.cross(a, { x: 330, y: 160, size: 48, at: at(slider, 'forbids') });
      arch.tag(a, { x: 380, y: 142, text: 'Rule 4: no feedback loops', tone: 'red', at: at(slider, 'forbids') + 0.2 });
      arch.quality(a, { x: 24, y: 400, w: 320, name: 'Interactivity', effect: 'inhibited', at: at(slider, 'interactivity') });

      const latency = 'costs/latency';
      const b = picture(latency);
      rule(b, 1, { full: true, x: 24, y: 8, w: 444, at: begin(latency) + 0.3 });
      frame(b, { x: 8, y: 116, w: 944, h: 210, key: [['component', 'filter, with the steps it runs']], at: begin(latency) + 0.1 });
      NAMES.forEach((name, i) => {
        uml.component(b, { x: 24 + i * 184, y: 164, w: 172, h: 148, name, stereotype: 'filter', lines: ['decode', 'job', 'encode'], at: at(latency, 'decode') + i * 0.12 });
      });
      arch.readout(b, { x: 24, y: 344, w: 440, label: 'One photo through the line', iconName: 'timer', at: at(latency, 'five'), values: [{ at: -1, text: '5 decodes, 5 encodes', state: 'warn' }, { at: at(latency, 'longer'), text: 'Slower than one program', state: 'bad' }] });
      pf.photo(b, { x: 560, y: 340, w: 200, look: { crop: true, blocky: true }, caption: 'After 5 encodes', at: at(latency, 'quality') });
      arch.quality(b, { x: 24, y: 436, w: 380, name: 'Performance: latency', effect: 'inhibited', at: at(latency, 'longer') });

      const errors = 'costs/errors';
      const c = picture(errors);
      rule(c, 1, { x: 24, y: 8, w: 300, at: begin(errors) + 0.3 });
      rule(c, 2, { x: 340, y: 8, w: 300, at: begin(errors) + 0.4 });
      const row3 = standardLine(c, {
        y: 138, at: begin(errors) + 0.1, step: 0.05,
        specs: [{}, {}, {}, { states: [{ at: at(errors, 'crashes'), state: 'crashed', light: 'Crashed' }] }, {}],
      });
      lineFrame(c, { y: 138, below: 80, at: begin(errors) + 0.05 });
      arch.token(c, { kind: 'photo', size: 30, path: [row3.pipes[2].from, row3.pipes[2].to], at: at(errors, 'corrupted'), duration: 0.6, until: at(errors, 'crashes'), art: (node) => { node.classList.add('pf-token', 'pf-token--garbled'); } });
      [1, 3].forEach((i) => wall.slot(c, { x: (row3.pipes[i].from[0] + row3.pipes[i].to[0]) / 2 - 36, y: 258, w: 72, h: 52, text: '?', at: at(errors, i === 1 ? 'left' : 'remain') }));
      arch.tag(c, { x: 24, y: 352, text: 'No component knows the global state', tone: 'red', at: at(errors, 'global') });
      pf.gallery(c, { x: 600, y: 352, w: 336, title: 'After a restart', at: at(errors, 'restart'), items: [{ at: at(errors, 'restart') + 0.2, look: LOOKS[5], caption: 'Posted' }, { at: at(errors, 'twice'), look: LOOKS[5], caption: 'Twice' }] });
      arch.quality(c, { x: 24, y: 420, w: 340, name: 'Error handling', effect: 'inhibited', at: at(errors, 'handling') });
    }

    function limits() {
      const best = 'limits/best_shot';
      const a = picture(best);
      rule(a, 3, { full: true, x: 492, y: 8, w: 444, at: begin(best) + 0.3, crackAt: at(best, 'cannot') });
      pf.tray(a, { x: 24, y: 8, w: 440, title: 'Best shot of the burst', of: 10, at: at(best, 'best'), counts: Array.from({ length: 10 }, (_, i) => ({ at: at(best, 'buffer') + i * 0.3, n: i + 1 })) });
      frame(a, { x: 488, y: 120, w: 464, h: 286, key: [['component', 'filter'], ['port', 'port']], at: at(best, 'downstream') - 0.8 });
      ['Blur faces', 'Watermark'].forEach((name, i) => pf.filter(a, { x: 540, y: 170 + i * 120, w: 360, h: 104, name, at: at(best, 'downstream') - 0.6, states: [{ at: at(best, 'idle'), state: 'idle', light: 'Waiting' }] }));
      arch.code(a, { x: 24, y: 424, w: 640, at: at(best, 'sort'), lines: [{ code: 'sort  # reads all input before writing any' }] });
      sticker(a, 'Back to a batch', { x: 700, y: 440, at: at(best, 'batch'), variant: 'red', iconName: 'hourglass' });

      const shared = 'limits/shared_state';
      const b = picture(shared);
      rule(b, 1, { full: true, x: 24, y: 8, w: 600, at: begin(shared) + 0.1, crackAt: at(shared, 'violates') });
      frame(b, { x: 8, y: 116, w: 944, h: 280, key: [['component', 'filter'], ['port', 'port'], ['dependency', 'hidden dependency']], at: begin(shared) + 0.15 });
      pf.filter(b, { x: 60, y: 176, w: 300, h: 160, name: 'Blur faces', lines: ['faces_found'], at: begin(shared) + 0.2 });
      pf.filter(b, { x: 600, y: 176, w: 300, h: 160, name: 'Caption players', at: at(shared, 'caption'), states: [{ at: at(shared, 'reads'), state: 'new', light: 'Reads its faces' }] });
      uml.connector(b, { points: [[596, 300], [366, 300]], kind: 'dependency', tone: 'red', at: at(shared, 'internal') });
      uml.label(b, { x: 380, y: 256, text: 'Shared state', stereotype: false, tone: 'red', at: at(shared, 'internal') + 0.3 });
      sticker(b, 'Can’t reuse alone', { x: 60, y: 430, at: at(shared, 'separately'), variant: 'red', iconName: 'cross' });
      sticker(b, 'Can’t reorder', { x: 560, y: 430, at: at(shared, 'reordered'), variant: 'red', iconName: 'cross' });

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
     * rule that makes the style fit it written underneath. A wider `gap`
     * leaves room to label a pipe.
     */
    function example(parent, { y, title, names, stereotypes = {}, mono = false, why, gap = 40, at }) {
      frame(parent, { x: 8, y, w: 944, h: 232, title, at });
      const w = (912 - (names.length - 1) * gap) / names.length;
      const row = pf.line(parent, {
        x0: 24, y: y + 50, w, gap, h: 100, names, at: at + 0.15, step: 0.1,
        specs: names.map((_, i) => ({ stereotype: stereotypes[i] || 'filter', variant: mono ? 'mono' : undefined, ports: { in: stereotypes[i] !== 'source', out: stereotypes[i] !== 'sink' } })),
      });
      arch.tag(parent, { x: 24, y: y + 168, text: why, tone: 'green', at: at + 0.8 });
      return row;
    }

    function inPractice() {
      const shell = 'in_practice/shell_gpu';
      const a = picture(shell);
      example(a, { y: 6, title: 'Unix shell · operating systems', names: ['tr', 'tr', 'sort', 'uniq -c', 'sort -rn', 'sed'], mono: true, why: 'Rule 2: agnostic tools, reused in any text pipeline', at: at(shell, 'unix') });
      example(a, { y: 250, title: 'GPU · games', names: ['Input assembler', 'Vertex shader', 'Rasterizer', 'Pixel shader', 'Output merger'], why: 'Rule 3: each stage passes vertices and pixels straight on', at: at(shell, 'graphics') });

      const search = 'in_practice/search_fraud';
      const b = picture(search);
      const analyzer = example(b, { y: 6, title: 'Elasticsearch · search', names: ['Char filter', 'Tokenizer', 'Lowercase', 'Stop words', 'Stemmer'], why: 'Reuse: indexing and search share one chain', at: at(search, 'analyzer') - 0.6 });
      uml.callout(b, { x: 560, y: 170, w: 370, text: 'Same chain for full-text queries', to: [analyzer.center(4), 156], at: at(search, 'query') });
      // Keying by account routes each payment; it is no filter, so it labels the pipe.
      const fraud = example(b, { y: 250, title: 'fraud detection · finance', names: ['Card payments', 'Fraud detector', 'Alerts'], stereotypes: { 0: 'source', 2: 'sink' }, gap: 220, why: 'Rule 3: each payment judged as it arrives', at: at(search, 'fraud') });
      uml.label(b, { x: fraud.outPort(0)[0] + 26, y: 250 + 66, text: 'keyed by account', stereotype: false, at: at(search, 'fraud') + 0.5 });

      const radio = 'in_practice/radio_genomes';
      const c = picture(radio);
      example(c, { y: 6, title: 'GNU Radio · software radio', names: ['Antenna samples', 'Channel filter', 'FM demodulator', 'Audio filter', 'Sound card'], stereotypes: { 0: 'source', 4: 'sink' }, why: 'Rule 4: GNU Radio 3 forbids loops', at: at(radio, 'radios') });
      example(c, { y: 250, title: 'nf-core · RNA sequencing, simplified', names: ['FastQC', 'Trim Galore!', 'STAR', 'Salmon', 'MultiQC'], why: 'Rule 1: no shared state, so each step is tested alone', at: at(radio, 'genomics') });

      const thread = 'in_practice/common_thread';
      const d = picture(thread);
      wall.listCard(d, { x: 24, y: 20, w: 912, title: 'The shared workload', text: 'A stream of items through independent steps', iconName: 'list', at: begin(thread) + 0.2 });
      rule(d, 3, { x: 24, y: 176, w: 444, at: at(thread, 'bends') - 0.4 });
      wall.listCard(d, { x: 24, y: 244, w: 444, title: 'Waits for all its input', iconName: 'hourglass', tone: 'trap', at: at(thread, 'sort'), items: [{ text: 'sort, in the Unix shell' }, { text: 'MultiQC, the QC report' }] });
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
      uml.callout(a, { x: 60, y: 484, w: 250, text: 'Pipe: a connector', to: [(row.outPort(0)[0] + row.inPort(1)[0]) / 2, 350 + FH / 2 + 4], at: at(problem, 'connectors') });
      flowAll(a, row, { from: at(problem, 'pipes'), to: end(problem), every: 1.0 });
      pf.gallery(a, { x: 600, y: 8, w: 336, title: 'Website', at: at(problem, 'sink'), items: [{ at: at(problem, 'sink') + 0.2, look: LOOKS[5] }, { at: at(problem, 'sink') + 0.5, look: LOOKS[5] }] });

      // Each rule over the consequence it yields.
      const rules = 'summary/recap_rules';
      const b = picture(rules);
      [[1, 'state'], [2, 'neighbors'], [3, 'immediately'], [4, 'way']].forEach(([n, word], i) => {
        rule(b, n, { x: 24 + i * 232, y: 24, w: 216, at: at(rules, word) - 0.5 });
      });
      wall.bracket(b, { x: 24, y: 128, w: 448, text: 'Rules 1 and 2', at: at(rules, 'independence') });
      [['Reusability', 24, 'reusability'], ['Modifiability', 256, 'modifiability'], ['Throughput', 488, 'throughput'], ['Simple reasoning', 720, 'reasoning']].forEach(([name, x, word]) => {
        arch.quality(b, { x, y: 190, w: 216, name, at: at(rules, word) });
      });
      sticker(b, 'As long as you keep the rules', { x: 280, y: 400, at: at(rules, 'composition'), variant: 'gold', iconName: 'check' });

      const costsCue = 'summary/recap_costs';
      const c = picture(costsCue);
      // The qualities the last cue promoted stand on the left; each cost arrives as the narration names it.
      arch.tradeoff(c, {
        x: 480, y: 92, beam: 480, h: 356, at: begin(costsCue) + 0.1,
        pans: [
          {
            w: 440, title: 'Promoted', at: begin(costsCue) + 0.2,
            items: [
              { name: 'Reusability', rule: 'Rules 1, 2', why: 'A filter needs only its input and output' },
              { name: 'Modifiability', rule: 'Rule 2', why: 'Change one filter; no neighbor changes' },
              { name: 'Throughput', rule: 'Rule 3', why: 'All filters work at once on different items' },
              { name: 'Simple reasoning', rule: 'Rule 4', why: 'The line’s behavior composes its filters' },
            ],
          },
          {
            w: 440, title: 'Inhibited', effect: 'inhibited', at: begin(costsCue) + 0.3,
            items: [
              { name: 'Interactivity', rule: 'Rule 4', why: 'No feedback flows upstream', at: at(costsCue, 'interactivity') },
              { name: 'Latency', rule: 'Rule 1', why: 'Every filter decodes and re-encodes', at: at(costsCue, 'latency') },
              { name: 'Error handling', rule: 'Rules 1, 2', why: 'No filter knows the global state', at: at(costsCue, 'error') },
            ],
          },
        ],
      });
      sticker(c, 'Could each step be its own filter?', { x: 300, y: 20, at: at(costsCue, 'filter'), variant: 'gold', iconName: 'question' });
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

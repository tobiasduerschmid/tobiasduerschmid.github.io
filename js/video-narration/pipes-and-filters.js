/*
 * Choreography for the Pipes and Filters video narration (script:
 * _data/narrations/pipes_and_filters.yml; artwork: pipes-and-filters-kit.js
 * on the architecture kit and the wall kit). The narration reaches this stage
 * as a song: each scene is a section and each cue a line, and `at(cue, word)`
 * is the estimated time the narrator says that word (repeated words are
 * word2, word3, ...). Cues are named by their stable script ids
 * ('intro/sideline'), looked up in the storyboard, so reordering the script
 * never misplaces a picture.
 *
 * The teaching rule for the pictures: show the mechanism the cue names, on
 * the student paper's game-day photos. Each filter's work is visible on the
 * photo; photos slide through pipes and never across a filter's name; a rule
 * of the style is a numbered rule card; and every consequence is a quality
 * card that says Promoted or Inhibited in words. Stamps never shake the
 * stage, and nothing large changes brightness quickly (WCAG 2.3.1). Layout:
 * the 960x540 picture body; nothing readable within 12px of an edge.
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
    summary: { kind: 'Recap', name: 'Do one thing, pass it on', iconName: 'check' },
  };

  const NAMES = ['Denoise', 'Brighten', 'Crop', 'Blur faces', 'Watermark'];
  /** What a photo looks like after each filter of the line, in order. */
  const LOOKS = [
    { noise: true, dark: true }, { dark: true }, {}, { crop: true }, { crop: true, blur: true }, { crop: true, blur: true, mark: true },
  ];
  /** The standard line: five boxes 128 wide, pipes 46 long between them. */
  const LINE = { x0: 28, w: 128, gap: 66 };

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
    const pf = window.PipesKit;
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

    /** The standard line at height y; `specs` per box, `names` to vary it. */
    function standardLine(parent, { y, at: when, names = NAMES, specs = [], step = 0.12, until, ...layout }) {
      return pf.line(parent, { ...LINE, ...layout, y, names, at: when, specs, step, until });
    }
    /** Photos sliding through every pipe of a line from `from` to `to`, each looking as its upstream filter left it. */
    function flowAll(parent, row, { from, to, every = 0.9, offset = 0 }) {
      row.pipes.forEach(({ from: a, to: b }, i) => pf.flow(parent, { from: a, to: b, at: from + i * 0.2 + offset, until: to, every, look: LOOKS[i + 1] }));
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
        pf.photo(b, { x: 24 + i * 154, y: 70, w: 140, look: LOOKS[i], caption, at: at(steps, word) });
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

      const predict = 'monolith/predict_first';
      const midnight = 'monolith/midnight';
      const b = picture(predict, midnight);
      arch.readout(b, {
        x: 24, y: 24, w: 250, label: 'Clock', iconName: 'timer', at: begin(predict) + 0.1,
        values: [{ at: -1, text: '10:00 p.m.' }, { at: at(midnight, 'midnight'), text: '12:00 a.m.', state: 'bad' }],
      });
      const stepsOf = ['Denoise', 'Brighten', 'Crop', 'Blur faces', 'Watermark', 'Upload'];
      pf.bars(b, {
        x: 24, y: 110, w: 560, at: at(predict, 'step'),
        rows: stepsOf.map((label, i) => ({ label, at: at(midnight, 'every') + i * 0.55, duration: 0.5 })),
      });
      arch.tag(b, { x: 300, y: 40, text: '20 minutes per step, all photos', at: at(predict, 'twenty') });
      wall.slot(b, { x: 620, y: 110, w: 316, h: 110, text: 'First photo online: when?', at: at(predict, 'predict'), until: begin(midnight) + 0.2 });
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
    // Rules: the parts, then the four rules
    // ----------------------------------------------------------------

    function filtersScene() {
      const filterCue = 'filters/filter';
      const pipeCue = 'filters/pipe';
      const ends = 'filters/source_sink';
      const a = picture(filterCue, ends);
      const row = standardLine(a, { y: 200, at: at(filterCue, 'filters'), specs: NAMES.map((_, i) => (i ? { at: at(filterCue, i === 1 ? 'brighten' : 'filters') + 0.1 * i } : { at: at(filterCue, 'denoise') })) });
      arch.tag(a, { x: 24, y: 330, text: 'Filter: reads a stream, transforms each item, writes a stream', at: at(filterCue, 'reads'), until: begin(pipeCue) + 0.2 });
      flowAll(a, row, { from: at(pipeCue, 'carries'), to: end(ends) });
      arch.tag(a, { x: 24, y: 330, text: 'Pipe: one way, in order, unchanged, with a small buffer', at: at(pipeCue, 'way'), until: begin(ends) + 0.2 });
      pf.filter(a, { x: 40, y: 50, w: 220, h: 70, name: 'Camera uploads', ports: false, at: at(ends, 'source') });
      pf.pipe(a, { from: [104, 124], to: [104, 190], at: at(ends, 'feeds') });
      pf.filter(a, { x: 716, y: 410, w: 220, h: 70, name: 'Website gallery', ports: false, at: at(ends, 'sink') });
      pf.pipe(a, { from: [row.center(4), 290], to: [row.center(4), 400], at: at(ends, 'gallery') });
      [['Enrich: Watermark adds the logo', 'enrich'], ['Refine: Denoise removes noise', 'refine'], ['Transform: raw file to web image', 'transform']].forEach(([text, word], i) => {
        arch.tag(a, { x: 24, y: 330 + i * 46, text, tone: 'cyan', at: at(ends, word) });
      });
      arch.tag(a, { x: 300, y: 70, text: 'Source', tone: 'gold', at: at(ends, 'source') + 0.2 });
      arch.tag(a, { x: 640, y: 480, text: 'Sink', tone: 'gold', at: at(ends, 'sink') + 0.2 });
    }

    function alone() {
      const independent = 'alone/independent';
      const a = picture(independent);
      arch.rule(a, { x: 24, y: 18, w: 600, n: 1, name: 'Independence', text: 'No shared state: filters talk only through pipes.', at: at(independent, 'one') });
      const row = standardLine(a, { y: 190, at: begin(independent) + 0.2, step: 0.05, specs: [{}, { dial: 'amount=1.3' }] });
      wall.listCard(a, { x: 24, y: 360, w: 460, title: 'Shared global settings', iconName: 'gear', at: begin(independent) + 0.3, items: [{ text: 'SETTINGS, LAST_BRIGHTNESS' }] }).classList.add('pf-globals');
      arch.cross(a, { x: 536, y: 404, size: 70, at: at(independent, 'global') });
      sticker(a, 'Parameters, not globals', { x: 600, y: 446, at: at(independent, 'parameter'), variant: 'green', iconName: 'gear' });
      flowAll(a, row, { from: at(independent, 'pipes'), to: end(independent), every: 1.2 });

      const agnostic = 'alone/agnostic';
      const b = picture(agnostic);
      arch.rule(b, { x: 24, y: 18, w: 600, n: 2, name: 'Agnosticism', text: 'Don’t know your neighbors: just item in, item out.', at: at(agnostic, 'two') });
      pf.filter(b, { x: 40, y: 220, w: 200, h: 90, name: 'Crop', at: at(agnostic, 'crop'), states: [{ at: at(agnostic, 'crop'), state: 'frosted', light: 'Unknown' }] });
      pf.filter(b, { x: 360, y: 200, w: 240, h: 130, name: 'Blur faces', at: at(agnostic, 'blur'), states: [{ at: at(agnostic, 'blur'), state: 'booth', light: 'Knows: in, out' }] });
      pf.filter(b, { x: 720, y: 220, w: 200, h: 90, name: 'Watermark', at: at(agnostic, 'watermark'), states: [{ at: at(agnostic, 'watermark'), state: 'frosted', light: 'Unknown' }] });
      pf.pipe(b, { from: [250, 265], to: [350, 265], at: at(agnostic, 'comes') });
      pf.pipe(b, { from: [610, 265], to: [710, 265], at: at(agnostic, 'goes') });
      pf.flow(b, { from: [250, 265], to: [350, 265], at: at(agnostic, 'comes'), until: end(agnostic), look: LOOKS[3] });
      pf.flow(b, { from: [610, 265], to: [710, 265], at: at(agnostic, 'goes'), until: end(agnostic), look: LOOKS[4] });
      arch.tag(b, { x: 200, y: 360, text: 'A photo comes in', at: at(agnostic, 'comes') });
      arch.tag(b, { x: 600, y: 360, text: 'A photo goes out', at: at(agnostic, 'goes') });
      sticker(b, 'Move it anywhere', { x: 360, y: 440, at: at(agnostic, 'anywhere'), variant: 'green', iconName: 'move' });

      const format = 'alone/common_format';
      const c = picture(format);
      const first = standardLine(c, { y: 70, at: begin(format) + 0.1, step: 0.05 });
      arch.tag(c, { x: 24, y: 190, text: 'Every pipe carries: Image (JPEG)', tone: 'cyan', at: at(format, 'pipe') });
      const shuffled = standardLine(c, { y: 290, names: ['Brighten', 'Denoise', 'Watermark', 'Crop', 'Blur faces'], at: at(format, 'any'), step: 0.12 });
      flowAll(c, first, { from: at(format, 'carries'), to: end(format), every: 1.1 });
      flowAll(c, shuffled, { from: at(format, 'any') + 0.6, to: end(format), every: 1.1 });
      arch.tag(c, { x: 24, y: 410, text: 'Any order still connects, port to port', tone: 'green', at: at(format, 'follow') });
      wall.note(c, { x: 640, y: 420, w: 296, text: 'Same format in, same format out', tone: 'cyan', tilt: -1, at: at(format, 'gives') });
      void shuffled;
    }

    function stream() {
      const incremental = 'stream/incremental';
      const predict = 'stream/predict_online';
      const seconds = 'stream/seconds';
      const a = picture(incremental, seconds);
      arch.rule(a, { x: 24, y: 14, w: 600, n: 3, name: 'Incremental', text: 'Pass each item on right away.', at: at(incremental, 'three'), until: begin(predict) + 0.3 });
      const busy = (from) => [{ at: from, state: 'busy', light: 'Busy' }];
      const row = standardLine(a, { y: 190, at: begin(incremental) + 0.2, step: 0.05, specs: NAMES.map(() => ({ states: busy(at(incremental, 'while')) })) });
      [['Photo 5', 0], ['Photo 4', 1], ['Photo 3', 2, 'three2'], ['Photo 2', 3, 'two'], ['Photo 1', 4, 'one']].forEach(([text, i, word]) => {
        arch.tag(a, { x: row.center(i) - 46, y: 296, text, tone: 'gold', at: word ? at(incremental, word) : at(incremental, 'line'), until: begin(predict) + 0.3 });
      });
      flowAll(a, row, { from: at(incremental, 'passes'), to: end(seconds), every: 1.0 });
      arch.readout(a, { x: 676, y: 14, w: 260, label: 'Scoreboard', iconName: 'timer', at: at(predict, 'game'), values: [{ at: -1, text: '2nd quarter · 9:12' }] });
      pf.photo(a, { x: 24, y: 360, w: 180, look: LOOKS[0], caption: 'Touchdown catch', at: at(predict, 'catch') });
      wall.slot(a, { x: 640, y: 350, w: 296, h: 120, text: 'Online when?', at: at(predict, 'predict'), until: begin(seconds) + 0.2 });
      // The catch hops pipe by pipe, half a second in each filter.
      const hop = at(seconds, 'slides');
      row.pipes.forEach(({ from, to }, i) => arch.token(a, { kind: 'photo', size: 30, path: [from, to], at: hop + i * 0.5, duration: 0.3, until: hop + i * 0.5 + 0.35, art: pf.photoToken(LOOKS[i + 1]) }));
      arch.readout(a, { x: 240, y: 380, w: 300, label: 'Shot to website', iconName: 'timer', at: at(seconds, 'second'), values: [{ at: -1, text: '2.5 seconds', state: 'ok' }] });
      pf.gallery(a, { x: 640, y: 350, w: 296, title: 'Website', at: at(seconds, 'lands'), items: [{ at: at(seconds, 'lands') + 0.2, look: LOOKS[5], caption: '2nd quarter' }] });

      const acyclic = 'stream/acyclic';
      const b = picture(acyclic);
      arch.rule(b, { x: 24, y: 18, w: 600, n: 4, name: 'Acyclic', text: 'One way, from source to sink, without loops.', at: at(acyclic, 'four') });
      const row2 = standardLine(b, { y: 210, at: begin(acyclic) + 0.2, step: 0.05 });
      flowAll(b, row2, { from: begin(acyclic) + 0.6, to: end(acyclic), every: 1.1 });
      arch.wire(b, { from: [row2.center(4), 196], to: [row2.center(2), 196], tone: 'red', dashed: true, at: at(acyclic, 'back') });
      arch.cross(b, { x: (row2.center(4) + row2.center(2)) / 2, y: 178, size: 50, at: at(acyclic, 'back') + 0.3 });
      arch.code(b, { x: 24, y: 360, w: 760, at: at(acyclic, 'websites'), lines: [{ code: 'photo = watermark(blur(crop(brighten(denoise(raw)))))' }] });
      arch.tag(b, { x: 24, y: 460, text: 'One-way flow: the output is a composition of filters', tone: 'green', at: at(acyclic, 'reason') });
    }

    function order() {
      const matters = 'order/order_matters';
      const a = picture(matters);
      [['Crop, then Watermark', ['Crop', 'Watermark'], { crop: true, mark: true }, 'crop', 60], ['Watermark, then Crop', ['Watermark', 'Crop'], { crop: true, mark: true, markCut: true }, 'crop2', 260]]
        .forEach(([label, names, look, word, y]) => {
          arch.tag(a, { x: 24, y: y - 40, text: label, at: at(matters, word) });
          pf.line(a, { x0: 40, y, w: 170, gap: 60, names, at: at(matters, word), step: 0.1 });
          pf.pipe(a, { from: [430, y + 42], to: [520, y + 42], at: at(matters, word) + 0.3 });
          pf.photo(a, { x: 540, y: y - 30, w: 190, look, at: at(matters, word) + 0.5 });
        });
      stamp(a, 'Logo cut off', { x: 560, y: 392, at: at(matters, 'logo'), color: 'red', rotate: -5, small: true });
      arch.code(a, {
        x: 24, y: 420, w: 560, at: at(matters, 'add'),
        lines: [{ code: '3 -> add 1 -> double = 8' }, { code: '3 -> double -> add 1 = 7', at: at(matters, 'double2') }],
      });

      const roles = 'order/roles';
      const b = picture(roles);
      wall.badge(b, { x: 70, y: 60, w: 210, role: 'Filter developer', iconName: 'pencil', at: at(roles, 'developer') });
      wall.skill(b, { x: 40, y: 210, w: 270, text: 'Knows only image in, image out', at: at(roles, 'nothing') });
      wall.badge(b, { x: 620, y: 60, w: 210, role: 'Pipeline builder', iconName: 'list', variant: 'po', at: at(roles, 'builder') });
      wall.skill(b, { x: 590, y: 210, w: 270, text: 'Picks the filters and their order', variant: 'po', at: at(roles, 'picks') });
      const names = ['Brighten', 'Crop', 'Straighten', 'Blur faces', 'Watermark'];
      const same = (when) => [{ at: when, state: 'same', light: 'Same' }];
      standardLine(b, {
        y: 330, names, at: begin(roles) + 0.2, step: 0.05,
        specs: names.map((name) => (name === 'Straighten'
          ? { at: at(roles, 'plugs'), how: 'drop', states: [{ at: at(roles, 'plugs'), state: 'new', light: 'New' }] }
          : { states: same(at(roles, 'nobody')) })),
      });
      arch.tag(b, { x: 40, y: 450, text: 'From Denoise …', at: begin(roles) + 0.3 });
    }

    // ----------------------------------------------------------------
    // Consequences
    // ----------------------------------------------------------------

    function buys() {
      const reuse = 'buys/reuse';
      const a = picture(reuse);
      arch.quality(a, { x: 24, y: 14, w: 300, name: 'Reusability', at: at(reuse, 'reuse') });
      arch.rule(a, { x: 350, y: 14, w: 270, n: 1, name: 'Independence', at: at(reuse, 'state') });
      arch.rule(a, { x: 646, y: 14, w: 290, n: 2, name: 'Agnosticism', at: at(reuse, 'neighbors') });
      const row = standardLine(a, { y: 140, at: begin(reuse) + 0.2, step: 0.05 });
      flowAll(a, row, { from: begin(reuse) + 0.5, to: end(reuse), every: 1.2 });
      const robotRow = pf.line(a, { x0: 40, y: 360, w: 170, gap: 60, names: ['Robot camera', 'Denoise', 'Detect obstacles', 'Steer'], at: at(reuse, 'drops'), step: 0.15, specs: [{}, { states: [{ at: at(reuse, 'unchanged'), state: 'same', light: 'Unchanged' }] }] });
      void robotRow;
      arch.tag(a, { x: 40, y: 300, text: 'The robotics club’s line', tone: 'gold', at: at(reuse, 'robotics') });
      sticker(a, 'Does one thing well: travels', { x: 480, y: 470, at: at(reuse, 'travels'), variant: 'green', iconName: 'move' });

      const change = 'buys/change';
      const b = picture(change);
      arch.quality(b, { x: 24, y: 14, w: 300, name: 'Extensibility', at: at(change, 'inserting') });
      arch.quality(b, { x: 350, y: 14, w: 300, name: 'Modifiability', at: at(change, 'replacing') });
      const names = ['Auto-exposure', 'Crop', 'Straighten', 'Blur faces'];
      pf.filter(b, { x: 60, y: 150, w: 180, h: 90, name: 'Brighten', at: begin(change) + 0.1, until: at(change, 'replacing') + 0.4 });
      pf.line(b, {
        x0: 60, y: 150, w: 180, gap: 56, h: 90, names, at: begin(change) + 0.1, step: 0.05,
        specs: [{ at: at(change, 'auto'), how: 'drop', states: [{ at: at(change, 'auto'), state: 'new', light: 'Swapped in' }] }, {}, { states: [{ at: at(change, 'straighten'), state: 'new', light: 'Inserted' }] }, {}],
      });
      arch.readout(b, { x: 24, y: 330, w: 560, label: 'Test: Blur faces alone', iconName: 'check', at: at(change, 'test'), values: [{ at: -1, text: 'In: 3 faces · Out: 3 blurred' }, { at: at(change, 'comes'), text: 'In: 3 faces · Out: 3 blurred · Passed', state: 'ok' }] });
      sticker(b, 'Touches nothing else', { x: 600, y: 340, at: at(change, 'nothing'), variant: 'green', iconName: 'check' });

      const throughput = 'buys/throughput';
      const c = picture(throughput);
      arch.quality(c, { x: 24, y: 14, w: 400, name: 'Performance: throughput', at: at(throughput, 'throughput') });
      NAMES.forEach((name, i) => pf.filter(c, { x: 24 + i * 184, y: 100, w: 170, h: 90, name: `Core ${i + 1}`, ports: false, at: at(throughput, 'cores') + i * 0.1, states: [{ at: at(throughput, 'cores') + i * 0.1, state: 'busy', light: name }] }));
      arch.readout(c, { x: 24, y: 230, w: 440, label: 'Photos per minute', iconName: 'chart', at: at(throughput, 'minute'), values: [{ at: -1, text: 'One program: 30' }, { at: at(throughput, 'minute') + 0.6, text: 'The line: up to 150', state: 'ok' }] });
      arch.tag(c, { x: 500, y: 246, text: 'The slowest filter sets the pace', tone: 'cyan', at: at(throughput, 'slowest') });
      wall.listCard(c, {
        x: 24, y: 330, w: 912, title: 'Each benefit comes from a rule', iconName: 'list', at: at(throughput, 'benefit'),
        items: [{ text: 'Reuse: from Independence and Agnosticism', at: at(throughput, 'benefit') + 0.2 }, { text: 'Easy change: from one common format', at: at(throughput, 'rule') }, { text: 'Throughput: from Incremental processing', at: at(throughput, 'rule') + 0.4 }],
      });
    }

    function costs() {
      const slider = 'costs/slider';
      const a = picture(slider);
      pf.slider(a, { x: 24, y: 30, w: 420, label: 'Brightness', at: at(slider, 'slider'), moves: [{ at: at(slider, 'live'), p: 0.75 }, { at: at(slider, 'drag'), p: 0.5 }] });
      const row = standardLine(a, { y: 250, at: begin(slider) + 0.1, step: 0.05 });
      flowAll(a, row, { from: begin(slider) + 0.4, to: end(slider), every: 1.1 });
      arch.wire(a, { from: [300, 120], to: [row.center(1), 240], tone: 'red', dashed: true, at: at(slider, 'back') });
      arch.cross(a, { x: 300, y: 180, size: 54, at: at(slider, 'pipelines') });
      arch.tag(a, { x: 470, y: 150, text: 'Pipelines run one way', tone: 'red', at: at(slider, 'pipelines') });
      arch.quality(a, { x: 24, y: 400, w: 320, name: 'Interactivity', effect: 'inhibited', at: at(slider, 'interactive') });

      const latency = 'costs/latency';
      const b = picture(latency);
      NAMES.forEach((name, i) => {
        const box = wall.listCard(b, { x: 24 + i * 184, y: 30, w: 172, title: name, at: at(latency, 'each') + i * 0.12, items: [{ text: 'Decode' }, { text: 'Job' }, { text: 'Encode' }] });
        box.classList.add('pf-steps');
      });
      arch.readout(b, { x: 24, y: 270, w: 440, label: 'One photo through the line', iconName: 'timer', at: at(latency, 'five'), values: [{ at: -1, text: '5 decodes, 5 encodes', state: 'warn' }, { at: at(latency, 'longer'), text: 'Slower than one program', state: 'bad' }] });
      pf.photo(b, { x: 520, y: 260, w: 220, look: { crop: true, blocky: true }, caption: 'After 5 encodes', at: at(latency, 'quality') });
      arch.quality(b, { x: 24, y: 400, w: 380, name: 'Performance: latency', effect: 'inhibited', at: at(latency, 'longer') });

      const errors = 'costs/errors';
      const c = picture(errors);
      const row3 = standardLine(c, {
        y: 120, at: begin(errors) + 0.1, step: 0.05,
        specs: [{}, {}, {}, { states: [{ at: at(errors, 'crashes'), state: 'crashed', light: 'Crashed' }] }, {}],
      });
      arch.token(c, { kind: 'photo', size: 30, path: [row3.pipes[2].from, row3.pipes[2].to], at: at(errors, 'corrupted'), duration: 0.6, until: at(errors, 'crashes'), art: (node) => { node.classList.add('pf-token', 'pf-token--garbled'); } });
      [1, 3].forEach((i) => wall.slot(c, { x: (row3.pipes[i].from[0] + row3.pipes[i].to[0]) / 2 - 40, y: 230, w: 80, h: 56, text: '?', at: at(errors, i === 1 ? 'made' : 'stuck') }));
      arch.tag(c, { x: 24, y: 300, text: 'Made it out? Stuck in pipes?', tone: 'red', at: at(errors, 'stuck') });
      pf.gallery(c, { x: 600, y: 300, w: 336, title: 'After a restart', at: at(errors, 'restarting'), items: [{ at: at(errors, 'restarting') + 0.2, look: LOOKS[5], caption: 'Posted' }, { at: at(errors, 'twice'), look: LOOKS[5], caption: 'Twice' }] });
      arch.quality(c, { x: 24, y: 400, w: 340, name: 'Error handling', effect: 'inhibited', at: at(errors, 'error') });
    }

    function limits() {
      const best = 'limits/best_shot';
      const a = picture(best);
      pf.tray(a, { x: 24, y: 30, w: 520, title: 'Best shot of the burst', of: 10, at: at(best, 'best'), counts: Array.from({ length: 10 }, (_, i) => ({ at: at(best, 'hold') + i * 0.3, n: i + 1 })) });
      ['Blur faces', 'Watermark'].forEach((name, i) => pf.filter(a, { x: 600 + i * 0, y: 40 + i * 120, w: 336, h: 90, name, at: at(best, 'downstream') - 0.6, states: [{ at: at(best, 'downstream'), state: 'idle', light: 'Waiting' }] }));
      arch.code(a, { x: 24, y: 330, w: 640, at: at(best, 'sort'), lines: [{ code: 'sort  # reads all input before writing any' }] });
      sticker(a, 'Back to a batch', { x: 700, y: 330, at: at(best, 'idle'), variant: 'red', iconName: 'hourglass' });

      const shared = 'limits/shared_state';
      const b = picture(shared);
      arch.rule(b, { x: 24, y: 18, w: 600, n: 1, name: 'Independence', text: 'No shared state.', at: begin(shared) + 0.1, crackAt: at(shared, 'break') });
      pf.filter(b, { x: 80, y: 200, w: 280, h: 110, name: 'Blur faces', at: begin(shared) + 0.2 });
      arch.tag(b, { x: 100, y: 330, text: 'faces_found', mono: true, at: at(shared, 'list') });
      pf.filter(b, { x: 600, y: 200, w: 280, h: 110, name: 'Caption players', at: at(shared, 'caption'), states: [{ at: at(shared, 'peeks'), state: 'new', light: 'Peeks inside' }] });
      arch.wire(b, { from: [596, 300], to: [262, 344], tone: 'red', dashed: true, at: at(shared, 'peeks') });
      arch.tag(b, { x: 380, y: 400, text: 'Shared state', tone: 'red', at: at(shared, 'peeks') + 0.3 });
      sticker(b, 'Can’t reuse alone', { x: 60, y: 450, at: at(shared, 'reuse'), variant: 'red', iconName: 'cross' });
      sticker(b, 'Can’t reorder', { x: 560, y: 450, at: at(shared, 'reorder'), variant: 'red', iconName: 'cross' });

      const when = 'limits/when';
      const c = picture(when);
      wall.listCard(c, {
        x: 24, y: 30, w: 440, title: 'Good fit', iconName: 'check', tone: 'fix', at: at(when, 'stream'),
        items: [['Photos and video', 'photos'], ['Audio', 'audio'], ['Server logs', 'logs'], ['Sensor data', 'sensor'], ['Lines of text', 'text']].map(([text, word]) => ({ text, at: at(when, word) })),
      });
      wall.listCard(c, {
        x: 496, y: 30, w: 440, title: 'Poor fit', iconName: 'cross', tone: 'trap', at: at(when, 'skip'),
        items: [{ text: 'Interactive editors', at: at(when, 'steer') }, { text: 'Steps sharing lots of data', at: at(when, 'share') }],
      });
      wall.banner(c, { x: 200, y: 430, w: 560, title: 'Choose it for', text: 'Streams of items through independent steps', at: at(when, 'data2') });
    }

    // ----------------------------------------------------------------
    // Summary
    // ----------------------------------------------------------------

    function summary() {
      const problem = 'summary/recap_problem';
      const a = picture(problem);
      pf.bars(a, {
        x: 24, y: 30, w: 440, at: begin(problem) + 0.1,
        rows: ['Denoise', 'Brighten', 'Crop', 'Blur faces', 'Watermark', 'Upload'].map((label) => ({ label, at: -1, duration: 0.1 })),
        clock: [{ at: -1, text: 'Nothing online until midnight' }],
      });
      arch.cross(a, { x: 244, y: 170, size: 80, at: at(problem, 'midnight') });
      const row = standardLine(a, { y: 330, at: at(problem, 'filters'), step: 0.12 });
      flowAll(a, row, { from: at(problem, 'pipes2'), to: end(problem), every: 1.0 });
      pf.gallery(a, { x: 600, y: 30, w: 336, title: 'Website', at: at(problem, 'sink'), items: [{ at: at(problem, 'sink') + 0.2, look: LOOKS[5] }, { at: at(problem, 'sink') + 0.5, look: LOOKS[5] }] });

      const rules = 'summary/recap_rules';
      const b = picture(rules);
      [[1, 'Independence', 'share'], [2, 'Agnosticism', 'neighbors'], [3, 'Incremental', 'item'], [4, 'Acyclic', 'loops']].forEach(([n, name, word], i) => {
        arch.rule(b, { x: 24 + (i % 2) * 468, y: 24 + Math.floor(i / 2) * 90, w: 444, n, name, at: at(rules, word) });
      });
      [['Reusability', 'reuse'], ['Extensibility', 'insertion'], ['Modifiability', 'replacement'], ['Throughput', 'throughput']].forEach(([name, word], i) => {
        arch.quality(b, { x: 24 + (i % 2) * 468, y: 260 + Math.floor(i / 2) * 84, w: 444, name, at: at(rules, word) });
      });
      sticker(b, 'As long as you keep the rules', { x: 300, y: 450, at: at(rules, 'keep'), variant: 'gold', iconName: 'check' });

      const costsCue = 'summary/recap_costs';
      const c = picture(costsCue);
      wall.balance(c, {
        x: 480, y: 120, beam: 560, at: begin(costsCue) + 0.1,
        pans: [
          { w: 270, title: 'Promoted', iconName: 'arrowUp', items: [{ text: 'Reusability' }, { text: 'Extensibility' }, { text: 'Modifiability' }, { text: 'Throughput' }], at: begin(costsCue) + 0.2 },
          { w: 270, title: 'Inhibited', iconName: 'arrowDown', items: [{ text: 'Interactivity', at: at(costsCue, 'live') }, { text: 'Latency', at: at(costsCue, 'overhead') }, { text: 'Error handling', at: at(costsCue, 'error') }], at: begin(costsCue) + 0.3 },
        ],
        tilts: [],
      });
      sticker(c, 'Could each step be its own filter?', { x: 300, y: 20, at: at(costsCue, 'filter2'), variant: 'gold', iconName: 'question' });
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
    summary();
  };
})();

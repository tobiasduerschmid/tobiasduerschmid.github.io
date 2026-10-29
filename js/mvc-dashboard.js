/* The screen-time dashboard of the Model-View-Controller lesson, built with the
   pattern it teaches. A Dataset model holds the minutes; the table, bar chart,
   and pie chart are views that redraw from it; controllers turn a student's
   edits and clicks into requests. Each narration cue moves the dashboard to
   that cue's state; between cues, students can edit it themselves. */
(function () {
  'use strict';
  const SVG = 'http://www.w3.org/2000/svg';
  const MAX_MINUTES = 600;
  const BAR_SCALE = 120;    // the static panel draws one unit per minute up to 120
  const TWEEN_MS = 450;
  const TYPE_MS = 260;      // pause between narrated keystrokes
  const REDRAWN_MS = 1100;  // how long a view shows that it redrew
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let dashboards = 0;

  function el(tag, attributes = {}, ...children) {
    const element = tag.startsWith('svg:')
      ? document.createElementNS(SVG, tag.slice(4)) : document.createElement(tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    element.append(...children);
    return element;
  }

  // Ease numbers from `from` to `to`; with reduced motion, jump straight there.
  function tween(from, to, apply) {
    if (reducedMotion.matches) { apply(to); return; }
    const start = performance.now();
    const frame = now => {
      const t = Math.min(1, (now - start) / TWEEN_MS);
      const eased = 1 - (1 - t) ** 3;
      apply(from.map((value, index) => value + (to[index] - value) * eased));
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  const wait = ms => new Promise(resolve => { setTimeout(resolve, reducedMotion.matches ? 0 : ms); });

  // Model: the minutes per category and the list of dependents.
  class Dataset {
    constructor(minutes) {
      this.minutes = new Map(Object.entries(minutes));
      this.observers = [];
    }
    attach(observer) { this.observers.push(observer); }
    notify() { this.observers.forEach(observer => observer.update()); }
    setMinutes(category, minutes) {
      this.minutes.set(category, minutes);
      this.notify();
    }
    rows() { return [...this.minutes]; }
  }

  // A view redraws from the model and briefly shows that it redrew.
  class View {
    constructor(pane, model) {
      this.pane = pane;
      this.model = model;
      model.attach(this);
    }
    update() {
      this.draw();
      this.showRedrawn();
    }
    showRedrawn() {
      clearTimeout(this.redrawnTimer);
      this.pane.classList.remove('is-redrawn');
      void this.pane.offsetWidth; // restart the animation
      this.pane.classList.add('is-redrawn');
      this.redrawnTimer = setTimeout(() => this.pane.classList.remove('is-redrawn'), REDRAWN_MS);
    }
  }

  class TableView extends View {
    draw() {
      this.model.rows().forEach(([category, minutes]) => {
        const input = this.inputs.get(category);
        if (input.value !== String(minutes)) input.value = String(minutes);
        input.removeAttribute('aria-invalid');
      });
    }
  }

  class BarChartView extends View {
    constructor(pane, model) {
      super(pane, model);
      this.selected = '';
    }
    widths() {
      const rows = this.model.rows();
      const scale = Math.max(BAR_SCALE, ...rows.map(([, minutes]) => minutes));
      return rows.map(([, minutes]) => (minutes * BAR_SCALE) / scale);
    }
    draw() {
      const rects = [...this.bars.values()].map(bar => bar.rect);
      tween(rects.map(rect => Number(rect.getAttribute('width'))), this.widths(),
        widths => widths.forEach((width, index) => rects[index].setAttribute('width', width.toFixed(2))));
      this.model.rows().forEach(([category, minutes]) => {
        const bar = this.bars.get(category);
        // The name starts with the visible label and adds the value the bar shows.
        bar.button.setAttribute('aria-label', `${category}, ${minutes} minutes`);
        bar.button.setAttribute('aria-pressed', String(category === this.selected));
      });
    }
    // A display request: it changes only this view, not the data.
    highlight(category) {
      this.selected = category;
      this.update();
    }
  }

  class PieChartView extends View {
    shares() {
      const rows = this.model.rows();
      const total = rows.reduce((sum, [, minutes]) => sum + minutes, 0);
      return rows.map(([, minutes]) => (total ? (100 * minutes) / total : 0));
    }
    draw() {
      const circles = [...this.slices.values()];
      tween(circles.map(circle => Number(circle.dataset.share)), this.shares(), shares => {
        let start = 0;
        shares.forEach((share, index) => {
          circles[index].dataset.share = String(share);
          circles[index].setAttribute('stroke-dasharray', `${share.toFixed(3)} ${(100 - share).toFixed(3)}`);
          circles[index].setAttribute('stroke-dashoffset', (25 - start).toFixed(3));
          start += share;
        });
      });
      const shares = this.shares();
      this.model.rows().forEach(([category], index) => {
        this.legend.get(category).textContent = `${category} ${Math.round(shares[index])}%`;
      });
    }
  }

  // Controllers turn input into requests: data changes go to the model.
  class TableController {
    constructor(dashboard) { this.dashboard = dashboard; }
    handleEvent(category, input) {
      const minutes = Number(input.value);
      if (input.value === '' || !Number.isInteger(minutes) || minutes < 0 || minutes > MAX_MINUTES) {
        input.setAttribute('aria-invalid', 'true');
        this.dashboard.say(`Enter whole minutes from 0 to ${MAX_MINUTES}.`);
        return;
      }
      input.removeAttribute('aria-invalid');
      this.dashboard.model.setMinutes(category, minutes);
      this.dashboard.say(`${category} is now ${minutes} minutes. The table, bar chart, and pie chart redrew.`);
    }
  }

  // Swapped in to make the table read-only: it ignores every edit.
  class IgnoringController {
    constructor(dashboard) { this.dashboard = dashboard; }
    handleEvent() {
      this.dashboard.table.draw();
      this.dashboard.say('The table is read-only: its controller ignored the edit, so the data did not change.');
    }
  }

  // Clicks are display requests for the bar chart itself.
  class ChartController {
    constructor(dashboard) { this.dashboard = dashboard; }
    handleEvent(category) {
      const { bars, redrawAll } = this.dashboard;
      bars.highlight(category);
      if (redrawAll) {
        this.dashboard.table.showRedrawn();
        this.dashboard.pie.showRedrawn();
        this.dashboard.say(`${category} is highlighted. This first design redraws all three views anyway.`);
      } else {
        this.dashboard.say(`${category} is highlighted. The data did not change, so only the bar chart redrew.`);
      }
    }
  }

  class Dashboard {
    constructor(panel) {
      const cue = JSON.parse(panel.dataset.mvcCue);
      const id = `mvc-dashboard-${++dashboards}`;
      this.cueToken = 0;
      this.redrawAll = false;
      this.model = new Dataset(cue.from || cue.minutes);
      this.render(panel, id);
      this.table = new TableView(this.paneTable, this.model);
      this.bars = new BarChartView(this.paneBars, this.model);
      this.pie = new PieChartView(this.panePie, this.model);
      Object.assign(this.table, { inputs: this.inputs });
      Object.assign(this.bars, { bars: this.barParts });
      Object.assign(this.pie, { slices: this.sliceParts, legend: this.legendParts });
      this.tableController = new TableController(this);
      this.chartController = new ChartController(this);
      [this.table, this.bars, this.pie].forEach(view => view.draw());
      this.applyCue(cue, false);
    }

    // Replace the static picture with the same dashboard as live controls.
    render(panel, id) {
      const categories = Object.keys(JSON.parse(panel.dataset.mvcCue).minutes);
      panel.removeAttribute('role');
      panel.removeAttribute('aria-label');
      panel.classList.add('is-live');
      panel.setAttribute('role', 'group');
      panel.setAttribute('aria-labelledby', `${id}-title`);
      this.inputs = new Map();
      this.barParts = new Map();
      this.sliceParts = new Map();
      this.legendParts = new Map();
      const pane = (name, title) => el('div', { class: 'mvc-pane' },
        el('p', { class: 'mvc-pane-title' }, title, ' ', el('span', { class: 'mvc-redrawn-tag', 'aria-hidden': 'true' }, 'redrawn')));
      this.paneTable = pane('table', 'Table');
      this.paneBars = pane('bars', 'Bar chart');
      this.panePie = pane('pie', 'Pie chart');
      const tbody = el('tbody');
      categories.forEach(category => {
        const input = el('input', { type: 'number', id: `${id}-${category}`, min: '0', max: String(MAX_MINUTES), step: '1', inputmode: 'numeric' });
        input.addEventListener('input', () => this.tableController.handleEvent(category, input));
        this.inputs.set(category, input);
        tbody.append(el('tr', {}, el('th', { scope: 'row' }, el('label', { for: input.id }, category)), el('td', {}, input, ' min')));
      });
      this.paneTable.append(el('table', { class: 'mvc-table' }, el('caption', { class: 'sr-only' }, 'Minutes per category'), tbody));
      const list = el('ul', { class: 'mvc-bars' });
      categories.forEach(category => {
        const rect = el('svg:rect', { class: `mvc-fill--${category.toLowerCase()}`, width: '0', height: '10' });
        const button = el('button', { type: 'button', class: 'mvc-bar-button', 'aria-pressed': 'false' },
          el('span', { class: 'mvc-bar-label' }, category),
          el('svg:svg', { class: 'mvc-bar-track', viewBox: `0 0 ${BAR_SCALE} 10`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' }, rect));
        button.addEventListener('click', () => this.chartController.handleEvent(category));
        this.barParts.set(category, { button, rect });
        list.append(el('li', { class: 'mvc-bar-row' }, button));
      });
      this.paneBars.append(list);
      const pie = el('svg:svg', { class: 'mvc-pie', viewBox: '0 0 42 42', 'aria-hidden': 'true', focusable: 'false' });
      const legend = el('ul', { class: 'mvc-legend' });
      categories.forEach(category => {
        const slice = el('svg:circle', { class: `mvc-slice mvc-stroke--${category.toLowerCase()}`, cx: '21', cy: '21', r: '15.9155', pathLength: '100', 'stroke-dasharray': '0 100', 'stroke-dashoffset': '25' });
        slice.dataset.share = '0';
        pie.append(slice);
        this.sliceParts.set(category, slice);
        const text = el('span');
        legend.append(el('li', {}, el('span', { class: `mvc-swatch mvc-fill--${category.toLowerCase()}` }), text));
        this.legendParts.set(category, text);
      });
      this.readonlyBadge = el('span', { class: 'mvc-badge', hidden: '' }, 'read-only');
      this.panePie.querySelector('.mvc-pane-title').append(' ', this.readonlyBadge);
      this.panePie.append(el('div', { class: 'mvc-pie-layout' }, pie, legend));
      const readOnly = el('input', { type: 'checkbox', id: `${id}-readonly` });
      readOnly.addEventListener('change', () => this.setTableReadOnly(readOnly.checked, true));
      this.readOnlyToggle = readOnly;
      const reset = el('button', { type: 'button', class: 'mvc-dashboard-reset' }, 'Reset to the narration');
      reset.addEventListener('click', () => {
        this.applyCue(this.cue, true);
        this.say('The dashboard is back to the narration.');
      });
      this.inputLine = el('span');
      this.resultLine = el('p', { class: 'mvc-dashboard-result' });
      this.status = el('p', { class: 'mvc-dashboard-status', role: 'status' });
      panel.replaceChildren(
        el('div', { class: 'nja-window-bar', id: `${id}-title` }, 'Screen time · try it: edit the table or click a bar'),
        el('div', { class: 'mvc-dashboard-views' }, this.paneTable, this.paneBars, this.panePie),
        el('div', { class: 'mvc-dashboard-controls' },
          el('label', { for: readOnly.id }, readOnly, ' Make the table read-only (its controller ignores edits)'), reset),
        el('p', { class: 'mvc-dashboard-input' }, el('span', {}, 'Last narrated input'), ' ', this.inputLine),
        this.resultLine, this.status);
    }

    say(message) { this.status.textContent = message; }

    setTableReadOnly(readOnly, announce) {
      this.readOnlyToggle.checked = readOnly;
      this.tableController = readOnly ? new IgnoringController(this) : new TableController(this);
      if (announce) {
        this.say(readOnly ? 'The table now has a controller that ignores edits. Try typing in it.'
          : 'The table has its editing controller again.');
      }
    }

    // Move to a cue's state, typing narrated edits into the table so students
    // see the input arrive before the views follow.
    async applyCue(cue, animate) {
      const token = ++this.cueToken;
      this.cue = cue;
      this.redrawAll = cue.redraw === 'all';
      this.inputLine.textContent = cue.input;
      this.resultLine.textContent = cue.result;
      this.readonlyBadge.hidden = !cue.readonly;
      this.panePie.classList.toggle('is-readonly', Boolean(cue.readonly));
      this.setTableReadOnly(false, false);
      if (cue.from && animate) {
        Object.entries(cue.from).forEach(([category, minutes]) => this.model.minutes.set(category, minutes));
        [this.table, this.bars, this.pie].forEach(view => view.draw());
        await wait(TYPE_MS * 3);
      }
      for (const [category, minutes] of Object.entries(cue.minutes)) {
        if (token !== this.cueToken) return;
        if (this.model.minutes.get(category) === minutes) continue;
        if (animate) await this.typeInto(category, minutes, token);
        if (token !== this.cueToken) return;
        this.model.setMinutes(category, minutes);
      }
      if (token !== this.cueToken) return;
      if (this.bars.selected !== (cue.selected || '')) {
        if (animate) await wait(TYPE_MS);
        if (token !== this.cueToken) return;
        this.bars.highlight(cue.selected || '');
        if (this.redrawAll && cue.selected) { this.table.showRedrawn(); this.pie.showRedrawn(); }
      }
    }

    async typeInto(category, minutes, token) {
      const input = this.inputs.get(category);
      input.classList.add('is-typing');
      input.value = '';
      for (const digit of String(minutes)) {
        await wait(TYPE_MS);
        if (token !== this.cueToken) break;
        input.value += digit;
      }
      await wait(TYPE_MS);
      input.classList.remove('is-typing');
    }
  }

  // Each scene's dashboard stays live; cue changes move it instead of replacing it.
  document.querySelectorAll('.narrated-pattern .nja-stage [data-np-visual] .mvc-dashboard').forEach(panel => {
    const dashboard = new Dashboard(panel);
    panel.closest('[data-np-visual]').addEventListener('narrated-pattern:cue', event => {
      const settled = event.detail.settled.querySelector('.mvc-dashboard');
      if (!settled) return;
      event.preventDefault();
      dashboard.applyCue(JSON.parse(settled.dataset.mvcCue), true);
    });
  });
})();

/**
 * Reusable compiler presentation, independent of the tutorial runtime.
 *
 * CompilerLabView.render(host, CompilerLabCore.compile(config)) renders results.
 * CompilerLabView.mount(host, {title?, prediction?, tokenRules, grammar, source,
 *   startRule?, ast?}) adds editable inputs and explicit Run/Stop/Reset controls.
 * Load compiler-lab-client.js before mounting. No input is persisted.
 *
 * Embed JSON inside [data-compiler-lab] for automatic initialization. Dynamic
 * content owners call destroyWithin(root) before replacement and initFrom(root)
 * afterward. A mounted instance exposes run(), reset(), and destroy().
 */
(function () {
  'use strict';
  if (window.CompilerLabView) return;
  const instances = new Map();
  const selector = '[data-compiler-lab]';
  const diagramNodeLimit = 120;
  const diagrams = new WeakMap();
  let instanceNumber = 0;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function title(text) {
    const paragraph = element('p', 'compiler-lab-panel-title');
    paragraph.append(element('strong', '', text));
    return paragraph;
  }

  function diagnosticText(diagnostic) {
    const stages = { tokenRules: 'Tokenizer rules', lexical: 'Tokenization', grammar: 'Grammar',
      syntax: 'Syntax', ast: 'Grammar structure', limits: 'Example too large', execution: 'Run' };
    const location = diagnostic.line === undefined ? '' : ' at line ' + diagnostic.line
      + (diagnostic.column === undefined ? '' : ', column ' + diagnostic.column);
    let message = diagnostic.message;
    if (diagnostic.stage === 'ast') {
      message = diagnostic.code === 'INVALID_FOLD'
        ? message.replace(' after punctuation is discarded', '')
        : 'A token or grammar rule required by this example was removed or renamed. Restore the original names, or reset the example.';
    }
    return (stages[diagnostic.stage] || diagnostic.stage) + location + ': ' + message;
  }

  function renderDiagnostics(host, diagnostics) {
    if (!diagnostics.length) return;
    const panel = element('div', 'compiler-lab-diagnostics');
    panel.setAttribute('role', 'alert');
    panel.append(title('Check these inputs'));
    const list = element('ul');
    diagnostics.forEach(diagnostic => list.append(element('li', '', diagnosticText(diagnostic))));
    panel.append(list);
    host.append(panel);
  }

  function renderTokens(host, tokens, { primary = false } = {}) {
    const scroll = element('div', 'compiler-lab-table-scroll');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', 'Token stream table');
    const table = element('table', 'compiler-lab-tokens');
    table.append(element('caption', '', tokens.length + (tokens.length === 1 ? ' token' : ' tokens')));
    const head = element('thead');
    const headings = element('tr');
    ['Type', 'Text', 'Line:column'].forEach(label => {
      const cell = element('th', '', label);
      cell.scope = 'col';
      headings.append(cell);
    });
    head.append(headings);
    const body = element('tbody');
    tokens.forEach(token => {
      const row = element('tr');
      [token.type, JSON.stringify(token.value), token.line + ':' + token.column].forEach(value => {
        const cell = element('td');
        cell.append(element('code', '', value));
        row.append(cell);
      });
      body.append(row);
    });
    table.append(head, body);
    scroll.append(table);
    if (primary) {
      host.append(scroll);
    } else {
      const details = element('details', 'compiler-lab-tokens-details');
      details.append(element('summary', '', 'Tokens (' + tokens.length + ')'), scroll);
      host.append(details);
    }
  }

  function isBinaryExpression(node) {
    return node.type === 'BinaryExpression' && node.value !== undefined && node.children.length === 2;
  }

  function nodeKind(node) {
    if (isBinaryExpression(node)) return 'operator';
    const names = { IDENTIFIER: 'identifier', IDENT: 'identifier', LITERAL_NUM: 'number', NUMBER: 'number' };
    return names[node.type] || node.type;
  }

  function childLabel(node, index) {
    return isBinaryExpression(node) ? ['left', 'right'][index] : 'child ' + (index + 1);
  }

  function nodeLabel(node) {
    return nodeKind(node) + (node.value === undefined ? '' : ': ' + JSON.stringify(node.value));
  }

  /** Iteration avoids a second recursion limit in presentation of deep trees. */
  function treeList(root) {
    const list = element('ul', 'compiler-lab-structure');
    const queue = [{ node: root, list, relationship: 'root' }];
    let count = 0;
    while (queue.length) {
      const entry = queue.pop();
      const number = ++count;
      const item = element('li');
      const label = element('span');
      label.append(element('code', '', nodeLabel(entry.node)));
      label.append(document.createTextNode(' (node ' + number + ', ' + entry.relationship + ')'));
      item.append(label);
      entry.list.append(item);
      const children = entry.node.children || [];
      if (children.length) {
        const childList = element('ul');
        item.append(childList);
        for (let index = children.length - 1; index >= 0; index--) {
          queue.push({ node: children[index], list: childList, relationship: childLabel(entry.node, index) + ' of node ' + number });
        }
      }
    }
    return list;
  }

  function svgElement(tag, attributes) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function diagramRecords(root) {
    const records = [];
    let truncated = false;
    function visit(node, depth) {
      const record = { node, depth, children: [], number: records.length + 1 };
      records.push(record);
      for (const child of node.children || []) {
        if (depth >= 5 || records.length >= diagramNodeLimit) { truncated = true; break; }
        record.children.push(visit(child, depth + 1));
      }
      return record;
    }
    visit(root, 0);
    return { records, truncated };
  }

  function recordCard(record) {
    const card = element('div', 'compiler-lab-record');
    const fields = element('dl', 'compiler-lab-record-fields');
    const kind = element('dd');
    kind.textContent = nodeKind(record.node);
    fields.append(element('dt', '', 'kind'), kind);
    if (record.node.value !== undefined) {
      const value = element('dd', 'compiler-lab-record-value');
      value.append(element('code', '', String(record.node.value)));
      fields.append(element('dt', '', 'value'), value);
    }
    card.append(fields);
    const slots = element('div', 'compiler-lab-record-children');
    record.ports = record.children.map((child, index) => {
      const label = childLabel(record.node, index);
      const port = element('span', 'compiler-lab-child-port', label);
      slots.append(port);
      return port;
    });
    if (record.children.length) card.append(slots);
    if (record.children.length < (record.node.children || []).length) {
      card.append(element('p', 'compiler-lab-hint', 'More children in the outline.'));
    }
    record.card = card;
    return card;
  }

  function layoutDiagram(scene) {
    const diagram = diagrams.get(scene);
    if (!diagram || !scene.isConnected) return;
    const { records, svg } = diagram;
    const fontSize = parseFloat(getComputedStyle(scene).fontSize);
    const siblingGap = fontSize;
    const levelGap = fontSize * 1.5;
    const padding = fontSize;
    const levelHeights = [];
    records.forEach(record => {
      record.width = record.card.offsetWidth;
      record.height = record.card.offsetHeight;
      levelHeights[record.depth] = Math.max(levelHeights[record.depth] || 0, record.height);
    });
    const levelTops = [padding];
    levelHeights.forEach((height, index) => { levelTops[index + 1] = levelTops[index] + height + levelGap; });
    for (const record of [...records].reverse()) {
      record.childrenWidth = record.children.reduce((width, child) => width + child.subtreeWidth, 0)
        + Math.max(0, record.children.length - 1) * siblingGap;
      record.subtreeWidth = Math.max(record.width, record.childrenWidth);
    }
    const width = Math.max(records[0].subtreeWidth + padding * 2, scene.parentElement.clientWidth);
    records[0].subtreeLeft = (width - records[0].subtreeWidth) / 2;
    records.forEach(record => {
      record.x = record.subtreeLeft + (record.subtreeWidth - record.width) / 2;
      record.y = levelTops[record.depth];
      record.card.style.left = record.x + 'px';
      record.card.style.top = record.y + 'px';
      let childLeft = record.subtreeLeft + (record.subtreeWidth - record.childrenWidth) / 2;
      record.children.forEach(child => { child.subtreeLeft = childLeft; childLeft += child.subtreeWidth + siblingGap; });
    });
    const height = levelTops[levelHeights.length - 1] + levelHeights.at(-1) + padding;
    scene.style.width = width + 'px';
    scene.style.height = height + 'px';
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    drawConnections(diagram);
  }

  function drawConnections({ records, svg, markerId }) {
    const defs = svgElement('defs', {});
    const marker = svgElement('marker', { id: markerId, viewBox: '0 0 10 10', refX: 9, refY: 5,
      markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    marker.append(svgElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'compiler-lab-arrowhead' }));
    defs.append(marker);
    svg.replaceChildren(defs);
    // SVG and HTML share one coordinate space, even under zoom or CSS transforms.
    const screenMatrix = svg.getScreenCTM();
    if (!screenMatrix) return;
    const toDiagram = screenMatrix.inverse();
    records.forEach(record => record.children.forEach((child, index) => {
      const port = record.ports[index].getBoundingClientRect();
      const target = child.card.getBoundingClientRect();
      const start = new DOMPoint(port.left + port.width / 2, port.bottom).matrixTransform(toDiagram);
      const end = new DOMPoint(target.left + target.width / 2, target.top - 3).matrixTransform(toDiagram);
      const { x: startX, y: startY } = start;
      const { x: endX, y: endY } = end;
      const bendY = startY + (endY - startY) / 2;
      svg.append(svgElement('path', { d: `M ${startX} ${startY} C ${startX} ${bendY}, ${endX} ${bendY}, ${endX} ${endY}`,
        class: 'compiler-lab-tree-edge', 'marker-end': 'url(#' + markerId + ')' }));
    }));
  }

  function createDiagram(tree, label) {
    const preview = diagramRecords(tree);
    const scroll = element('div', 'compiler-lab-tree-scroll');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', label + ' diagram. Scroll to explore; a complete text outline follows.');
    const scene = element('div', 'compiler-lab-tree-scene');
    scene.setAttribute('aria-hidden', 'true');
    const svg = svgElement('svg', { class: 'compiler-lab-tree-edges', 'aria-hidden': 'true' });
    scene.append(svg, ...preview.records.map(recordCard));
    scroll.append(scene);
    diagrams.set(scene, { ...preview, svg, markerId: 'compiler-arrow-' + (++instanceNumber) });
    return { scroll, scene, truncated: preview.truncated };
  }

  function renderTree(host, tree, label) {
    host.replaceChildren();
    if (!tree) {
      host.append(element('p', '', 'No ' + label.toLowerCase() + ' was produced.'));
      return;
    }
    const figure = element('figure', 'compiler-lab-tree-figure');
    figure.setAttribute('aria-label', 'Tree visualization');
    const visual = createDiagram(tree, label);
    figure.append(visual.scroll);
    if (visual.truncated) figure.append(element('p', '', 'The diagram previews up to '
      + diagramNodeLimit + ' nodes and six levels. The outline below includes every node.'));
    const details = element('details', 'compiler-lab-tree-text');
    details.setAttribute('aria-label', 'Syntax tree outline');
    details.append(element('summary', '', 'Tree outline'));
    details.append(treeList(tree));
    host.append(figure, details);
    layoutDiagram(visual.scene);
    if (document.fonts) document.fonts.ready.then(() => layoutDiagram(visual.scene));
  }

  function renderTreePicker(host, result) {
    const trees = result.asts || (result.ast ? [result.ast] : []);
    if (!trees.length) return;
    const treeHost = element('div');
    const status = element('p', 'compiler-lab-selection-status');
    status.setAttribute('role', 'status');
    const grouping = element('p', 'compiler-lab-grouping');
    const navigation = element('div', 'compiler-lab-tree-navigation');
    let selected = 0;
    let alternative;
    const updateTree = () => {
      renderTree(treeHost, trees[selected], 'Syntax tree');
      const shape = expressionGrouping(trees[selected]);
      grouping.replaceChildren();
      grouping.hidden = shape === null;
      if (shape !== null) grouping.append(document.createTextNode('Grouping: '), element('code', '', shape));
      status.textContent = 'Syntax tree ' + (selected + 1) + ' of ' + trees.length
        + (result.incomplete ? ' found so far; additional trees may exist.' : '.');
      if (alternative) alternative.value = String(selected);
    };
    if (trees.length > 1) {
      const picker = element('label', 'compiler-lab-tree-picker', 'Syntax tree ');
      alternative = element('select');
      alternative.setAttribute('aria-label', 'Syntax tree');
      trees.forEach((tree, index) => {
        const option = element('option', '', (index + 1) + ' of ' + trees.length);
        option.value = String(index);
        alternative.append(option);
      });
      alternative.addEventListener('change', () => { selected = Number(alternative.value); updateTree(); });
      picker.append(alternative);
      const controls = element('div', 'compiler-lab-toolbar');
      [['Previous tree', -1], ['Next tree', 1]].forEach(([label, offset]) => {
        const button = element('button', '', label);
        button.type = 'button';
        button.addEventListener('click', () => {
          selected = (selected + offset + trees.length) % trees.length;
          updateTree();
        });
        controls.append(button);
      });
      navigation.append(picker, controls);
    } else {
      navigation.append(title('Syntax tree'));
    }
    host.append(navigation, status, grouping, treeHost);
    updateTree();
  }

  function expressionGrouping(node) {
    const children = node.children || [];
    if (!children.length && node.value !== undefined) return String(node.value);
    if (!isBinaryExpression(node)) return null;
    const left = expressionGrouping(children[0]);
    const right = expressionGrouping(children[1]);
    return left === null || right === null ? null : '(' + left + ' ' + node.value + ' ' + right + ')';
  }

  /** Replace host contents with a token table, diagnostics, and tree selector. */
  function render(host, result, { focus = 'tree' } = {}) {
    host.classList.add('compiler-lab', 'compiler-lab-result');
    host.replaceChildren();
    renderDiagnostics(host, result.diagnostics || []);
    if (focus !== 'tokens') renderTreePicker(host, result);
    renderTokens(host, result.tokens || [], { primary: focus === 'tokens' });
    if (focus === 'tokens' && result.ok) {
      const count = (result.tokens || []).length;
      const status = element('p', 'compiler-lab-selection-status', count + (count === 1 ? ' token recognized.' : ' tokens recognized.'));
      status.setAttribute('role', 'status');
      host.append(status);
    }
  }

  /** Keep the previous result available for comparison, with one edit notice. */
  function markStale(host) {
    if (!host || !host.children.length || host.querySelector('.compiler-lab-stale')) return;
    const notice = element('p', 'compiler-lab-stale', 'Inputs changed. Run to update these results.');
    notice.setAttribute('role', 'status');
    host.prepend(notice);
  }

  function addEditor(host, { id, label, value, rows }) {
    const field = element('div', 'compiler-lab-field');
    const labelNode = element('label', '', label);
    labelNode.htmlFor = id;
    const textarea = element('textarea');
    textarea.id = id;
    textarea.rows = rows;
    textarea.value = value;
    textarea.spellcheck = false;
    textarea.autocomplete = 'off';
    textarea.autocapitalize = 'off';
    field.append(labelNode, textarea);
    host.append(field);
    return textarea;
  }

  function inputControl(label, value, type = 'text') {
    const input = element('input');
    input.type = type;
    input.setAttribute('aria-label', label);
    input.autocomplete = 'off';
    input.spellcheck = false;
    if (type === 'checkbox') input.checked = Boolean(value);
    else input.value = value === undefined ? '' : value;
    return input;
  }

  function tableWithHeaders(caption, headings) {
    const table = element('table', 'compiler-lab-rules-table');
    table.append(element('caption', '', caption));
    const head = element('thead');
    const row = element('tr');
    headings.forEach(heading => {
      const cell = element('th', '', heading);
      cell.scope = 'col';
      row.append(cell);
    });
    head.append(row);
    table.append(head);
    const body = element('tbody');
    table.append(body);
    return { table, body };
  }

  function appendCell(row, control) {
    const cell = element('td');
    cell.append(control);
    row.append(cell);
  }

  /** Native dragging is an optional pointer alternative to the row move buttons. */
  function enableRuleDragging(host, signal, onMove) {
    let draggedRow = null;
    let dropRow = null;
    let dropAfter = false;

    function clearTarget() {
      dropRow?.classList.remove('compiler-lab-drop-before', 'compiler-lab-drop-after');
      dropRow = null;
    }

    function cancel() {
      draggedRow?.classList.remove('compiler-lab-dragging');
      draggedRow = null;
      clearTarget();
    }

    host.addEventListener('dragstart', event => {
      const handle = event.target.closest('[data-rule-drag]');
      if (!handle || !host.contains(handle)) return;
      draggedRow = handle.closest('tr');
      event.dataTransfer.effectAllowed = 'move';
      // A private type prevents an aborted row drag from pasting its label
      // into a grammar/source editor or another application's text field.
      event.dataTransfer.setData('application/x-sebook-token-rule', draggedRow.dataset.ruleIndex);
      event.dataTransfer.setDragImage(draggedRow, 20, draggedRow.offsetHeight / 2);
      draggedRow.classList.add('compiler-lab-dragging');
    }, { signal });

    host.addEventListener('dragover', event => {
      if (!draggedRow) return;
      const row = event.target.closest('tr[data-rule-index]');
      clearTarget();
      if (!row || row.parentElement !== draggedRow.parentElement) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      dropRow = row;
      const bounds = row.getBoundingClientRect();
      dropAfter = event.clientY >= bounds.top + bounds.height / 2;
      row.classList.add(dropAfter ? 'compiler-lab-drop-after' : 'compiler-lab-drop-before');
    }, { signal });

    host.addEventListener('dragleave', event => {
      if (!host.contains(event.relatedTarget)) clearTarget();
    }, { signal });
    host.addEventListener('drop', event => {
      if (!draggedRow || !dropRow) return;
      event.preventDefault();
      const from = Number(draggedRow.dataset.ruleIndex);
      const boundary = Number(dropRow.dataset.ruleIndex) + (dropAfter ? 1 : 0);
      const to = boundary > from ? boundary - 1 : boundary;
      cancel();
      if (from !== to) onMove(from, to);
    }, { signal });
    host.addEventListener('dragend', cancel, { signal });
    signal.addEventListener('abort', cancel, { once: true });
    return { cancel };
  }

  /** Edit token rules while preserving the embedding's hidden parser settings. */
  function createRulesEditor(host, initialSettings, { onChange = () => {} } = {}) {
    const listeners = new AbortController();
    let settings;
    let tokens = [];
    host.classList.add('compiler-lab', 'compiler-lab-rules-editor');
    const getValue = () => ({ ...settings,
      tokenRules: tokens.map(row => ({ name: row.name.value, pattern: row.pattern.value, skip: row.skip.checked })),
    });
    const reportChange = () => onChange(getValue());
    const content = element('div');
    const status = element('p', 'compiler-lab-selection-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-atomic', 'true');
    host.replaceChildren(content, status);
    const dragging = enableRuleDragging(host, listeners.signal, moveRule);

    function moveRule(from, to) {
      const value = getValue();
      const [rule] = value.tokenRules.splice(from, 1);
      value.tokenRules.splice(to, 0, rule);
      setValue(value);
      tokens[to].name.focus();
      status.textContent = (rule.name || 'Token rule') + ' moved to position ' + (to + 1) + ' of ' + tokens.length + '.';
      reportChange();
    }

    function action(label, operation, index, disabled = false) {
      const visibleLabel = operation === 'up' ? '↑' : operation === 'down' ? '↓' : label;
      const button = element('button', '', visibleLabel);
      button.type = 'button';
      button.dataset.rulesAction = operation;
      if (index !== undefined) {
        button.dataset.row = String(index);
        button.setAttribute('aria-label', label + ' token rule ' + (index + 1));
        button.title = label + ' token rule ' + (index + 1);
      }
      button.disabled = disabled;
      return button;
    }

    function setValue(value) {
      dragging.cancel();
      settings = value || {};
      content.replaceChildren();
      status.textContent = '';
      content.append(element('p', 'compiler-lab-hint', 'Use raw regex without / delimiters. Earlier rows win equal-length matches; Skip consumes a match without emitting a token. Drag a handle or use the arrow buttons to reorder.'));
      const { table, body } = tableWithHeaders('Tokenizer rules', ['Move', 'Token name', 'Regular expression', 'Skip', 'Order']);
      tokens = (settings.tokenRules || []).map((rule, index, rules) => {
        const row = element('tr');
        row.dataset.ruleIndex = String(index);
        const handle = element('span', 'compiler-lab-drag-handle', '⠿');
        handle.draggable = true;
        handle.dataset.ruleDrag = '';
        handle.dataset.noTooltip = 'true';
        handle.title = 'Drag token rule ' + (index + 1) + ' to reorder';
        // The adjacent native move buttons expose the same action to keyboards,
        // assistive technology, and touch browsers without native dragging.
        handle.setAttribute('aria-hidden', 'true');
        appendCell(row, handle);
        const controls = { name: inputControl('Token name ' + (index + 1), rule.name),
          pattern: inputControl('Regular expression ' + (index + 1), rule.pattern),
          skip: inputControl('Skip token ' + (index + 1), rule.skip, 'checkbox') };
        Object.values(controls).forEach(control => appendCell(row, control));
        const actions = element('div', 'compiler-lab-row-actions');
        actions.append(action('Move up', 'up', index, index === 0), action('Move down', 'down', index, index === rules.length - 1), action('Remove', 'remove', index));
        appendCell(row, actions);
        body.append(row);
        return controls;
      });
      const scroll = element('div', 'compiler-lab-table-scroll');
      scroll.tabIndex = 0;
      scroll.setAttribute('role', 'region');
      scroll.setAttribute('aria-label', 'Tokenizer rules table');
      scroll.append(table);
      content.append(scroll, action('Add token rule', 'add'));
    }

    host.addEventListener('input', reportChange, { signal: listeners.signal });
    host.addEventListener('click', event => {
      const button = event.target.closest('button[data-rules-action]');
      if (!button || !host.contains(button)) return;
      const value = getValue();
      const index = Number(button.dataset.row);
      const operation = button.dataset.rulesAction;
      if (operation === 'up' || operation === 'down') {
        moveRule(index, index + (operation === 'up' ? -1 : 1));
        return;
      }
      if (operation === 'add') value.tokenRules.push({ name: '', pattern: '', skip: false });
      if (operation === 'remove') value.tokenRules.splice(index, 1);
      setValue(value);
      const focusedRow = operation === 'add' ? tokens.length - 1 : Math.min(index, tokens.length - 1);
      const target = tokens[focusedRow]?.name || host.querySelector('[data-rules-action="add"]');
      target.focus();
      reportChange();
    }, { signal: listeners.signal });
    setValue(initialSettings);
    return { getValue, setValue, destroy: () => listeners.abort() };
  }

  function addPrintSource(host, config) {
    host.replaceChildren();
    const { table, body } = tableWithHeaders('Tokenizer rules', ['Token name', 'Regular expression', 'Skip']);
    (config.tokenRules || []).forEach(rule => {
      const row = element('tr');
      [rule.name, rule.pattern, rule.skip ? 'Yes' : 'No'].forEach(value => appendCell(row, element('code', '', value)));
      body.append(row);
    });
    host.append(table);
    [['Grammar (EBNF)', config.grammar],
      ['Source program', config.source]].forEach(([label, value]) => {
      host.append(title(label));
      const pre = element('pre');
      pre.append(element('code', '', value));
      host.append(pre);
    });
  }

  class Lab {
    constructor(host, config) {
      this.host = host;
      this.config = config;
      this.id = 'compiler-lab-' + (++instanceNumber);
      this.client = new window.CompilerLabClient();
      this.listeners = new AbortController();
      this.revision = 0;
      this.destroyed = false;
      this.build();
    }

    build() {
      this.host.replaceChildren();
      this.host.classList.add('compiler-lab');
      this.host.setAttribute('role', 'region');
      this.host.setAttribute('aria-label', 'Compiler lab: ' + (this.config.title || 'Explore syntax trees'));
      this.host.append(title(this.config.title || 'Compiler lab'));
      if (this.config.prediction) this.host.append(element('p', '', this.config.prediction));
      this.editors = element('div', 'compiler-lab-editors');
      this.buildEditors();
      this.workbench = element('div', 'compiler-lab-workbench');
      this.inputPanel = element('div', 'compiler-lab-input-panel');
      this.inputPanel.append(this.editors);
      this.workbench.append(this.inputPanel);
      this.host.append(this.workbench);
      this.buildControls();
      this.status = element('p', 'compiler-lab-status', 'Run to inspect the result.');
      this.status.setAttribute('role', 'status');
      this.status.setAttribute('aria-atomic', 'true');
      this.result = element('div', 'compiler-lab-results');
      this.printSource = element('div', 'compiler-lab-print-source');
      addPrintSource(this.printSource, this.config);
      this.inputPanel.append(this.status);
      this.workbench.append(this.result);
      this.host.append(this.printSource);
      this.editors.addEventListener('input', () => this.invalidate(), { signal: this.listeners.signal });
    }

    buildEditors() {
      this.rulesDisclosure = element('details', 'compiler-lab-rules-disclosure');
      this.rulesDisclosure.open = this.config.showRules === true;
      this.rulesDisclosure.append(element('summary', '', 'Tokenizer rules'));
      const rulesHost = element('div');
      this.rulesDisclosure.append(rulesHost);
      this.rulesEditor = createRulesEditor(rulesHost, this.config, { onChange: () => this.invalidate() });
      this.host.append(this.rulesDisclosure);
      this.grammar = addEditor(this.editors, { id: this.id + '-grammar', rows: 7,
        label: 'Grammar (EBNF)', value: this.config.grammar });
      this.source = addEditor(this.editors, { id: this.id + '-source', rows: 2,
        label: 'Source program', value: this.config.source });
    }

    buildControls() {
      const toolbar = element('div', 'compiler-lab-toolbar');
      this.runButton = element('button', 'compiler-lab-run-primary', 'Run');
      this.stopButton = element('button', '', 'Stop');
      const resetButton = element('button', '', 'Reset');
      this.stopButton.disabled = true;
      this.stopButton.hidden = true;
      [[this.runButton, () => { void this.run(); }], [this.stopButton, () => this.stop()],
        [resetButton, () => this.reset()]].forEach(([button, handler]) => {
        button.type = 'button';
        button.addEventListener('click', handler, { signal: this.listeners.signal });
        toolbar.append(button);
      });
      this.inputPanel.append(toolbar);
    }

    setRunning(running) {
      const restoreRunFocus = !running && document.activeElement === this.stopButton;
      this.runButton.disabled = running;
      this.stopButton.disabled = !running;
      this.stopButton.hidden = !running;
      this.result.setAttribute('aria-busy', String(running));
      if (restoreRunFocus) this.runButton.focus();
    }

    invalidate() {
      ++this.revision;
      this.client.cancel();
      this.setRunning(false);
      this.result.replaceChildren();
      this.status.textContent = 'Inputs changed. Select Run to generate new results.';
      addPrintSource(this.printSource, this.readConfig());
    }

    readConfig() {
      return { ...this.rulesEditor.getValue(), grammar: this.grammar.value, source: this.source.value };
    }

    async run() {
      const revision = ++this.revision;
      this.client.cancel();
      this.setRunning(false);
      const config = this.readConfig();
      this.result.replaceChildren();
      this.setRunning(true);
      this.status.textContent = 'Tokenizing and parsing…';
      addPrintSource(this.printSource, config);
      const result = await this.client.run(config);
      if (this.destroyed || revision !== this.revision) return;
      this.setRunning(false);
      render(this.result, result, { focus: this.config.focus });
      if (result.diagnostics.some(item => ['tokenRules', 'ast'].includes(item.stage))) this.rulesDisclosure.open = true;
      const treeCount = (result.asts || [result.ast]).length;
      this.status.textContent = result.ok
        ? this.config.focus === 'tokens' ? result.tokens.length + ' tokens recognized.'
          : treeCount + (treeCount === 1 ? ' syntax tree generated.' : ' possible syntax trees generated.')
        : 'Review the highlighted error, then run again.';
      return result;
    }

    stop() {
      ++this.revision;
      this.client.cancel();
      this.setRunning(false);
      this.status.textContent = 'Run stopped. Edit the inputs or select Run to try again.';
    }

    reset() {
      this.stop();
      this.rulesEditor.setValue(this.config);
      this.grammar.value = this.config.grammar;
      this.source.value = this.config.source;
      this.result.replaceChildren();
      addPrintSource(this.printSource, this.config);
      this.status.textContent = 'Original example restored. Select Run when you are ready.';
    }

    destroy() {
      this.destroyed = true;
      ++this.revision;
      this.client.destroy();
      this.rulesEditor.destroy();
      this.listeners.abort();
      instances.delete(this.host);
    }
  }

  function mount(host, config) {
    if (instances.has(host)) instances.get(host).destroy();
    const lab = new Lab(host, config);
    instances.set(host, lab);
    return lab;
  }

  function initFrom(root = document) {
    const hosts = [...root.querySelectorAll(selector)];
    if (root.matches && root.matches(selector)) hosts.unshift(root);
    hosts.forEach(host => {
      if (instances.has(host)) return;
      const script = host.querySelector('script[type="application/json"]');
      if (!script) return;
      try { mount(host, JSON.parse(script.textContent)); }
      catch (error) {
        const message = element('p', 'compiler-lab-diagnostics', 'Compiler lab could not load: ' + error.message);
        message.setAttribute('role', 'alert');
        host.append(message);
      }
    });
  }

  function destroyWithin(root) {
    instances.forEach((lab, host) => { if (root === host || root.contains(host)) lab.destroy(); });
  }

  window.CompilerLabView = { render, markStale, mount, initFrom, destroyWithin, createRulesEditor };
  window.addEventListener('resize', () => document.querySelectorAll('.compiler-lab-tree-scene').forEach(layoutDiagram));
  const openedForPrint = new Set();
  window.addEventListener('beforeprint', () => document.querySelectorAll('.compiler-lab-tree-text:not([open]), .compiler-lab-tokens-details:not([open])').forEach(details => {
    openedForPrint.add(details);
    details.open = true;
  }));
  window.addEventListener('afterprint', () => {
    openedForPrint.forEach(details => { details.open = false; });
    openedForPrint.clear();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initFrom(), { once: true });
  else initFrom();
})();

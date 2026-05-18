(function () {
  'use strict';

  var TURN_METHOD_ALIASES = [
    'takeTurn',
    'doTurn',
    'playTurn',
    'performTurn',
    'executeTurn',
    'processTurn',
    'handleTurn',
    'runTurn',
    'makeMove',
    'takeAction',
    'performAction'
  ];

  var STATE_CHANGE_METHOD_ALIASES = [
    'setState',
    'changeState',
    'stateChange',
    'switchState',
    'updateState',
    'transitionState',
    'transitionToState'
  ];

  var UML_TYPE_LABELS = {
    class: 'Class Diagram',
    sequence: 'Sequence Diagram',
    state: 'State Diagram',
    component: 'Component Diagram',
    deployment: 'Deployment Diagram',
    usecase: 'Use Case Diagram',
    activity: 'Activity Diagram'
  };

  var UML_RENDERER_GLOBALS = {
    class: 'UMLClassDiagram',
    sequence: 'UMLSequenceDiagram',
    state: 'UMLStateDiagram',
    component: 'UMLComponentDiagram',
    deployment: 'UMLDeploymentDiagram',
    usecase: 'UMLUseCaseDiagram',
    activity: 'UMLActivityDiagram'
  };

  var UML_CONTAINER_CLASSES = {
    class: 'uml-class-diagram-container',
    sequence: 'uml-sequence-diagram-container',
    state: 'uml-state-diagram-container',
    component: 'uml-component-diagram-container',
    deployment: 'uml-deployment-diagram-container',
    usecase: 'uml-usecase-diagram-container',
    activity: 'uml-activity-diagram-container'
  };

  function UMLTutorialEditor(root, options) {
    this.root = typeof root === 'string' ? document.querySelector(root) : root;
    this.options = options || {};
    this.steps = this.options.steps || [];
    this.currentStep = 0;
    this.config = { backend: 'uml-editor' };
    this.requireTests = !!this.options.requireTests;
    this.instructorMode = !!this.options.instructorMode;
    this.tutorialId = this.options.tutorialId || 'default';
    this._stepsPassed = new Set();
    this._stepsUnlocked = new Set([0]);
    this.sourceEl = null;
    this.typeEl = null;
    this.instructionsEl = null;
    this.contentWrapEl = null;
    this.navEl = null;
    this.controlsEl = null;
    this.resultsEl = null;
    this.stepContentEl = null;
    this._testResults = [];
    this._testHintRecords = [];
    this._testAnnouncer = null;
    this._clearDialog = null;
    this._clearDialogPreviousFocus = null;

    // See tutorial-code.js for the matching state — cooldown gates the visible
    // "Test My Work" button after every run, with an "I'm sure" silent fallback
    // that still unlocks Next on a passing run.
    this._testCooldownSeconds = this.options.cooldownSeconds || 0;
    this._testCooldownStorageKey = this._testCooldownSeconds > 0
      ? 'tutorial-cooldown-' + this.tutorialId : null;
    this._testCooldownTimer = null;
    this._silentTestRun = false;
  }

  UMLTutorialEditor.prototype.start = function () {
    if (!this.root) return;
    this.sourceEl = this.root.querySelector('#uml-pg-input');
    this.typeEl = this.root.querySelector('#uml-pg-type');
    this.instructionsEl = this.root.querySelector('.tvm-step-content');
    this.stepContentEl = this.instructionsEl;
    this.contentWrapEl = this.root.querySelector('.tvm-step-content-wrap');
    this.navEl = this.root.querySelector('.tvm-step-nav');
    this.controlsEl = this.root.querySelector('.tvm-step-controls');
    this.bind();
    this.initSplitters();
    this.loadStep(0);
  };

  UMLTutorialEditor.prototype.bind = function () {
    var self = this;
    var resetBtn = document.getElementById('resetStepBtn');
    if (resetBtn) {
      resetBtn.style.display = 'flex';
      resetBtn.addEventListener('click', function (event) {
        event.preventDefault();
        if (!window.confirm('Reset the current diagram? This will discard your edits for this diagram type.')) return;
        self.resetCurrentDiagram();
      });
    }
    var popoutBtn = this.root.querySelector('.tvm-instructions-popout-btn');
    if (popoutBtn) {
      popoutBtn.hidden = true;
    }
  };

  UMLTutorialEditor.prototype._stepHasTests = function (step) {
    return !!(step && step.tests && step.tests.length);
  };

  UMLTutorialEditor.prototype.initSplitters = function () {
    var splitter = this.root.querySelector('.tvm-hsplitter');
    var instructions = this.root.querySelector('.tvm-instructions-panel');
    var workspace = this.root.querySelector('.tvm-workspace');
    this.makeDraggable(splitter, 'vertical', instructions, workspace);
  };

  UMLTutorialEditor.prototype.makeDraggable = function (splitter, direction, beforeEl, afterEl) {
    if (!splitter || !beforeEl || !afterEl) return;
    var startPos = 0;
    var startSizeBefore = 0;
    var pointerId = null;

    splitter.setAttribute('role', 'separator');
    splitter.setAttribute('tabindex', '0');
    splitter.setAttribute('aria-orientation', direction === 'vertical' ? 'vertical' : 'horizontal');
    splitter.setAttribute('aria-valuemin', '0');
    splitter.setAttribute('aria-valuemax', '100');
    splitter.setAttribute('aria-label', direction === 'vertical'
      ? 'Resize tutorial panels'
      : 'Resize tutorial sections');

    function updateSeparatorValue() {
      var parentRect = beforeEl.parentElement.getBoundingClientRect();
      var beforeRect = beforeEl.getBoundingClientRect();
      var total = direction === 'vertical' ? parentRect.width : parentRect.height;
      var current = direction === 'vertical' ? beforeRect.width : beforeRect.height;
      if (total > 0) {
        splitter.setAttribute('aria-valuenow', String(Math.round((current / total) * 100)));
      }
    }

    function applySize(size) {
      var parent = beforeEl.parentElement;
      if (!parent) return;
      var parentRect = parent.getBoundingClientRect();
      var otherSpace = 0;
      Array.prototype.forEach.call(parent.children, function (child) {
        if (child !== beforeEl && child !== afterEl &&
            window.getComputedStyle(child).display !== 'none' &&
            window.getComputedStyle(child).position !== 'absolute') {
          otherSpace += direction === 'vertical' ? child.offsetWidth : child.offsetHeight;
        }
      });
      var totalAvailable = (direction === 'vertical' ? parentRect.width : parentRect.height) - otherSpace;
      var minSize = 220;
      var minAfter = 360;
      var maxSize = Math.max(minSize, totalAvailable - minAfter);
      var clamped = Math.min(maxSize, Math.max(minSize, size));
      beforeEl.style.flex = '0 0 ' + clamped + 'px';
      afterEl.style.flex = '1 1 0';
      updateSeparatorValue();
    }

    function beginDrag(event) {
      if (event.button != null && event.button !== 0) return;
      event.preventDefault();
      pointerId = event.pointerId;
      startPos = direction === 'vertical' ? event.clientX : event.clientY;
      startSizeBefore = direction === 'vertical'
        ? beforeEl.getBoundingClientRect().width
        : beforeEl.getBoundingClientRect().height;
      splitter.classList.add('active');
      document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      if (splitter.setPointerCapture && pointerId != null) {
        try { splitter.setPointerCapture(pointerId); } catch (e) {}
      }
    }

    function continueDrag(event) {
      if (pointerId == null || (event.pointerId != null && event.pointerId !== pointerId)) return;
      var current = direction === 'vertical' ? event.clientX : event.clientY;
      applySize(startSizeBefore + (current - startPos));
    }

    function endDrag(event) {
      if (pointerId == null || (event && event.pointerId != null && event.pointerId !== pointerId)) return;
      if (splitter.releasePointerCapture && pointerId != null) {
        try { splitter.releasePointerCapture(pointerId); } catch (e) {}
      }
      pointerId = null;
      splitter.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    updateSeparatorValue();
    splitter.addEventListener('pointerdown', beginDrag);
    splitter.addEventListener('pointermove', continueDrag);
    splitter.addEventListener('pointerup', endDrag);
    splitter.addEventListener('pointercancel', endDrag);
    splitter.addEventListener('keydown', function (event) {
      var beforeRect = beforeEl.getBoundingClientRect();
      var current = direction === 'vertical' ? beforeRect.width : beforeRect.height;
      var step = event.shiftKey ? 50 : 20;
      var handled = true;
      if (direction === 'vertical' && event.key === 'ArrowLeft') applySize(current - step);
      else if (direction === 'vertical' && event.key === 'ArrowRight') applySize(current + step);
      else if (direction !== 'vertical' && event.key === 'ArrowUp') applySize(current - step);
      else if (direction !== 'vertical' && event.key === 'ArrowDown') applySize(current + step);
      else if (event.key === 'Home') applySize(220);
      else if (event.key === 'End') applySize(100000);
      else handled = false;
      if (handled) event.preventDefault();
    });
  };

  UMLTutorialEditor.prototype._isNextStepLocked = function (index) {
    if (!this.requireTests || this.instructorMode) return false;
    if (!this._stepHasTests(this.steps[index])) return false;
    return !this._stepsUnlocked.has(index + 1);
  };

  UMLTutorialEditor.prototype.renderNav = function () {
    var self = this;
    if (!this.navEl) return;
    this.navEl.innerHTML = '';
    var statusEl = document.createElement('output');
    statusEl.className = 'tvm-step-status';
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    statusEl.textContent = 'Step ' + (this.currentStep + 1) + ' of ' + this.steps.length;
    this.navEl.appendChild(statusEl);
    this.steps.forEach(function (step, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      var unlocked = self.instructorMode || self._stepsUnlocked.has(index);
      btn.className = 'tvm-step-btn' + (index === self.currentStep ? ' active' : '') + (unlocked ? '' : ' locked');
      btn.textContent = String(index + 1);
      btn.title = unlocked ? (step.title || 'Step') : (step.title || 'Step') + ' (locked)';
      btn.setAttribute('aria-label', unlocked
        ? 'Step ' + (index + 1) + ': ' + (step.title || 'Step')
        : 'Step ' + (index + 1) + ': ' + (step.title || 'Step') + ' (locked, complete the previous step to unlock)');
      if (index === self.currentStep) btn.setAttribute('aria-current', 'step');
      if (unlocked) {
        btn.addEventListener('click', function () { self.loadStep(index); });
      } else {
        btn.disabled = true;
      }
      self.navEl.appendChild(btn);
    });
  };

  UMLTutorialEditor.prototype.renderControls = function (index) {
    var self = this;
    if (!this.controlsEl) return;
    var step = this.steps[index] || {};
    var nextLocked = this._isNextStepLocked(index);
    var html = '';
    html += index > 0
      ? '<button class="tvm-btn tvm-btn-prev" title="Previous step">&larr; Previous</button>'
      : '<span></span>';
    html += '<span class="tvm-step-actions">' +
      '<button class="tvm-btn tvm-btn-clear-model" title="Remove all UML elements from this step" type="button">Remove All Elements</button>';
    html += this._stepHasTests(step) ? this._buildTestButtonHTML(index) : '';
    html += '</span>';
    html += index < this.steps.length - 1
      ? '<button class="tvm-btn tvm-btn-next"' + (nextLocked ? ' disabled title="Pass all tests to continue"' : ' title="Next step"') + '>Next &rarr;</button>'
      : '<span></span>';
    this.controlsEl.innerHTML = html;

    var prev = this.controlsEl.querySelector('.tvm-btn-prev');
    var next = this.controlsEl.querySelector('.tvm-btn-next');
    var clear = this.controlsEl.querySelector('.tvm-btn-clear-model');
    if (prev) prev.addEventListener('click', function () { self.loadStep(index - 1); });
    if (next) next.addEventListener('click', function () {
      if (next.disabled) return;
      self._stepsUnlocked.add(index + 1);
      self.loadStep(index + 1);
    });
    this._wireTestButtons(this.controlsEl);
    if (clear) clear.addEventListener('click', function () { self.openClearStepDialog(clear); });
    this._ensureCooldownTicker(index);
  };

  // ---------------------------------------------------------------------------
  // Test cooldown helpers — same semantics as tutorial-code.js. See its
  // comments for the design.
  // ---------------------------------------------------------------------------
  UMLTutorialEditor.prototype._cooldownEnabled = function () {
    return !!(this._testCooldownSeconds && this._testCooldownSeconds > 0);
  };

  UMLTutorialEditor.prototype._loadCooldownMap = function () {
    if (!this._cooldownEnabled()) return {};
    try {
      var raw = localStorage.getItem(this._testCooldownStorageKey);
      var parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return {};
      // Self-pruning: drop entries whose end time is already past so closing
      // the tab before expiry doesn't leave stale rows in localStorage.
      var now = Date.now();
      var clean = {};
      var pruned = false;
      for (var k in parsed) {
        if (parsed.hasOwnProperty(k) && parsed[k] > now) clean[k] = parsed[k];
        else if (parsed.hasOwnProperty(k)) pruned = true;
      }
      if (pruned) this._saveCooldownMap(clean);
      return clean;
    } catch (e) { return {}; }
  };

  UMLTutorialEditor.prototype._saveCooldownMap = function (map) {
    if (!this._cooldownEnabled()) return;
    try {
      var hasAny = false;
      for (var k in map) { if (map.hasOwnProperty(k)) { hasAny = true; break; } }
      if (!hasAny) localStorage.removeItem(this._testCooldownStorageKey);
      else localStorage.setItem(this._testCooldownStorageKey, JSON.stringify(map));
    } catch (e) { /* ignore */ }
  };

  UMLTutorialEditor.prototype._cooldownRemaining = function (index) {
    if (!this._cooldownEnabled()) return 0;
    var map = this._loadCooldownMap();
    var endsAt = map[index];
    if (!endsAt) return 0;
    var remaining = Math.ceil((endsAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  };

  UMLTutorialEditor.prototype._startTestCooldown = function (index) {
    if (!this._cooldownEnabled()) return;
    var map = this._loadCooldownMap();
    map[index] = Date.now() + this._testCooldownSeconds * 1000;
    this._saveCooldownMap(map);
    this._refreshTestButton(index);
    this._ensureCooldownTicker(index);
  };

  UMLTutorialEditor.prototype._clearTestCooldown = function (index) {
    if (!this._cooldownEnabled()) return;
    var map = this._loadCooldownMap();
    if (map[index]) {
      delete map[index];
      this._saveCooldownMap(map);
    }
  };

  UMLTutorialEditor.prototype._formatCooldown = function (seconds) {
    var s = Math.max(0, Math.floor(seconds));
    var m = Math.floor(s / 60);
    var rem = s % 60;
    return m + ':' + (rem < 10 ? '0' : '') + rem;
  };

  UMLTutorialEditor.prototype._buildTestButtonHTML = function (index) {
    var remaining = this._cooldownRemaining(index);
    if (remaining <= 0) {
      return '<button class="tvm-btn tvm-btn-test" title="Check the UML diagram for this step">&#10003; Test My Work</button>';
    }
    var label = '⏱ Test My Work (' + this._formatCooldown(remaining) + ')';
    var aria = 'Test My Work locked, ' + remaining + ' second' + (remaining === 1 ? '' : 's') + ' remaining';
    var html = '<span class="tvm-test-btn-group">';
    html += '<button class="tvm-btn tvm-btn-test tvm-btn-test-cooldown" disabled aria-label="' + aria + '">' + label + '</button>';
    html += '<button class="tvm-btn tvm-btn-test-sure" title="Run tests now without seeing results — passes still unlock Next">I’m sure</button>';
    html += '</span>';
    return html;
  };

  UMLTutorialEditor.prototype._wireTestButtons = function (containerEl) {
    if (!containerEl) return;
    var self = this;
    var test = containerEl.querySelector('.tvm-btn-test:not(.tvm-btn-test-cooldown)');
    if (test) test.addEventListener('click', function () { self.runTests({ silent: false }); });
    var sure = containerEl.querySelector('.tvm-btn-test-sure');
    if (sure) sure.addEventListener('click', function () { self.runTests({ silent: true }); });
  };

  UMLTutorialEditor.prototype._refreshTestButton = function (index) {
    if (index == null) index = this.currentStep;
    if (!this.controlsEl) return;
    var step = this.steps[index];
    if (!step || !this._stepHasTests(step)) return;
    var existing = this.controlsEl.querySelector('.tvm-btn-test, .tvm-test-btn-group');
    if (!existing) return;
    var wrapper = document.createElement('div');
    wrapper.innerHTML = this._buildTestButtonHTML(index);
    var replacement = wrapper.firstChild;
    existing.parentNode.replaceChild(replacement, existing);
    this._wireTestButtons(this.controlsEl);
  };

  UMLTutorialEditor.prototype._ensureCooldownTicker = function (index) {
    if (!this._cooldownEnabled()) return;
    if (this._testCooldownTimer) {
      clearInterval(this._testCooldownTimer);
      this._testCooldownTimer = null;
    }
    var self = this;
    if (this._cooldownRemaining(index) <= 0) return;
    this._testCooldownTimer = setInterval(function () {
      var remaining = self._cooldownRemaining(self.currentStep);
      var label = self.controlsEl && self.controlsEl.querySelector('.tvm-btn-test-cooldown');
      if (remaining <= 0) {
        clearInterval(self._testCooldownTimer);
        self._testCooldownTimer = null;
        self._clearTestCooldown(self.currentStep);
        self._refreshTestButton(self.currentStep);
        return;
      }
      if (label) label.textContent = '⏱ Test My Work (' + self._formatCooldown(remaining) + ')';
    }, 1000);
  };

  UMLTutorialEditor.prototype.loadStep = function (index) {
    if (index < 0 || index >= this.steps.length) return;
    if (!this.instructorMode && !this._stepsUnlocked.has(index)) return;
    this.currentStep = index;
    var step = this.steps[index] || {};
    if (this.instructionsEl) {
      this.instructionsEl.innerHTML = '<h2>' + escapeHtml(step.title || 'Step') + '</h2>' +
        '<div class="tvm-step-instructions">' + (step.instructionsHTML || step.instructions || '') + '</div>';
      if (window.UMLShared && UMLShared.renderAll) UMLShared.renderAll();
      this.renderPreviousDiagrams(index);
    }
    if (this.contentWrapEl) {
      this.contentWrapEl.scrollTop = 0;
    }
    if (this.typeEl && step.uml_type && this.typeEl.value !== step.uml_type) {
      this.typeEl.value = step.uml_type;
      this.typeEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    this.renderNav();
    this.renderControls(index);
    this.clearResults();
    document.dispatchEvent(new CustomEvent('tvm:stepchange', { detail: { stepIndex: index } }));
  };

  UMLTutorialEditor.prototype.previousDiagramEntries = function (index) {
    var entries = [];
    var seenTypes = {};
    for (var i = 0; i < index; i++) {
      var step = this.steps[i] || {};
      var type = step.uml_type || step.umlType;
      if (!type || seenTypes[type] || !UML_RENDERER_GLOBALS[type]) continue;
      seenTypes[type] = true;
      var source = this.sourceForDiagramType(type);
      if (!hasMeaningfulArchUml(source)) continue;
      entries.push({
        type: type,
        title: step.title || umlTypeLabel(type),
        source: source
      });
    }
    return entries;
  };

  UMLTutorialEditor.prototype.renderPreviousDiagrams = function (index) {
    if (!this.instructionsEl) return;
    var entries = this.previousDiagramEntries(index);
    if (!entries.length) return;
    var section = document.createElement('section');
    section.className = 'tvm-previous-diagrams';
    var headingId = 'tvm-previous-diagrams-title-' + index;
    section.setAttribute('aria-labelledby', headingId);
    var heading = document.createElement('h3');
    heading.id = headingId;
    heading.textContent = 'Earlier Diagrams';
    section.appendChild(heading);
    var list = document.createElement('div');
    list.className = 'tvm-previous-diagram-list';
    var previews = [];
    entries.forEach(function (entry) {
      var article = document.createElement('article');
      article.className = 'tvm-previous-diagram-card';
      article.setAttribute('data-uml-preview-type', entry.type);
      var title = document.createElement('h4');
      title.className = 'tvm-previous-diagram-title';
      title.textContent = umlTypeLabel(entry.type);
      article.appendChild(title);
      var preview = document.createElement('div');
      preview.className = 'tvm-previous-diagram-render ' + (UML_CONTAINER_CLASSES[entry.type] || 'uml-class-diagram-container');
      preview.setAttribute('aria-label', umlTypeLabel(entry.type) + ' created in a previous tutorial step');
      article.appendChild(preview);
      list.appendChild(article);
      previews.push({ container: preview, type: entry.type, source: entry.source });
    });
    section.appendChild(list);
    this.instructionsEl.appendChild(section);
    previews.forEach(function (preview) {
      renderStaticUmlPreview(preview.container, preview.type, preview.source);
    });
  };

  UMLTutorialEditor.prototype.resetCurrentDiagram = function () {
    var step = this.steps[this.currentStep] || {};
    var type = step.uml_type || (this.typeEl && this.typeEl.value) || 'class';
    if (this.typeEl) {
      this.typeEl.value = type;
      this.typeEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var reset = this.root.querySelector('#uml-pg-reset-example');
    if (reset) reset.click();
  };

  UMLTutorialEditor.prototype.currentStepDiagramType = function () {
    var step = this.steps[this.currentStep] || {};
    return step.uml_type || step.umlType || (this.typeEl && this.typeEl.value) || 'class';
  };

  UMLTutorialEditor.prototype.clearCurrentStepDiagram = function () {
    var type = this.currentStepDiagramType();
    var source = emptySource();
    if (this.typeEl && this.typeEl.value !== type) {
      this.typeEl.value = type;
      this.typeEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (this.sourceEl) {
      this.sourceEl.value = source;
      this.sourceEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    try { localStorage.setItem(autosaveKeyForType(type), source); } catch (e) {}
    this._stepsPassed.delete(this.currentStep);
    this.clearResults();
  };

  UMLTutorialEditor.prototype.ensureClearStepDialog = function () {
    var self = this;
    if (this._clearDialog && this._clearDialog.isConnected) return this._clearDialog;
    var backdrop = document.createElement('div');
    backdrop.className = 'tvm-clear-step-dialog-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = [
      '<div class="tvm-clear-step-dialog" role="dialog" aria-modal="true" aria-labelledby="tvm-clear-step-title" aria-describedby="tvm-clear-step-desc">',
      '  <h2 id="tvm-clear-step-title">Remove all UML elements from this step?</h2>',
      '  <p id="tvm-clear-step-desc">This clears the current step diagram and keeps diagrams from other steps saved.</p>',
      '  <div class="tvm-clear-step-dialog-actions">',
      '    <button class="tvm-btn tvm-btn-clear-cancel" type="button">Cancel</button>',
      '    <button class="tvm-btn tvm-btn-clear-confirm" type="button">Remove Elements</button>',
      '  </div>',
      '</div>'
    ].join('');
    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) self.closeClearStepDialog();
    });
    backdrop.addEventListener('keydown', function (event) {
      self.handleClearDialogKeydown(event);
    });
    var cancel = backdrop.querySelector('.tvm-btn-clear-cancel');
    var confirm = backdrop.querySelector('.tvm-btn-clear-confirm');
    if (cancel) cancel.addEventListener('click', function () { self.closeClearStepDialog(); });
    if (confirm) {
      confirm.addEventListener('click', function () {
        self.clearCurrentStepDiagram();
        self.closeClearStepDialog();
      });
    }
    document.body.appendChild(backdrop);
    this._clearDialog = backdrop;
    return backdrop;
  };

  UMLTutorialEditor.prototype.openClearStepDialog = function (trigger) {
    var dialog = this.ensureClearStepDialog();
    this._clearDialogPreviousFocus = trigger || document.activeElement;
    dialog.hidden = false;
    var cancel = dialog.querySelector('.tvm-btn-clear-cancel');
    if (cancel) cancel.focus();
  };

  UMLTutorialEditor.prototype.closeClearStepDialog = function () {
    if (this._clearDialog) this._clearDialog.hidden = true;
    var previous = this._clearDialogPreviousFocus;
    this._clearDialogPreviousFocus = null;
    if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus();
  };

  UMLTutorialEditor.prototype.handleClearDialogKeydown = function (event) {
    if (!this._clearDialog || this._clearDialog.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeClearStepDialog();
      return;
    }
    if (event.key !== 'Tab') return;
    var focusable = Array.prototype.slice.call(this._clearDialog.querySelectorAll('button'))
      .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  UMLTutorialEditor.prototype.currentSource = function () {
    return this.sourceEl ? this.sourceEl.value || '' : '';
  };

  UMLTutorialEditor.prototype.sourceForDiagramType = function (type) {
    type = type || (this.typeEl && this.typeEl.value) || 'class';
    if (this.typeEl && this.typeEl.value === type) return this.currentSource();
    try {
      return localStorage.getItem(autosaveKeyForType(type)) || '';
    } catch (e) {
      return '';
    }
  };

  UMLTutorialEditor.prototype.clearResults = function () {
    this._testResults = [];
    this._testHintRecords = [];
    if (window.TutorChat) window.TutorChat.onStepChange();
    if (!this.instructionsEl) return;
    var panel = this.instructionsEl.querySelector('.tvm-test-panel');
    if (panel) panel.remove();
  };

  UMLTutorialEditor.prototype._showTestPanel = function (innerHtml) {
    if (!this.instructionsEl) return;
    var panel = this.instructionsEl.querySelector('.tvm-test-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'tvm-test-panel';
      this.instructionsEl.appendChild(panel);
    }
    panel.innerHTML = innerHtml;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  UMLTutorialEditor.prototype._ensureTestAnnouncer = function () {
    if (this._testAnnouncer && this._testAnnouncer.isConnected) return this._testAnnouncer;
    var announcer = document.createElement('div');
    announcer.className = 'sr-only tvm-test-announcer';
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    (this.root || document.body).appendChild(announcer);
    this._testAnnouncer = announcer;
    return announcer;
  };

  UMLTutorialEditor.prototype._announceTestResult = function (tests, results) {
    var passed = results.filter(function (result) { return result === true; }).length;
    var total = tests.length;
    var message = passed === total
      ? 'All ' + total + (total === 1 ? ' test passed.' : ' tests passed.')
      : passed + ' of ' + total + ' tests passed.';
    var announcer = this._ensureTestAnnouncer();
    announcer.textContent = '';
    var self = this;
    setTimeout(function () {
      if (self._testAnnouncer) self._testAnnouncer.textContent = message;
    }, 50);
  };

  UMLTutorialEditor.prototype._buildTestResultsHTML = function (tests, results) {
    var html = '<div class="tvm-test-results">';
    var passed = results.filter(function (result) { return result === true; }).length;
    var total = tests.length;
    var allPass = passed === total;
    html += '<div class="tvm-test-summary ' + (allPass ? 'all-pass' : 'partial') + '">';
    html += allPass ? '&#9989; All ' + total + ' tests passed!' : passed + '&nbsp;/&nbsp;' + total + ' tests passed';
    html += '</div><ul class="tvm-test-list">';
    tests.forEach(function (test, index) {
      var ok = results[index] === true;
      html += '<li class="tvm-test-item ' + (ok ? 'pass' : 'fail') + '">';
      html += '<span class="tvm-test-icon">' + (ok ? '&#10003;' : '&#10007;') + '</span>';
      html += '<span class="tvm-test-desc">' + escapeHtml(test.description || 'UML check') + '</span>';
      if (!ok && test.failures && test.failures.length) {
        html += '<ul class="tvm-uml-test-failures">';
        test.failures.forEach(function (failure) {
          html += '<li>' + escapeHtml(failure) + '</li>';
        });
        html += '</ul>';
      }
      html += '</li>';
    });
    html += '</ul></div>';
    return html;
  };

  UMLTutorialEditor.prototype.runTests = function (opts) {
    var silent = !!(opts && opts.silent);
    if (!silent && this._cooldownEnabled() && this._cooldownRemaining(this.currentStep) > 0) return;
    this._silentTestRun = silent;
    var step = this.steps[this.currentStep] || {};
    var tests = step.tests || [];
    var model = parseArchUml(this.currentSource());
    var currentType = step.uml_type || (this.typeEl && this.typeEl.value) || 'class';
    var self = this;
    var parsedModels = {};
    var context = {
      currentType: currentType,
      modelForType: function (type) {
        type = type || currentType;
        if (type === currentType) return model;
        if (!parsedModels[type]) parsedModels[type] = parseArchUml(self.sourceForDiagramType(type));
        return parsedModels[type];
      }
    };
    var results = [];
    var resultTests = [];
    var hintRecords = [];
    tests.forEach(function (test) {
      var failures = [];
      var hints = [];
      (test.assertions || []).forEach(function (assertion) {
        var result = evaluateAssertion(model, assertion, context);
        if (!result.pass) {
          failures.push(result.message);
          toArray(result.hints || result.hint).forEach(function (hint) {
            if (!hint) return;
            var record = {
              icon: '\uD83D\uDCA1',
              title: 'Naming nudge',
              text: hint
            };
            var duplicate = hints.some(function (existing) {
              return existing.title === record.title && existing.text === record.text;
            });
            if (!duplicate) hints.push(record);
          });
        }
      });
      var ok = failures.length === 0;
      results.push(ok);
      hintRecords.push(hints);
      resultTests.push({
        description: test.description || 'UML check',
        failures: failures
      });
    });
    var allPass = results.length > 0 && results.every(function (result) { return result === true; });
    this._testResults = results;
    this._testHintRecords = hintRecords;
    if (allPass) {
      this._stepsPassed.add(this.currentStep);
      this._stepsUnlocked.add(this.currentStep + 1);
      this.renderNav();
      this.renderControls(this.currentStep);
    }
    if (!tests.length) {
      if (!silent) this._showTestPanel('<div class="tvm-test-results"><div class="tvm-test-summary all-pass">No tests for this step.</div></div>');
      this._silentTestRun = false;
      return;
    }
    if (!silent) {
      this._showTestPanel(this._buildTestResultsHTML(resultTests, results));
      this._announceTestResult(resultTests, results);
      if (!allPass && window.TutorChat) window.TutorChat.onTestFailure(this);
      if (allPass && window.TutorChat) window.TutorChat.onTestPass();
      if (allPass && window.SEGymHeroCelebration) {
        window.SEGymHeroCelebration.show({ hostEl: this.instructionsEl });
      }
    }
    if (!silent && this._cooldownEnabled()) this._startTestCooldown(this.currentStep);
    this._silentTestRun = false;
  };

  function escapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function cleanId(text) {
    return String(text || '').trim().replace(/^"((?:[^"\\]|\\.)*)"$/, '$1').replace(/\\"/g, '"');
  }

  function normalize(text) {
    return cleanId(text).toLowerCase().replace(/[\s_-]+/g, '').replace(/[^\w.]/g, '');
  }

  function assertionNamingHint(assertion, fallback) {
    return assertion.naming_hint || assertion.namingHint || assertion.name_hint || assertion.nameHint || fallback || '';
  }

  function failResult(message, hint) {
    var result = { pass: false, message: message };
    if (hint) result.hints = [hint];
    return result;
  }

  function umlTypeLabel(type) {
    return UML_TYPE_LABELS[type] || (String(type || '').charAt(0).toUpperCase() + String(type || '').slice(1) + ' Diagram');
  }

  function hasMeaningfulArchUml(source) {
    var inLayout = false;
    return String(source || '').split(/\r?\n/).some(function (line) {
      var trimmed = line.trim();
      if (!trimmed || trimmed.charAt(0) === "'") return false;
      if (/^@layout\b/i.test(trimmed)) {
        inLayout = true;
        return false;
      }
      if (/^@endlayout\b/i.test(trimmed)) {
        inLayout = false;
        return false;
      }
      if (inLayout) return false;
      if (/^@(startuml|enduml)\b/i.test(trimmed)) return false;
      return true;
    });
  }

  function emptySource() {
    return '@startuml\n@enduml';
  }

  function autosaveKeyForType(type) {
    if (window.UMLEditor && typeof window.UMLEditor.autosaveKey === 'function') {
      return window.UMLEditor.autosaveKey(type);
    }
    return 'uml-pg-autosave-' + type;
  }

  function renderStaticUmlPreview(container, type, source) {
    var rendererName = UML_RENDERER_GLOBALS[type];
    var renderer = rendererName && window[rendererName];
    if (!renderer || typeof renderer.render !== 'function') {
      container.innerHTML = '<p class="tvm-previous-diagram-placeholder">Saved ' + escapeHtml(umlTypeLabel(type).toLowerCase()) + ' preview is not ready yet.</p>';
      return;
    }
    try {
      renderer.render(container, source);
      container.setAttribute('data-uml-rendered', 'true');
    } catch (error) {
      container.innerHTML = '<p class="tvm-previous-diagram-placeholder">This saved ' + escapeHtml(umlTypeLabel(type).toLowerCase()) + ' could not be rendered.</p>';
    }
  }

  function parseArchUml(source) {
    var model = { elements: [], members: [], relations: [] };
    var lines = String(source || '').split(/\r?\n/);
    var current = null;
    var inLayout = false;
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line || line === '@startuml' || line === '@enduml') return;
      if (/^@layout\b/i.test(line)) { inLayout = true; return; }
      if (/^@endlayout\b/i.test(line)) { inLayout = false; return; }
      if (inLayout || /^layout\b/i.test(line)) return;
      if (current && line === '}') { current = null; return; }

      var m = line.match(/^(abstract\s+class|class|interface|enum)\s+(?:"([^"]+)"\s+as\s+)?([A-Za-z_][\w.]*)/i);
      if (m) {
        addElement(model, m[1].toLowerCase(), m[3], m[2] || m[3]);
        var owner = m[3];
        var inlineBody = line.match(/\{(.*)\}/);
        if (inlineBody) {
          inlineBody[1].split(';').forEach(function (part) { addMember(model, owner, part); });
          current = null;
        } else {
          current = /\{/.test(line) ? owner : null;
        }
        return;
      }

      m = line.match(/^state\s+(?:"([^"]+)"\s+as\s+)?([A-Za-z_][\w.]*)/i);
      if (m) { addElement(model, 'state', m[2], m[1] || m[2]); return; }

      m = line.match(/^(actor|participant|boundary|control|entity|database)\s+([A-Za-z_][\w.]*)(?:\s*(?::|as)\s*(.+))?/i);
      if (m) { addElement(model, m[1].toLowerCase(), m[2], m[3] || m[2]); return; }

      if (current) {
        addMember(model, current, line);
        return;
      }

      var relation = parseRelationLine(line);
      if (relation) model.relations.push(relation);
    });
    return model;
  }

  function parseRelationLine(line) {
    var split = splitRelationLabel(line);
    var parsed = parseTokenizedRelationLine(split.body.trim());
    if (!parsed) return null;
    return {
      from: cleanId(parsed.source),
      sourceMult: cleanId(parsed.sourceMult || ''),
      op: parsed.op,
      targetMult: cleanId(parsed.targetMult || ''),
      to: cleanId(parsed.target),
      label: split.label
    };
  }

  function tokenizeRelationParts(text) {
    var tokens = [];
    var re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\S+)/g;
    var match;
    while ((match = re.exec(String(text || '')))) {
      if (match[1] != null) {
        tokens.push({ value: cleanId('"' + match[1] + '"'), quoted: true });
      } else if (match[2] != null) {
        tokens.push({ value: match[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\'), quoted: true });
      } else {
        tokens.push({ value: match[3], quoted: false });
      }
    }
    return tokens;
  }

  function isRelationOperatorToken(token) {
    var op = String(token && token.value || '').trim();
    if (!op || token.quoted) return false;
    if (op === '..') return true;
    return /^[-.<=>|*ox]+$/.test(op) && /[-<=>|]/.test(op);
  }

  function relationTokenLooksLikeMultiplicity(token) {
    if (!token) return false;
    var value = String(token.value || '').trim();
    if (!value) return false;
    if (!token.quoted && /^\[[^\]]+\]$/.test(value)) return true;
    return /^[*0-9nNmM.]+$/.test(value) || /\.\./.test(value);
  }

  function cleanRelationMultiplicityToken(token) {
    var value = String(token && token.value || '').trim();
    var bracket = !token.quoted && value.match(/^\[([^\]]+)\]$/);
    return bracket ? bracket[1].trim() : value;
  }

  function joinRelationEndpointTokens(tokens) {
    return (tokens || []).map(function (token) {
      return String(token && token.value || '').trim();
    }).filter(Boolean).join(' ').trim();
  }

  function parseRelationEndpointTokens(tokens, side) {
    var result = { id: '', mult: '' };
    var list = (tokens || []).filter(function (token) {
      return token && String(token.value || '').trim();
    });
    if (!list.length) return result;

    if (side === 'source' &&
        list.length === 2 &&
        relationTokenLooksLikeMultiplicity(list[0]) &&
        !relationTokenLooksLikeMultiplicity(list[1])) {
      result.mult = cleanRelationMultiplicityToken(list[0]);
      result.id = joinRelationEndpointTokens([list[1]]);
      return result;
    }

    if (side === 'source' &&
        list.length >= 2 &&
        relationTokenLooksLikeMultiplicity(list[list.length - 1]) &&
        !relationTokenLooksLikeMultiplicity(list[0])) {
      result.mult = cleanRelationMultiplicityToken(list[list.length - 1]);
      result.id = joinRelationEndpointTokens(list.slice(0, list.length - 1));
      return result;
    }

    if (side === 'target' &&
        list.length >= 2 &&
        relationTokenLooksLikeMultiplicity(list[0]) &&
        !relationTokenLooksLikeMultiplicity(list[list.length - 1])) {
      result.mult = cleanRelationMultiplicityToken(list[0]);
      result.id = joinRelationEndpointTokens(list.slice(1));
      return result;
    }

    if (side === 'target' &&
        list.length >= 2 &&
        relationTokenLooksLikeMultiplicity(list[list.length - 1]) &&
        !relationTokenLooksLikeMultiplicity(list[0])) {
      result.mult = cleanRelationMultiplicityToken(list[list.length - 1]);
      result.id = joinRelationEndpointTokens(list.slice(0, list.length - 1));
      return result;
    }

    result.id = joinRelationEndpointTokens(list);
    return result;
  }

  function parseTokenizedRelationLine(text) {
    var tokens = tokenizeRelationParts(text);
    var opIdx = -1;
    for (var i = 0; i < tokens.length; i++) {
      if (isRelationOperatorToken(tokens[i])) { opIdx = i; break; }
    }
    if (opIdx <= 0 || opIdx >= tokens.length - 1) return null;
    var source = parseRelationEndpointTokens(tokens.slice(0, opIdx), 'source');
    var target = parseRelationEndpointTokens(tokens.slice(opIdx + 1), 'target');
    if (!source.id || !target.id) return null;
    return {
      source: source.id,
      sourceMult: source.mult,
      op: tokens[opIdx].value,
      targetMult: target.mult,
      target: target.id
    };
  }

  function splitRelationLabel(line) {
    var text = String(line || '');
    var inQuote = false;
    var escaped = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ':' && !inQuote) {
        return { body: text.slice(0, i), label: text.slice(i + 1).trim() };
      }
    }
    return { body: text, label: '' };
  }

  function addElement(model, type, id, label) {
    model.elements.push({ type: type, id: cleanId(id), label: cleanId(label || id) });
  }

  function addMember(model, owner, text) {
    text = String(text || '').trim();
    if (!text || text === '{' || text === '}') return;
    model.members.push({ owner: cleanId(owner), text: text });
  }

  function evaluateAssertion(model, assertion, context) {
    var kind = assertion.kind || assertion.type || 'element';
    if (kind === 'element' || kind === 'state' || kind === 'participant' || kind === 'class') {
      return assertElement(model, assertion, kind, context);
    }
    if (kind === 'member') return assertMember(model, assertion);
    if (kind === 'relation' || kind === 'transition' || kind === 'message') return assertRelation(model, assertion, kind, context);
    if (kind === 'sequence' || kind === 'sequence_consistency') return assertSequence(model, assertion, context);
    if (kind === 'class_consistency' || kind === 'classConsistency') return assertClassConsistency(model, assertion);
    return { pass: false, message: 'Unknown assertion kind: ' + kind };
  }

  function assertElement(model, assertion, kind, context) {
    var classRole = assertion.class_role || assertion.classRole;
    if (kind === 'state' && classRole) return assertStateForClassRole(model, assertion, context, classRole);
    var id = assertion.id || assertion.name;
    var idContains = containsValues(assertion, 'id').concat(containsValues(assertion, 'name'));
    var expectedType = assertion.element_type || assertion.elementType || (kind === 'element' ? assertion.uml_type : kind);
    var expectedTypes = elementTypeValues(assertion);
    if (expectedType) expectedTypes.push(expectedType);
    var found = model.elements.some(function (el) {
      var idMatches = valueMatches([el.id, el.label], id, idContains);
      var typeMatches = typeMatchesAny(el.type, expectedTypes);
      return idMatches && typeMatches;
    });
    var namingCandidateExists = model.elements.some(function (el) {
      return typeMatchesAny(el.type, expectedTypes);
    });
    return found
      ? { pass: true }
      : failResult('Expected ' + (expectedTypes.length ? describeExpectedValue(null, expectedTypes) : 'element') + ' ' + describeExpectedValue(id, idContains) + '.', namingCandidateExists ? assertionNamingHint(assertion) : null);
  }

  function assertMember(model, assertion) {
    var owner = assertion.owner || assertion.class || assertion.element;
    var ownerContains = containsValues(assertion, 'owner').concat(containsValues(assertion, 'class')).concat(containsValues(assertion, 'element'));
    var text = assertion.text || assertion.member || assertion.name;
    var textContains = containsValues(assertion, 'text').concat(containsValues(assertion, 'member')).concat(containsValues(assertion, 'name'));
    var expectedArgumentTypes = argumentTypeValues(assertion);
    var requiresArguments = assertionRequiresArgumentList(assertion) || expectedArgumentTypes.length > 0;
    var found = model.members.some(function (member) {
      var signature = methodSignatureFromMember(member.text);
      var abstractOk = assertion.is_abstract == null && assertion.isAbstract == null && assertion.abstract == null
        ? true
        : memberIsAbstract(member, model) === !!(assertion.is_abstract || assertion.isAbstract || assertion.abstract);
      return valueMatches(member.owner, owner, ownerContains) &&
        valueMatches(member.text, text, textContains, true) &&
        abstractOk &&
        (!requiresArguments || !!signature) &&
        (!expectedArgumentTypes.length || methodSignatureHasArgumentType(signature, expectedArgumentTypes));
    });
    var namingCandidateExists = model.members.some(function (member) {
      var abstractOk = assertion.is_abstract == null && assertion.isAbstract == null && assertion.abstract == null
        ? true
        : memberIsAbstract(member, model) === !!(assertion.is_abstract || assertion.isAbstract || assertion.abstract);
      return valueMatches(member.owner, owner, ownerContains) && abstractOk && !valueMatches(member.text, text, textContains, true);
    });
    var argumentCandidateExists = expectedArgumentTypes.length && model.members.some(function (member) {
      return valueMatches(member.owner, owner, ownerContains) &&
        valueMatches(member.text, text, textContains, true) &&
        !!methodSignatureFromMember(member.text);
    });
    return found
      ? { pass: true }
      : failResult('Expected ' + (requiresArguments ? 'operation ' : 'member ') + describeExpectedValue(text, textContains) + ' on ' + describeExpectedValue(owner, ownerContains) + (assertion.is_abstract || assertion.isAbstract || assertion.abstract ? ' marked abstract' : '') + (requiresArguments ? ' with an argument list, such as method() or method(arg)' : '') + (expectedArgumentTypes.length ? ' and an argument typed as ' + describeExpectedValue(null, expectedArgumentTypes) : '') + '.', (namingCandidateExists || argumentCandidateExists) ? assertionNamingHint(assertion) : null);
  }

  function assertRelation(model, assertion, kind, context) {
    var from = assertion.from || assertion.source;
    var to = assertion.to || assertion.target;
    var fromContains = containsValues(assertion, 'from').concat(containsValues(assertion, 'source'));
    var toContains = containsValues(assertion, 'to').concat(containsValues(assertion, 'target'));
    var fromClassRole = assertion.from_class_role || assertion.fromClassRole || assertion.source_class_role || assertion.sourceClassRole;
    var toClassRole = assertion.to_class_role || assertion.toClassRole || assertion.target_class_role || assertion.targetClassRole;
    var fromExact = classRoleValues(context, fromClassRole);
    var toExact = classRoleValues(context, toClassRole);
    if (fromClassRole && !fromExact.length) return { pass: false, message: 'Expected class diagram to define a "' + fromClassRole + '" state class.' };
    if (toClassRole && !toExact.length) return { pass: false, message: 'Expected class diagram to define a "' + toClassRole + '" state class.' };
    var relationTypes = relationTypeValues(assertion).concat(conditionalRelationTypes(model, assertion, to, toContains));
    var labelContains = containsValues(assertion, 'label');
    if (assertion.label) labelContains.push(assertion.label);
    var labelMinLength = numericValue(assertion.label_min_length || assertion.labelMinLength);
    var sourceMultiplicity = multiplicityValues(assertion, 'source');
    var targetMultiplicity = multiplicityValues(assertion, 'target');
    var optional = assertion.optional === true || assertion.optional === 'true';
    var candidateExists = false;
    var namingCandidateExists = false;
    var found = model.relations.some(function (rel) {
      var forward = endpointsMatch(rel.from, rel.to, from, to, fromContains, toContains, fromExact, toExact);
      var semantic = semanticRelationEndpoints(rel);
      var matchedEdges = [];
      if (semantic.length) {
        semantic.forEach(function (edge) {
          if (endpointsMatch(edge.from, edge.to, from, to, fromContains, toContains, fromExact, toExact)) matchedEdges.push(edge);
          if (assertion.directed === false && endpointsMatch(edge.from, edge.to, to, from, toContains, fromContains, toExact, fromExact)) matchedEdges.push(edge);
        });
      } else {
        if (forward) matchedEdges.push({ from: rel.from, to: rel.to });
        if (assertion.directed === false && endpointsMatch(rel.from, rel.to, to, from, toContains, fromContains, toExact, fromExact)) {
          matchedEdges.push({ from: rel.to, to: rel.from });
        }
      }
      var endpointOk = matchedEdges.length > 0;
      var typeOk = !relationTypes.length || relationTypes.some(function (expectedType) {
        return normalize(relationSemanticType(rel)) === normalize(expectedType);
      });
      var labelOk = valueMatches(rel.label, null, labelContains);
      var candidateOk = endpointOk && typeOk;
      if (candidateOk) candidateExists = true;
      var labelLengthOk = !labelMinLength || String(rel.label || '').trim().length >= labelMinLength;
      var multiplicityOk = !candidateOk || matchedEdges.some(function (edge) {
        return relationEdgeMultiplicityMatches(rel, edge, sourceMultiplicity, targetMultiplicity);
      });
      if (candidateOk && (!labelOk || !labelLengthOk || !multiplicityOk)) namingCandidateExists = true;
      return candidateOk && labelOk && labelLengthOk && multiplicityOk;
    });
    return found
      ? { pass: true }
      : optional && !candidateExists
        ? { pass: true }
        : failResult('Expected ' + kind + ' from ' + describeExpectedValue(from, fromContains, fromExact) + ' to ' + describeExpectedValue(to, toContains, toExact) + (relationTypes.length ? ' with type ' + describeExpectedValue(null, relationTypes) : '') + (sourceMultiplicity.length ? ' with source multiplicity ' + describeExpectedValue(null, sourceMultiplicity) : '') + (targetMultiplicity.length ? ' with target multiplicity ' + describeExpectedValue(null, targetMultiplicity) : '') + (labelContains.length ? ' labeled with ' + describeExpectedValue(null, labelContains) : '') + (labelMinLength ? ' with a label at least ' + labelMinLength + ' characters long' : '') + '.', namingCandidateExists ? assertionNamingHint(assertion) : null);
  }

  function assertSequence(model, assertion, context) {
    var check = normalize(assertion.check || assertion.rule || assertion.name);
    if (check === 'playerobject') return assertSequencePlayerObject(model, assertion);
    if (check === 'stateobjects') return assertSequenceStateObjects(model, context, assertion);
    if (check === 'messagesbetweenplayerandstates') return assertSequenceMessagesBetweenPlayerAndStates(model, context, assertion);
    if (check === 'statechangebetweenstatecalls') return assertSequenceStateChangeBetweenStateCalls(model, context, assertion);
    if (check === 'statechangeargumentisnextstate' || check === 'statechangepassesnextstateobject') return assertSequenceStateChangeArgumentIsNextState(model, context, assertion);
    if (check === 'calllabelshaveargumentlists' || check === 'calllabelsuseoperationsyntax') return assertSequenceCallLabelsHaveArgumentLists(model, assertion);
    if (check === 'calledmethodsexist') return assertSequenceCalledMethodsExist(model, context, assertion);
    return { pass: false, message: 'Unknown sequence assertion check: ' + (assertion.check || assertion.rule || assertion.name || '') };
  }

  function assertSequencePlayerObject(model, assertion) {
    return sequencePlayerParticipants(model).length
      ? { pass: true }
      : failResult('Expected a Player object participant in the sequence diagram.', sequenceParticipants(model).length ? assertionNamingHint(assertion) : null);
  }

  function assertSequenceStateObjects(model, context, assertion) {
    var stateParticipants = sequenceStateParticipants(model, context);
    var min = numericValue(assertion.min || assertion.minimum || 2) || 2;
    if (stateParticipants.length < min) {
      return failResult('Expected at least ' + min + ' concrete PlayerState object participants from the class diagram.', sequenceParticipants(model).length >= min ? assertionNamingHint(assertion) : null);
    }
    if (assertion.different_types !== false && assertion.differentTypes !== false) {
      var types = uniqueValues(stateParticipants.map(function (participant) { return participant.className; }));
      if (types.length < min) {
        return failResult('Expected concrete PlayerState object participants of at least ' + min + ' different types.', assertionNamingHint(assertion));
      }
    }
    return { pass: true };
  }

  function assertSequenceMessagesBetweenPlayerAndStates(model, context, assertion) {
    var player = sequencePlayerParticipants(model)[0];
    if (!player) return { pass: false, message: 'Expected a Player object participant before checking state interactions.' };
    var stateParticipants = sequenceStateParticipants(model, context);
    if (!stateParticipants.length) return { pass: false, message: 'Expected at least one concrete PlayerState object participant before checking state interactions.' };
    var missing = stateParticipants.filter(function (stateParticipant) {
      return !model.relations.some(function (rel) {
        return relationBetweenParticipants(rel, player, stateParticipant);
      });
    });
    return missing.length
      ? { pass: false, message: 'Expected a message between the Player object and each concrete PlayerState object. Missing: ' + missing.map(function (p) { return p.id; }).join(', ') + '.' }
      : { pass: true };
  }

  function assertSequenceStateChangeBetweenStateCalls(model, context, assertion) {
    var player = sequencePlayerParticipants(model)[0];
    if (!player) return { pass: false, message: 'Expected a Player object participant before checking state-change ordering.' };
    var stateParticipants = sequenceStateParticipants(model, context);
    var turnAliases = toArray(context && context.turnAliases).concat(TURN_METHOD_ALIASES);
    var changeAliases = toArray(context && context.stateChangeAliases).concat(STATE_CHANGE_METHOD_ALIASES);
    var stateCalls = [];
    model.relations.forEach(function (rel, index) {
      var stateParticipant = stateParticipants.find(function (candidate) {
        return relationBetweenParticipants(rel, player, candidate) && methodMatchesAliases(rel.label, turnAliases);
      });
      if (stateParticipant) {
        stateCalls.push({ index: index, participant: stateParticipant });
      }
    });
    var potentialNamedChange = false;
    for (var i = 0; i < stateCalls.length; i++) {
      for (var j = i + 1; j < stateCalls.length; j++) {
        if (normalize(stateCalls[i].participant.className) === normalize(stateCalls[j].participant.className)) continue;
        var hasChange = model.relations.slice(stateCalls[i].index + 1, stateCalls[j].index).some(function (rel) {
          if (participantMatchesEndpoint(rel.to, player) && methodNameFromLabel(rel.label)) potentialNamedChange = true;
          return participantMatchesEndpoint(rel.to, player) && methodMatchesAliases(rel.label, changeAliases);
        });
        if (hasChange) return { pass: true };
      }
    }
    return failResult('Expected a Player state-change method call between two turn calls to different state objects.', potentialNamedChange ? assertionNamingHint(assertion) : null);
  }

  function assertSequenceStateChangeArgumentIsNextState(model, context, assertion) {
    var player = sequencePlayerParticipants(model)[0];
    if (!player) return { pass: false, message: 'Expected a Player object participant before checking state-change arguments.' };
    var stateParticipants = sequenceStateParticipants(model, context);
    var turnAliases = toArray(context && context.turnAliases).concat(TURN_METHOD_ALIASES);
    var changeAliases = toArray(context && context.stateChangeAliases).concat(STATE_CHANGE_METHOD_ALIASES);
    var stateCalls = [];
    model.relations.forEach(function (rel, index) {
      var stateParticipant = stateParticipants.find(function (candidate) {
        return participantMatchesEndpoint(rel.from, player) &&
          participantMatchesEndpoint(rel.to, candidate) &&
          methodMatchesAliases(rel.label, turnAliases);
      });
      if (stateParticipant) stateCalls.push({ index: index, participant: stateParticipant });
    });
    var sawStateChange = false;
    var expectedTargets = [];
    for (var i = 0; i < stateCalls.length; i++) {
      for (var j = i + 1; j < stateCalls.length; j++) {
        if (normalize(stateCalls[i].participant.className) === normalize(stateCalls[j].participant.className)) continue;
        var nextState = stateCalls[j].participant;
        expectedTargets.push(nextState.id);
        var hasMatchingArgument = model.relations.slice(stateCalls[i].index + 1, stateCalls[j].index).some(function (rel) {
          if (!participantMatchesEndpoint(rel.to, player) || !methodMatchesAliases(rel.label, changeAliases)) return false;
          sawStateChange = true;
          var call = methodCallFromLabel(rel.label);
          return !!call && call.args.some(function (arg) {
            return argumentMatchesParticipant(arg, nextState);
          });
        });
        if (hasMatchingArgument) return { pass: true };
      }
    }
    return failResult('Expected the state-change call to pass the object that receives the next turn call as an argument' + (expectedTargets.length ? ' (for example, ' + expectedTargets.join(' or ') + ').' : '.'), sawStateChange ? assertionNamingHint(assertion) : null);
  }

  function assertSequenceCallLabelsHaveArgumentLists(model, assertion) {
    var invalid = [];
    model.relations.forEach(function (rel) {
      if (isSequenceReturnRelation(rel)) return;
      var call = methodCallFromLabel(rel.label);
      if (!call) invalid.push(sequenceRelationDescription(rel));
    });
    return invalid.length
      ? failResult('Expected every non-return sequence message to be labeled as methodName(arguments) without a receiver prefix. Invalid messages: ' + invalid.join(', ') + '.', assertionNamingHint(assertion))
      : { pass: true };
  }

  function assertSequenceCalledMethodsExist(model, context, assertion) {
    var classModel = context && typeof context.modelForType === 'function' ? context.modelForType('class') : { elements: [], members: [], relations: [] };
    var participants = sequenceParticipants(model);
    var failures = [];
    model.relations.forEach(function (rel) {
      if (isSequenceReturnRelation(rel)) return;
      var methodName = methodNameFromLabel(rel.label);
      if (!methodName) return;
      var receiver = participantForEndpoint(participants, rel.to);
      if (!receiver) {
        failures.push('receiver "' + rel.to + '" is not shown as an object');
        return;
      }
      if (!classModelHasMethod(classModel, receiver.className, methodName)) {
        failures.push(receiver.className + '.' + methodName);
      }
    });
    return failures.length
      ? failResult('Expected sequence calls to exist in the class diagram: ' + failures.join(', ') + '.', assertionNamingHint(assertion))
      : { pass: true };
  }

  function isSequenceReturnRelation(rel) {
    var op = String(rel && rel.op || '').trim();
    return op === '-->' || op === '<--';
  }

  function assertClassConsistency(model, assertion) {
    var check = normalize(assertion.check || assertion.rule || assertion.name);
    if (check === 'abstractmethodsimplemented') {
      return assertAbstractMethodsImplemented(model, assertion);
    }
    return { pass: false, message: 'Unknown class consistency check: ' + (assertion.check || assertion.rule || assertion.name || '') };
  }

  function assertAbstractMethodsImplemented(model, assertion) {
    var missing = [];
    var namingCandidateExists = false;
    model.elements.forEach(function (abstraction) {
      if (!isAbstractElement(abstraction)) return;
      var abstractMethods = abstractMethodNamesForElement(model, abstraction);
      if (!abstractMethods.length) return;
      concreteDescendantsOf(model, abstraction).forEach(function (concrete) {
        abstractMethods.forEach(function (methodName) {
          if (classHasConcreteMethod(model, concrete, methodName, {})) return;
          missing.push(concrete.id + '.' + methodName);
          if (classHasAnyDirectMethod(model, concrete)) namingCandidateExists = true;
        });
      });
    });
    return missing.length
      ? failResult('Expected concrete subclasses to implement abstract methods: ' + missing.join(', ') + '.', namingCandidateExists ? assertionNamingHint(assertion) : null)
      : { pass: true };
  }

  function endpointsMatch(actualFrom, actualTo, expectedFrom, expectedTo, expectedFromContains, expectedToContains, expectedFromExact, expectedToExact) {
    return endpointMatches(actualFrom, expectedFrom, expectedFromContains, expectedFromExact) &&
      endpointMatches(actualTo, expectedTo, expectedToContains, expectedToExact);
  }

  function endpointMatches(actual, expected, contains, exactValues) {
    return valueMatches(actual, expected, contains) && (!exactValues || !exactValues.length || exactValueMatches(actual, exactValues));
  }

  function valueMatches(actualValues, expected, contains, allowSubstringExpected) {
    var actualList = Array.isArray(actualValues) ? actualValues : [actualValues];
    var containsList = Array.isArray(contains) ? contains : [];
    if (!expected && !containsList.length) return true;
    return actualList.some(function (actual) {
      var normalizedActual = normalize(actual);
      if (!normalizedActual) return false;
      if (expected) {
        var normalizedExpected = normalize(expected);
        if (allowSubstringExpected ? normalizedActual.indexOf(normalizedExpected) !== -1 : normalizedActual === normalizedExpected) return true;
      }
      return containsList.some(function (token) {
        var normalizedToken = normalize(token);
        return normalizedToken && normalizedActual.indexOf(normalizedToken) !== -1;
      });
    });
  }

  function exactValueMatches(actualValues, expectedValues) {
    var actualList = Array.isArray(actualValues) ? actualValues : [actualValues];
    var expectedList = Array.isArray(expectedValues) ? expectedValues : [expectedValues];
    return actualList.some(function (actual) {
      var normalizedActual = normalize(actual);
      return normalizedActual && expectedList.some(function (expected) {
        return normalizedActual === normalize(expected);
      });
    });
  }

  function assertStateForClassRole(model, assertion, context, role) {
    var expectedNames = classRoleValues(context, role);
    if (!expectedNames.length) {
      return { pass: false, message: 'Expected class diagram to define a "' + role + '" state class.' };
    }
    var found = stateNameValues(model).some(function (name) {
      return exactValueMatches(name, expectedNames);
    });
    var namingCandidateExists = stateNameValues(model).length > 0;
    return found
      ? { pass: true }
      : failResult('Expected state matching the class-diagram "' + role + '" state name (' + expectedNames.join(' or ') + ').', namingCandidateExists ? assertionNamingHint(assertion) : null);
  }

  function stateNameValues(model) {
    var values = [];
    model.elements.forEach(function (el) {
      if (normalize(el.type) === 'state') {
        values.push(el.id);
        values.push(el.label);
      }
    });
    model.relations.forEach(function (rel) {
      values.push(rel.from);
      values.push(rel.to);
    });
    return uniqueValues(values);
  }

  function classRoleValues(context, role) {
    var el = classRoleElement(context, role);
    return el ? uniqueValues([el.id, el.label]) : [];
  }

  function classRoleElement(context, role) {
    if (!role || !context || typeof context.modelForType !== 'function') return null;
    var classModel = context.modelForType('class');
    var tokens = roleTokens(role);
    if (!tokens.length) return null;
    return classModel.elements.find(function (el) {
      if (normalize(el.type).indexOf('class') === -1) return false;
      return tokens.some(function (token) {
        return normalize(el.id).indexOf(token) !== -1 || normalize(el.label).indexOf(token) !== -1;
      });
    }) || null;
  }

  function roleTokens(role) {
    var normalizedRole = normalize(role);
    if (normalizedRole === 'normal') return ['normal'];
    if (normalizedRole === 'jail' || normalizedRole === 'prison' || normalizedRole === 'injail') return ['jail', 'prison'];
    if (normalizedRole === 'bankrupt' || normalizedRole === 'bankruptcy') return ['bankrupt'];
    return normalizedRole ? [normalizedRole] : [];
  }

  function uniqueValues(values) {
    var seen = {};
    var result = [];
    values.forEach(function (value) {
      value = cleanId(value);
      var key = normalize(value);
      if (!key || seen[key]) return;
      seen[key] = true;
      result.push(value);
    });
    return result;
  }

  function numericValue(value) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function sequenceParticipants(model) {
    var participants = [];
    var byId = {};
    model.elements.forEach(function (el) {
      if (!isSequenceParticipantType(el.type)) return;
      var participant = {
        id: cleanId(el.id),
        label: cleanId(el.label || el.id),
        className: cleanId(el.label || el.id),
        implicit: false
      };
      participants.push(participant);
      byId[normalize(participant.id)] = participant;
    });
    model.relations.forEach(function (rel) {
      [rel.from, rel.to].forEach(function (endpoint) {
        var key = normalize(endpoint);
        if (!key || byId[key]) return;
        var participant = {
          id: cleanId(endpoint),
          label: cleanId(endpoint),
          className: cleanId(endpoint),
          implicit: true
        };
        participants.push(participant);
        byId[key] = participant;
      });
    });
    return participants;
  }

  function isSequenceParticipantType(type) {
    return ['actor', 'participant', 'boundary', 'control', 'entity', 'database'].indexOf(normalize(type)) !== -1;
  }

  function sequencePlayerParticipants(model) {
    return sequenceParticipants(model).filter(function (participant) {
      return exactValueMatches([participant.className, participant.label], ['Player']) ||
        (normalize(participant.id).indexOf('player') !== -1 && normalize(participant.className).indexOf('state') === -1);
    });
  }

  function sequenceStateParticipants(model, context) {
    var classNames = []
      .concat(classRoleValues(context, 'normal'))
      .concat(classRoleValues(context, 'jail'))
      .concat(classRoleValues(context, 'bankrupt'));
    return sequenceParticipants(model).filter(function (participant) {
      return exactValueMatches([participant.className, participant.label, participant.id], classNames);
    });
  }

  function relationBetweenParticipants(rel, left, right) {
    return (participantMatchesEndpoint(rel.from, left) && participantMatchesEndpoint(rel.to, right)) ||
      (participantMatchesEndpoint(rel.from, right) && participantMatchesEndpoint(rel.to, left));
  }

  function participantMatchesEndpoint(endpoint, participant) {
    return !!participant && exactValueMatches(endpoint, [participant.id, participant.label, participant.className]);
  }

  function participantForEndpoint(participants, endpoint) {
    return participants.find(function (participant) {
      return participantMatchesEndpoint(endpoint, participant);
    }) || null;
  }

  function argumentMatchesParticipant(argument, participant) {
    return exactValueMatches(cleanArgument(argument), [participant.id, participant.label, participant.className]);
  }

  function cleanArgument(argument) {
    return String(argument || '').trim();
  }

  function methodMatchesAliases(label, aliases) {
    var methodName = methodNameFromLabel(label);
    return !!methodName && toArray(aliases).some(function (alias) {
      return normalize(methodName) === normalize(alias);
    });
  }

  function methodNameFromLabel(label) {
    var call = methodCallFromLabel(label);
    return call ? call.name : '';
  }

  function methodCallFromLabel(label) {
    var text = String(label || '').trim();
    if (!text) return null;
    var match = text.match(/^([A-Za-z_]\w*)\s*\((.*)\)\s*$/);
    if (!match) return null;
    return {
      name: match[1],
      args: splitArgumentList(match[2])
    };
  }

  function methodNameFromMember(text) {
    var signature = methodSignatureFromMember(text);
    return signature ? signature.name : '';
  }

  function methodSignatureFromMember(text) {
    text = String(text || '').replace(/\{[^}]*\}/g, ' ').replace(/^[+\-#~]\s*/, '').trim();
    var match = text.match(/^([A-Za-z_]\w*)\s*\((.*)\)/);
    if (!match) return null;
    return {
      name: match[1],
      args: splitArgumentList(match[2])
    };
  }

  function splitArgumentList(text) {
    text = String(text || '').trim();
    if (!text) return [];
    return text.split(',').map(function (arg) { return arg.trim(); }).filter(Boolean);
  }

  function sequenceRelationDescription(rel) {
    var label = String(rel.label || '').trim();
    return cleanId(rel.from) + ' -> ' + cleanId(rel.to) + (label ? ' : ' + label : ' : unlabeled');
  }

  function assertionRequiresArgumentList(assertion) {
    return assertion.requires_arguments === true ||
      assertion.requiresArguments === true ||
      assertion.require_arguments === true ||
      assertion.requireArguments === true ||
      assertion.is_operation === true ||
      assertion.isOperation === true;
  }

  function classModelHasMethod(classModel, className, methodName) {
    return classMethodNamesForType(classModel, className, {}).some(function (candidate) {
      return normalize(candidate) === normalize(methodName);
    });
  }

  function classMethodNamesForType(classModel, className, visited) {
    var element = classElementForName(classModel, className);
    if (!element) return [];
    var key = normalize(element.id);
    if (visited[key]) return [];
    visited[key] = true;
    var names = classModel.members
      .filter(function (member) {
        return exactValueMatches(member.owner, [element.id, element.label]);
      })
      .map(function (member) { return methodNameFromMember(member.text); })
      .filter(Boolean);
    classParentTypes(classModel, element).forEach(function (parentName) {
      names = names.concat(classMethodNamesForType(classModel, parentName, visited));
    });
    return uniqueValues(names);
  }

  function classElementForName(classModel, className) {
    return classModel.elements.find(function (el) {
      return exactValueMatches([el.id, el.label], [className]);
    }) || null;
  }

  function classParentTypes(classModel, element) {
    var parents = [];
    classModel.relations.forEach(function (rel) {
      semanticRelationEndpoints(rel).forEach(function (edge) {
        if (exactValueMatches(edge.from, [element.id, element.label]) &&
            (relationSemanticType(rel) === 'generalization' || relationSemanticType(rel) === 'realization')) {
          parents.push(edge.to);
        }
      });
    });
    return uniqueValues(parents);
  }

  function classParentElements(classModel, element) {
    return classParentTypes(classModel, element).map(function (parentName) {
      return classElementForName(classModel, parentName);
    }).filter(Boolean);
  }

  function typeMatchesAny(actualType, expectedTypes) {
    if (!expectedTypes.length) return true;
    return expectedTypes.some(function (expectedType) {
      var actual = normalize(actualType);
      var expected = normalize(expectedType);
      return !expected || expected === 'element' || actual === expected || (expected === 'class' && actual.indexOf('class') !== -1);
    });
  }

  function memberIsAbstract(member, model) {
    if (/\{abstract\}|\babstract\b/i.test(member.text)) return true;
    return model.elements.some(function (el) {
      var ownerMatches = exactValueMatches(member.owner, [el.id, el.label]);
      var type = normalize(el.type);
      return ownerMatches && (type === 'interface' || type === 'abstractclass');
    });
  }

  function isAbstractElement(element) {
    var type = normalize(element && element.type);
    return type === 'interface' || type === 'abstractclass';
  }

  function isConcreteClassElement(element) {
    return normalize(element && element.type) === 'class';
  }

  function abstractMethodNamesForElement(model, element) {
    var names = model.members.filter(function (member) {
      return exactValueMatches(member.owner, [element.id, element.label]) && memberIsAbstract(member, model);
    }).map(function (member) {
      return methodNameFromMember(member.text);
    }).filter(Boolean);
    return uniqueValues(names);
  }

  function concreteDescendantsOf(model, abstraction) {
    return model.elements.filter(function (candidate) {
      return isConcreteClassElement(candidate) && classInheritsFrom(model, candidate, abstraction, {});
    });
  }

  function classInheritsFrom(model, child, ancestor, visited) {
    var key = normalize(child && child.id);
    if (!key || visited[key]) return false;
    visited[key] = true;
    return classParentElements(model, child).some(function (parent) {
      return exactValueMatches([parent.id, parent.label], [ancestor.id, ancestor.label]) ||
        classInheritsFrom(model, parent, ancestor, visited);
    });
  }

  function classHasAnyDirectMethod(model, element) {
    return model.members.some(function (member) {
      return exactValueMatches(member.owner, [element.id, element.label]) && !!methodNameFromMember(member.text);
    });
  }

  function classHasConcreteMethod(model, element, methodName, visited) {
    var key = normalize(element && element.id);
    if (!key || visited[key]) return false;
    visited[key] = true;
    var direct = model.members.some(function (member) {
      return exactValueMatches(member.owner, [element.id, element.label]) &&
        normalize(methodNameFromMember(member.text)) === normalize(methodName) &&
        !memberIsAbstract(member, model);
    });
    if (direct) return true;
    return classParentElements(model, element).some(function (parent) {
      return !isAbstractElement(parent) && classHasConcreteMethod(model, parent, methodName, visited);
    });
  }

  function containsValues(assertion, field) {
    var snake = field + '_contains';
    var snakeAny = field + '_contains_any';
    var camel = field + 'Contains';
    var camelAny = field + 'ContainsAny';
    return []
      .concat(toArray(assertion[snake]))
      .concat(toArray(assertion[snakeAny]))
      .concat(toArray(assertion[camel]))
      .concat(toArray(assertion[camelAny]));
  }

  function relationTypeValues(assertion) {
    return []
      .concat(toArray(assertion.relation_type))
      .concat(toArray(assertion.relation_types))
      .concat(toArray(assertion.relation_type_any))
      .concat(toArray(assertion.relationType))
      .concat(toArray(assertion.relationTypes))
      .concat(toArray(assertion.relationTypeAny));
  }

  function argumentTypeValues(assertion) {
    return []
      .concat(toArray(assertion.argument_type))
      .concat(toArray(assertion.argument_types))
      .concat(toArray(assertion.argument_type_any))
      .concat(toArray(assertion.argumentType))
      .concat(toArray(assertion.argumentTypes))
      .concat(toArray(assertion.argumentTypeAny));
  }

  function multiplicityValues(assertion, side) {
    var snake = side + '_multiplicity';
    var snakePlural = side + '_multiplicities';
    var snakeAny = side + '_multiplicity_any';
    var camel = side + 'Multiplicity';
    var camelPlural = side + 'Multiplicities';
    var camelAny = side + 'MultiplicityAny';
    return []
      .concat(toArray(assertion[snake]))
      .concat(toArray(assertion[snakePlural]))
      .concat(toArray(assertion[snakeAny]))
      .concat(toArray(assertion[camel]))
      .concat(toArray(assertion[camelPlural]))
      .concat(toArray(assertion[camelAny]));
  }

  function elementTypeValues(assertion) {
    return []
      .concat(toArray(assertion.element_type_any))
      .concat(toArray(assertion.element_types))
      .concat(toArray(assertion.elementTypeAny))
      .concat(toArray(assertion.elementTypes));
  }

  function conditionalRelationTypes(model, assertion, to, toContains) {
    var byTarget = assertion.relation_type_for_target_type || assertion.relationTypeForTargetType;
    if (!byTarget || typeof byTarget !== 'object') return [];
    var matchingTarget = model.elements.find(function (el) {
      return valueMatches([el.id, el.label], to, toContains);
    });
    if (!matchingTarget) return ['__missing_target_type__'];
    var expected = [];
    Object.keys(byTarget).forEach(function (targetType) {
      if (normalize(matchingTarget.type) === normalize(targetType)) {
        expected = expected.concat(toArray(byTarget[targetType]));
      }
    });
    return expected.length ? expected : ['__unexpected_target_type__'];
  }

  function toArray(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }

  function methodSignatureHasArgumentType(signature, expectedTypes) {
    if (!signature || !signature.args || !signature.args.length) return false;
    return signature.args.some(function (arg) {
      return argumentTypeCandidates(arg).some(function (candidate) {
        return exactValueMatches(candidate, expectedTypes);
      });
    });
  }

  function argumentTypeCandidates(argument) {
    var text = String(argument || '').replace(/=.*/, '').trim();
    if (!text) return [];
    var candidates = [];
    if (text.indexOf(':') !== -1) candidates.push(text.split(':').slice(1).join(':').trim());
    var tokens = text.split(/\s+/).filter(Boolean).filter(function (token) {
      return !/^(final|const|readonly|var|let)$/i.test(token);
    });
    if (tokens.length === 1) candidates.push(tokens[0]);
    if (tokens.length > 1) candidates.push(tokens[0]);
    return uniqueValues(candidates.map(function (candidate) {
      return String(candidate || '').replace(/[?;,]+$/g, '').replace(/\[\]$/g, '').trim();
    }));
  }

  function relationEdgeMultiplicityMatches(rel, edge, sourceMultiplicity, targetMultiplicity) {
    var mult = relationMultiplicitiesForEdge(rel, edge);
    return (!sourceMultiplicity.length || exactValueMatches(mult.source, sourceMultiplicity)) &&
      (!targetMultiplicity.length || exactValueMatches(mult.target, targetMultiplicity));
  }

  function relationMultiplicitiesForEdge(rel, edge) {
    if (exactValueMatches(edge.from, [rel.from]) && exactValueMatches(edge.to, [rel.to])) {
      return { source: rel.sourceMult || '', target: rel.targetMult || '' };
    }
    if (exactValueMatches(edge.from, [rel.to]) && exactValueMatches(edge.to, [rel.from])) {
      return { source: rel.targetMult || '', target: rel.sourceMult || '' };
    }
    return { source: '', target: '' };
  }

  function describeExpectedValue(expected, contains, exactValues) {
    var exactList = Array.isArray(exactValues) ? exactValues.filter(function (item) { return item != null && String(item).trim(); }) : [];
    var containsList = Array.isArray(contains) ? contains.filter(function (item) { return item != null && String(item).trim(); }) : [];
    if (expected) return '"' + expected + '"';
    if (exactList.length) return 'matching ' + exactList.map(function (item) { return '"' + item + '"'; }).join(' or ');
    if (!containsList.length) return 'any value';
    return 'matching ' + containsList.map(function (item) { return '"' + item + '"'; }).join(' or ');
  }

  function semanticRelationEndpoints(rel) {
    var op = rel.op || '';
    var edges = [];
    // UML generalization / realization arrows point at the abstraction. Accept
    // both textual forms:
    //   Concrete --|> Abstraction
    //   Abstraction <|-- Concrete
    if (/\|>/.test(op)) edges.push({ from: rel.from, to: rel.to });
    if (/<\|/.test(op)) edges.push({ from: rel.to, to: rel.from });
    // UML composition / aggregation diamonds sit at the owner/whole end.
    // Normalize both spellings to owner -> part:
    //   Whole o-- Part
    //   Part --o Whole
    if (/^[o*]/.test(op)) edges.push({ from: rel.from, to: rel.to });
    if (/[o*]$/.test(op)) edges.push({ from: rel.to, to: rel.from });
    return edges;
  }

  function relationSemanticType(rel) {
    var op = rel.op || '';
    if (/\*/.test(op)) return 'composition';
    if (/o/.test(op)) return 'aggregation';
    if ((/\|>/.test(op) || /<\|/.test(op)) && /\./.test(op)) return 'realization';
    if (/\|>/.test(op) || /<\|/.test(op)) return 'generalization';
    if (/\.\.>/.test(op)) return 'dependency';
    if (/--?>/.test(op) || /<--?/.test(op) || /--/.test(op)) return 'association';
    return 'relation';
  }

  window.UMLTutorialEditor = UMLTutorialEditor;
})();

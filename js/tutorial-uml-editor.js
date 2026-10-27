(function () {
  'use strict';

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
        window.SebookConfirmation.confirm({
          title: 'Reset the current diagram?',
          message: 'This will discard your edits for this diagram type.',
          confirmLabel: 'Reset diagram',
          trigger: resetBtn
        }).then(function (confirmed) {
          if (confirmed) self.resetCurrentDiagram();
        });
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
      btn.setAttribute('data-original-title', unlocked ? (step.title || 'Step') : (step.title || 'Step') + ' (locked)');
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
      ? '<button class="tvm-btn tvm-btn-prev" data-original-title="Previous step">&larr; Previous</button>'
      : '<span></span>';
    html += '<span class="tvm-step-actions">' +
      '<button class="tvm-btn tvm-btn-clear-model" data-original-title="Remove all UML elements from this step" type="button">Remove All Elements</button>';
    html += this._stepHasTests(step) ? this._buildTestButtonHTML(index) : '';
    html += '</span>';
    html += index < this.steps.length - 1
      ? '<button class="tvm-btn tvm-btn-next"' + (nextLocked ? ' disabled data-original-title="Pass all tests to continue"' : ' data-original-title="Next step"') + '>Next &rarr;</button>'
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
      return '<button class="tvm-btn tvm-btn-test" data-original-title="Check the UML diagram for this step">&#10003; Test My Work</button>';
    }
    var label = '⏱ Test My Work (' + this._formatCooldown(remaining) + ')';
    var aria = 'Test My Work locked, ' + remaining + ' second' + (remaining === 1 ? '' : 's') + ' remaining';
    var html = '<span class="tvm-test-btn-group">';
    html += '<button class="tvm-btn tvm-btn-test tvm-btn-test-cooldown" disabled aria-label="' + aria + '">' + label + '</button>';
    html += '<button class="tvm-btn tvm-btn-test-sure" data-original-title="Run tests now without seeing results — passes still unlock Next">I’m sure</button>';
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
      // step.instructionsHTML / step.instructions is trusted authored tutorial
      // content (same trust level as the page itself), so it is intentionally
      // injected as HTML. Do NOT "harden" this by escaping it — that would
      // break authored markup. Only untrusted values (title, type labels) are
      // run through escapeHtml.
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
      preview.setAttribute('role', 'group');
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
    if (window.UMLEditor && typeof window.UMLEditor.resetCurrentDiagram === 'function') {
      window.UMLEditor.resetCurrentDiagram({ confirm: false });
    } else if (reset) {
      reset.click();
    }
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

  UMLTutorialEditor.prototype.openClearStepDialog = function (trigger) {
    var self = this;
    return window.SebookConfirmation.confirm({
      title: 'Remove all UML elements from this step?',
      message: 'This clears the current step diagram and keeps diagrams from other steps saved.',
      confirmLabel: 'Remove Elements',
      trigger: trigger
    }).then(function (confirmed) {
      if (confirmed) self.clearCurrentStepDiagram();
    });
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
      // Keep results at the criterion level; targeted guidance lives in Hints.
      html += '<span class="tvm-test-desc">' + escapeHtml(test.description || 'UML check') + '</span>';
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
    var currentType = step.uml_type || (this.typeEl && this.typeEl.value) || 'class';
    var model = parseArchUml(this.currentSource(), currentType);
    var self = this;
    var parsedModels = {};
    var context = {
      currentType: currentType,
      modelForType: function (type) {
        type = type || currentType;
        if (type === currentType) return model;
        if (!parsedModels[type]) parsedModels[type] = parseArchUml(self.sourceForDiagramType(type), type);
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
        var result;
        try {
          result = evaluateAssertion(model, assertion, context);
        } catch (err) {
          // A malformed authored assertion must not abort the whole run and
          // strand the learner on a step they can never pass — treat the
          // error as a failed check with a diagnostic message instead.
          result = { pass: false, message: 'This check could not be evaluated (' + (err && err.message ? err.message : err) + ').' };
        }
        if (!result || !result.pass) {
          failures.push((result && result.message) || 'Check failed.');
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
      container.setAttribute('role', 'img');
      window.UMLShared.autoFitSVG(container);
      window.UMLShared.applySvgAccessibility(container, type, source);
      container.setAttribute('data-uml-rendered', 'true');
    } catch (error) {
      container.innerHTML = '<p class="tvm-previous-diagram-placeholder">This saved ' + escapeHtml(umlTypeLabel(type).toLowerCase()) + ' could not be rendered.</p>';
    }
  }

  // Adapt the renderer's public model rather than interpreting source a second time.
  function parseArchUml(source, type) {
    var model = { elements: [], members: [], relations: [], events: [] };
    var renderer = window[UML_RENDERER_GLOBALS[type]];
    if (!renderer || typeof renderer.parse !== 'function') {
      model.parseError = 'The UML parser is unavailable. Reload the page before checking your work.';
      return model;
    }
    if (['class', 'state', 'sequence'].indexOf(type) === -1) return parseOtherArchUml(source);
    try {
      var parsed = renderer.parse(source);
      if (type === 'class') {
        parsed.classes.forEach(function (cls) {
          addElement(model, cls.type === 'abstract' ? 'abstract class' : cls.type, cls.name, cls.name);
          cls.attributes.concat(cls.methods).forEach(function (member) {
            model.members.push({ owner: cls.name, text: member.text, declaredAbstract: member.isAbstract, isStatic: member.isStatic });
          });
        });
        model.relations = parsed.relationships.map(function (rel) {
          return { from: rel.from, to: rel.to, semanticType: rel.type, sourceMult: rel.fromMult, targetMult: rel.toMult, label: rel.label };
        });
      } else if (type === 'state') {
        parsed.states.forEach(function (state) { addElement(model, 'state', state.name, state.name); });
        model.relations = parsed.transitions.map(function (rel) { return { from: rel.from, to: rel.to, op: '-->', label: rel.label }; });
      } else {
        parsed.participants.forEach(function (participant) {
          addElement(model, 'participant', participant.id, participant.label.replace(/^:\s*/, ''));
        });
        model.events = parsed.messages;
        model.relations = parsed.messages.filter(function (event) { return event.type === 'message'; }).map(function (event) {
          return Object.assign({}, event, { op: event.msgType === 'response' ? '-->' : '->' });
        });
      }
    } catch (error) {
      model.parseError = 'The diagram could not be parsed: ' + error.message;
    }
    return model;
  }

  function parseOtherArchUml(source) {
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
    if (model.parseError) return { pass: false, message: model.parseError };
    var kind = assertion.kind || assertion.type || 'element';
    if (kind === 'element' || kind === 'state' || kind === 'participant' || kind === 'class') {
      return assertElement(model, assertion, kind, context);
    }
    if (kind === 'member') return assertMember(model, assertion);
    if (kind === 'relation' || kind === 'transition' || kind === 'message') return assertRelation(model, assertion, kind, context);
    if (kind === 'sequence' || kind === 'sequence_consistency') return assertSequence(model, assertion, context);
    if (kind === 'class_consistency' || kind === 'classConsistency') return assertClassConsistency(model, assertion);
    if (kind === 'state_consistency') return assertTransitionLabels(model);
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
        valueMatches(requiresArguments && signature ? signature.name : member.text, text, textContains, true) &&
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

  function assertSequenceMessagesBetweenPlayerAndStates(model, context) {
    var analysis = sequenceAnalysis(model, context);
    return analysis.witness && !analysis.errors.length
      ? { pass: true }
      : { pass: false, message: 'Show a coherent path where Player calls two different concrete state types with a state-changing call between them.' };
  }

  function assertSequenceStateChangeBetweenStateCalls(model, context) {
    return assertSequenceMessagesBetweenPlayerAndStates(model, context);
  }

  function assertSequenceStateChangeArgumentIsNextState(model, context, assertion) {
    var analysis = sequenceAnalysis(model, context);
    return analysis.errors.length ? failResult(analysis.errors.join(' '), assertionNamingHint(assertion))
      : analysis.witness ? { pass: true }
      : { pass: false, message: 'Pass the next state lifeline to the state-changing operation between turn calls.' };
  }

  // A fragment is a control-flow choice, not a flat list of messages. Keep the
  // finite state (current object, last turn and witness) rather than enumerate
  // exponentially many complete traces. Loops are checked to a fixed point.
  function sequenceTree(events) {
    var root = [], stack = [{ kind: 'root', operands: [root] }], errors = [];
    events.forEach(function (event) {
      var top = stack[stack.length - 1];
      if (event.type === 'fragment_start') {
        var fragment = { kind: event.fragType, condition: event.condition || '', guards: [event.condition || ''], operands: [[]] };
        top.operands[top.operands.length - 1].push(fragment); stack.push(fragment);
      } else if (event.type === 'fragment_else') {
        if (stack.length === 1 || ['alt', 'par'].indexOf(top.kind) === -1) errors.push('An else operand needs an alt or par fragment.');
        else { top.operands.push([]); top.guards.push(event.condition || ''); }
      } else if (event.type === 'fragment_end') {
        if (stack.length === 1) errors.push('A fragment end has no matching start.'); else stack.pop();
      } else if (event.type === 'message' && event.msgType !== 'response') {
        top.operands[top.operands.length - 1].push(event);
      }
    });
    if (stack.length !== 1) errors.push('Close each sequence fragment before checking the interaction.');
    return { nodes: root, errors: errors };
  }

  function uniqueTraceStates(states) {
    var seen = new Set();
    return states.filter(function (state) {
      var key = JSON.stringify(state);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }

  function resumeTraceStates(states) {
    return states.map(function (state) {
      if (!state.ended) return state;
      var resumed = Object.assign({}, state); delete resumed.ended; return resumed;
    });
  }

  function evaluateSequenceNodes(nodes, states, advance, errors) {
    nodes.forEach(function (node) {
      // Break skips the remainder of this operand. Its caller resumes execution
      // outside the enclosing fragment, rather than ending the whole diagram.
      var ended = states.filter(function (state) { return state.ended; });
      states = states.filter(function (state) { return !state.ended; });
      if (node.type === 'message') {
        states = states.map(function (state) { return advance(state, node); });
      } else if (node.kind === 'alt') {
        var exhaustive = node.guards.some(function (guard) { return !guard || /^(else|true)$/i.test(guard.trim()); });
        states = resumeTraceStates(node.operands.reduce(function (all, operand) {
          return all.concat(evaluateSequenceNodes(operand, states, advance, errors));
        }, exhaustive ? [] : states));
      } else if (node.kind === 'opt' || node.kind === 'break') {
        var optional = resumeTraceStates(evaluateSequenceNodes(node.operands[0], states, advance, errors));
        if (node.kind === 'break') optional = optional.map(function (state) { return Object.assign({}, state, { ended: true }); });
        states = states.concat(optional);
      } else if (node.kind === 'loop') {
        states = evaluateSequenceLoop(node, states, advance, errors);
      } else if (node.kind === 'critical') {
        states = resumeTraceStates(evaluateSequenceNodes(node.operands[0], states, advance, errors));
      } else {
        errors.push('Automatic ordering checks cannot certify ' + node.kind + ' fragments; use a supported path or request manual review.');
      }
      states = uniqueTraceStates(ended.concat(states));
    });
    return states;
  }

  function evaluateSequenceLoop(node, states, advance, errors) {
    var bounds = node.condition.match(/^\(\s*(\d+)\s*(?:,\s*(\d+|\*)\s*)?\)/);
    var min = bounds ? Number(bounds[1]) : 0;
    var max = bounds ? (bounds[2] === '*' ? Infinity : Number(bounds[2] || bounds[1])) : Infinity;
    if (!Number.isSafeInteger(min) || (max !== Infinity && !Number.isSafeInteger(max)) || max < min || (!bounds && /^\(/.test(node.condition))) {
      errors.push('Automatic loop checks need nonnegative numeric bounds, such as (1, 3), or manual review.');
      return states;
    }
    var exits = [], iteration = 0, layers = new Map();
    while (states.length) {
      if (iteration >= min) exits = uniqueTraceStates(exits.concat(states));
      if (iteration === max) break;
      var key = states.map(function (state) { return JSON.stringify(state); }).sort().join('\n');
      var previous = layers.get(key);
      if (previous !== undefined) {
        if (previous >= min) break; // All exits in the repeated cycle were checked.
        var period = iteration - previous;
        // A large minimum need not repeat an already checked abstract cycle.
        if (iteration < min) iteration += Math.floor((min - iteration) / period) * period;
        if (iteration >= min) {
          exits = uniqueTraceStates(exits.concat(states));
          if (iteration === max) break;
        }
      }
      layers.set(key, iteration);
      var next = evaluateSequenceNodes(node.operands[0], states, advance, errors);
      exits = uniqueTraceStates(exits.concat(resumeTraceStates(next.filter(function (state) { return state.ended; }))));
      states = next.filter(function (state) { return !state.ended; });
      iteration++;
    }
    return exits;
  }

  function sequenceAnalysis(model, context) {
    if (context.sequenceAnalysis) return context.sequenceAnalysis;
    var classModel = context.modelForType('class');
    var stateModel = context.modelForType('state');
    var states = sequenceStateParticipants(model, context);
    var players = sequencePlayerParticipants(model);
    var turns = turnOperations(classModel).map(function (member) { return methodNameFromMember(member.text); });
    var changes = stateChangeOperations(classModel);
    var tree = sequenceTree(model.events);
    var analysis = { errors: tree.errors.slice(), witness: false };
    var stateNames = stateNameValues(stateModel);
    if (stateModel.parseError) analysis.errors.push(stateModel.parseError);
    players.forEach(function (player) {
      var result = evaluateSequenceNodes(tree.nodes, [{ last: '', current: '', changed: false, witness: false }], function (trace, message) {
        return advancePlayerTrace(trace, message, { player: player, states: states, turns: turns, changes: changes, classModel: classModel, stateModel: stateModel, stateNames: stateNames, participants: sequenceParticipants(model) }, analysis.errors);
      }, analysis.errors);
      if (result.some(function (trace) { return trace.witness; })) analysis.witness = true;
    });
    analysis.errors = uniqueValues(analysis.errors);
    context.sequenceAnalysis = analysis;
    return analysis;
  }

  function advancePlayerTrace(trace, message, design, errors) {
    var call = methodCallFromLabel(message.label);
    if (!call) return trace;
    var receiver = design.states.find(function (state) { return participantMatchesEndpoint(message.to, state); });
    var isTurn = participantMatchesEndpoint(message.from, design.player) && receiver && design.turns.some(function (name) { return name === call.name; });
    var change = design.changes.find(function (member) { return operationAcceptsCall(design.classModel, member, call, design.participants); });
    if (!isTurn && !(change && participantMatchesEndpoint(message.to, design.player))) return trace;
    var next = Object.assign({}, trace);
    if (isTurn) {
      if (!exactValueMatches(receiver.className, design.stateNames)) errors.push('State ' + receiver.className + ' is missing from the state diagram.');
      if (trace.current && trace.current !== receiver.id) errors.push('The next turn must use the assigned state object ' + trace.current + ', not ' + receiver.id + '.');
      var last = design.states.find(function (state) { return state.id === trace.last; });
      next.witness = trace.witness || !!(last && last.className !== receiver.className && trace.changed);
      next.last = next.current = receiver.id; next.changed = false;
      return next;
    }
    var signature = methodSignatureFromMember(change.text);
    var abstraction = stateAbstraction(design.classModel);
    var parameterIndex = signature.parameters.filter(function (param) { return param.direction !== 'out'; }).findIndex(function (param) { return param.direction !== 'out' && exactValueMatches(param.type, [abstraction.id]); });
    var target = design.states.find(function (state) { return cleanArgument(call.args[parameterIndex]) === state.id; });
    if (!target) { errors.push('The state-changing call must pass the next state object lifeline as its state argument.'); return next; }
    if (!exactValueMatches(target.className, design.stateNames)) errors.push('State ' + target.className + ' is missing from the state diagram.');
    var current = design.states.find(function (state) { return state.id === trace.current; });
    if (current && current.id !== target.id && !design.stateModel.relations.some(function (edge) {
      return exactValueMatches(edge.from, [current.className]) && exactValueMatches(edge.to, [target.className]);
    })) errors.push('The state diagram needs the illustrated transition from ' + current.className + ' to ' + target.className + '.');
    next.current = target.id; next.changed = true;
    return next;
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
      if (!classModelHasCall(classModel, receiver.className, methodCallFromLabel(rel.label), participants)) {
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
    if (check === 'stateroles') return assertStateRoles(model);
    if (check === 'stateoperations') return assertStateOperations(model);
    if (check === 'stateownership') return assertStateOwnership(model);
    if (check === 'stateinheritance') return assertStateInheritance(model);
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
      var abstractMethods = abstractOperationsForElement(model, abstraction);
      if (!abstractMethods.length) return;
      concreteDescendantsOf(model, abstraction).forEach(function (concrete) {
        abstractMethods.forEach(function (operation) {
          if (classHasConcreteMethod(model, concrete, operation, {})) return;
          missing.push(concrete.id + '.' + methodNameFromMember(operation.text) + ' with signature ' + operation.text);
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
      var normalizedActual = cleanId(actual);
      return normalizedActual && expectedList.some(function (expected) {
        return normalizedActual === cleanId(expected);
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
    if (!role || !context) return null;
    return stateRoles(context.modelForType('class'))[role] || null;
  }

  function stateAbstraction(model) {
    var player = classElementForName(model, 'Player');
    if (!player) return null;
    var candidates = model.elements.filter(isAbstractElement).filter(function (element) {
      return model.relations.some(function (rel) {
        return (exactValueMatches(rel.from, [player.id]) && exactValueMatches(rel.to, [element.id])) ||
          (exactValueMatches(rel.to, [player.id]) && exactValueMatches(rel.from, [element.id]));
      });
    });
    if (candidates.length > 1) {
      candidates = candidates.filter(function (candidate) {
        return ['normal', 'jail', 'bankrupt'].every(function (role) {
          return model.elements.some(function (element) {
            return roleTokens(role).some(function (token) { return normalize(element.id).indexOf(token) !== -1; }) && classInheritsFrom(model, element, candidate, {});
          });
        });
      });
    }
    return candidates.length === 1 ? candidates[0] : null;
  }

  function stateRoles(model) {
    var abstraction = stateAbstraction(model);
    var roles = {};
    if (!abstraction) return roles;
    ['normal', 'jail', 'bankrupt'].forEach(function (role) {
      var candidates = concreteDescendantsOf(model, abstraction).filter(function (el) {
        return roleTokens(role).some(function (token) { return normalize(el.id).indexOf(token) !== -1; });
      });
      if (candidates.length === 1) roles[role] = candidates[0];
    });
    return roles;
  }

  function assertStateRoles(model) {
    var roles = stateRoles(model);
    var ids = Object.keys(roles).map(function (role) { return roles[role].id; });
    return ids.length === 3 && new Set(ids).size === 3
      ? { pass: true }
      : failResult('Show three distinct concrete state classes linked to the state abstraction: include normal, jail (or prison), and bankrupt in their respective names. Keep unrelated helpers outside these roles.', model.elements.length ? 'Concrete state class names should expose their Monopoly role within the state hierarchy, using the published naming convention.' : null);
  }

  function turnOperations(model) {
    var abstraction = stateAbstraction(model);
    var player = classElementForName(model, 'Player');
    if (!abstraction || !player) return [];
    var playerNames = classMethodNamesForType(model, player.id, {});
    return allClassOperations(model, abstraction, {}).filter(function (member) {
      return memberIsAbstract(member, model) && !member.isStatic &&
        playerNames.some(function (name) { return name === methodNameFromMember(member.text); });
    });
  }

  function stateChangeOperations(model) {
    var abstraction = stateAbstraction(model);
    var player = classElementForName(model, 'Player');
    if (!abstraction || !player) return [];
    return allClassOperations(model, player, {}).filter(function (member) {
      var signature = methodSignatureFromMember(member.text);
      return !member.isStatic && signature && signature.parameters.some(function (param) {
        return param.direction !== 'out' && exactValueMatches(param.type, [abstraction.id]);
      });
    });
  }

  function assertStateOperations(model) {
    return turnOperations(model).length && stateChangeOperations(model).length
      ? { pass: true }
      : failResult('Declare an abstract turn operation on the state abstraction and expose the same operation name on Player. Give Player a state-changing operation with an argument typed as that abstraction.', model.members.length ? 'The state abstraction and Player should share the turn operation name. Mark abstract-class turn operations abstract and type the state-changing parameter as the abstraction.' : null);
  }

  function assertStateOwnership(model) {
    var abstraction = stateAbstraction(model);
    if (!abstraction) return { pass: false, message: 'Connect Player to one state abstraction with aggregation or composition.' };
    return assertRelation(model, { from: 'Player', to: abstraction.id, relation_type_any: ['aggregation', 'composition'], target_multiplicity_any: ['1', '1..1'] }, 'relation');
  }

  function assertStateInheritance(model) {
    var abstraction = stateAbstraction(model);
    var roles = stateRoles(model);
    return abstraction && Object.keys(roles).length === 3 && Object.keys(roles).every(function (role) {
      return validInheritancePath(model, roles[role], abstraction, {});
    }) ? { pass: true } : { pass: false, message: 'Concrete states must implement the state abstraction, directly or through inheritance: generalize a class and realize an interface.' };
  }

  function validInheritancePath(model, child, ancestor, visited) {
    if (visited[child.id]) return false;
    visited = Object.assign({}, visited); visited[child.id] = true;
    return model.relations.some(function (rel) {
      var type = relationSemanticType(rel);
      var edge = semanticRelationEndpoints(rel)[0];
      if (!edge || !exactValueMatches(edge.from, [child.id])) return false;
      var parent = classElementForName(model, edge.to);
      if (!parent || (normalize(parent.type) === 'interface' ? type !== 'realization' && !(normalize(child.type) === 'interface' && type === 'generalization') : type !== 'generalization')) return false;
      return parent === ancestor || validInheritancePath(model, parent, ancestor, visited);
    });
  }

  function assertTransitionLabels(model) {
    return model.relations.every(function (rel) { return String(rel.label || '').trim(); })
      ? { pass: true }
      : { pass: false, message: 'Label every transition with its condition or event, including additional transitions.' };
  }

  function roleTokens(role) {
    var normalizedRole = normalize(role);
    if (normalizedRole === 'normal') return ['normal'];
    if (normalizedRole === 'jail' || normalizedRole === 'prison' || normalizedRole === 'injail') return ['jail', 'prison'];
    if (normalizedRole === 'bankrupt' || normalizedRole === 'bankruptcy') return ['bankrupt'];
    return normalizedRole ? [normalizedRole] : [];
  }

  function uniqueValues(values) {
    var seen = Object.create(null);
    var result = [];
    values.forEach(function (value) {
      value = cleanId(value);
      var key = value;
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
    var byId = Object.create(null);
    model.elements.forEach(function (el) {
      if (!isSequenceParticipantType(el.type)) return;
      var participant = {
        id: cleanId(el.id),
        label: cleanId(el.label || el.id),
        className: cleanId(el.label || el.id),
        implicit: false
      };
      participants.push(participant);
      byId[participant.id] = participant;
    });
    model.relations.forEach(function (rel) {
      [rel.from, rel.to].forEach(function (endpoint) {
        var key = cleanId(endpoint);
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
    return sequenceParticipants(model).filter(function (participant) { return exactValueMatches(participant.className, ['Player']); });
  }

  function sequenceStateParticipants(model, context) {
    var classModel = context.modelForType('class');
    var abstraction = stateAbstraction(classModel);
    if (!abstraction) return [];
    var names = concreteDescendantsOf(classModel, abstraction).map(function (element) { return element.id; });
    return sequenceParticipants(model).filter(function (participant) { return exactValueMatches(participant.className, names); });
  }

  function participantMatchesEndpoint(endpoint, participant) {
    return !!participant && cleanId(endpoint) === participant.id;
  }

  function participantForEndpoint(participants, endpoint) {
    return participants.find(function (participant) {
      return participantMatchesEndpoint(endpoint, participant);
    }) || null;
  }

  function cleanArgument(argument) {
    return String(argument || '').trim();
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
    var match = text.match(/^([A-Za-z_]\w*)\s*\((.*)\)\s*(?::\s*(.*))?$/);
    if (!match) return null;
    var args = splitArgumentList(match[2]);
    return { name: match[1], args: args, parameters: args.map(operationParameter), returns: (match[3] || '').trim() };
  }

  function splitArgumentList(text) {
    var args = [], start = 0, depth = 0, quote = '', escaped = false;
    String(text || '').split('').forEach(function (ch, index) {
      if (escaped) { escaped = false; return; }
      if (quote) { if (ch === '\\') escaped = true; else if (ch === quote) quote = ''; return; }
      if (ch === '"' || ch === "'") { quote = ch; return; }
      if ('([<{'.indexOf(ch) !== -1) depth++;
      if (')]>}'.indexOf(ch) !== -1) depth--;
      if (ch === ',' && depth === 0) { args.push(text.slice(start, index).trim()); start = index + 1; }
    });
    var tail = String(text || '').slice(start).trim();
    if (tail) args.push(tail);
    return args;
  }

  function operationParameter(text) {
    var direction = (text.match(/^(inout|out|in)\s+/) || [null, 'in'])[1];
    var declaration = text.replace(/^(inout|out|in)\s+/, '').split('=')[0].trim();
    var parts = declaration.split(':');
    var words = declaration.split(/\s+/);
    return { type: parts.length > 1 ? parts.slice(1).join(':').trim() : words.length > 1 ? words.slice(0, -1).join(' ') : '', direction: direction, optional: text.indexOf('=') !== -1 };
  }

  function compatibleOperation(model, actual, expected) {
    var a = methodSignatureFromMember(actual.text), b = methodSignatureFromMember(expected.text);
    return !!a && !!b && a.name === b.name && !!actual.isStatic === !!expected.isStatic &&
      a.parameters.length === b.parameters.length && compatibleDeclaredTypes(model, a.returns, b.returns) &&
      a.parameters.every(function (param, index) {
        var required = b.parameters[index];
        return param.direction === required.direction && compatibleDeclaredTypes(model, param.type, required.type);
      });
  }

  // UML operation redefinition allows related parameter types in either
  // direction (UML 2.5.1 section 9.9.11.6); do not impose a language's rules.
  function compatibleDeclaredTypes(model, actual, expected) {
    if (!actual || !expected || actual === expected) return true;
    var a = classElementForName(model, actual), b = classElementForName(model, expected);
    return !!a && !!b && (validInheritancePath(model, a, b, {}) || validInheritancePath(model, b, a, {}));
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

  function classModelHasCall(model, className, call, participants) {
    var receiver = classElementForName(model, className);
    return !!receiver && allClassOperations(model, receiver, {}).some(function (member) {
      return operationAcceptsCall(model, member, call, participants);
    });
  }

  function operationAcceptsCall(model, member, call, participants) {
    var signature = methodSignatureFromMember(member.text);
    if (signature.name !== call.name) return false;
    var params = signature.parameters.filter(function (param) { return param.direction !== 'out'; });
    if (call.args.length > params.length || call.args.length < params.filter(function (param) { return !param.optional; }).length) return false;
    return call.args.every(function (argument, index) {
      var participant = participants.find(function (candidate) { return candidate.id === argument; });
      if (!participant || !params[index].type) return true;
      if (participant.className === params[index].type) return true;
      var child = classElementForName(model, participant.className), parent = classElementForName(model, params[index].type);
      return !!child && !!parent && validInheritancePath(model, child, parent, {});
    });
  }

  function classMethodNamesForType(classModel, className, visited) {
    var element = classElementForName(classModel, className);
    if (!element) return [];
    var key = element.id;
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
    if (member.declaredAbstract || /\{abstract\}/i.test(member.text)) return true;
    return model.elements.some(function (el) {
      var ownerMatches = exactValueMatches(member.owner, [el.id, el.label]);
      var type = normalize(el.type);
      return ownerMatches && type === 'interface';
    });
  }

  function isAbstractElement(element) {
    var type = normalize(element && element.type);
    return type === 'interface' || type === 'abstractclass';
  }

  function isConcreteClassElement(element) {
    return normalize(element && element.type) === 'class';
  }

  function abstractOperationsForElement(model, element) {
    return allClassOperations(model, element, {}).filter(function (member) { return memberIsAbstract(member, model); });
  }

  function allClassOperations(model, element, visited) {
    if (visited[element.id]) return [];
    visited = Object.assign({}, visited); visited[element.id] = true;
    var operations = model.members.filter(function (member) { return member.owner === element.id && methodSignatureFromMember(member.text); });
    classParentElements(model, element).forEach(function (parent) { operations = operations.concat(allClassOperations(model, parent, visited)); });
    return operations;
  }

  function concreteDescendantsOf(model, abstraction) {
    return model.elements.filter(function (candidate) {
      return isConcreteClassElement(candidate) && classInheritsFrom(model, candidate, abstraction, {});
    });
  }

  function classInheritsFrom(model, child, ancestor, visited) {
    var key = child && child.id;
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

  function classHasConcreteMethod(model, element, operation, visited) {
    var key = element && element.id;
    if (!key || visited[key]) return false;
    visited = Object.assign({}, visited); visited[key] = true;
    var direct = model.members.filter(function (member) {
      return member.owner === element.id && compatibleOperation(model, member, operation);
    });
    // A nearer declaration replaces the inherited operation, including when it
    // makes that operation abstract again. Search each inheritance path alone.
    if (direct.length) return direct.some(function (member) { return !memberIsAbstract(member, model); });
    return classParentElements(model, element).some(function (parent) {
      return classHasConcreteMethod(model, parent, operation, visited);
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
    if (rel.semanticType) return ['generalization', 'realization', 'aggregation', 'composition'].indexOf(rel.semanticType) !== -1 ? [{ from: rel.from, to: rel.to }] : [];
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
    if (rel.semanticType) return rel.semanticType;
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

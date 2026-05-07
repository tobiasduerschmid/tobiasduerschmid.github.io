(function () {
  'use strict';

  function UMLTutorialEditor(root, options) {
    this.root = typeof root === 'string' ? document.querySelector(root) : root;
    this.options = options || {};
    this.steps = this.options.steps || [];
    this.currentStep = 0;
    this.requireTests = !!this.options.requireTests;
    this.instructorMode = !!this.options.instructorMode;
    this._stepsPassed = new Set();
    this._stepsUnlocked = new Set([0]);
    this.sourceEl = null;
    this.typeEl = null;
    this.instructionsEl = null;
    this.contentWrapEl = null;
    this.navEl = null;
    this.controlsEl = null;
    this.resultsEl = null;
    this._testAnnouncer = null;
  }

  UMLTutorialEditor.prototype.start = function () {
    if (!this.root) return;
    this.sourceEl = this.root.querySelector('#uml-pg-input');
    this.typeEl = this.root.querySelector('#uml-pg-type');
    this.instructionsEl = this.root.querySelector('.tvm-step-content');
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
    html += this._stepHasTests(step)
      ? '<button class="tvm-btn tvm-btn-test" title="Check the UML diagram for this step">&#10003; Test My Work</button>'
      : '<span></span>';
    html += index < this.steps.length - 1
      ? '<button class="tvm-btn tvm-btn-next"' + (nextLocked ? ' disabled title="Pass all tests to continue"' : ' title="Next step"') + '>Next &rarr;</button>'
      : '<span></span>';
    this.controlsEl.innerHTML = html;

    var prev = this.controlsEl.querySelector('.tvm-btn-prev');
    var next = this.controlsEl.querySelector('.tvm-btn-next');
    var test = this.controlsEl.querySelector('.tvm-btn-test');
    if (prev) prev.addEventListener('click', function () { self.loadStep(index - 1); });
    if (next) next.addEventListener('click', function () {
      if (next.disabled) return;
      self._stepsUnlocked.add(index + 1);
      self.loadStep(index + 1);
    });
    if (test) test.addEventListener('click', function () { self.runTests(); });
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

  UMLTutorialEditor.prototype.resetCurrentDiagram = function () {
    var step = this.steps[this.currentStep] || {};
    var type = step.uml_type || (this.typeEl && this.typeEl.value) || 'class';
    try { localStorage.removeItem('uml-pg-' + type); } catch (e) {}
    if (this.typeEl) {
      this.typeEl.value = type;
      this.typeEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var reset = this.root.querySelector('#uml-pg-reset-example');
    if (reset) reset.click();
  };

  UMLTutorialEditor.prototype.currentSource = function () {
    return this.sourceEl ? this.sourceEl.value || '' : '';
  };

  UMLTutorialEditor.prototype.sourceForDiagramType = function (type) {
    type = type || (this.typeEl && this.typeEl.value) || 'class';
    if (this.typeEl && this.typeEl.value === type) return this.currentSource();
    try {
      return localStorage.getItem('uml-pg-autosave-' + type) || '';
    } catch (e) {
      return '';
    }
  };

  UMLTutorialEditor.prototype.clearResults = function () {
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

  UMLTutorialEditor.prototype.runTests = function () {
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
    tests.forEach(function (test) {
      var failures = [];
      (test.assertions || []).forEach(function (assertion) {
        var result = evaluateAssertion(model, assertion, context);
        if (!result.pass) failures.push(result.message);
      });
      var ok = failures.length === 0;
      results.push(ok);
      resultTests.push({
        description: test.description || 'UML check',
        failures: failures
      });
    });
    var allPass = results.length > 0 && results.every(function (result) { return result === true; });
    if (allPass) {
      this._stepsPassed.add(this.currentStep);
      this._stepsUnlocked.add(this.currentStep + 1);
      this.renderNav();
      this.renderControls(this.currentStep);
    }
    if (!tests.length) {
      this._showTestPanel('<div class="tvm-test-results"><div class="tvm-test-summary all-pass">No tests for this step.</div></div>');
      return;
    }
    this._showTestPanel(this._buildTestResultsHTML(resultTests, results));
    this._announceTestResult(resultTests, results);
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
    return cleanId(text).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function parseArchUml(source) {
    var model = { elements: [], members: [], relations: [] };
    var lines = String(source || '').split(/\r?\n/);
    var current = null;
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line || line === '@startuml' || line === '@enduml' || /^layout\b/i.test(line) || /^@layout\b/i.test(line) || /^@endlayout\b/i.test(line)) return;
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

      m = line.match(/^(actor|participant|boundary|control|entity|database)\s+([A-Za-z_][\w.]*)(?:\s*:\s*(.+))?/i);
      if (m) { addElement(model, m[1].toLowerCase(), m[2], m[3] || m[2]); return; }

      if (current) {
        addMember(model, current, line);
        return;
      }

      m = line.match(/^(.+?)\s+([.<o*|]*[-.]+[->o*|]*|<-->|--|->>|->|-->)\s+(.+?)(?:\s*:\s*(.+))?$/);
      if (m) {
        model.relations.push({
          from: cleanId(m[1]),
          op: m[2],
          to: cleanId(m[3]),
          label: (m[4] || '').trim()
        });
      }
    });
    return model;
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
    return found
      ? { pass: true }
      : { pass: false, message: 'Expected ' + (expectedTypes.length ? describeExpectedValue(null, expectedTypes) : 'element') + ' ' + describeExpectedValue(id, idContains) + '.' };
  }

  function assertMember(model, assertion) {
    var owner = assertion.owner || assertion.class || assertion.element;
    var ownerContains = containsValues(assertion, 'owner').concat(containsValues(assertion, 'class')).concat(containsValues(assertion, 'element'));
    var text = assertion.text || assertion.member || assertion.name;
    var textContains = containsValues(assertion, 'text').concat(containsValues(assertion, 'member')).concat(containsValues(assertion, 'name'));
    var found = model.members.some(function (member) {
      var abstractOk = assertion.is_abstract == null && assertion.isAbstract == null && assertion.abstract == null
        ? true
        : memberIsAbstract(member, model) === !!(assertion.is_abstract || assertion.isAbstract || assertion.abstract);
      return valueMatches(member.owner, owner, ownerContains) && valueMatches(member.text, text, textContains, true) && abstractOk;
    });
    return found
      ? { pass: true }
      : { pass: false, message: 'Expected member ' + describeExpectedValue(text, textContains) + ' on ' + describeExpectedValue(owner, ownerContains) + (assertion.is_abstract || assertion.isAbstract || assertion.abstract ? ' marked abstract' : '') + '.' };
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
    var optional = assertion.optional === true || assertion.optional === 'true';
    var candidateExists = false;
    var found = model.relations.some(function (rel) {
      var forward = endpointsMatch(rel.from, rel.to, from, to, fromContains, toContains, fromExact, toExact);
      var semantic = semanticRelationEndpoints(rel);
      var semanticForward = semantic.some(function (edge) {
        return endpointsMatch(edge.from, edge.to, from, to, fromContains, toContains, fromExact, toExact);
      });
      var endpointOk = semantic.length ? semanticForward : forward;
      var semanticReverse = semantic.some(function (edge) {
        return endpointsMatch(edge.from, edge.to, to, from, toContains, fromContains, toExact, fromExact);
      });
      var reverseOk = assertion.directed === false && (semantic.length
        ? semanticReverse
        : endpointsMatch(rel.from, rel.to, to, from, toContains, fromContains, toExact, fromExact));
      var typeOk = !relationTypes.length || relationTypes.some(function (expectedType) {
        return normalize(relationSemanticType(rel)) === normalize(expectedType);
      });
      var labelOk = valueMatches(rel.label, null, labelContains);
      var candidateOk = (endpointOk || reverseOk) && typeOk;
      if (candidateOk) candidateExists = true;
      var labelLengthOk = !labelMinLength || String(rel.label || '').trim().length >= labelMinLength;
      return candidateOk && labelOk && labelLengthOk;
    });
    return found
      ? { pass: true }
      : optional && !candidateExists
        ? { pass: true }
        : { pass: false, message: 'Expected ' + kind + ' from ' + describeExpectedValue(from, fromContains, fromExact) + ' to ' + describeExpectedValue(to, toContains, toExact) + (relationTypes.length ? ' with type ' + describeExpectedValue(null, relationTypes) : '') + (labelContains.length ? ' labeled with ' + describeExpectedValue(null, labelContains) : '') + (labelMinLength ? ' with a label at least ' + labelMinLength + ' characters long' : '') + '.' };
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
    return found
      ? { pass: true }
      : { pass: false, message: 'Expected state matching the class-diagram "' + role + '" state name (' + expectedNames.join(' or ') + ').' };
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
      return normalize(el.type) === 'interface' && normalize(el.id) === normalize(member.owner);
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

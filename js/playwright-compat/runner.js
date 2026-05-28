/**
 * SEBook Playwright compatibility runner.
 *
 * This is a teaching runner for browser-hosted tutorials. Students write
 * Playwright-shaped spec files that can be copied into a real project, while
 * this runner drives the tutorial preview iframe with a focused subset of the
 * Playwright API.
 */
(function (global) {
  'use strict';

  var RESPONSE_TAG = '__sebookPlaywrightCompat';

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function normalizeText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function serializeMatcher(value) {
    if (value instanceof RegExp) {
      return { type: 'regex', source: value.source, flags: value.flags };
    }
    if (Array.isArray(value)) {
      return { type: 'array', items: value.map(serializeMatcher) };
    }
    return { type: 'text', value: String(value == null ? '' : value) };
  }

  function serializeOptions(options) {
    options = options || {};
    var out = {};
    Object.keys(options).forEach(function (key) {
      var value = options[key];
      if (key === 'name' || key === 'hasText') out[key] = serializeMatcher(value);
      else out[key] = value;
    });
    return out;
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (!a || !b || typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    var ak = Object.keys(a), bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (var i = 0; i < ak.length; i++) {
      var key = ak[i];
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  function PreviewBroker(frame, options) {
    this.frame = frame;
    this.timeout = (options && options.timeout) || 5000;
    this._seq = 0;
    this._pending = {};
    this._onMessage = this._handleMessage.bind(this);
    global.addEventListener('message', this._onMessage);
  }

  PreviewBroker.prototype.dispose = function () {
    global.removeEventListener('message', this._onMessage);
    Object.keys(this._pending).forEach(function (id) {
      this._pending[id].reject(new Error('Playwright runner was disposed'));
      clearTimeout(this._pending[id].timer);
    }, this);
    this._pending = {};
  };

  PreviewBroker.prototype._handleMessage = function (event) {
    if (!event.data || event.data[RESPONSE_TAG] !== 'response') return;
    if (this.frame && event.source !== this.frame.contentWindow) return;
    var item = this._pending[event.data.id];
    if (!item) return;
    delete this._pending[event.data.id];
    clearTimeout(item.timer);
    if (event.data.ok) item.resolve(event.data.value);
    else item.reject(new Error(event.data.error || 'Playwright command failed'));
  };

  PreviewBroker.prototype.command = function (type, payload, timeout) {
    if (!this.frame || !this.frame.contentWindow) {
      return Promise.reject(new Error('Preview iframe is not ready'));
    }
    var id = ++this._seq;
    var self = this;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        delete self._pending[id];
        reject(new Error('Timed out waiting for preview command: ' + type));
      }, timeout || self.timeout);
      self._pending[id] = { resolve: resolve, reject: reject, timer: timer };
      self.frame.contentWindow.postMessage({
        __sebookPlaywrightCompat: 'request',
        id: id,
        type: type,
        payload: payload || {},
      }, '*');
    });
  };

  function Locator(page, steps) {
    this._page = page;
    this._steps = steps || [];
  }

  Locator.prototype._with = function (step) {
    return new Locator(this._page, this._steps.concat([step]));
  };

  Locator.prototype.locator = function (selector, options) {
    var next = this._with({ kind: 'css', selector: selector });
    if (options && options.hasText !== undefined) {
      next = next.filter({ hasText: options.hasText });
    }
    return next;
  };

  Locator.prototype.getByRole = function (role, options) {
    return this._with({ kind: 'role', role: role, options: serializeOptions(options) });
  };

  Locator.prototype.getByText = function (text, options) {
    return this._with({ kind: 'text', text: serializeMatcher(text), options: serializeOptions(options) });
  };

  Locator.prototype.getByLabel = function (text, options) {
    return this._with({ kind: 'label', text: serializeMatcher(text), options: serializeOptions(options) });
  };

  Locator.prototype.getByPlaceholder = function (text, options) {
    return this._with({ kind: 'placeholder', text: serializeMatcher(text), options: serializeOptions(options) });
  };

  Locator.prototype.getByAltText = function (text, options) {
    return this._with({ kind: 'alt', text: serializeMatcher(text), options: serializeOptions(options) });
  };

  Locator.prototype.getByTitle = function (text, options) {
    return this._with({ kind: 'title', text: serializeMatcher(text), options: serializeOptions(options) });
  };

  Locator.prototype.getByTestId = function (id) {
    return this._with({ kind: 'testid', value: String(id) });
  };

  Locator.prototype.filter = function (options) {
    return this._with({ kind: 'filter', options: serializeOptions(options) });
  };

  Locator.prototype.nth = function (index) {
    return this._with({ kind: 'nth', index: index });
  };

  Locator.prototype.first = function () { return this.nth(0); };

  Locator.prototype.last = function () {
    return this._with({ kind: 'last' });
  };

  Locator.prototype.click = function (options) {
    return this._page._command('action', { action: 'click', locator: this._steps, options: options || {} });
  };

  Locator.prototype.fill = function (value, options) {
    return this._page._command('action', { action: 'fill', locator: this._steps, value: String(value), options: options || {} });
  };

  Locator.prototype.clear = function (options) {
    return this.fill('', options);
  };

  Locator.prototype.type = function (value, options) {
    return this._page._command('action', { action: 'type', locator: this._steps, value: String(value), options: options || {} });
  };

  Locator.prototype.check = function (options) {
    return this._page._command('action', { action: 'check', locator: this._steps, options: options || {} });
  };

  Locator.prototype.uncheck = function (options) {
    return this._page._command('action', { action: 'uncheck', locator: this._steps, options: options || {} });
  };

  Locator.prototype.press = function (key, options) {
    return this._page._command('action', { action: 'press', locator: this._steps, key: key, options: options || {} });
  };

  Locator.prototype.hover = function (options) {
    return this._page._command('action', { action: 'hover', locator: this._steps, options: options || {} });
  };

  Locator.prototype.selectOption = function (value, options) {
    return this._page._command('action', { action: 'selectOption', locator: this._steps, value: value, options: options || {} });
  };

  Locator.prototype.count = function () {
    return this._page._command('count', { locator: this._steps });
  };

  Locator.prototype.textContent = function () {
    return this._page._command('value', { value: 'textContent', locator: this._steps });
  };

  Locator.prototype.inputValue = function () {
    return this._page._command('value', { value: 'inputValue', locator: this._steps });
  };

  Locator.prototype.isVisible = function () {
    return this._page._command('assert', { assertion: 'visibleLoose', locator: this._steps })
      .then(function (result) { return !!result.pass; });
  };

  function Page(broker) {
    this._broker = broker;
  }

  Page.prototype._command = function (type, payload, timeout) {
    return this._broker.command(type, payload, timeout);
  };

  Page.prototype.goto = function (url) {
    return this._command('goto', { url: url || '/' });
  };

  Page.prototype.reload = function () {
    return this.goto('/');
  };

  Page.prototype.locator = function (selector, options) {
    var loc = new Locator(this, [{ kind: 'css', selector: selector }]);
    if (options && options.hasText !== undefined) loc = loc.filter({ hasText: options.hasText });
    return loc;
  };

  Page.prototype.getByRole = function (role, options) {
    return new Locator(this, [{ kind: 'role', role: role, options: serializeOptions(options) }]);
  };

  Page.prototype.getByText = function (text, options) {
    return new Locator(this, [{ kind: 'text', text: serializeMatcher(text), options: serializeOptions(options) }]);
  };

  Page.prototype.getByLabel = function (text, options) {
    return new Locator(this, [{ kind: 'label', text: serializeMatcher(text), options: serializeOptions(options) }]);
  };

  Page.prototype.getByPlaceholder = function (text, options) {
    return new Locator(this, [{ kind: 'placeholder', text: serializeMatcher(text), options: serializeOptions(options) }]);
  };

  Page.prototype.getByAltText = function (text, options) {
    return new Locator(this, [{ kind: 'alt', text: serializeMatcher(text), options: serializeOptions(options) }]);
  };

  Page.prototype.getByTitle = function (text, options) {
    return new Locator(this, [{ kind: 'title', text: serializeMatcher(text), options: serializeOptions(options) }]);
  };

  Page.prototype.getByTestId = function (id) {
    return new Locator(this, [{ kind: 'testid', value: String(id) }]);
  };

  Page.prototype.waitForTimeout = function (ms) {
    return delay(ms);
  };

  Page.prototype.waitForSelector = function (selector, options) {
    var loc = this.locator(selector);
    options = options || {};
    if (options.state === 'hidden' || options.state === 'detached') {
      return makeExpect().expect(loc).toBeHidden({ timeout: options.timeout });
    }
    return makeExpect().expect(loc).toBeVisible({ timeout: options.timeout });
  };

  function makeExpect(defaultTimeout) {
    defaultTimeout = defaultTimeout || 5000;

    function poll(locator, assertion, expected, options, negate) {
      options = options || {};
      var timeout = options.timeout || defaultTimeout;
      var deadline = Date.now() + timeout;
      var lastMessage = '';
      function attempt() {
        return locator._page._command('assert', {
          assertion: assertion,
          locator: locator._steps,
          expected: expected,
        }).then(function (result) {
          var pass = !!(result && result.pass);
          lastMessage = result && result.message || '';
          if (negate ? !pass : pass) return true;
          if (Date.now() >= deadline) {
            throw new Error(lastMessage || ('Expected locator ' + (negate ? 'not ' : '') + assertion));
          }
          return delay(80).then(attempt);
        }).catch(function (err) {
          lastMessage = err && err.message || String(err);
          if (negate && assertion === 'visible') return true;
          if (Date.now() >= deadline) throw err;
          return delay(80).then(attempt);
        });
      }
      return attempt();
    }

    function locatorMatchers(locator, negate) {
      return {
        get not() { return locatorMatchers(locator, !negate); },
        toBeVisible: function (options) { return poll(locator, 'visible', null, options, negate); },
        toBeHidden: function (options) { return poll(locator, 'hidden', null, options, negate); },
        toHaveText: function (expected, options) { return poll(locator, 'text', serializeMatcher(expected), options, negate); },
        toContainText: function (expected, options) { return poll(locator, 'containText', serializeMatcher(expected), options, negate); },
        toHaveCount: function (expected, options) { return poll(locator, 'count', expected, options, negate); },
        toHaveValue: function (expected, options) { return poll(locator, 'value', serializeMatcher(expected), options, negate); },
        toHaveAttribute: function (name, expected, options) {
          return poll(locator, 'attribute', { name: name, value: expected === undefined ? null : serializeMatcher(expected) }, options, negate);
        },
        toBeChecked: function (options) { return poll(locator, 'checked', null, options, negate); },
        toBeEnabled: function (options) { return poll(locator, 'enabled', null, options, negate); },
        toBeDisabled: function (options) { return poll(locator, 'disabled', null, options, negate); },
      };
    }

    function assertValue(pass, message, negate) {
      var ok = negate ? !pass : pass;
      if (!ok) throw new Error(message);
    }

    function valueMatchers(actual, negate) {
      return {
        get not() { return valueMatchers(actual, !negate); },
        toBe: function (expected) {
          assertValue(Object.is(actual, expected), 'Expected ' + JSON.stringify(actual) + ' to be ' + JSON.stringify(expected), negate);
        },
        toEqual: function (expected) {
          assertValue(deepEqual(actual, expected), 'Expected ' + JSON.stringify(actual) + ' to equal ' + JSON.stringify(expected), negate);
        },
        toContain: function (expected) {
          var pass = actual && typeof actual.indexOf === 'function' && actual.indexOf(expected) !== -1;
          assertValue(pass, 'Expected ' + JSON.stringify(actual) + ' to contain ' + JSON.stringify(expected), negate);
        },
        toMatch: function (expected) {
          var re = expected instanceof RegExp ? expected : new RegExp(String(expected));
          assertValue(re.test(String(actual)), 'Expected ' + JSON.stringify(actual) + ' to match ' + String(re), negate);
        },
        toBeTruthy: function () {
          assertValue(!!actual, 'Expected value to be truthy', negate);
        },
        toBeFalsy: function () {
          assertValue(!actual, 'Expected value to be falsy', negate);
        },
      };
    }

    function expect(target) {
      if (target instanceof Locator) return locatorMatchers(target, false);
      return valueMatchers(target, false);
    }

    expect.configure = function (options) {
      return makeExpect((options && options.timeout) || defaultTimeout).expect;
    };

    return { expect: expect };
  }

  function createTestApi(registry) {
    var describeStack = [];
    var scopeStack = [{ beforeEach: [], afterEach: [] }];
    var hasOnly = false;

    function currentTitle(title) {
      return describeStack.concat([title]).filter(Boolean).join(' ');
    }

    function flatten(kind) {
      var scopes = kind === 'afterEach' ? scopeStack.slice().reverse() : scopeStack;
      var out = [];
      scopes.forEach(function (scope) {
        out = out.concat(scope[kind] || []);
      });
      return out;
    }

    function addTest(title, fn, opts) {
      opts = opts || {};
      if (typeof fn !== 'function') fn = function () {};
      if (opts.only) hasOnly = true;
      registry.push({
        title: currentTitle(title),
        fn: fn,
        only: !!opts.only,
        skip: !!opts.skip,
        beforeEach: flatten('beforeEach'),
        afterEach: flatten('afterEach'),
      });
    }

    function test(title, fn) { addTest(title, fn); }
    test.only = function (title, fn) { addTest(title, fn, { only: true }); };
    test.skip = function (title, fn) { addTest(title, fn, { skip: true }); };
    test.describe = function (title, fn) {
      describeStack.push(title);
      scopeStack.push({ beforeEach: [], afterEach: [] });
      try { fn(); }
      finally {
        scopeStack.pop();
        describeStack.pop();
      }
    };
    test.describe.only = test.describe;
    test.describe.skip = function () {};
    test.beforeEach = function (fn) { scopeStack[scopeStack.length - 1].beforeEach.push(fn); };
    test.afterEach = function (fn) { scopeStack[scopeStack.length - 1].afterEach.push(fn); };
    test.step = function (title, fn) { return fn(); };
    test._hasOnly = function () { return hasOnly; };
    return test;
  }

  function transformSpec(source) {
    return String(source || '')
      .replace(/^\s*import\s+[^;]*?from\s+['"]@playwright\/test['"];?\s*$/gm, '')
      .replace(/^\s*const\s+\{[^}]*\}\s*=\s*require\(['"]@playwright\/test['"]\);?\s*$/gm, '')
      .replace(/^\s*export\s+\{[^}]*\};?\s*$/gm, '');
  }

  function CompatRunner(options) {
    this.previewFrame = options.previewFrame;
    this.files = options.files || {};
    this.testFiles = options.testFiles || [];
    this.timeout = options.timeout || 5000;
    this.resetBetweenTests = options.resetBetweenTests !== false;
    this.rebuildPreview = options.rebuildPreview;
    this.registry = [];
  }

  CompatRunner.prototype.evaluateSpecs = function () {
    var testApi = createTestApi(this.registry);
    var expectApi = makeExpect(this.timeout).expect;
    for (var i = 0; i < this.testFiles.length; i++) {
      var filename = this.testFiles[i];
      var source = this.files[filename] || '';
      var transformed = transformSpec(source);
      try {
        /* jshint evil:true */
        var fn = new Function('test', 'expect', transformed + '\n//# sourceURL=' + filename);
        fn(testApi, expectApi);
      } catch (err) {
        return {
          error: err,
          filename: filename,
        };
      }
    }
    if (testApi._hasOnly()) {
      this.registry = this.registry.filter(function (t) { return t.only; });
    }
    return null;
  };

  CompatRunner.prototype._runOne = function (testCase) {
    var self = this;
    if (testCase.skip) return Promise.resolve(true);
    var broker;
    var work = Promise.resolve();
    if (this.resetBetweenTests && this.rebuildPreview) {
      work = work.then(function () { return self.rebuildPreview(); });
    }
    return work.then(function () {
      broker = new PreviewBroker(self.previewFrame, { timeout: self.timeout });
      var page = new Page(broker);
      var fixtures = { page: page };
      var chain = page.goto('/');
      testCase.beforeEach.forEach(function (hook) {
        chain = chain.then(function () { return hook(fixtures); });
      });
      chain = chain.then(function () { return testCase.fn(fixtures); });
      testCase.afterEach.forEach(function (hook) {
        chain = chain.then(function () { return hook(fixtures); });
      });
      return Promise.race([
        chain,
        delay(self.timeout).then(function () {
          throw new Error('Test timed out after ' + self.timeout + 'ms');
        }),
      ]);
    }).then(function () {
      if (broker) broker.dispose();
      return true;
    }).catch(function (err) {
      if (broker) broker.dispose();
      console.warn('[PlaywrightCompat] ' + testCase.title + ' failed:', err && err.message || err);
      return false;
    });
  };

  CompatRunner.prototype.run = function () {
    var loadError = this.evaluateSpecs();
    if (loadError) {
      console.warn('[PlaywrightCompat] Failed to load spec:', loadError.error);
      return Promise.resolve({
        tests: [{ description: 'Load ' + loadError.filename }],
        results: [false],
      });
    }
    if (!this.registry.length) {
      return Promise.resolve({
        tests: [{ description: 'At least one Playwright test is defined' }],
        results: [false],
      });
    }
    var tests = this.registry.map(function (item) {
      return { description: item.title + (item.skip ? ' (skipped)' : '') };
    });
    var results = [];
    var chain = Promise.resolve();
    this.registry.forEach(function (testCase, index) {
      chain = chain.then(function () {
        return this._runOne(testCase).then(function (result) {
          results[index] = result;
        });
      }.bind(this));
    }, this);
    var self = this;
    function resetScrollState() {
      try {
        var doc = self.previewFrame && self.previewFrame.contentDocument;
        var win = self.previewFrame && self.previewFrame.contentWindow;
        // Blur any focused element: fill()/click() called .focus(), and when
        // the iframe gets resized by the test results panel appearing, Chrome
        // auto-scrolls the iframe to keep the focused element visible —
        // which would undo the scrollTo(0, 0) below.
        if (doc && doc.activeElement && doc.activeElement.blur) doc.activeElement.blur();
        // Reset iframe contentWindow scroll. Force instant behavior: if the
        // iframe's html has scroll-behavior: smooth, a plain scrollTo animates
        // and Chrome's focus / scroll-anchoring auto-scroll wins the race
        // before the animation finishes.
        var html = doc && doc.documentElement;
        var prevBehavior = html && html.style.scrollBehavior;
        if (html) html.style.scrollBehavior = 'auto';
        if (win && typeof win.scrollTo === 'function') {
          try { win.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }
          catch (inner) { win.scrollTo(0, 0); }
        }
        if (html) html.style.scrollBehavior = prevBehavior || '';
      } catch (e) { /* cross-origin or detached frame — ignore */ }
      // Reset host-page scroll ancestors: Element.scrollIntoView() inside the
      // iframe historically propagated up to the tutorial container in Chrome.
      // The agent script is now scoped, but reset ancestors as defense in
      // depth in case cached bundles, React effects, or future actions still
      // nudge the host.
      try {
        var node = self.previewFrame && self.previewFrame.parentNode;
        while (node && node.nodeType === 1) {
          if (node.scrollTop) node.scrollTop = 0;
          if (node.scrollLeft) node.scrollLeft = 0;
          node = node.parentNode;
        }
      } catch (e) { /* ignore */ }
    }
    return chain.then(function () {
      // Reset once synchronously, then again after the next paint. The test
      // results panel becomes visible immediately after this promise resolves,
      // shrinking the iframe — and Chrome may re-anchor scroll across that
      // resize, undoing a synchronous-only reset.
      resetScrollState();
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function () {
          requestAnimationFrame(resetScrollState);
        });
      } else {
        setTimeout(resetScrollState, 0);
      }
      return { tests: tests, results: results };
    });
  };

  function agentScript(config) {
    config = config || {};
    var testIdAttribute = config.testIdAttribute || 'data-testid';
    return '(' + function (responseTag, tidAttr) {
      function normalizeText(value) {
        return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
      }
      function matches(value, matcher, exact) {
        value = normalizeText(value);
        if (!matcher) return true;
        if (matcher.type === 'regex') {
          return new RegExp(matcher.source, matcher.flags || '').test(value);
        }
        if (matcher.type === 'array') return matcher.items.some(function (m) { return matches(value, m, exact); });
        var expected = normalizeText(matcher.value);
        return exact ? value === expected : value.toLowerCase().indexOf(expected.toLowerCase()) !== -1;
      }
      function allElements(root) {
        var base = root && root.querySelectorAll ? root : document;
        return Array.prototype.slice.call(base.querySelectorAll('*'));
      }
      function unique(nodes) {
        var seen = [];
        return nodes.filter(function (node) {
          if (seen.indexOf(node) !== -1) return false;
          seen.push(node);
          return true;
        });
      }
      function visible(el) {
        if (!el || !el.ownerDocument || !el.isConnected) return false;
        if (el.hidden) return false;
        var style = el.ownerDocument.defaultView.getComputedStyle(el);
        if (!style || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        var rects = el.getClientRects();
        return !!(rects && rects.length);
      }
      function roleOf(el) {
        var explicit = el.getAttribute && el.getAttribute('role');
        if (explicit) return explicit.split(/\s+/)[0];
        var tag = el.tagName ? el.tagName.toLowerCase() : '';
        var type = (el.getAttribute && el.getAttribute('type') || '').toLowerCase();
        if (tag === 'button') return 'button';
        if (tag === 'a' && el.hasAttribute('href')) return 'link';
        if (tag === 'input' && ['button', 'submit', 'reset'].indexOf(type) !== -1) return 'button';
        if (tag === 'input' && ['text', 'email', 'search', 'tel', 'url', 'password', 'number', ''].indexOf(type) !== -1) return 'textbox';
        if (tag === 'textarea') return 'textbox';
        if (tag === 'input' && type === 'checkbox') return 'checkbox';
        if (tag === 'input' && type === 'radio') return 'radio';
        if (tag === 'select') return 'combobox';
        if (/^h[1-6]$/.test(tag)) return 'heading';
        if (tag === 'ul' || tag === 'ol') return 'list';
        if (tag === 'li') return 'listitem';
        if (tag === 'img') return 'img';
        if (tag === 'table') return 'table';
        if (tag === 'tr') return 'row';
        if (tag === 'td') return 'cell';
        if (tag === 'th') return 'columnheader';
        if (tag === 'option') return 'option';
        return '';
      }
      function textOf(el) {
        return normalizeText(el && (el.innerText || el.textContent || ''));
      }
      function labelsFor(el) {
        var out = [];
        if (el.labels) {
          Array.prototype.forEach.call(el.labels, function (label) { out.push(textOf(label)); });
        }
        return out.join(' ');
      }
      function nameOf(el) {
        if (!el || !el.getAttribute) return '';
        var labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
          return normalizeText(labelledBy.split(/\s+/).map(function (id) {
            var ref = document.getElementById(id);
            return ref ? textOf(ref) : '';
          }).join(' '));
        }
        var aria = el.getAttribute('aria-label');
        if (aria) return normalizeText(aria);
        var tag = el.tagName ? el.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
          var label = labelsFor(el);
          if (label) return normalizeText(label);
          if (el.getAttribute('placeholder')) return normalizeText(el.getAttribute('placeholder'));
          if (el.getAttribute('value')) return normalizeText(el.getAttribute('value'));
        }
        if (tag === 'img') return normalizeText(el.getAttribute('alt') || '');
        return textOf(el);
      }
      function controlForLabel(label) {
        if (!label) return null;
        var id = label.getAttribute('for');
        if (id) return document.getElementById(id);
        return label.querySelector('input, textarea, select, button');
      }
      function queryStep(roots, step) {
        var out = [];
        roots.forEach(function (root) {
          if (step.kind === 'css') {
            try { out = out.concat(Array.prototype.slice.call((root.querySelectorAll ? root : document).querySelectorAll(step.selector))); }
            catch (e) { throw new Error('Invalid selector: ' + step.selector); }
          } else if (step.kind === 'role') {
            var opts = step.options || {};
            out = out.concat(allElements(root).filter(function (el) {
              if (roleOf(el) !== step.role) return false;
              if (opts.level && /^h[1-6]$/i.test(el.tagName || '') && Number((el.tagName || '').slice(1)) !== Number(opts.level)) return false;
              return opts.name === undefined || matches(nameOf(el), opts.name, opts.exact);
            }));
          } else if (step.kind === 'text') {
            var candidates = allElements(root).filter(function (el) {
              return matches(textOf(el), step.text, step.options && step.options.exact);
            });
            out = out.concat(candidates.filter(function (el) {
              return !Array.prototype.some.call(el.children || [], function (child) {
                return matches(textOf(child), step.text, step.options && step.options.exact);
              });
            }));
          } else if (step.kind === 'label') {
            allElements(root).forEach(function (el) {
              if (el.tagName && el.tagName.toLowerCase() === 'label' && matches(textOf(el), step.text, step.options && step.options.exact)) {
                var ctl = controlForLabel(el);
                if (ctl) out.push(ctl);
              }
              if ((el.tagName || '').match(/^(input|textarea|select)$/i) && matches(labelsFor(el) || nameOf(el), step.text, step.options && step.options.exact)) {
                out.push(el);
              }
            });
          } else if (step.kind === 'placeholder') {
            out = out.concat(allElements(root).filter(function (el) {
              return /^(input|textarea)$/i.test(el.tagName || '') &&
                matches(el.getAttribute('placeholder') || '', step.text, step.options && step.options.exact);
            }));
          } else if (step.kind === 'alt') {
            out = out.concat(allElements(root).filter(function (el) {
              return matches(el.getAttribute && el.getAttribute('alt') || '', step.text, step.options && step.options.exact);
            }));
          } else if (step.kind === 'title') {
            out = out.concat(allElements(root).filter(function (el) {
              return matches(el.getAttribute && el.getAttribute('title') || '', step.text, step.options && step.options.exact);
            }));
          } else if (step.kind === 'testid') {
            var selector = '[' + tidAttr + '="' + String(step.value).replace(/"/g, '\\"') + '"]';
            out = out.concat(Array.prototype.slice.call((root.querySelectorAll ? root : document).querySelectorAll(selector)));
          } else if (step.kind === 'filter') {
            out = roots.filter(function (el) {
              var opts = step.options || {};
              if (opts.hasText !== undefined && !matches(textOf(el), opts.hasText, false)) return false;
              return true;
            });
          } else if (step.kind === 'nth') {
            var index = step.index < 0 ? roots.length + step.index : step.index;
            out = roots[index] ? [roots[index]] : [];
          } else if (step.kind === 'last') {
            out = roots.length ? [roots[roots.length - 1]] : [];
          }
        });
        return unique(out);
      }
      function resolve(locator) {
        var roots = [document];
        (locator || []).forEach(function (step) {
          roots = queryStep(roots, step);
        });
        return roots;
      }
      function strictOne(locator) {
        var nodes = resolve(locator);
        if (nodes.length !== 1) throw new Error('Strict locator expected 1 element, found ' + nodes.length);
        return nodes[0];
      }
      function fire(el, type, init) {
        init = init || {};
        var event;
        if (/^mouse|click$/.test(type)) event = new MouseEvent(type, Object.assign({ bubbles: true, cancelable: true, view: window }, init));
        else if (/^key/.test(type)) event = new KeyboardEvent(type, Object.assign({ bubbles: true, cancelable: true }, init));
        else event = new Event(type, { bubbles: true, cancelable: true });
        el.dispatchEvent(event);
      }
      function setValue(el, value) {
        var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        var desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(el, value);
        else el.value = value;
        fire(el, 'input');
        fire(el, 'change');
      }
      function scrollIntoViewWithinIframe(el) {
        // Element.scrollIntoView() walks all ancestor scroll containers,
        // including the host page's tutorial scroll container in Chrome —
        // which would shift the entire tutorial layout when an action targets
        // an element inside the iframe. Scroll only the iframe's own window
        // so the host layout stays put.
        if (!el || !el.getBoundingClientRect || !window.scrollTo) return;
        var rect = el.getBoundingClientRect();
        var vw = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
        var vh = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0;
        if (!vw || !vh) return;
        // Match the previous { block: 'center', inline: 'center' } intent:
        // place the element at the center of the iframe viewport.
        var targetY = window.scrollY + rect.top + rect.height / 2 - vh / 2;
        var targetX = window.scrollX + rect.left + rect.width / 2 - vw / 2;
        try {
          window.scrollTo({
            top: Math.max(0, targetY),
            left: Math.max(0, targetX),
            behavior: 'instant'
          });
        } catch (e) {
          // Some browsers reject the options dict; fall back to the legacy signature.
          window.scrollTo(Math.max(0, targetX), Math.max(0, targetY));
        }
      }
      function handleAction(payload) {
        var el = strictOne(payload.locator);
        var action = payload.action;
        scrollIntoViewWithinIframe(el);
        if (action === 'click') {
          fire(el, 'mouseover'); fire(el, 'mousemove'); fire(el, 'mousedown'); fire(el, 'mouseup'); fire(el, 'click');
        } else if (action === 'fill') {
          if (!/^(input|textarea)$/i.test(el.tagName || '')) throw new Error('fill() target is not an input or textarea');
          el.focus(); setValue(el, payload.value || '');
        } else if (action === 'type') {
          if (!/^(input|textarea)$/i.test(el.tagName || '')) throw new Error('type() target is not an input or textarea');
          el.focus(); setValue(el, String(el.value || '') + String(payload.value || ''));
        } else if (action === 'check' || action === 'uncheck') {
          if (!/^(input)$/i.test(el.tagName || '') || !/^(checkbox|radio)$/i.test(el.type || '')) throw new Error(action + '() target is not a checkbox or radio');
          el.checked = action === 'check';
          fire(el, 'input'); fire(el, 'change'); fire(el, 'click');
        } else if (action === 'press') {
          fire(el, 'keydown', { key: payload.key }); fire(el, 'keyup', { key: payload.key });
        } else if (action === 'hover') {
          fire(el, 'mouseover'); fire(el, 'mousemove');
        } else if (action === 'selectOption') {
          if (!/^select$/i.test(el.tagName || '')) throw new Error('selectOption() target is not a select');
          var value = Array.isArray(payload.value) ? payload.value[0] : payload.value;
          if (value && typeof value === 'object') value = value.value || value.label;
          el.value = String(value);
          fire(el, 'input'); fire(el, 'change');
        }
        return true;
      }
      function checkAssertion(payload) {
        var nodes = resolve(payload.locator);
        var a = payload.assertion;
        function fail(msg) { return { pass: false, message: msg }; }
        function pass() { return { pass: true, message: '' }; }
        if (a === 'count') return nodes.length === Number(payload.expected) ? pass() : fail('Expected count ' + payload.expected + ', got ' + nodes.length);
        if (a === 'hidden') return nodes.length === 0 || nodes.every(function (el) { return !visible(el); }) ? pass() : fail('Expected element to be hidden');
        if (a === 'visibleLoose') return nodes.some(visible) ? pass() : fail('Expected at least one visible element');
        if (nodes.length !== 1) return fail('Strict locator expected 1 element, found ' + nodes.length);
        var el = nodes[0];
        if (a === 'visible') return visible(el) ? pass() : fail('Expected element to be visible');
        if (a === 'text') return matches(textOf(el), payload.expected, true) ? pass() : fail('Expected text ' + JSON.stringify(payload.expected && payload.expected.value) + ', got ' + JSON.stringify(textOf(el)));
        if (a === 'containText') return matches(textOf(el), payload.expected, false) ? pass() : fail('Expected text to contain ' + JSON.stringify(payload.expected && payload.expected.value) + ', got ' + JSON.stringify(textOf(el)));
        if (a === 'value') return matches(el.value || '', payload.expected, true) ? pass() : fail('Expected value ' + JSON.stringify(payload.expected && payload.expected.value) + ', got ' + JSON.stringify(el.value || ''));
        if (a === 'attribute') {
          var name = payload.expected && payload.expected.name;
          if (!el.hasAttribute(name)) return fail('Expected attribute ' + name + ' to exist');
          if (!payload.expected.value) return pass();
          var attr = el.getAttribute(name);
          return matches(attr, payload.expected.value, true) ? pass() : fail('Expected attribute ' + name + ' to match, got ' + JSON.stringify(attr));
        }
        if (a === 'checked') return el.checked ? pass() : fail('Expected element to be checked');
        if (a === 'enabled') return !el.disabled ? pass() : fail('Expected element to be enabled');
        if (a === 'disabled') return el.disabled ? pass() : fail('Expected element to be disabled');
        return fail('Unsupported assertion: ' + a);
      }
      function handleValue(payload) {
        var el = strictOne(payload.locator);
        if (payload.value === 'textContent') return el.textContent || '';
        if (payload.value === 'inputValue') return el.value || '';
        return null;
      }
      function handle(payload) {
        if (payload.type === 'goto') {
          try {
            if (payload.payload && payload.payload.url && payload.payload.url.indexOf('#') === 0) window.location.hash = payload.payload.url;
          } catch (e) {}
          return true;
        }
        if (payload.type === 'action') return handleAction(payload.payload);
        if (payload.type === 'count') return resolve(payload.payload.locator).length;
        if (payload.type === 'value') return handleValue(payload.payload);
        if (payload.type === 'assert') return checkAssertion(payload.payload);
        throw new Error('Unsupported Playwright command: ' + payload.type);
      }
      window.addEventListener('message', function (event) {
        var data = event.data;
        if (!data || data.__sebookPlaywrightCompat !== 'request') return;
        Promise.resolve().then(function () {
          return handle(data);
        }).then(function (value) {
          event.source.postMessage({ __sebookPlaywrightCompat: 'response', id: data.id, ok: true, value: value }, '*');
        }).catch(function (err) {
          event.source.postMessage({ __sebookPlaywrightCompat: 'response', id: data.id, ok: false, error: err && err.message || String(err) }, '*');
        });
      });
    } + ')(' + JSON.stringify(RESPONSE_TAG) + ', ' + JSON.stringify(testIdAttribute) + ');';
  }

  function run(options) {
    var runner = new CompatRunner(options || {});
    return runner.run();
  }

  global.SEBookPlaywrightCompat = {
    run: run,
    agentScript: agentScript,
  };
})(window);

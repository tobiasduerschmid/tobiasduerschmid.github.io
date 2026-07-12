/**
 * SEBook Playwright compatibility runner.
 *
 * This is a teaching runner for browser-hosted tutorials. Students write
 * Playwright-shaped spec files that can be copied into a real project, while
 * this runner evaluates those specs in a terminable opaque-origin worker and
 * drives the tutorial preview iframe with a focused subset of the Playwright
 * API. Preview commands travel through the React assertion broker's private
 * MessageChannel so app code cannot inspect or forge them.
 */
(function (global) {
  'use strict';

  var NativePromise = global.Promise;
  var NativeError = global.Error;
  var NativeString = global.String;
  var NativeMessageChannel = global.MessageChannel;
  var NativeWorker = global.Worker;
  var NativeAbortController = global.AbortController;
  var scheduleTimeout = global.setTimeout.bind(global);
  var cancelTimeout = global.clearTimeout.bind(global);
  var call = Function.prototype.call;
  var addWindowEventListener = global.addEventListener.bind(global);
  var removeWindowEventListener = global.removeEventListener.bind(global);
  var addPortEventListener = call.bind(MessagePort.prototype.addEventListener);
  var removePortEventListener = call.bind(MessagePort.prototype.removeEventListener);
  var postPortMessage = call.bind(MessagePort.prototype.postMessage);
  var startPort = call.bind(MessagePort.prototype.start);
  var closePort = call.bind(MessagePort.prototype.close);
  var sliceString = call.bind(String.prototype.slice);
  var WORKER_SOURCE_URL = '/js/playwright-compat/runner.js';
  var WORKER_INIT = 'sebook-playwright-worker-init';
  var WORKER_BOOT_TIMEOUT_MS = 10000;
  var WORKER_WATCHDOG_GRACE_MS = 500;
  var PREVIEW_RESET_TIMEOUT_MS = 30000;
  var cachedWorkerSource = null;
  var resetSequence = 0;

  function delay(ms) {
    return new NativePromise(function (resolve) { scheduleTimeout(resolve, ms); });
  }

  function errorMessage(error) {
    var message;
    try {
      message = NativeString(error && error.message || error || 'Playwright runner failed');
    } catch (stringError) {
      message = 'Playwright runner failed';
    }
    return sliceString(message, 0, 2000);
  }

  function resetScrollState(frame) {
    try {
      var doc = frame && frame.contentDocument;
      var win = frame && frame.contentWindow;
      // fill()/click() focus controls. Blur before the result panel resizes the
      // preview, otherwise Chrome can re-anchor its scroll to the focused node.
      if (doc && doc.activeElement && doc.activeElement.blur) doc.activeElement.blur();
      var html = doc && doc.documentElement;
      var previousBehavior = html && html.style.scrollBehavior;
      if (html) html.style.scrollBehavior = 'auto';
      if (win && typeof win.scrollTo === 'function') {
        try { win.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }
        catch (innerError) { win.scrollTo(0, 0); }
      }
      if (html) html.style.scrollBehavior = previousBehavior || '';
    } catch (frameError) { /* opaque-origin or detached preview */ }

    // Element scrolling inside an iframe has historically nudged scrollable
    // ancestors in Chrome. Reset those host containers as defense in depth.
    try {
      var node = frame && frame.parentNode;
      while (node && node.nodeType === 1) {
        if (node.scrollTop) node.scrollTop = 0;
        if (node.scrollLeft) node.scrollLeft = 0;
        node = node.parentNode;
      }
    } catch (hostError) { /* detached preview */ }
  }

  function scheduleScrollReset(frame) {
    resetScrollState(frame);
    if (typeof global.requestAnimationFrame === 'function') {
      global.requestAnimationFrame(function () {
        global.requestAnimationFrame(function () { resetScrollState(frame); });
      });
    } else {
      scheduleTimeout(function () { resetScrollState(frame); }, 0);
    }
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
    var timeoutMs = (options && options.timeout) || 5000;
    var port = options && options.port;
    var requestType = options && options.requestType || 'playwright';
    var sequence = 0;
    var pending = {};
    var disposed = false;
    if (!port) throw new Error('Private React preview broker is unavailable');

    function handleMessage(event) {
      if (!event.data || event.data.type !== 'playwright-result') return;
      var item = pending[event.data.id];
      if (!item) return;
      delete pending[event.data.id];
      cancelTimeout(item.timer);
      if (event.data.ok) item.resolve(event.data.value);
      else item.reject(new Error(event.data.error || 'Playwright command failed'));
    }

    addPortEventListener(port, 'message', handleMessage);
    startPort(port);

    this.dispose = function () {
      if (disposed) return;
      disposed = true;
      removePortEventListener(port, 'message', handleMessage);
      Object.keys(pending).forEach(function (id) {
        pending[id].reject(new NativeError('Playwright runner was disposed'));
        cancelTimeout(pending[id].timer);
      });
      pending = {};
    };

    this.command = function (type, payload, timeout) {
      if (disposed) {
        return NativePromise.reject(new NativeError('Playwright runner was disposed'));
      }
      var id = ++sequence;
      return new NativePromise(function (resolve, reject) {
        var timer = scheduleTimeout(function () {
          delete pending[id];
          reject(new Error('Timed out waiting for preview command: ' + type));
        }, timeout || timeoutMs);
        pending[id] = { resolve: resolve, reject: reject, timer: timer };
        postPortMessage(port, {
          type: requestType,
          id: id,
          commandType: type,
          payload: payload || {},
        });
      });
    };
  }

  function WorkerWatchdog(port) {
    this.arm = function (timeout, label) {
      postPortMessage(port, {
        type: 'watchdog-arm',
        timeout: timeout,
        label: label,
      });
    };
  }

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
    this.port = options.port;
    this.requestType = options.requestType || 'playwright';
    this.watchdog = options.watchdog || null;
    this.resetTimeout = options.resetTimeout || PREVIEW_RESET_TIMEOUT_MS;
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
        var fn = new Function(
          'test',
          'expect',
          '"use strict";\n' + transformed + '\n//# sourceURL=' + filename
        );
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
    if (testCase.skip) {
      if (this.watchdog) this.watchdog.arm(this.timeout, 'Playwright test scheduling');
      return NativePromise.resolve(true);
    }
    var broker;
    var work = NativePromise.resolve();
    if (this.resetBetweenTests && this.rebuildPreview) {
      if (this.watchdog) this.watchdog.arm(this.resetTimeout, 'React preview reset');
      work = work.then(function () { return self.rebuildPreview(); });
    } else if (this.watchdog) {
      this.watchdog.arm(this.timeout, 'Learner Playwright test');
    }
    return work.then(function (rebuiltPreview) {
      if (self.watchdog) self.watchdog.arm(self.timeout, 'Learner Playwright test');
      if (rebuiltPreview && rebuiltPreview.frame) {
        self.previewFrame = rebuiltPreview.frame;
        if (rebuiltPreview.port) self.port = rebuiltPreview.port;
      }
      broker = new PreviewBroker(self.previewFrame, {
        timeout: self.timeout,
        port: self.port,
        requestType: self.requestType,
      });
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
      return NativePromise.race([
        chain,
        delay(self.timeout).then(function () {
          throw new NativeError('Test timed out after ' + self.timeout + 'ms');
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
    if (this.watchdog) this.watchdog.arm(this.timeout, 'Learner Playwright spec loading');
    var loadError = this.evaluateSpecs();
    if (loadError) {
      console.warn('[PlaywrightCompat] Failed to load spec:', loadError.error);
      return NativePromise.resolve({
        tests: [{ description: 'Load ' + loadError.filename }],
        results: [false],
      });
    }
    if (!this.registry.length) {
      return NativePromise.resolve({
        tests: [{ description: 'At least one Playwright test is defined' }],
        results: [false],
      });
    }
    var tests = this.registry.map(function (item) {
      return { description: item.title + (item.skip ? ' (skipped)' : '') };
    });
    var results = [];
    var chain = NativePromise.resolve();
    this.registry.forEach(function (testCase, index) {
      chain = chain.then(function () {
        return this._runOne(testCase).then(function (result) {
          results[index] = result;
        });
      }.bind(this));
    }, this);
    return chain.then(function () { return { tests: tests, results: results }; });
  };

  function agentScript(config) {
    config = config || {};
    var testIdAttribute = config.testIdAttribute || 'data-testid';
    return '(' + function (tidAttr) {
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
      // The repository-owned assertion broker captures this function before
      // learner scripts run, deletes the temporary global, and invokes it only
      // for requests received through its private MessageChannel.
      window.__sebookPlaywrightCompatCommand = handle;
    } + ')(' + JSON.stringify(testIdAttribute) + ');';
  }

  function requestPreviewReset(port, timeout) {
    var id = 'reset-' + (++resetSequence);
    return new NativePromise(function (resolve, reject) {
      var timer = scheduleTimeout(function () {
        removePortEventListener(port, 'message', handleResetResult);
        reject(new NativeError('Timed out while rebuilding the React preview'));
      }, timeout || PREVIEW_RESET_TIMEOUT_MS);

      function handleResetResult(event) {
        var message = event.data;
        if (!message || message.type !== 'reset-result' || message.id !== id) return;
        removePortEventListener(port, 'message', handleResetResult);
        cancelTimeout(timer);
        if (message.ok) resolve(true);
        else reject(new NativeError(message.error || 'Could not rebuild the React preview'));
      }

      addPortEventListener(port, 'message', handleResetResult);
      postPortMessage(port, { type: 'reset-preview', id: id });
    });
  }

  function runInsideWorker(message, sessionPort) {
    var execution;
    try {
      var timeout = Number(message.timeout) || 5000;
      var resetTimeout = timeout * 3;
      if (resetTimeout < PREVIEW_RESET_TIMEOUT_MS) resetTimeout = PREVIEW_RESET_TIMEOUT_MS;
      startPort(sessionPort);
      postPortMessage(sessionPort, { type: 'ready' });

      var runner = new CompatRunner({
        files: message.files || {},
        testFiles: message.testFiles || [],
        timeout: timeout,
        resetBetweenTests: message.resetBetweenTests !== false,
        port: sessionPort,
        requestType: 'preview-command',
        watchdog: new WorkerWatchdog(sessionPort),
        resetTimeout: resetTimeout,
        rebuildPreview: function () {
          return requestPreviewReset(sessionPort, resetTimeout);
        },
      });
      execution = runner.run();
    } catch (error) {
      postPortMessage(sessionPort, { type: 'fatal', error: errorMessage(error) });
      return;
    }

    execution.then(function (result) {
      postPortMessage(sessionPort, { type: 'complete', result: result });
    }).catch(function (error) {
      postPortMessage(sessionPort, { type: 'fatal', error: errorMessage(error) });
    });
  }

  function listenForWorkerRun() {
    function handleInit(event) {
      var message = event.data;
      var sessionPort = event.ports && event.ports[0];
      if (!message || message.type !== WORKER_INIT || !sessionPort) return;
      removeWindowEventListener('message', handleInit);
      runInsideWorker(message, sessionPort);
    }

    addWindowEventListener('message', handleInit);
  }

  function loadWorkerSource(signal) {
    if (cachedWorkerSource) return NativePromise.resolve(cachedWorkerSource);

    // Do not cache an in-flight request. A browser/network stack can leave a
    // fetch pending indefinitely; sharing that Promise would poison every
    // later test run even after its own bootstrap watchdog fired. Each run
    // owns and can abort its fetch until one request completes successfully.
    var requestOptions = { credentials: 'same-origin' };
    if (signal) requestOptions.signal = signal;
    return global.fetch(WORKER_SOURCE_URL, requestOptions).then(function (response) {
      if (!response.ok) {
        throw new NativeError('HTTP ' + response.status + ' while loading ' + WORKER_SOURCE_URL);
      }
      return response.text();
    }).then(function (source) {
      if (!source) throw new NativeError('Worker source was empty');
      cachedWorkerSource = source;
      return source;
    }).catch(function (error) {
      throw new NativeError('Could not load isolated Playwright worker: ' + errorMessage(error));
    });
  }

  function createOpaqueWorker(source) {
    if (typeof NativeWorker !== 'function') {
      throw new NativeError('This browser does not support Web Workers');
    }
    // The HTML Standard assigns data-URL workers a unique opaque origin. That
    // keeps learner specs away from the tutorial's DOM and origin storage,
    // while Worker#terminate gives the host a hard stop for synchronous loops.
    var workerUrl = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(
      source + '\n//# sourceURL=' + WORKER_SOURCE_URL
    );
    return new NativeWorker(workerUrl, { name: 'SEBook Playwright learner specs' });
  }

  function run(options) {
    options = options || {};
    return new NativePromise(function (resolve, reject) {
      if (!global.document || !global.document.body) {
        reject(new NativeError('Playwright runner requires a document body'));
        return;
      }
      if (!options.port) {
        reject(new NativeError('Private React preview broker is unavailable'));
        return;
      }
      if (options.resetBetweenTests !== false && typeof options.rebuildPreview !== 'function') {
        reject(new NativeError('Playwright runner cannot reset the React preview'));
        return;
      }

      var worker = null;
      var sessionPort = null;
      var previewBroker = null;
      var previewFrame = options.previewFrame || null;
      var previewPort = options.port;
      var bootTimer = null;
      var watchdogTimer = null;
      var sourceAbortController = typeof NativeAbortController === 'function'
        ? new NativeAbortController()
        : null;
      var settled = false;

      function sendToWorker(payload) {
        if (settled || !sessionPort) return;
        postPortMessage(sessionPort, payload);
      }

      function disposePreviewBroker() {
        if (!previewBroker) return;
        previewBroker.dispose();
        previewBroker = null;
      }

      function getPreviewBroker() {
        if (!previewBroker) {
          previewBroker = new PreviewBroker(previewFrame, {
            timeout: Number(options.timeout) || 5000,
            port: previewPort,
            requestType: 'playwright',
          });
        }
        return previewBroker;
      }

      function cleanup() {
        if (bootTimer) cancelTimeout(bootTimer);
        if (watchdogTimer) cancelTimeout(watchdogTimer);
        bootTimer = null;
        watchdogTimer = null;
        if (sourceAbortController) {
          try { sourceAbortController.abort(); } catch (abortError) { /* already settled */ }
          sourceAbortController = null;
        }
        disposePreviewBroker();
        if (sessionPort) {
          removePortEventListener(sessionPort, 'message', handleSessionMessage);
          try { closePort(sessionPort); } catch (closeError) { /* already closed */ }
          sessionPort = null;
        }
        if (worker) {
          worker.removeEventListener('error', handleWorkerError);
          worker.removeEventListener('messageerror', handleWorkerMessageError);
          worker.terminate();
          worker = null;
        }
      }

      function finishWithError(error) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error instanceof NativeError ? error : new NativeError(errorMessage(error)));
      }

      function finishWithResult(result) {
        if (settled) return;
        scheduleScrollReset(previewFrame);
        settled = true;
        cleanup();
        resolve(result);
      }

      function replyToPreviewCommand(message, ok, value, error) {
        sendToWorker({
          type: 'playwright-result',
          id: message.id,
          ok: ok,
          value: value,
          error: error || '',
        });
      }

      function handlePreviewCommand(message) {
        if ((typeof message.id !== 'string' && typeof message.id !== 'number') ||
            typeof message.commandType !== 'string') return;
        var command;
        try {
          command = getPreviewBroker().command(message.commandType, message.payload || {});
        } catch (error) {
          replyToPreviewCommand(message, false, null, errorMessage(error));
          return;
        }
        command.then(function (value) {
          replyToPreviewCommand(message, true, value, '');
        }).catch(function (error) {
          replyToPreviewCommand(message, false, null, errorMessage(error));
        });
      }

      function handleResetRequest(message) {
        if (typeof options.rebuildPreview !== 'function') {
          sendToWorker({
            type: 'reset-result',
            id: message.id,
            ok: false,
            error: 'Playwright runner cannot reset the React preview',
          });
          return;
        }

        var rebuild;
        try {
          rebuild = options.rebuildPreview();
        } catch (error) {
          sendToWorker({ type: 'reset-result', id: message.id, ok: false, error: errorMessage(error) });
          return;
        }

        NativePromise.resolve(rebuild).then(function (rebuiltPreview) {
          if (!rebuiltPreview || !rebuiltPreview.port) {
            throw new NativeError('Rebuilt React preview did not provide a private broker');
          }
          disposePreviewBroker();
          previewFrame = rebuiltPreview.frame || previewFrame;
          previewPort = rebuiltPreview.port;
          sendToWorker({ type: 'reset-result', id: message.id, ok: true });
        }).catch(function (error) {
          sendToWorker({ type: 'reset-result', id: message.id, ok: false, error: errorMessage(error) });
        });
      }

      function armWatchdog(message) {
        if (watchdogTimer) cancelTimeout(watchdogTimer);
        var timeout = Number(message.timeout);
        if (!(timeout > 0) || !global.isFinite(timeout)) {
          timeout = Number(options.timeout) || 5000;
        }
        var label = message.label || 'Learner Playwright code';
        watchdogTimer = scheduleTimeout(function () {
          finishWithError(new NativeError(
            label + ' timed out after ' + timeout + 'ms and was terminated'
          ));
        }, timeout + WORKER_WATCHDOG_GRACE_MS);
      }

      function handleSessionMessage(event) {
        var message = event.data;
        if (!message || typeof message.type !== 'string') return;
        if (message.type === 'ready') {
          if (bootTimer) {
            cancelTimeout(bootTimer);
            bootTimer = null;
          }
        } else if (message.type === 'watchdog-arm') {
          armWatchdog(message);
        } else if (message.type === 'preview-command') {
          handlePreviewCommand(message);
        } else if (message.type === 'reset-preview') {
          handleResetRequest(message);
        } else if (message.type === 'complete') {
          finishWithResult(message.result);
        } else if (message.type === 'fatal') {
          finishWithError(new NativeError(message.error || 'Isolated Playwright runner failed'));
        }
      }

      function handleWorkerError(event) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        finishWithError(new NativeError(
          'Isolated Playwright worker failed: ' + (event && event.message || 'unknown error')
        ));
      }

      function handleWorkerMessageError() {
        finishWithError(new NativeError('Isolated Playwright worker sent an unreadable message'));
      }

      function startWorker(source) {
        if (settled) return;
        var bootstrapPort = null;
        try {
          worker = createOpaqueWorker(source);
          worker.addEventListener('error', handleWorkerError);
          worker.addEventListener('messageerror', handleWorkerMessageError);
          var channel = new NativeMessageChannel();
          sessionPort = channel.port1;
          bootstrapPort = channel.port2;
          addPortEventListener(sessionPort, 'message', handleSessionMessage);
          startPort(sessionPort);
          worker.postMessage({
            type: WORKER_INIT,
            files: options.files || {},
            testFiles: options.testFiles || [],
            timeout: Number(options.timeout) || 5000,
            resetBetweenTests: options.resetBetweenTests !== false,
          }, [bootstrapPort]);
          bootstrapPort = null;
        } catch (error) {
          if (bootstrapPort) {
            try { closePort(bootstrapPort); } catch (closeError) { /* already closed */ }
          }
          finishWithError(error);
        }
      }

      bootTimer = scheduleTimeout(function () {
        finishWithError(new NativeError('Timed out while starting the isolated Playwright worker'));
      }, WORKER_BOOT_TIMEOUT_MS);
      loadWorkerSource(sourceAbortController && sourceAbortController.signal)
        .then(startWorker)
        .catch(finishWithError);
    });
  }

  if (typeof global.document === 'undefined' && typeof global.importScripts === 'function') {
    listenForWorkerRun();
  } else {
    global.SEBookPlaywrightCompat = {
      run: run,
      agentScript: agentScript,
    };
  }
})(typeof window !== 'undefined' ? window : self);

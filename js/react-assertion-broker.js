/**
 * Private assertion transport for an opaque-origin React preview.
 *
 * This script must execute before learner-authored scripts. It transfers one
 * end of a MessageChannel to the tutorial host, then keeps the other end in a
 * closure. Assertion commands and results travel only over that capability;
 * learner code cannot discover the port through window message listeners or
 * forge a result with parent.postMessage().
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var generation = Number(script && script.getAttribute('data-preview-generation')) || 0;
  var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  var NativeError = Error;
  var NativePromise = Promise;
  var NativeString = String;
  var call = Function.prototype.call;
  var addEventListener = call.bind(EventTarget.prototype.addEventListener);
  var postPortMessage = call.bind(MessagePort.prototype.postMessage);
  var startPort = call.bind(MessagePort.prototype.start);
  var promiseThen = call.bind(NativePromise.prototype.then);
  var promiseResolve = NativePromise.resolve.bind(NativePromise);
  var sliceString = call.bind(String.prototype.slice);
  var channel = new MessageChannel();
  var assertionPort = channel.port1;
  var playwrightCommand = window.__sebookPlaywrightCompatCommand;
  try { delete window.__sebookPlaywrightCompatCommand; } catch (deleteError) { /* non-fatal */ }

  function assertResult(condition, message) {
    if (!condition) throw new NativeError(message || 'Assertion failed');
  }

  function errorMessage(error) {
    var message;
    try {
      message = NativeString(error && error.message || error || 'Assertion failed');
    } catch (stringError) {
      message = 'Assertion failed';
    }
    return sliceString(message, 0, 2000);
  }

  function reply(requestId, passed, error) {
    postPortMessage(assertionPort, {
      type: 'result',
      id: requestId,
      passed: passed,
      error: error || '',
    });
  }

  function replyPlaywright(requestId, ok, value, error) {
    postPortMessage(assertionPort, {
      type: 'playwright-result',
      id: requestId,
      ok: ok,
      value: value,
      error: error || '',
    });
  }

  function handlePlaywrightRequest(request) {
    if (typeof playwrightCommand !== 'function') {
      replyPlaywright(request.id, false, null, 'Playwright preview agent is unavailable');
      return;
    }

    var execution;
    try {
      execution = playwrightCommand({
        type: request.commandType,
        payload: request.payload || {},
      });
    } catch (error) {
      replyPlaywright(request.id, false, null, errorMessage(error));
      return;
    }

    promiseThen(promiseResolve(execution), function (value) {
      replyPlaywright(request.id, true, value, '');
    }, function (error) {
      replyPlaywright(request.id, false, null, errorMessage(error));
    });
  }

  function handleRequest(event) {
    var request = event.data;
    if (!request || (typeof request.id !== 'string' && typeof request.id !== 'number')) return;
    if (request.type === 'playwright') {
      if (typeof request.commandType !== 'string') return;
      handlePlaywrightRequest(request);
      return;
    }
    if (request.type !== 'evaluate' || typeof request.command !== 'string') return;

    var frame = Object.freeze({
      contentDocument: document,
      contentWindow: window,
    });
    var evaluation;
    try {
      // Strict mode also prevents learner-installed callees from recovering
      // the repository command through the legacy Function#caller surface.
      var runAssertion = new AsyncFunction(
        'frame', 'code', 'assert', 'files', '"use strict";\n' + request.command
      );
      evaluation = runAssertion(frame, request.code || '', assertResult, request.files || {});
    } catch (error) {
      reply(request.id, false, errorMessage(error));
      return;
    }

    promiseThen(promiseResolve(evaluation), function () {
      reply(request.id, true, '');
    }, function (error) {
      reply(request.id, false, errorMessage(error));
    });
  }

  addEventListener(assertionPort, 'message', handleRequest);
  startPort(assertionPort);

  // This is sent synchronously before learner scripts execute. The host accepts
  // only the first port from the current, freshly-created preview WindowProxy.
  parent.postMessage({
    type: 'sebook-react-assertion-broker-ready',
    generation: generation,
  }, '*', [channel.port2]);
})();

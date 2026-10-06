(function () {
  var EXTENSION_ID = 'phcfjcdliacndimckihgbpncoohjffad';
  var statusNode = document.getElementById('profile-sync-status');
  var copyButton = document.getElementById('profile-sync-copy-extensions');

  function setStatus(text) {
    if (statusNode) statusNode.textContent = text;
  }

  function describe(state) {
    if (!state || !state.installed || state.skipped) {
      return 'The extension is not installed in this browser yet. After you load it, sync starts on its own.';
    }
    if (state.paused) {
      return 'The extension is installed, and syncing is paused. Resume it from the extension button in the Chrome toolbar.';
    }
    if (state.omittedCount) {
      return 'The extension is installed and syncing. ' + state.omittedCount + ' saved items are too large for Chrome profile sync and stay in this browser.';
    }
    return 'The extension is installed. Saved preferences and progress sync automatically with your Chrome profile.';
  }

  function queryExtension() {
    var runtime = window.chrome && window.chrome.runtime;
    if (!runtime || typeof runtime.sendMessage !== 'function') {
      setStatus(describe(null));
      return;
    }
    try {
      runtime.sendMessage(EXTENSION_ID, { type: 'status' }, function (response) {
        var failed = !!(runtime.lastError) || !response || !response.installed;
        setStatus(describe(failed ? null : response));
      });
    } catch (error) {
      setStatus(describe(null));
    }
  }

  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var address = 'chrome://extensions';
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        setStatus('Type chrome://extensions into the address bar.');
        return;
      }
      navigator.clipboard.writeText(address).then(function () {
        setStatus('Copied chrome://extensions. Paste it into the address bar.');
      }, function () {
        setStatus('Could not copy automatically. Type chrome://extensions into the address bar.');
      });
    });
  }

  queryExtension();
})();

(function () {
  var statusNode = document.getElementById('status');
  var detailNode = document.getElementById('detail');
  var pauseButton = document.getElementById('pause');
  var wipeButton = document.getElementById('wipe');
  var discardButton = document.getElementById('discard');

  function send(type) {
    return chrome.runtime.sendMessage({ type: type });
  }

  function render(state) {
    if (!state) {
      statusNode.textContent = 'Sync status is unavailable.';
      return;
    }
    pauseButton.textContent = state.paused ? 'Resume syncing' : 'Pause syncing';
    discardButton.hidden = !state.replacedCount;
    if (state.error) {
      statusNode.textContent = state.error + ' Saved data is still in this browser.';
    } else if (state.paused) {
      statusNode.textContent = 'Syncing is paused on this computer. Saved data remains in this browser.';
    } else {
      statusNode.textContent = 'Syncing automatically. ' + state.keyCount + ' saved items are in this Chrome profile.';
    }
    var details = [];
    if (state.omittedCount) {
      details.push(state.omittedCount + ' saved items are too large for Chrome profile sync and stay in the browser where they were saved.');
    }
    if (state.replacedCount) {
      details.push('The profile copy replaced ' + state.replacedCount + ' older values in this browser. Those previous values are kept in the extension on this computer.');
    }
    if (!state.paused && !state.error) {
      details.push('Other computers receive the copy when they use the same Chrome profile, with profile sync turned on, and with this extension installed.');
    }
    detailNode.textContent = details.join(' ');
  }

  function refresh() {
    send('status').then(render);
  }

  pauseButton.addEventListener('click', function () {
    send('status').then(function (state) {
      return send(state && state.paused ? 'resume' : 'pause');
    }).then(render);
  });

  wipeButton.addEventListener('click', function () {
    var confirmed = window.confirm('Delete the copy stored in this Chrome profile and pause syncing on this computer? Data that is already in this browser stays here.');
    if (!confirmed) return;
    send('wipe').then(render);
  });

  discardButton.addEventListener('click', function () {
    send('discard-backup').then(render);
  });

  refresh();
})();

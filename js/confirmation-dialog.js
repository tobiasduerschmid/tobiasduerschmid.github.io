(function () {
  'use strict';

  var active = false;

  /** Resolve true only after explicit confirmation; dismissal preserves work. */
  function confirm(options) {
    if (active) return Promise.resolve(false);
    active = true;
    var dialog = document.getElementById('sebook-confirmation-template').content.firstElementChild.cloneNode(true);
    var previousFocus = options.trigger || document.activeElement;
    var cancel = dialog.querySelector('.sebook-confirmation-cancel');
    var accept = dialog.querySelector('.sebook-confirmation-accept');
    dialog.querySelector('h2').textContent = options.title;
    dialog.querySelector('p').textContent = options.message;
    cancel.textContent = options.cancelLabel || 'Cancel';
    accept.textContent = options.confirmLabel;

    return new Promise(function (resolve) {
      var finished = false;
      function finish(confirmed) {
        if (finished) return;
        finished = true;
        dialog.close();
        dialog.remove();
        document.body.classList.remove('sebook-confirmation-open');
        active = false;
        if (previousFocus && previousFocus.isConnected) previousFocus.focus();
        resolve(confirmed);
      }
      cancel.addEventListener('click', function () { finish(false); });
      accept.addEventListener('click', function () { finish(true); });
      dialog.addEventListener('cancel', function (event) {
        event.preventDefault();
        finish(false);
      });
      dialog.addEventListener('close', function () { finish(false); });
      dialog.addEventListener('keydown', function (event) {
        // Editor shortcuts must not act on the inert workspace behind us.
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
        } else if (event.key === 'Tab') {
          event.preventDefault();
          (document.activeElement === cancel ? accept : cancel).focus();
        }
      });
      dialog.addEventListener('click', function (event) {
        if (event.target !== dialog) return;
        var bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) finish(false);
      });

      // The modal top layer stays above CSS fullscreen editors. Hosting inside
      // the fullscreen element also keeps it visible in native fullscreen.
      (document.fullscreenElement || document.body).appendChild(dialog);
      document.body.classList.add('sebook-confirmation-open');
      dialog.showModal();
      cancel.focus();
    });
  }

  window.SebookConfirmation = { confirm: confirm };
})();

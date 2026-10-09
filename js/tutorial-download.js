/* Download a snapshot of editor-managed files; never read saved progress or the preview. */
(function () {
  'use strict';

  function createZip(files) {
    if (!window.fflate) {
      throw new Error('ZIP support did not load. Back up your edits, then reload and try again.');
    }
    const entries = Object.create(null);
    for (const [path, content] of Object.entries(files)) {
      // Archive names must stay relative when Gradescope extracts them.
      if (!path || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) {
        throw new Error('Invalid ZIP file path: ' + path);
      }
      entries[path] = window.fflate.strToU8(content);
    }
    return new Blob([window.fflate.zipSync(entries)], { type: 'application/zip' });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
      // Keep the URL alive until the browser has consumed the download request.
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  }

  function attach({ button, status, filename, readFiles }) {
    button.addEventListener('click', () => {
      status.textContent = '';
      status.classList.add('sr-only');
      try {
        // Read synchronously at activation, including edits not yet auto-saved.
        downloadBlob(createZip(readFiles()), filename);
        status.textContent = filename + ' is ready. Check your downloads.';
      } catch (error) {
        status.classList.remove('sr-only');
        status.textContent = 'ZIP download failed. ' + error.message;
      }
    });
    button.disabled = false;
  }

  window.TutorialDownload = { attach };
})();

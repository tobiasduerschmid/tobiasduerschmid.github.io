/**
 * Tells the Chrome profile sync extension which saved keys the site has
 * retired. New cookies and localStorage keys are copied automatically, so
 * adding storage does not require an entry here or an extension update.
 * When a key is removed from the site, add it below so an older profile
 * copy cannot write that key back. Use `key` for one name, or `prefix`
 * for a whole family such as "old-feature-".
 */
(function () {
  window.__sebookStorageCatalog = {
    version: 1,
    retired: []
  };
  window.dispatchEvent(new Event('sebook-storage-catalog'));
})();

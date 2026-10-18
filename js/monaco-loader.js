/** One local Monaco dependency loader for tutorials and chapter editors. */
(function (global) {
  'use strict';
  const vs = new URL('vendor/monaco-editor/0.44.0/min/vs', document.currentScript.src).href;
  let loading;

  function load() {
    if (global.monaco && global.monaco.editor) return Promise.resolve(global.monaco);
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        function loadEditor() {
          global.require.config({ paths: { vs } });
          global.require(['vs/editor/editor.main'], () => resolve(global.monaco), reject);
        }
        if (global.require && global.require.config) return loadEditor();
        const script = document.createElement('script');
        script.src = vs + '/loader.js';
        script.onload = loadEditor;
        script.onerror = () => {
          script.remove();
          reject(new Error('Could not load the code editor.'));
        };
        document.head.appendChild(script);
      }).catch(error => { loading = null; throw error; });
    }
    return loading;
  }

  global.SEBookMonaco = { load };
})(window);

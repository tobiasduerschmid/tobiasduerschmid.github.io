/* Node-specific content adapter for the shared audio transport. */
(function () {
  'use strict';
  document.querySelectorAll('.nodejs-animation').forEach((root) => {
    window.NarratedExplainer.enhance(root, {
      storyboard: JSON.parse(root.querySelector('[data-nodejs-storyboard]').textContent),
      timing: JSON.parse(root.querySelector('[data-nodejs-timing]').textContent),
      render(scene, storyScene, cue, progress, motion) {
        window.NodejsAnimationArt.render(scene, storyScene.id, cue, progress, motion);
      },
    });
  });
})();

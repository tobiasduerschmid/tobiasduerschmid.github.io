/* One lesson lifecycle for every narration. Visual modules implement
   createRenderer(root, data), returning a function that presents a cue frame.
   They do not control playback, knowledge checks, or lesson continuation. */
(function () {
  'use strict';
  if (window.NarrationPlayer) return;

  function readData(root) {
    // Older cached markup uses these names for the same compiled data.
    const legacy = {
      story: '[data-np-storyboard], [data-explainer-storyboard], [data-case-storyboard]',
      timing: '[data-np-timing], [data-explainer-timing], [data-case-timing]',
      examples: '[data-np-examples]',
      quizzes: '[data-np-quizzes]',
    };
    const read = (name, fallback) => {
      const element = root.querySelector(`[data-narration-${name}]`)
        || (legacy[name] && root.querySelector(legacy[name]));
      if (element) return JSON.parse(element.textContent);
      if (fallback !== undefined) return fallback;
      throw new Error(`Narration ${name} data is missing.`);
    };
    const story = read('story');
    const quizzes = read('quizzes', {}) || {};
    // Both companion quizzes and inline decision checkpoints enter the same
    // lifecycle here. No renderer interprets or grades a question.
    const checks = story.scenes.map(scene => {
      const check = quizzes[scene.id] || scene.checkpoint;
      if (!check) return null;
      return { min_score: 0.8, shuffle_questions: false,
        ...(check.questions ? check : { questions: [check] }) };
    });
    return { story, timing: read('timing'), examples: read('examples', {}) || {}, checks, study: read('study', null) };
  }

  function linkNavigation(root, story, player) {
    const link = (item, sceneIndex) => {
      const name = item.textContent.trim();
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.setAttribute('aria-label', `${name}: jump to its start`);
      button.addEventListener('click', () => {
        player.selectScene(sceneIndex);
        const destination = root.querySelectorAll('[data-scene]')[sceneIndex];
        const target = Array.from(destination.querySelectorAll('.np-navigation button'))
          .find(candidate => candidate.textContent === name);
        if (target) target.focus();
      });
      item.replaceChildren(button);
      item.classList.add('is-linked');
    };
    root.querySelectorAll('.np-navigation .np-parts li').forEach(item => {
      const sceneIndex = story.scenes.findIndex(scene => scene.part === item.textContent.trim());
      if (sceneIndex >= 0) link(item, sceneIndex);
    });
    root.querySelectorAll('.np-outline li').forEach(item => link(item, Number(item.dataset.narrationSceneIndex)));
  }

  function bindReading(root, player) {
    const transcript = root.querySelector('.nja-transcript');
    const actions = root.querySelector('[data-narration-reading-actions]');
    if (!actions) return;
    actions.querySelector('[data-narration-action="read"]').addEventListener('click', () => {
      player.pause();
      transcript.open = true;
      transcript.querySelector('summary').focus();
      transcript.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    actions.querySelector('[data-narration-action="print"]').addEventListener('click', () => window.print());
    actions.hidden = false;
    transcript.open = false;
  }

  // Step navigation is an optional view of the same session, with or without
  // audio. It never maintains a second scene/cue position.
  function stepControls(root, { story }, shouldCheck) {
    const next = root.querySelector('[data-narration-action="next-step"]');
    const previous = root.querySelector('[data-narration-action="previous-step"]');
    const progress = root.querySelector('[data-narration-progress]');
    return {
      update({ sceneIndex, cueIndex, scene }) {
        if (!next) return;
        previous.disabled = sceneIndex === 0 && cueIndex === 0;
        next.textContent = cueIndex + 1 < scene.cues.length ? 'Next step'
          : shouldCheck(sceneIndex) ? 'Knowledge check'
          : sceneIndex + 1 < story.scenes.length ? 'Next scene' : 'Finish review';
        progress.textContent = `Scene ${sceneIndex + 1} of ${story.scenes.length} · Step ${cueIndex + 1} of ${scene.cues.length}`;
      },
      bind(player, finishScene) {
        if (!next) return;
        function showCue(sceneIndex, cueIndex) {
          player.showCue(sceneIndex, cueIndex);
          root.querySelector('.nja-status').textContent = `Step ${cueIndex + 1}: ${story.scenes[sceneIndex].cues[cueIndex].step}`;
        }
        next.addEventListener('click', () => {
          if (player.holdPrediction()) return;
          const index = player.currentScene();
          const cue = player.currentCue();
          if (cue + 1 < story.scenes[index].cues.length) showCue(index, cue + 1);
          else finishScene(index, false);
        });
        previous.addEventListener('click', () => {
          const index = player.currentScene();
          const cue = player.currentCue();
          if (cue > 0) showCue(index, cue - 1);
          else if (index > 0) showCue(index - 1, story.scenes[index - 1].cues.length - 1);
        });
      },
    };
  }

  /** Mount one compiled lesson using its declared visual renderer. All mutable
   * playback/check state belongs to this root. Repeated mounting is a no-op. */
  function mount(root) {
    if (root.classList.contains('is-enhanced')) return;
    const data = readData(root);
    const { story, timing, examples, checks } = data;
    // An incompletely rendered lesson still has its readable transcript.
    if (story.audio && !timing) return;
    const renderVisuals = window[root.dataset.narrationRenderer].createRenderer(root, data);
    const checkScenes = checks.flatMap((check, index) => check ? [index] : []);
    let finalCheckOnly = false;
    const shouldCheck = index => Boolean(checks[index]) && (!finalCheckOnly || index === checkScenes.at(-1));
    const steps = stepControls(root, data, shouldCheck);
    const status = root.querySelector('.nja-status');
    const playButton = root.querySelector('[data-action="play"]');
    const nextStep = root.querySelector('[data-narration-action="next-step"]');
    let player;
    let study;
    let resumeAfterCheck = Boolean(story.audio);
    window.NarrationPreferences.subscribe(preferences => {
      if (finalCheckOnly === preferences.finalCheckOnly) return;
      finalCheckOnly = preferences.finalCheckOnly;
      if (player) player.refresh();
    });

    function focusPlayback(resume) {
      const target = player.isFullscreen() ? root.querySelector('[data-vn-video]')
        : (!resume && nextStep) || playButton || root.querySelector('.vn-settings-toggle');
      target.focus({ preventScroll: true });
    }

    async function continueAfter(index, resume) {
      quiz.close();
      if (index + 1 < story.scenes.length) {
        player.selectScene(index + 1);
        focusPlayback(resume);
        if (resume && player.play) await player.play();
        return;
      }
      if (window.NarrationSong.continueToSong(root, player)) return;
      status.textContent = 'Lesson complete. Revisit any scene to review.';
      focusPlayback(true);
    }

    async function replaySegment(index) {
      const previousCheck = checkScenes.filter(checkIndex => checkIndex < index).pop();
      player.selectScene((previousCheck ?? -1) + 1);
      focusPlayback(true);
      await player.play();
    }

    const quiz = window.NarrationQuiz.create(root, {
      scenes: story.scenes, checks, reviews: data.study?.reviews || {},
      continueLabel: story.audio ? 'Continue narration' : 'Continue lesson',
      finishLabel: window.NarrationSong.hasSong(root) ? 'Continue to song' : 'Finish review',
      onContinue: index => continueAfter(index, resumeAfterCheck),
      onReplay: story.audio ? replaySegment : null,
      onReview(reference) {
        if (study) study.close();
        const sceneIndex = story.scenes.findIndex(scene => scene.id === reference.scene);
        const cueIndex = story.scenes[sceneIndex].cues.findIndex(cue => cue.id === reference.cue);
        player.showCue(sceneIndex, cueIndex);
      },
      onReviewReturn() {
        if (study) study.close();
        player.pause();
        player.dismissPrediction();
      },
    });

    async function finishScene(index, resume = Boolean(story.audio), { review = false } = {}) {
      resumeAfterCheck = resume;
      player.pause();
      player.dismissPrediction();
      if (study) study.close();
      if (checks[index] && (review || shouldCheck(index))) quiz.open(index);
      else if (resume && index === story.scenes.length - 1) status.textContent = 'Narration complete.';
      else await continueAfter(index, resume);
    }

    player = window.NarrationTransport.mount(root, {
      storyboard: story, timing, checkScenes, shouldCheck,
      render(frame) { renderVisuals(frame); steps.update(frame); if (study) study.update(frame); },
      onSectionEnd: finishScene, onSeek: quiz.close,
      canPlay: () => !quiz.isOpen() && !(study && study.isOpen()),
    });
    if (window.NarrationStudy) {
      study = window.NarrationStudy.create(root, data, player);
      player.refresh();
    }
    steps.bind(player, finishScene);
    linkNavigation(root, story, player);
    bindReading(root, player);
    root.querySelectorAll('[data-review-check]').forEach(button => {
      button.hidden = checkScenes.length === 0;
      button.addEventListener('click', async () => {
        const index = player.currentScene();
        if (checks[index]) await finishScene(index, Boolean(story.audio), { review: true });
        else status.textContent = `${index + 1}. ${story.scenes[index].label} has no knowledge check.`;
      });
    });
    root.querySelector('[data-narration-action="review-scene"]').addEventListener('click', () => {
      quiz.close();
      focusPlayback(false);
    });
    const language = root.querySelector('[data-setting="language"]');
    if (language) language.addEventListener('sebook:languagechange', () => {
      player.refresh();
      status.textContent = `Code language: ${examples[language.value].label}. Narration position unchanged.`;
    });
    return player;
  }

  window.NarrationPlayer = { mount };
  function init() { document.querySelectorAll('[data-narration-renderer]').forEach(mount); }
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

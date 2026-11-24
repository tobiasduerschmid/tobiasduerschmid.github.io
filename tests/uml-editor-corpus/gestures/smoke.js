'use strict';
// Family `smoke` (plan Task 3): one gesture that proves the harness end to end before the
// families of Tasks 4-8 are written.

module.exports = [
  {
    id: 'class-added-with-the-keyboard-on-the-uml-editor-page',
    family: 'smoke',
    type: 'class',
    page: '/SEBook/tools/uml-editor',
    start: null,
    steps: [
      // Enter on a palette button adds the element without the canvas.
      { do: 'press', target: { role: 'button', name: 'Add element: Class' }, key: 'Enter' },
    ],
    covers: ['addElementWithoutCanvas'],
  },
];

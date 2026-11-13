/* ArchUML-generated sequence geometry. Source: docs/always-code-sequence.puml.
 * Styling is owned by song-video-always-code.css; message groups use song time.
 * Vertical whitespace was compressed for the 960 x 540 stage; text stays unscaled.
 */
(function () {
  'use strict';
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" class="ac-sequence" viewBox="0 0 576.12 195" width="576" height="195" aria-hidden="true">
<g transform="translate(0,0)">
<line class="ac-sequence-lifeline" x1="83.60986328125" y1="36.8" x2="83.60986328125" y2="185.12" stroke-dasharray="6,4" stroke-linecap="round" />
<line class="ac-sequence-lifeline" x1="282.40966796875" y1="36.8" x2="282.40966796875" y2="185.12" stroke-dasharray="6,4" stroke-linecap="round" />
<line class="ac-sequence-lifeline" x1="486.859375" y1="36.8" x2="486.859375" y2="185.12" stroke-dasharray="6,4" stroke-linecap="round" />
<rect data-layout-id="actbar:7" data-layout-kind="activation" data-activation-start-line="7" data-activation-end-line="9" data-activation-pidx="2" x="480.859375" y="84.32" width="12" height="28.8" class="ac-sequence-activation" />
<rect data-layout-id="actbar:5" data-layout-kind="activation" data-activation-start-line="5" data-activation-end-line="11" data-activation-pidx="1" x="276.40966796875" y="55.52" width="12" height="86.4" class="ac-sequence-activation" />
<g class="ac-sequence-message" data-message="seqmsg:4">
<line x1="83.60986328125" y1="55.52" x2="275.90966796875" y2="55.52" stroke-linecap="butt" data-layout-route-id="seqmsg:4" data-layout-source="client" data-layout-target="service" class="ac-sequence-arrow" />
<polygon points="275.91,55.52 265.91,51.92 265.91,59.12" class="ac-sequence-call-head" />
<text x="179.759765625" y="51.2" text-anchor="middle" data-layout-route-id="seqmsg:4" data-layout-source="client" data-layout-target="service" class="ac-sequence-text">request()</text>
</g>
<g class="ac-sequence-message" data-message="seqmsg:6">
<line x1="288.90966796875" y1="84.32" x2="480.359375" y2="84.32" stroke-linecap="butt" data-layout-route-id="seqmsg:6" data-layout-source="service" data-layout-target="store" class="ac-sequence-arrow" />
<polygon points="480.36,84.32 470.36,80.72 470.36,87.92" class="ac-sequence-call-head" />
<text x="384.634521484375" y="80.0" text-anchor="middle" data-layout-route-id="seqmsg:6" data-layout-source="service" data-layout-target="store" class="ac-sequence-text">load()</text>
</g>
<g class="ac-sequence-message" data-message="seqmsg:8">
<line x1="480.359375" y1="113.12" x2="288.40966796875" y2="113.12" stroke-linecap="butt" data-layout-route-id="seqmsg:8" data-layout-source="store" data-layout-target="service" stroke-dasharray="6,4" class="ac-sequence-arrow" />
<polyline points="298.41,109.52 288.41,113.12 298.41,116.72" stroke-linecap="round" stroke-linejoin="miter" class="ac-sequence-arrow" />
<text x="384.384521484375" y="108.8" text-anchor="middle" data-layout-route-id="seqmsg:8" data-layout-source="store" data-layout-target="service" class="ac-sequence-text">data</text>
</g>
<g class="ac-sequence-message" data-message="seqmsg:10">
<line x1="275.90966796875" y1="141.92" x2="83.60986328125" y2="141.92" stroke-linecap="butt" data-layout-route-id="seqmsg:10" data-layout-source="service" data-layout-target="client" stroke-dasharray="6,4" class="ac-sequence-arrow" />
<polyline points="93.61,138.32 83.61,141.92 93.61,145.52" stroke-linecap="round" stroke-linejoin="miter" class="ac-sequence-arrow" />
<text x="179.759765625" y="137.6" text-anchor="middle" data-layout-route-id="seqmsg:10" data-layout-source="service" data-layout-target="client" class="ac-sequence-text">result</text>
</g>
<rect x="20" y="8.0" width="127.2197265625" height="28.8" class="ac-sequence-participant" />
<text x="83.60986328125" y="25.68" text-anchor="middle" class="ac-sequence-participant-text">Client</text>
<rect x="207.2197265625" y="8.0" width="150.3798828125" height="28.8" class="ac-sequence-participant" />
<text x="282.40966796875" y="25.68" text-anchor="middle" class="ac-sequence-participant-text">Service</text>
<rect x="417.599609375" y="8.0" width="138.51953125" height="28.8" class="ac-sequence-participant" />
<text x="486.859375" y="25.68" text-anchor="middle" class="ac-sequence-participant-text">Storage</text>
</g>
</svg>`;
  window.AlwaysCodeSequence = function (kit, parent) {
    const diagram = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
    const node = document.importNode(diagram, true);
    parent.appendChild(node);
    return { node, messages: Array.from(node.querySelectorAll('.ac-sequence-message')) };
  };
})();

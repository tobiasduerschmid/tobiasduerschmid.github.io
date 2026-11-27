// Article-specific illustrations. The essay stage owns timing and visibility.
(function () {
  'use strict';

  const ink = 'var(--be-ink)';
  const paper = 'var(--be-paper)';
  const blue = 'var(--be-blue)';
  const blueTint = 'var(--be-blue-tint)';
  const gold = 'var(--be-gold)';
  const goldTint = 'var(--be-gold-tint)';
  const shadow = 'var(--be-shadow)';

  function card({ x, y, width, height, tint = paper }) {
    return `
      <rect x="${x + 6}" y="${y + 6}" width="${width}" height="${height}" rx="12" fill="${shadow}" stroke="none"/>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="${tint}"/>`;
  }

  function label(x, y, text, align = 'start') {
    return `<text x="${x}" y="${y}" text-anchor="${align}" fill="${ink}" stroke="none">${text}</text>`;
  }

  function strokes(inner) {
    return `<g stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
  }

  function mergeChanges() {
    return `
      <g stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <rect x="379" y="18" width="228" height="45" rx="12" fill="${paper}"/>
        <circle cx="404" cy="40.5" r="12" fill="${goldTint}" stroke-width="2.4"/>
        <path d="M404 33 V40.5 L400 46" fill="none" stroke-width="2.4"/>
        <text x="427" y="49" fill="${ink}" stroke="none">Friday, 7 p.m.</text>
        <g data-be-item="0">
          <rect x="70" y="33" width="291" height="113" rx="12" fill="${shadow}" stroke="none"/>
          <rect x="63" y="26" width="291" height="113" rx="12" fill="${paper}"/>
          <text x="86" y="63" fill="${ink}" stroke="none">Your changes</text>
          <path d="M86 83 H192 M86 116 H175" fill="none" stroke-width="3"/>
          <path d="M96 99 H134 M151 99 H230" fill="none" stroke="${blue}" stroke-width="10"/>
        </g>
        <g data-be-item="1">
          <rect x="70" y="178" width="291" height="113" rx="12" fill="${shadow}" stroke="none"/>
          <rect x="63" y="171" width="291" height="113" rx="12" fill="${paper}"/>
          <text x="86" y="208" fill="${ink}" stroke="none">Teammate’s changes</text>
          <path d="M86 228 H192 M86 261 H175" fill="none" stroke-width="3"/>
          <path d="M96 244 H207" fill="none" stroke-width="12"/>
          <path d="M96 244 H207" fill="none" stroke="${gold}" stroke-width="6"/>
        </g>
        <g data-be-item="2">
          <path d="M373 86 C439 86 448 155 517 155 H543
                   M373 228 C439 228 448 155 517 155
                   M530 145 L543 155 L530 165" fill="none" stroke-width="4"/>
          <rect x="574" y="81" width="252" height="164" rx="13" fill="${shadow}" stroke="none"/>
          <rect x="567" y="74" width="252" height="164" rx="13" fill="${paper}"/>
          <rect x="568.5" y="86" width="8" height="140" rx="3" fill="${blue}" stroke="none"/>
          <text x="593" y="117" fill="${ink}" stroke="none">Combined file</text>
          <path d="M593 141 H699 M593 215 H682" fill="none" stroke-width="3"/>
          <path data-be-item="2" data-be-move="-507 -66" d="M603 165 H641 M658 165 H737"
                fill="none" stroke="${blue}" stroke-width="10"/>
          <g data-be-item="2" data-be-move="-507 56">
            <path d="M603 188 H714" fill="none" stroke-width="12"/>
            <path d="M603 188 H714" fill="none" stroke="${gold}" stroke-width="6"/>
          </g>
        </g>
      </g>`;
  }

  function robotAtGym() {
    return `
      <g stroke="${ink}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">
        <path d="M65 265 H815" stroke-width="2"/>
        <g data-be-item="0">
          <ellipse cx="228" cy="255" rx="101" ry="10" fill="${shadow}" stroke="none"/>
          <path d="M185 177 Q206 171 247 179 L253 203 L253 240 L222 240
                   L215 211 L203 240 L170 240 Z" fill="${blueTint}"/>
          <path d="M170 237 H203 L207 252 H160 Q157 245 170 237 Z
                   M222 237 H253 L268 248 V253 H222 Z" fill="${paper}"/>
          <path d="M179 122 Q169 129 164 149 L151 181 Q157 195 175 194
                   H250 Q261 194 259 182 L252 153 Q241 130 221 126 Z" fill="${blue}"/>
          <path d="M180 134 Q193 145 224 142 Q236 144 243 155"
                stroke="${blueTint}" stroke-width="4" fill="none"/>
          <path d="M166 171 Q184 176 207 169 L212 180 Q199 187 177 184
                   M212 175 L236 173 L240 191" fill="none"/>
          <path d="M187 106 L219 103 L226 136 Q208 151 186 135 Z" fill="${goldTint}"/>
          <path d="M170 100 Q159 88 167 71 Q170 58 183 58 Q190 43 209 50
                   Q226 43 240 57 Q254 61 255 77 L249 99 L237 114 H182 Z" fill="${ink}"/>
          <path d="M180 81 Q189 73 195 64 Q206 75 238 74
                   Q240 87 254 92 Q257 97 245 101 Q247 117 229 125
                   Q212 130 198 119 Q187 117 184 106 Q173 105 174 96
                   Q174 91 181 92 Z" fill="${goldTint}"/>
          <path d="M224 85 Q229 81 235 84 M222 112 Q231 115 237 110"
                fill="none" stroke-width="2.4"/>
          <path d="M231 89 V94" stroke-width="4"/>
          <text x="228" y="298" text-anchor="middle" fill="${ink}" stroke="none">Student watches</text>
        </g>

        <g data-be-item="1">
          <ellipse cx="633" cy="253" rx="117" ry="12" fill="${shadow}" stroke="none"/>
          <path d="M583 216 H609 V244 H580 Z M654 216 H680 L686 244 H656 Z" fill="${blueTint}"/>
          <rect x="570" y="239" width="52" height="18" rx="7" fill="${paper}"/>
          <rect x="642" y="239" width="52" height="18" rx="7" fill="${paper}"/>
          <path d="M578 171 H684 L672 226 H590 Z" fill="${goldTint}"/>
          <path d="M598 181 H662 L654 212 H605 Z" fill="${paper}"/>
          <circle cx="631" cy="196" r="8" fill="${gold}"/>

          <g data-be-item="2" data-be-move="0 50">
            <rect x="551" y="63" width="16" height="102" rx="7" fill="${blueTint}"/>
            <rect x="700" y="63" width="16" height="102" rx="7" fill="${blueTint}"/>
            <path d="M495 57 H773 V68 H495 Z" fill="${paper}"/>
            <rect x="484" y="42" width="17" height="41" rx="4" fill="${blueTint}"/>
            <rect x="497" y="34" width="23" height="57" rx="6" fill="${blue}"/>
            <rect x="746" y="34" width="23" height="57" rx="6" fill="${blue}"/>
            <rect x="766" y="42" width="17" height="41" rx="4" fill="${blueTint}"/>
            <rect x="546" y="48" width="26" height="29" rx="8" fill="${gold}"/>
            <rect x="695" y="48" width="26" height="29" rx="8" fill="${gold}"/>
            <path d="M503 47 H512 M752 47 H761 M551 57 H567 M700 57 H716"
                  fill="none" stroke-width="2.25"/>
          </g>

          <path d="M557 169 H588 M680 169 H710" stroke-width="12"/>
          <rect x="545" y="152" width="28" height="66" rx="11" fill="${blue}"/>
          <rect x="694" y="152" width="28" height="66" rx="11" fill="${blue}"/>
          <path d="M552 159 H566 M701 159 H715" stroke="${blueTint}" stroke-width="2.5"/>
          <rect x="580" y="126" width="102" height="55" rx="16" fill="${blueTint}"/>
          <rect x="592" y="135" width="78" height="36" rx="9" fill="${paper}"/>
          <path d="M610 146 V153 M651 146 V153" stroke-width="5"/>
          <path d="M621 157 Q631 165 641 157" fill="none" stroke-width="2.5"/>
          <text x="633" y="298" text-anchor="middle" fill="${ink}" stroke="none">Robot lifts</text>
        </g>
        <g data-be-item="2" fill="none" stroke-width="3.8">
          <path d="M812 117 V56 M803 65 L812 56 L821 65"/>
        </g>
      </g>`;
  }

  function memoryCapacity() {
    return strokes(`
      <g data-be-item="0">
        ${card({ x: 57, y: 45, width: 758, height: 226 })}
        ${label(436, 91, 'Working memory', 'middle')}
      </g>
      <g data-be-item="1">
        ${card({ x: 84, y: 116, width: 332, height: 88, tint: blueTint })}
        ${label(250, 170, 'Intrinsic load', 'middle')}
      </g>
      <g data-be-item="2">
        ${card({ x: 455, y: 116, width: 332, height: 88, tint: goldTint })}
        ${label(621, 170, 'Extraneous load', 'middle')}
      </g>
      <g data-be-item="3">
        <path d="M84 218 V227 H416 M455 227 H787 V218" fill="none"/>
        ${label(436, 253, 'One shared limit', 'middle')}
      </g>`);
  }

  function offloadFriction() {
    return strokes(`
      ${card({ x: 48, y: 39, width: 440, height: 245 })}
      ${label(268, 83, 'Working memory', 'middle')}
      <g data-be-item="0">
        ${card({ x: 154, y: 108, width: 222, height: 58, tint: blueTint })}
        ${label(265, 146, 'Target reasoning', 'middle')}
      </g>
      <g data-be-item="2">
        ${card({ x: 561, y: 112, width: 273, height: 140 })}
        ${label(697.5, 151, 'Tool takes over', 'middle')}
        <path d="M505 183 H545 M535 173 L545 183 L535 193" fill="none"/>
        <rect x="154" y="193" width="222" height="58" rx="12" fill="none" stroke-dasharray="8 7"/>
      </g>
      <g data-be-item="1">
        <g data-be-item="2" data-be-move="-432 23">
          ${card({ x: 586, y: 170, width: 222, height: 58, tint: goldTint })}
          ${label(697, 208, 'Setup friction', 'middle')}
        </g>
      </g>`);
  }

  function tutorWaits() {
    return strokes(`
      <g data-be-item="0">
        ${card({ x: 45, y: 43, width: 312, height: 110, tint: goldTint })}
        ${label(70, 86, 'Tutor asks')}
        ${label(70, 124, 'What comes next?')}
      </g>
      <g data-be-item="1">
        <path d="M376 98 H499 M489 88 L499 98 L489 108" fill="none"/>
        ${card({ x: 519, y: 43, width: 309, height: 110, tint: blueTint })}
        ${label(674, 82, 'You think and explain', 'middle')}
        <rect x="544" y="101" width="259" height="34" rx="8" fill="${paper}"/>
        <path data-be-item="1" data-be-move="-18 0" d="M561 119 H614 M624 119 H682 M692 119 H713" fill="none"/>
      </g>
      <g data-be-item="2">
        <path d="M673 164 V181" fill="none" stroke-dasharray="5 6"/>
        ${label(673, 209, 'If you need more help', 'middle')}
        <path d="M673 218 V223 H588 V234" fill="none" stroke-dasharray="5 6"/>
        ${card({ x: 511, y: 239, width: 155, height: 57 })}
        ${label(588, 276, 'Hint', 'middle')}
      </g>
      <g data-be-item="3">
        <path d="M673 223 H765 V234" fill="none" stroke-dasharray="5 6"/>
        ${card({ x: 685, y: 239, width: 158, height: 57 })}
        ${label(764, 276, 'Full example', 'middle')}
      </g>`);
  }

  function reversingFork() {
    return strokes(`
      <g data-be-item="0">
        ${card({ x: 234, y: 17, width: 412, height: 55 })}
        ${label(335, 53, 'A  B  C  D', 'middle')}
        <path d="M413 43 H469 M459 33 L469 43 L459 53" fill="none"/>
        ${label(545, 53, 'D  C  B  A', 'middle')}
      </g>
      <g data-be-item="1">
        <path d="M440 83 V93 H160 V112 M153 105 L160 112 L167 105" fill="none"/>
        ${card({ x: 35, y: 121, width: 250, height: 126, tint: blueTint })}
        ${label(160, 159, 'Standard library', 'middle')}
        <rect x="61" y="178" width="198" height="46" rx="8" fill="${paper}"/>
        <text x="160" y="209" text-anchor="middle" fill="${ink}" stroke="none"
              font-family="monospace" font-size="24">std::reverse</text>
      </g>
      <g data-be-item="2">
        <path d="M440 93 V112 M433 105 L440 112 L447 105" fill="none"/>
        ${card({ x: 315, y: 121, width: 250, height: 126, tint: goldTint })}
        ${label(440, 159, 'Two pointers', 'middle')}
        <rect x="355" y="176" width="170" height="38" rx="6" fill="${paper}"/>
        <path d="M397 176 V214 M440 176 V214 M483 176 V214" fill="none"/>
        ${label(376, 204, 'A', 'middle')}
        ${label(418, 204, 'B', 'middle')}
        ${label(462, 204, 'C', 'middle')}
        ${label(505, 204, 'D', 'middle')}
        <path data-be-item="2" data-be-move="-42 0" d="M418 221 L411 232 H425 Z" fill="${blue}"/>
        <path data-be-item="2" data-be-move="43 0" d="M462 221 L455 232 H469 Z" fill="${gold}"/>
      </g>
      <g data-be-item="3">
        <path d="M440 93 H720 V112 M713 105 L720 112 L727 105" fill="none"/>
        ${card({ x: 595, y: 121, width: 250, height: 126, tint: blueTint })}
        ${label(720, 159, 'Recursion', 'middle')}
      </g>
      <g data-be-item="4">
        ${card({ x: 223, y: 263, width: 434, height: 40 })}
        ${label(440, 292, 'Compare time and extra space', 'middle')}
      </g>
      <g data-be-item="5">
        <rect x="618" y="201" width="69" height="26" rx="5" fill="${goldTint}"/>
        <rect x="625" y="190" width="69" height="26" rx="5" fill="${paper}"/>
        <rect x="632" y="179" width="69" height="26" rx="5" fill="${paper}"/>
        ${label(772, 209, 'Call stack', 'middle')}
      </g>`);
  }

  function revisionLoop() {
    return strokes(`
      <g data-be-item="0">
        ${card({ x: 50, y: 32, width: 352, height: 222 })}
        ${label(76, 75, 'Your work')}
        <path d="M76 98 H344 M76 116 H303 M76 134 H329" fill="none"/>
        <path d="M76 159 H238" fill="none" stroke-width="6"/>
      </g>
      <g data-be-item="2">
        <path d="M420 120 H485 M475 110 L485 120 L475 130" fill="none"/>
        ${card({ x: 503, y: 32, width: 325, height: 222 })}
        ${label(526, 75, 'Check one rating')}
      </g>
      <g data-be-item="1">
        <g data-be-item="2" data-be-move="-450 90">
          ${card({ x: 526, y: 92, width: 278, height: 47, tint: blueTint })}
          ${label(665, 125, 'My self-rating', 'middle')}
        </g>
      </g>
      <g data-be-item="3">
        <rect x="526" y="162" width="278" height="66" rx="10" fill="${goldTint}"/>
        ${label(665, 204, 'Find the evidence', 'middle')}
        <path d="M76 166 H231" fill="none" stroke="${blue}" stroke-width="4"/>
      </g>
      <g data-be-item="4">
        <path d="M669 271 V281 Q669 295 655 295 H208 Q193 295 193 281 V267
                 M184 275 L193 267 L202 275" fill="none"/>
        <rect x="76" y="184" width="279" height="48" rx="9" fill="${goldTint}"/>
        ${label(215, 216, 'Revise it yourself', 'middle')}
      </g>`);
  }

  function brownFinal() {
    return strokes(`
      <g data-be-item="0">
        ${card({ x: 48, y: 30, width: 329, height: 146, tint: goldTint })}
        ${label(212, 71, 'Take-home exam', 'middle')}
        <text x="212" y="120" text-anchor="middle" fill="${ink}" stroke="none" font-size="38">96 / 100</text>
        ${label(212, 153, 'Class average', 'middle')}
      </g>
      <g data-be-item="1">
        <path d="M397 101 H478 M468 91 L478 101 L468 111" fill="none"/>
        ${card({ x: 501, y: 30, width: 329, height: 146, tint: blueTint })}
        ${label(665, 71, 'In-person final', 'middle')}
      </g>
      <g data-be-item="2">
        <path d="M211 190 V203 Q211 215 224 215 H336 V226" fill="none" stroke-dasharray="7 7"/>
        ${card({ x: 182, y: 234, width: 520, height: 67 })}
        ${label(442, 261, 'Many perfect scorers', 'middle')}
        ${label(442, 290, 'Dropped or missed the final', 'middle')}
      </g>
      <g data-be-item="3">
        <path d="M538 101 V145 M529 136 L538 145 L547 136" fill="none" stroke-width="4"/>
        ${label(678, 114, 'Most who took it', 'middle')}
        ${label(678, 146, 'scored much lower', 'middle')}
      </g>`);
  }

  function repeatedQueue() {
    return strokes(`
      <g data-be-item="0">
        ${card({ x: 46, y: 49, width: 320, height: 214 })}
        ${label(205, 90, 'Two neighbors', 'middle')}
        <path d="M136 157 H275" fill="none"/>
        <circle cx="132" cy="157" r="29" fill="${goldTint}"/>
        <circle cx="280" cy="157" r="29" fill="${blueTint}"/>
        ${label(132, 166, 'A', 'middle')}
        ${label(280, 166, 'B', 'middle')}
        ${label(205, 227, 'Start at A', 'middle')}
      </g>
      <g data-be-item="1">
        ${card({ x: 409, y: 49, width: 425, height: 214 })}
        ${label(622, 90, 'Queue as the search runs', 'middle')}
        ${card({ x: 441, y: 119, width: 84, height: 63, tint: goldTint })}
        ${label(483, 160, 'A', 'middle')}
      </g>
      <g data-be-item="2">
        <path d="M538 151 H560 M553 144 L560 151 L553 158
                 M667 151 H691 M684 144 L691 151 L684 158" fill="none"/>
        ${card({ x: 572, y: 119, width: 84, height: 63, tint: blueTint })}
        ${label(614, 160, 'B', 'middle')}
        <g data-be-item="2" data-be-move="-30 0">
          ${card({ x: 703, y: 119, width: 84, height: 63, tint: goldTint })}
          ${label(745, 160, 'A', 'middle')}
        </g>
        ${label(622, 228, 'A enters the queue again', 'middle')}
      </g>`);
  }

  function edgeCaseEvidence() {
    return strokes(`
      <g data-be-item="0">
        ${card({ x: 44, y: 50, width: 289, height: 215 })}
        ${label(188, 94, 'Your self-rating', 'middle')}
      </g>
      <g data-be-item="1">
        <rect x="65" y="133" width="247" height="70" rx="10" fill="${goldTint}"/>
        ${label(188, 161, 'Edge cases', 'middle')}
        ${label(188, 190, 'covered?', 'middle')}
      </g>
      <g data-be-item="2">
        ${card({ x: 359, y: 50, width: 474, height: 215 })}
        ${label(596, 94, 'Test evidence', 'middle')}
        <rect x="380" y="116" width="432" height="55" rx="10" fill="${blueTint}"/>
        ${label(407, 151, 'ABCD')}
        <path d="M493 141 H545 M537 133 L545 141 L537 149" fill="none"/>
        ${label(564, 151, 'DCBA')}
        ${label(736, 151, 'Pass', 'middle')}
        <path d="M768 140 L776 148 L789 132" fill="none" stroke-width="4"/>
      </g>
      <g data-be-item="3">
        <rect x="380" y="187" width="432" height="55" rx="10" fill="none" stroke-dasharray="8 7"/>
        ${label(407, 222, 'Empty input')}
        ${label(782, 222, 'Untested', 'end')}
      </g>`);
  }

  function traceCard({ index, x, title, frames }) {
    const center = x + 124;
    const rows = frames.map((frame, i) => {
      const y = 154 + i * 34;
      if (!frame) {
        return `<rect x="${x + 23}" y="${y}" width="202" height="28" rx="5" fill="none" stroke-dasharray="7 6"/>`;
      }
      return `
        <rect x="${x + 23}" y="${y}" width="202" height="28" rx="5" fill="${blueTint}"/>
        ${label(center, y + 23, frame, 'middle')}`;
    }).join('');
    return `
      <g data-be-item="${index}">
        ${card({ x, y: 102, width: 248, height: 201 })}
        ${label(center, 135, title, 'middle')}
        ${rows}
      </g>`;
  }

  function fadedTrace() {
    return strokes(`
      <g data-be-item="0">
        ${card({ x: 49, y: 16, width: 782, height: 67, tint: goldTint })}
        <g fill="${ink}" stroke="none" font-family="monospace" font-size="24">
          <text x="73" y="44">int sumTo(int n) {</text>
          <text x="102" y="72">return n == 0 ? 0 : n + sumTo(n - 1); }</text>
        </g>
      </g>
      ${traceCard({ index: 1, x: 35, title: 'Complete trace', frames: ['n = 2', 'n = 1', 'n = 0'] })}
      <path data-be-item="2" d="M294 211 H312 M306 204 L313 211 L306 218" fill="none"/>
      ${traceCard({ index: 2, x: 318, title: 'Two frames blank', frames: ['n = 3', 'n = 2', '', ''] })}
      <path data-be-item="3" d="M577 211 H595 M589 204 L596 211 L589 218" fill="none"/>
      <g data-be-item="3">
        ${card({ x: 601, y: 102, width: 248, height: 201 })}
        ${label(725, 135, 'Method and input', 'middle')}
        ${label(725, 176, 'sumTo(4)', 'middle')}
        <rect x="624" y="193" width="202" height="94" rx="10" fill="none" stroke-dasharray="7 6"/>
        ${label(725, 247, 'Your trace', 'middle')}
      </g>`);
  }

  function pythonFilters() {
    // Each value keeps its column as the two predicates narrow the input.
    const columns = [405, 508, 611, 714];
    const row = (y, values, tint) => values.map(value => {
      const x = columns[value - 1];
      return `<rect x="${x}" y="${y}" width="64" height="42" rx="12" fill="${tint}"/>
        ${label(x + 32, y + 30, value, 'middle')}`;
    }).join('');
    const survivors = [2, 4].map(value => {
      const x = columns[value - 1] + 32;
      return `<path d="M${x} 187 v29" fill="none" stroke="${blue}" stroke-width="3"/>
        <path d="m${x - 5} 210 5 6 5 -6" fill="none" stroke="${blue}"/>`;
    }).join('');
    return strokes(`
      ${card({ x: 30, y: 12, width: 813, height: 257 })}
      <path d="M54 90 H819 M54 189 H819" fill="none" stroke="${shadow}" stroke-width="2"/>
      <g data-be-item="0">
        ${label(58, 61, 'Input list')}
        ${row(28, [1, 2, 3, 4], paper)}
      </g>
      <g data-be-item="1">
        ${label(58, 151, 'if x &gt; 1')}
        ${row(120, [2, 3, 4], blueTint)}
      </g>
      <g data-be-item="2">
        ${label(58, 246, 'if x % 2 == 0')}
        <g data-be-exit="3">
          <rect x="411" y="208" width="365" height="46" rx="10" fill="${goldTint}" stroke-dasharray="7 5"/>
          ${label(593, 239, 'Which values pass?', 'middle')}
        </g>
      </g>
      <g data-be-item="3">
        ${survivors}
        ${row(216, [2, 4], goldTint)}
      </g>
      <g data-be-item="4">
        ${label(440, 302, 'Your turn: try the same filters on [2, 3, 5, 6].', 'middle')}
      </g>`);
  }

  Object.assign(window.BlogEssayFigures ||= {}, {
    'ai-python-filters': pythonFilters,
    'ai-merge': mergeChanges,
    'ai-gym': robotAtGym,
    'ai-working-memory': memoryCapacity,
    'ai-offload': offloadFriction,
    'ai-tutor-waits': tutorWaits,
    'ai-reversing-fork': reversingFork,
    'ai-revision-loop': revisionLoop,
    'ai-brown-final': brownFinal,
    'ai-repeated-queue': repeatedQueue,
    'ai-edge-case-evidence': edgeCaseEvidence,
    'ai-fading': fadedTrace,
  });
})();

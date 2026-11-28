/* Study tips figures share the article stage's palette and reveal clock. */
(function () {
  'use strict';

  const ink = 'var(--be-ink)';
  const paper = 'var(--be-paper)';
  const blue = 'var(--be-blue)';
  const blueTint = 'var(--be-blue-tint)';
  const gold = 'var(--be-gold)';
  const rule = 'var(--be-rule)';
  const shadow = 'var(--be-shadow)';

  function queueNotes() {
    const rings = [91, 143, 195, 247, 299, 351].map(x => `
      <circle cx="${x}" cy="57" r="5" fill="${ink}"/>
      <path d="M${x - 9} 41 Q${x - 12} 19 ${x - 2} 22 Q${x + 6} 23 ${x} 56" fill="none" stroke-width="4"/>`).join('');
    return `
      <path d="M48 53 H397 V284 L378 301 H48 Z" fill="${shadow}" stroke="none"/>
      <path d="M40 42 H388 V273 L370 290 H40 Z" fill="${blueTint}"/>
      <path d="M35 36 H382 V265 L365 282 H35 Z" fill="${paper}"/>
      ${rings}
      <path d="M75 112 H349 M75 170 H349 M75 221 H349 M75 255 H349" fill="none" stroke="${rule}" stroke-width="1.6"/>
      <path d="M367 278 V263 H379" fill="none" stroke="${rule}"/>
      <g fill="${ink}" stroke="none">
        <text x="78" y="101" font-size="35" font-weight="800">Queues</text>
        <text x="80" y="159" font-size="34">First in,</text>
        <text x="80" y="209" font-size="34">first out.</text>
      </g>
      <g data-be-item="1" fill="none">
        <path d="M80 167 Q137 164 198 167 M81 217 Q153 214 220 217" stroke="${ink}" stroke-width="6"/>
        <path data-be-trace="" d="M80 167 Q137 164 198 167 M81 217 Q153 214 220 217" stroke="${gold}" stroke-width="4"/>
        <g transform="translate(252 239) rotate(-22)">
          <path d="M0 0 L13 -6 H88 L96 0 V13 H13 L0 9 Z" fill="${gold}"/>
          <path d="M0 1 L-11 5 V10 L1 9 Z" fill="${ink}"/>
          <path d="M16 -4 V12 M73 -4 V12" stroke-width="2"/>
        </g>
      </g>`;
  }

  function rereading() {
    return `<g stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <g data-be-item="0">${queueNotes()}</g>
      <g data-be-item="2">
        <rect x="483" y="64" width="361" height="210" rx="13" fill="${shadow}" stroke="none"/>
        <rect x="477" y="57" width="361" height="210" rx="13" fill="${paper}"/>
        <path d="M477 99 V71 Q477 57 491 57 H824 Q838 57 838 71 V99 Z" fill="${blueTint}"/>
        <path d="M497 61 V45 M819 61 V45" stroke-width="5"/>
        <g stroke="none" text-anchor="middle">
          <text x="658" y="87">Tomorrow’s quiz</text>
          <text x="658" y="161" font-size="34" font-weight="780">What’s the rule?</text>
        </g>
        <path d="M528 213 H787" stroke="${blue}" stroke-width="3" stroke-dasharray="7 7"/>
      </g>
    </g>`;
  }

  function orderTicket(x, y, customer) {
    return `<g transform="translate(${x} ${y})">
      <path d="M0 0 H129 V58 L121 65 L112 59 L103 65 L94 59 L85 65 L76 59 L67 65
               L58 59 L49 65 L40 59 L31 65 L22 59 L13 65 L4 59 L0 61 Z" fill="${paper}"/>
      <path d="M7 12 H122" stroke="${rule}" stroke-dasharray="3 5" stroke-width="2"/>
      <path d="M12 27 H34 V38 Q34 45 23 45 Q12 44 12 37 Z M34 28 H38 Q45 30 40 36 H35"
            fill="${blueTint}" stroke-width="2"/>
      <text x="83" y="46" text-anchor="middle" stroke="none" font-size="29" font-weight="750">${customer}</text>
    </g>`;
  }

  function cafeQueue(first, next, servedAt) {
    const stripes = Array.from({ length: 6 }, (_, i) => {
      const top = 26 + i * 55;
      const hem = 5 + i * 62;
      return `<path d="M${top} 14 h55 L${hem + 62} 55 v7 q-31 21 -62 0 v-7 Z"
                    fill="${i % 2 ? paper : blue}" stroke-width="2.25"/>`;
    }).join('');
    return `<g transform="translate(465 10)">
      <rect x="23" y="54" width="339" height="199" rx="5" fill="${blueTint}"/>
      ${stripes}
      <rect x="5" y="237" width="374" height="17" rx="6" fill="${paper}"/>
      <path d="M19 255 H365 L356 270 H29 Z" fill="${blue}"/>
      <path d="M36 147 H349" stroke="${ink}" stroke-width="7"/>
      <path d="M37 146 H348" stroke="${rule}" stroke-width="2"/>
      <g text-anchor="middle" stroke="none">
        <text x="193" y="103" font-size="27" font-weight="800">Campus café</text>
        <text x="103" y="134" font-size="24">First</text>
        <text x="277" y="134" font-size="24">Then</text>
      </g>
      <g${servedAt === undefined ? '' : ` data-be-exit="${servedAt}"`}>${orderTicket(39, 150, first)}</g>
      ${orderTicket(213, 150, next)}
    </g>`;
  }

  function familiarity() {
    return `<g stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <g data-be-item="0">${queueNotes()}</g>
      <g data-be-item="2">
        ${cafeQueue('Inez', 'Kai')}
        <text x="657" y="312" text-anchor="middle" stroke="none">Who gets served first?</text>
      </g>
    </g>`;
  }

  function selfTest() {
    return `<g stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <g data-be-item="0">
        ${cafeQueue('Kai', 'Inez', 2)}
        <rect x="32" y="36" width="389" height="250" rx="16" fill="${shadow}" stroke="none"/>
        <rect x="26" y="30" width="389" height="250" rx="16" fill="${paper}"/>
        <path d="M28 83 V46 Q28 32 44 32 H396 Q413 32 413 46 V83 Z" fill="${blueTint}"/>
        <text x="220" y="67" text-anchor="middle" stroke="none" font-size="29" font-weight="800">Pickup</text>
        <ellipse cx="119" cy="219" rx="61" ry="9" fill="${shadow}" stroke="none"/>
        <path d="M154 166 H166 Q186 166 180 183 Q176 198 152 198" fill="none" stroke-width="8"/>
        <path d="M79 161 H156 L150 200 Q145 215 119 216 Q91 216 86 200 Z" fill="${blue}"/>
        <ellipse cx="117.5" cy="161" rx="38" ry="7" fill="${paper}"/>
        <path d="M94 160 Q114 154 141 160" fill="none" stroke-width="2"/>
        <rect x="224" y="154" width="140" height="76" rx="8" fill="none" stroke="${rule}" stroke-dasharray="6 6"/>
      </g>
      <g data-be-item="1">
        <text x="220" y="126" text-anchor="middle" stroke="none" font-size="29">Who gets the cup?</text>
        <g data-be-exit="2"><text x="294" y="206" text-anchor="middle" stroke="none" font-size="37">?</text></g>
      </g>
      <g data-be-item="2">
        <g data-be-item="2" data-be-move="275 0">${orderTicket(229, 160, 'Kai')}</g>
        <text x="220" y="264" text-anchor="middle" stroke="none">Kai arrived first.</text>
      </g>
    </g>`;
  }

  function cafeteriaTray(y, top = false) {
    return `<g transform="translate(525 ${y})">
      <path d="M1 23 L41 0 H277 Q286 0 282 7 L251 32 Q246 36 238 36 H12 Q3 36 1 29 Z"
            fill="${top ? 'var(--be-gold-tint)' : blueTint}"/>
      <path d="M17 23 L46 8 H264 L240 25 H17 Z" fill="none" stroke-width="2"/>
      <path d="M4 28 H240 Q247 28 251 25" fill="none" stroke="${top ? gold : ink}" stroke-width="${top ? 3.5 : 1.5}"/>
    </g>`;
  }

  function chooseServiceOrder() {
    return `<g stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <g data-be-item="0">
        <g transform="translate(-435 0)">${cafeQueue('Inez', 'Kai')}</g>
        <text x="671" y="63" text-anchor="middle" stroke="none" font-size="30" font-weight="800">Returned trays</text>
        <path d="M521 224 H808 L792 240 H505 Z" fill="${shadow}" stroke="none"/>
        ${cafeteriaTray(190)}${cafeteriaTray(172)}
        <g data-be-exit="2">${cafeteriaTray(154, true)}</g>
        <path d="M466 57 V248" stroke="${rule}" stroke-width="2" stroke-dasharray="4 7"/>
      </g>
      <g data-be-item="1">
        <path data-be-trace="" d="M70 237 Q120 233 196 237" fill="none" stroke="${blue}" stroke-width="5"/>
        <text x="222" y="310" text-anchor="middle" stroke="none">Queue serves the first order</text>
      </g>
      <g data-be-item="2">
        <g data-be-item="2" data-be-move="0 56">${cafeteriaTray(98, true)}</g>
        <path d="M677 173 V143 M668 152 L677 143 L686 152" fill="none" stroke="${blue}" stroke-width="4"/>
        <text x="666" y="310" text-anchor="middle" stroke="none">Stack returns the last tray added</text>
      </g>
    </g>`;
  }

  function arrayBoundary() {
    const cells = [0, 1, 2].map((index) => {
      const x = 68 + index * 104;
      return `<rect x="${x}" y="119" width="96" height="82" rx="8" fill="${blueTint}"/>
        <text x="${x + 48}" y="173" text-anchor="middle" stroke="none" font-size="36">${index}</text>`;
    }).join('');
    return `<g stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <g data-be-item="0">
        <text x="219" y="79" text-anchor="middle" stroke="none" font-weight="800">Three array slots</text>
        ${cells}
        <path d="M69 213 V227 H370 V213" fill="none"/>
        <text x="219" y="265" text-anchor="middle" stroke="none">Valid indices</text>
        <path d="M556 39 H825 Q840 39 840 54 V275 H542 V54 Q542 39 556 39 Z" fill="${paper}"/>
        <path d="M543 90 V56 Q543 41 558 41 H824 Q838 41 838 56 V90 Z" fill="${blueTint}"/>
        <text x="691" y="75" text-anchor="middle" stroke="none" font-weight="800">Loop from zero</text>
        <text x="691" y="148" text-anchor="middle" stroke="none" font-family="monospace" font-size="31">i &lt;= 3</text>
        <text x="691" y="198" text-anchor="middle" stroke="none">Which index fails?</text>
        <g data-be-exit="1"><text x="431" y="174" text-anchor="middle" stroke="none" font-size="42">?</text></g>
      </g>
      <g data-be-item="1">
        <rect x="383" y="119" width="96" height="82" rx="9" fill="${paper}" stroke-dasharray="7 6"/>
        <text x="431" y="173" text-anchor="middle" stroke="none" font-size="36">3</text>
        <g data-be-item="1" data-be-move="-104 0">
          <circle cx="431" cy="159" r="51" fill="none" stroke="${blue}" stroke-width="7"/>
          <path d="M469 197 L496 225" stroke="${ink}" stroke-width="16"/>
          <path d="M469 197 L496 225" stroke="${gold}" stroke-width="8"/>
        </g>
      </g>
      <g data-be-item="2">
        <path d="M565 210 H818" stroke="${rule}" stroke-width="2"/>
        <text x="573" y="252" stroke="none">Fix</text>
        <text x="802" y="252" text-anchor="end" stroke="none" font-family="monospace" font-size="30">i &lt; 3</text>
      </g>
    </g>`;
  }

  const loopHeader = `
    <text x="58" y="143">for (const task of tasks)</text>
    <text x="525" y="143">{</text>`;
  const loopBody = '<text x="95" y="200">review(task);</text>';
  const loopClose = '<text x="58" y="257">}</text>';
  const code = rows => `
    <g font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="30" font-weight="650">${rows}</g>`;

  function loopEditor(sideTitle) {
    return `
      <rect x="29" y="29" width="594" height="274" rx="14" fill="var(--be-shadow)"/>
      <rect x="24" y="24" width="594" height="274" rx="14" fill="var(--be-paper)"
            stroke="var(--be-ink)" stroke-width="2.5"/>
      <text x="58" y="73" font-size="32" font-weight="800">Practice loop</text>
      <path d="M54 91 H589" fill="none" stroke="var(--be-blue)" stroke-width="2.5"/>
      <rect x="645" y="29" width="211" height="274" rx="14" fill="var(--be-shadow)"/>
      <rect x="640" y="24" width="211" height="274" rx="14" fill="var(--be-blue-tint)"
            stroke="var(--be-ink)" stroke-width="2.5"/>
      <text x="745.5" y="73" text-anchor="middle" font-size="31" font-weight="800">${sideTitle}</text>`;
  }

  function codePractice() {
    return `
      <g data-be-item="0">${loopEditor('Suggestions')}</g>
      <g data-be-item="1" data-be-exit="3">
        <g data-be-exit="2">
          <rect x="48" y="108" width="542" height="162" rx="10" fill="var(--be-gold-tint)"
                stroke="var(--be-ink)" stroke-width="2" stroke-dasharray="6 5"/>
        </g>
        ${code(loopHeader + loopBody + loopClose)}
        <rect x="653" y="105" width="87" height="58" rx="9" fill="var(--be-gold-tint)"
              stroke="var(--be-ink)" stroke-width="2"/>
        <text x="696.5" y="146" text-anchor="middle" font-size="34" font-weight="800">On</text>
        <text x="745.5" y="203" text-anchor="middle" font-size="25">Suggested code</text>
      </g>
      <g data-be-item="2" data-be-exit="3">
        <text x="745.5" y="240" text-anchor="middle" font-size="28">Filled in</text>
        <text x="745.5" y="275" text-anchor="middle" font-size="28">at once</text>
      </g>
      <g data-be-item="3">
        <rect x="751" y="105" width="87" height="58" rx="9" fill="var(--be-paper)"
              stroke="var(--be-ink)" stroke-width="2"/>
        <text x="794.5" y="146" text-anchor="middle" font-size="34" font-weight="800">Off</text>
      </g>
      <g data-be-item="4">
        ${code(loopHeader)}
        <text x="745.5" y="218" text-anchor="middle" font-size="28">Type it</text>
        <text x="745.5" y="252" text-anchor="middle" font-size="28">step by step</text>
      </g>
      <g data-be-item="5">${code(loopBody)}</g>
      <g data-be-item="6">${code(loopClose)}</g>`;
  }

  function debugLoop() {
    return `
      <g data-be-item="0">
        ${loopEditor('Debugging')}
        ${code(loopHeader + loopBody)}
      </g>
      <g data-be-item="1" data-be-exit="2">
        <rect x="516" y="111" width="39" height="45" rx="6" fill="none"
              stroke="var(--be-blue)" stroke-width="3"/>
        <rect x="48" y="220" width="46" height="50" rx="6" fill="var(--be-gold-tint)"
              stroke="var(--be-ink)" stroke-width="3" stroke-dasharray="6 5"/>
        <text x="745.5" y="151" text-anchor="middle" font-size="31" font-weight="800">Find the</text>
        <text x="745.5" y="191" text-anchor="middle" font-size="28">missing brace</text>
      </g>
      <g data-be-item="2">
        <rect x="516" y="111" width="39" height="45" rx="6" fill="none"
              stroke="var(--be-blue)" stroke-width="3"/>
        <rect x="48" y="220" width="46" height="50" rx="6" fill="var(--be-blue-tint)"
              stroke="var(--be-blue)" stroke-width="3"/>
        ${code(loopClose)}
        <path d="M725 211 L739 225 L766 202" fill="none" stroke="var(--be-ink)" stroke-width="4"
              stroke-linecap="round" stroke-linejoin="round"/>
        <text x="745.5" y="268" text-anchor="middle" font-size="29" font-weight="800">Braces match</text>
      </g>`;
  }

  function spacing() {
    // Columns are weeks on a calendar. Each segment of a study block is one hour.
    const spacedSessions = [300, 510, 720];
    return `
      <g fill="none" stroke="var(--be-ink)" stroke-opacity=".65" stroke-width="2">
        <path d="M224 52 H854 V264 H224 Z M434 52 V264 M644 52 V264 M224 158 H854"/>
      </g>
      <g text-anchor="middle">
        <text x="329" y="294">Week 1</text>
        <text x="539" y="294">Week 2</text>
        <text x="749" y="294">Exam week</text>
      </g>
      <g data-be-item="0">
        <text x="23" y="95" font-size="28" font-weight="800">Cramming</text>
        <text x="23" y="134" font-size="24">One sitting</text>
        <rect x="668" y="81" width="168" height="57" rx="8" fill="var(--be-shadow)"/>
        <rect x="664" y="76" width="168" height="57" rx="8" fill="var(--be-gold-tint)"
              stroke="var(--be-ink)" stroke-width="2.5"/>
        <path d="M720 77 V132 M776 77 V132" stroke="var(--be-ink)" stroke-width="2"/>
        <g text-anchor="middle" font-size="24">
          ${spacedSessions.map((_, index) => `<text x="${692 + index * 56}" y="113" stroke="var(--be-gold-tint)" stroke-width="3" paint-order="stroke">1 h</text>`).join('')}
        </g>
      </g>
      <g data-be-item="1">
        <text x="23" y="201" font-size="28" font-weight="800">Spaced</text>
        <text x="23" y="240" font-size="24">Three sessions</text>
        ${spacedSessions.map((x, index) => `
          <g data-be-item="1" data-be-move="${664 + index * 56 - x} -106">
            <rect x="${x + 4}" y="187" width="56" height="57" rx="8" fill="var(--be-shadow)"/>
            <rect x="${x}" y="182" width="56" height="57" rx="8" fill="var(--be-blue-tint)"
                  stroke="var(--be-ink)" stroke-width="2.5"/>
            <text x="${x + 28}" y="219" text-anchor="middle" font-size="24"
                  stroke="var(--be-blue-tint)" stroke-width="3" paint-order="stroke">1 h</text>
          </g>
        `).join('')}
      </g>
      <g data-be-item="2">
        <text x="539" y="34" text-anchor="middle" font-size="25" font-weight="750">Three hours in each schedule</text>
      </g>`;
  }

  const SORTS = {
    merge: { name: 'Merge', fill: 'var(--be-blue-tint)', mark: '<path d="M0 1 L10 11 L20 1"/>' },
    quick: { name: 'Quick', fill: 'var(--be-gold-tint)', mark: '<path d="M0 11 L10 1 L20 11"/>' },
    bubble: { name: 'Bubble', fill: 'var(--be-paper)', mark: '<circle cx="10" cy="6" r="5"/>' },
  };

  const sortCardX = index => 177 + 114 * index;

  function sortCard(kind, index, y) {
    const { name, fill, mark } = SORTS[kind];
    return `
      <g transform="translate(${sortCardX(index)} ${y})">
        <rect x="4" y="4" width="103" height="75" rx="9" fill="var(--be-shadow)"/>
        <rect width="103" height="75" rx="9" fill="${fill}" stroke="var(--be-ink)" stroke-width="2.5"/>
        <g transform="translate(41.5 14)" fill="none" stroke="var(--be-ink)" stroke-width="2.7"
           stroke-linecap="round" stroke-linejoin="round">${mark}</g>
        <text x="51.5" y="55" text-anchor="middle" font-size="24">${name}</text>
      </g>`;
  }

  function interleaving() {
    const blocked = ['merge', 'merge', 'quick', 'quick', 'bubble', 'bubble'];
    const reordered = [0, 4, 2, 1, 3, 5];
    return `
      <g data-be-item="0">
        <text x="22" y="90" font-size="29" font-weight="800">Blocked</text>
      </g>
      ${blocked.map((kind, index) => `
        <g data-be-item="${Math.floor(index / 2)}">${sortCard(kind, index, 42)}</g>
      `).join('')}
      <g data-be-item="3">
        <text x="22" y="199" font-size="29" font-weight="800">Mixed</text>
        <g data-be-exit="4">
          ${reordered.map((oldIndex, index) => {
            const { fill, mark } = SORTS[blocked[oldIndex]];
            return `
              <g data-be-item="3" data-be-move="${sortCardX(oldIndex) - sortCardX(index)} -134">
                <g transform="translate(${sortCardX(index) + 51.5} 196)">
                  <circle r="20" fill="${fill}" stroke="var(--be-ink)" stroke-width="2.5"/>
                  <g transform="translate(-10 -6)" fill="none" stroke="var(--be-ink)" stroke-width="2.7"
                     stroke-linecap="round" stroke-linejoin="round">${mark}</g>
                </g>
              </g>`;
          }).join('')}
        </g>
      </g>
      <g data-be-item="4">
        ${reordered.map((oldIndex, index) => sortCard(blocked[oldIndex], index, 151)).join('')}
      </g>
      <g data-be-item="5">
        <path d="M176 262 H850" stroke="var(--be-rule)" stroke-width="2"/>
        <text x="513" y="298" text-anchor="middle" font-weight="750">Use the constraints to choose a sort.</text>
      </g>`;
  }

  function addYet() {
    return `
      <g data-be-item="0">
        <path d="M112 38 H770 Q788 38 788 56 V125 Q788 143 770 143 H219 L188 168 V143 H112
                 Q94 143 94 125 V56 Q94 38 112 38 Z" fill="var(--be-shadow)"/>
        <path d="M107 33 H765 Q783 33 783 51 V120 Q783 138 765 138 H214 L183 163 V138 H107
                 Q89 138 89 120 V51 Q89 33 107 33 Z" fill="var(--be-paper)"
              stroke="var(--be-ink)" stroke-width="2.5" stroke-linejoin="round"/>
        <text x="608" y="103" text-anchor="end" font-size="39" font-weight="780">I don’t understand this</text>
      </g>
      <g data-be-item="1">
        <g data-be-item="1" data-be-move="16 0">
          <rect x="622" y="65" width="82" height="57" rx="9" fill="var(--be-gold-tint)"
                stroke="var(--be-ink)" stroke-width="2"/>
          <text x="663" y="103" text-anchor="middle" font-size="39" font-weight="800">yet</text>
        </g>
      </g>
      <g data-be-item="2">
        <path d="M436 155 V181 H257 V214 M247 204 L257 214 L267 204"
              fill="none" stroke="var(--be-blue)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="97" y="227" width="320" height="68" rx="11" fill="var(--be-blue-tint)"
              stroke="var(--be-ink)" stroke-width="2.5"/>
        <text x="257" y="271" text-anchor="middle" font-size="28" font-weight="750">Adjust your strategy</text>
      </g>
      <g data-be-item="3">
        <path d="M436 181 H620 V214 M610 204 L620 214 L630 204"
              fill="none" stroke="var(--be-blue)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="461" y="227" width="320" height="68" rx="11" fill="var(--be-gold-tint)"
              stroke="var(--be-ink)" stroke-width="2.5"/>
        <text x="621" y="271" text-anchor="middle" font-size="28" font-weight="750">Ask for help</text>
      </g>`;
  }

  function traversalRow(y, title, numbers) {
    return `
      <rect x="509" y="${y}" width="348" height="106" rx="13" fill="var(--be-paper)"
            stroke="var(--be-ink)" stroke-width="2.5"/>
      <text x="531" y="${y + 38}" font-size="29" font-weight="800">${title}</text>
      <g text-anchor="middle" font-size="28" font-weight="750">
        ${numbers.map((number, index) => {
          const x = 527 + index * 45;
          return `<rect x="${x}" y="${y + 55}" width="41" height="38" rx="6" fill="var(--be-blue-tint)"/>
                  <text x="${x + 20.5}" y="${y + 84}">${number}</text>`;
        }).join('')}
      </g>`;
  }

  function generationTree() {
    const nodes = [
      [8, 237, 89],
      [4, 145, 166], [12, 329, 166],
      [2, 78, 246], [6, 192, 246], [10, 282, 246], [14, 396, 246],
    ];
    return `
      <g data-be-item="0">
        <rect x="22" y="22" width="438" height="282" rx="15" fill="var(--be-shadow)"/>
        <rect x="18" y="18" width="438" height="282" rx="15" fill="var(--be-blue-tint)"
              stroke="var(--be-ink)" stroke-width="2.5"/>
        <text x="237" y="51" text-anchor="middle" font-size="28" font-weight="750">In-order traversal</text>
        <path d="M237 89 L145 166 L78 246 M145 166 L192 246
                 M237 89 L329 166 L282 246 M329 166 L396 246"
              fill="none" stroke="var(--be-ink)" stroke-width="3"/>
        <g text-anchor="middle" font-size="27">
          ${nodes.map(([value, x, y]) => `
            <circle cx="${x}" cy="${y}" r="25" fill="var(--be-paper)" stroke="var(--be-ink)" stroke-width="2.5"/>
            <text x="${x}" y="${y + 9}">${value}</text>
          `).join('')}
        </g>
      </g>
      <g data-be-item="1">
        ${traversalRow(15, 'Your attempt', [2, 4, 8, 10, 12, 14])}
      </g>
      <g data-be-item="2">
        <text x="559" y="146" font-size="26" font-weight="750">6 of 7 nodes visited</text>
      </g>
      <g data-be-item="3">
        <path d="M536 145 V179 M526 169 L536 179 L546 169"
              fill="none" stroke="var(--be-blue)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ${traversalRow(201, 'Reference', [2, 4, 6, 8, 10, 12, 14])}
      </g>
      <g data-be-item="4">
        <circle cx="192" cy="246" r="32" fill="none" stroke="var(--be-blue)" stroke-width="4"/>
        <rect x="617" y="256" width="41" height="38" rx="6" fill="none"
              stroke="var(--be-blue)" stroke-width="3.5"/>
        <text x="559" y="187" font-size="28" font-weight="800">Skipped node 6</text>
      </g>`;
  }

  const SKILLS = {
    front: {
      name: 'Front end', fill: 'var(--be-blue-tint)',
      mark: '<rect x="-24" y="-17" width="48" height="34" rx="4"/><path d="M-24 -7 H24 M-17 -12 H-15 M-12 1 H14 M-12 8 H3"/>',
    },
    back: {
      name: 'Back end', fill: 'var(--be-gold-tint)',
      mark: '<path d="M-13 -12 L-25 0 L-13 12 M13 -12 L25 0 L13 12 M5 -15 L-5 15"/>',
    },
    database: {
      name: 'Database', fill: 'var(--be-paper)',
      mark: '<path d="M-20 -12 V12 C-20 23 20 23 20 12 V-12 M-20 0 C-20 11 20 11 20 0"/><ellipse cy="-12" rx="20" ry="7"/>',
    },
  };

  function skillCard(skill, x, y) {
    const { name, fill, mark } = SKILLS[skill];
    return `
      <g transform="translate(${x} ${y})">
        <rect x="4" y="4" width="247" height="68" rx="11" fill="var(--be-shadow)"/>
        <rect width="247" height="68" rx="11" fill="${fill}" stroke="var(--be-ink)" stroke-width="2.5"/>
        <g transform="translate(43 34)" fill="none" stroke="var(--be-ink)" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">${mark}</g>
        <text x="86" y="43" font-size="27" font-weight="750">${name}</text>
      </g>`;
  }

  function workingMemoryOverload() {
    return `
      <g data-be-item="0">
        <rect x="539" y="52" width="315" height="224" rx="16" fill="var(--be-shadow)"/>
        <rect x="534" y="47" width="315" height="224" rx="16" fill="var(--be-paper)"
              stroke="var(--be-ink)" stroke-width="2.5"/>
        <text x="691.5" y="100" text-anchor="middle" font-size="28" font-weight="800">Working memory</text>
        <rect x="557" y="124" width="269" height="123" rx="10" fill="none" stroke="var(--be-blue)"
              stroke-width="2.5" stroke-dasharray="6 6"/>
      </g>
      <g data-be-item="1">
        <path d="M293 64 H377 Q401 64 401 88 V135 Q401 153 419 153 H513 M503 143 L513 153 L503 163"
              fill="none" stroke="var(--be-blue)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ${skillCard('front', 32, 30)}
      </g>
      <g data-be-item="2">
        <path d="M293 153 H419" stroke="var(--be-blue)" stroke-width="3" stroke-linecap="round"/>
        ${skillCard('back', 32, 119)}
      </g>
      <g data-be-item="3">
        <path d="M293 242 H377 Q401 242 401 218 V171 Q401 153 419 153"
              fill="none" stroke="var(--be-blue)" stroke-width="3" stroke-linecap="round"/>
        ${skillCard('database', 32, 208)}
      </g>
      <g data-be-item="4">
        <rect x="565" y="131" width="253" height="109" rx="8" fill="var(--be-gold-tint)"
              stroke="var(--be-ink)" stroke-width="2.5"/>
        <path d="M675 181 L691 153 L707 181 Z M691 163 V173"
              fill="none" stroke="var(--be-ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="691" cy="177.5" r="1.6" fill="var(--be-ink)"/>
        <text x="691.5" y="214" text-anchor="middle" font-size="27" font-weight="800">Too much at once</text>
      </g>`;
  }

  function practiceStation(skill, x, task) {
    const {name, fill, mark} = SKILLS[skill];
    return `
      <g transform="translate(${x} 27)">
        <rect x="4" y="5" width="247" height="110" rx="12" fill="var(--be-shadow)"/>
        <rect width="247" height="110" rx="12" fill="${fill}" stroke="var(--be-ink)" stroke-width="2.5"/>
        <g transform="translate(42 36)" fill="none" stroke="var(--be-ink)" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">${mark}</g>
        <text x="80" y="47" font-size="30" font-weight="800">${name}</text>
        <path d="M22 62 H225" stroke="var(--be-ink)" stroke-width="2" stroke-opacity=".65"/>
        <text x="123.5" y="94" text-anchor="middle" font-size="27">${task}</text>
      </g>`;
  }

  function workingMemoryPractice() {
    return `
      <g data-be-item="0">${practiceStation('front', 29, 'Study notes page')}</g>
      <g data-be-item="1">${practiceStation('database', 603, 'Query notes')}</g>
      <g data-be-item="2">${practiceStation('back', 316, 'Save a note')}</g>
      <g data-be-item="3">
        <path d="M284 83 H306 M297 74 L306 83 L297 92
                 M571 83 H593 M584 74 L593 83 L584 92
                 M152.5 153 V185 M439.5 153 V185 M726.5 153 V185
                 M152.5 228 H726.5"
              fill="none" stroke="var(--be-blue)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <g fill="var(--be-paper)" stroke="var(--be-blue)" stroke-width="3">
          <circle cx="152.5" cy="228" r="8"/>
          <circle cx="439.5" cy="228" r="8"/>
          <circle cx="726.5" cy="228" r="8"/>
        </g>
      </g>
      <g data-be-item="4">
        <g data-be-item="4" data-be-move="-573.5 0">
          <rect x="625" y="197" width="202" height="62" rx="11" fill="var(--be-paper)"
                stroke="var(--be-ink)" stroke-width="2.5"/>
          <text x="726" y="239" text-anchor="middle" font-size="30" font-weight="800">New note</text>
        </g>
      </g>
      <g data-be-item="5">
        <path d="M643 279 L651 287 L666 271" fill="none" stroke="var(--be-ink)" stroke-width="3"
              stroke-linecap="round" stroke-linejoin="round"/>
        <text x="732" y="291" text-anchor="middle" font-size="26" font-weight="800">Note saved</text>
      </g>
      <g data-be-item="6">
        <text x="440" y="291" text-anchor="middle" font-size="28" font-weight="750">Practice after class</text>
      </g>`;
  }

  function workingMemory({ figureState }) {
    return figureState === 'overload' ? workingMemoryOverload() : workingMemoryPractice();
  }

  function bigORetrieval() {
    const visits = (count, y) => Array.from({ length: count }, (_, index) => `
      <g transform="translate(${90 + 40 * index} ${y})">
        <rect width="31" height="31" rx="6" fill="var(--be-blue-tint)"/>
        <path d="M8 16 l5 5 11 -12" fill="none" stroke-width="3"/>
      </g>`).join('');
    return `<g stroke="var(--be-ink)" stroke-width="2.5" stroke-linejoin="round">
      <path d="M191 44 H685" fill="none" stroke="var(--be-blue)" stroke-width="3"/>
      <path d="M352 34 v20 M515 34 v20" fill="none" stroke="var(--be-rule)"/>
      <g data-be-item="0">
        <circle cx="191" cy="44" r="10" fill="var(--be-blue-tint)"/>
        <rect x="35" y="75" width="360" height="224" rx="14" fill="var(--be-paper)"/>
        <g stroke="none" text-anchor="middle">
          <text x="215" y="118" font-weight="800">Week 1</text>
          <text x="215" y="163">Scan the list</text>
        </g>
        ${visits(3, 187)}
        <text x="225" y="212" stroke="none">3 visits</text>
        <text x="215" y="271" text-anchor="middle" stroke="none">n items, n visits</text>
      </g>
      <g data-be-item="1">
        <circle cx="685" cy="44" r="10" fill="var(--be-gold)"/>
        <rect x="485" y="75" width="360" height="224" rx="14" fill="var(--be-gold-tint)"/>
        <g stroke="none" text-anchor="middle">
          <text x="665" y="118" font-weight="800">Week 4</text>
          <text x="665" y="168">Double the list.</text>
          <text x="665" y="210">How many visits?</text>
        </g>
        <rect x="525" y="230" width="280" height="50" rx="9" fill="var(--be-paper)" stroke-dasharray="6 5"/>
      </g>
      <g data-be-item="2">
        <text x="665" y="264" text-anchor="middle" stroke="none">6 visits · O(n)</text>
      </g>
    </g>`;
  }

  Object.assign(window.BlogEssayFigures ||= {}, {
    'study-rereading': rereading,
    'study-array-boundary': arrayBoundary,
    'study-cafe-structures': chooseServiceOrder,
    'study-big-o': bigORetrieval,
    'study-familiarity': familiarity,
    'study-self-test': selfTest,
    'study-code-practice': codePractice,
    'study-loop-debug': debugLoop,
    'study-spacing': spacing,
    'study-interleaving': interleaving,
    'study-add-yet': addYet,
    'study-generation-tree': generationTree,
    'study-working-memory': workingMemory,
  });
})();

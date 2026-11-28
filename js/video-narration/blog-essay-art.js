// Decorative SVG props for the blog essay stages. Each fragment fits a 200 × 164
// viewBox and inherits the stage palette. The caller owns placement and motion.
(function () {
  'use strict';

  function illustration(shapes) {
    return '<g aria-hidden="true" fill="none" stroke="var(--be-ink)" stroke-width="2.75" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + shapes + '</g>';
  }

  window.BlogEssayArt = Object.freeze({
    book: illustration(`
      <path d="M23 118 Q64 105 102 123 Q146 104 185 119 L180 132
               Q140 125 103 142 Q69 129 26 135 Z" fill="var(--be-shadow)" stroke="none"/>
      <path d="M23 58 Q61 47 100 66 Q138 47 177 56 L177 128
               Q138 120 100 138 Q63 120 23 129 Z" fill="var(--be-accent)"/>
      <path d="M29 54 Q63 44 100 62 Q138 44 171 52 L171 122
               Q135 115 100 133 Q65 117 29 123 Z" fill="var(--be-blue-tint)"/>
      <g data-art-part="left-page">
        <path d="M31 43 Q67 35 100 56 L100 127 Q68 108 31 115 Z" fill="var(--be-paper)"/>
        <path d="M43 58 Q67 55 88 66 L88 76 Q66 65 43 69 Z" fill="var(--be-gold-tint)" stroke="none"/>
        <path d="M44 63 Q62 61 78 68 M44 78 Q66 75 87 85 M44 91 Q66 88 87 98
                 M44 103 Q56 102 68 105" stroke-width="2"/>
      </g>
      <g data-art-part="right-page">
        <path d="M100 56 Q134 31 169 37 L169 113 Q135 108 100 127 Z" fill="var(--be-paper)"/>
        <path d="M100 56 Q105 52 110 50 L110 122 L100 127 Z" fill="var(--be-blue-tint)" stroke="none"/>
        <path d="M115 65 Q128 58 139 55 M115 78 Q132 69 155 68
                 M115 91 Q135 82 155 82 M115 104 Q127 98 143 96" stroke-width="2"/>
        <path d="M146 39 Q153 37 160 37 L160 66 L153 61 L146 68 Z" fill="var(--be-gold)" stroke-width="2"/>
      </g>
      <path d="M100 56 V136" stroke-width="2.25"/>
    `),

    notebook: illustration(`
      <rect x="51" y="25" width="111" height="123" rx="9"
            transform="rotate(-8 103 83)" fill="var(--be-shadow)" stroke="none"/>
      <g transform="rotate(-8 100 82)">
        <rect x="47" y="22" width="109" height="122" rx="8" fill="var(--be-blue-tint)"/>
        <path d="M148 54 H166 V72 H148 Z" fill="var(--be-gold-tint)" stroke-width="2"/>
        <path d="M147 83 H163 V101 H147 Z" fill="var(--be-gold)" stroke-width="2"/>
        <rect x="47" y="17" width="104" height="121" rx="8" fill="var(--be-accent)"/>
        <path d="M61 18 V136" stroke-width="2"/>
        <path d="M46 38 H58 M46 58 H58 M46 78 H58 M46 98 H58 M46 118 H58" stroke-width="4"/>
        <path d="M46 38 H58 M46 58 H58 M46 78 H58 M46 98 H58 M46 118 H58"
              stroke="var(--be-paper)" stroke-width="1.5"/>
        <rect x="74" y="38" width="61" height="40" rx="5" fill="var(--be-paper)" stroke-width="2"/>
        <path d="M85 53 H123 M85 63 H112" stroke-width="2"/>
        <path d="M75 114 H134 M75 122 H134" stroke="var(--be-paper)" stroke-width="1.6" stroke-opacity=".8"/>
      </g>
    `),

    pencil: illustration(`
      <path d="M43 130 C52 121 62 128 70 122 S84 109 95 113"
            stroke="var(--be-ink)" stroke-opacity=".55" stroke-width="2.5"/>
      <g transform="rotate(-38 101 81)">
        <path d="M27 95 L58 83 H165 Q173 83 173 91 Q173 102 165 102 H58 Z"
              fill="var(--be-shadow)" stroke="none"/>
        <path d="M57 68 H147 V94 H57 L29 81 Z" fill="var(--be-gold-tint)"/>
        <path d="M57 68 H147 V94 H57 Q62 88 57 81 Q62 75 57 68 Z" fill="var(--be-accent)"/>
        <path d="M59 81 H145" stroke-width="2"/>
        <path d="M60 74 H143" stroke="var(--be-paper)" stroke-opacity=".7" stroke-width="2"/>
        <path d="M29 81 L40 76 Q37 81 40 86 Z" fill="var(--be-ink)" stroke-width="1.5"/>
        <path d="M150 68 H165 Q171 68 171 75 V87 Q171 94 165 94 H150 Z" fill="var(--be-gold)"/>
        <path d="M145 68 H155 V94 H145 Z" fill="var(--be-blue-tint)"/>
        <path d="M150 73 V89" stroke-width="1.4"/>
      </g>
    `),

    highlighter: illustration(`
      <path d="M43 91 L153 100 L164 136 L38 145 Z" fill="var(--be-shadow)" stroke="none"/>
      <path d="M47 85 L151 91 L157 131 L35 137 Z" fill="var(--be-paper)"/>
      <g data-art-part="highlight">
        <path d="M49 106 Q83 103 133 102 L141 114 Q100 117 47 118 Z"
              fill="var(--be-gold)" stroke="none"/>
        <path d="M54 112 L128 108" stroke-width="2"/>
      </g>
      <path d="M52 125 L102 122 M65 98 L139 100" stroke-width="1.75" stroke-opacity=".65"/>
      <g transform="rotate(-23 106 64)">
        <path d="M46 54 L33 58 L32 72 L48 72 Z" fill="var(--be-gold)"/>
        <path d="M44 55 L58 48 H157 Q169 48 169 59 V72 Q169 81 158 81
                 H59 L44 74 Z" fill="var(--be-gold-tint)"/>
        <path d="M58 48 H129 V81 H59 L44 74 V55 Z" fill="var(--be-gold)"/>
        <path d="M129 48 H156 Q169 48 169 59 V71 Q169 81 158 81 H129 Z" fill="var(--be-accent)"/>
        <path d="M134 56 H158 M68 57 H111" stroke="var(--be-paper)" stroke-width="2.5"/>
        <path d="M66 71 H96 M103 71 H113" stroke-width="2"/>
      </g>
    `),

    cards: illustration(`
      <rect x="40" y="55" width="131" height="79" rx="8" transform="rotate(10 106 94)"
            fill="var(--be-shadow)" stroke="none"/>
      <rect x="37" y="48" width="131" height="79" rx="8" transform="rotate(10 103 87)"
            fill="var(--be-accent)"/>
      <rect x="39" y="46" width="128" height="80" rx="8" transform="rotate(-1 103 85)"
            fill="var(--be-gold-tint)"/>
      <g data-art-part="front-card">
        <g transform="rotate(-12 98 80)">
          <rect x="32" y="39" width="132" height="80" rx="8" fill="var(--be-paper)"/>
          <path d="M33 57 H163" stroke-width="1.9"/>
          <path d="M45 71 H103 M45 85 H95 M45 99 H74" stroke-width="2"/>
          <circle cx="133" cy="84" r="18" fill="var(--be-blue-tint)" stroke-width="2"/>
          <path d="M127 79 C127 71 141 73 139 80 C138 84 133 84 133 89" stroke-width="2.4"/>
          <circle cx="133" cy="95" r="1.55" fill="var(--be-ink)" stroke="none"/>
        </g>
      </g>
    `),

    calendar: illustration(`
      <rect x="36" y="36" width="134" height="105" rx="11" fill="var(--be-shadow)" stroke="none"/>
      <rect x="31" y="30" width="134" height="105" rx="11" fill="var(--be-paper)"/>
      <path d="M31 58 V41 Q31 30 42 30 H154 Q165 30 165 41 V58 Z" fill="var(--be-blue-tint)"/>
      <path d="M63 41 V29 A6 6 0 0 1 75 29 M122 41 V29 A6 6 0 0 1 134 29"
            stroke-width="3.6"/>
      <path d="M47 78 H148 M47 97 H148 M47 116 H148 M57 69 V123 M77 69 V123
               M97 69 V123 M117 69 V123 M137 69 V123" stroke-width="1" stroke-opacity=".20"/>
      <g data-art-part="marks">
        <circle cx="57" cy="78" r="7.5" fill="var(--be-gold-tint)" stroke-width="2"/>
        <circle cx="97" cy="97" r="7.5" fill="var(--be-gold-tint)" stroke-width="2"/>
        <circle cx="137" cy="116" r="7.5" fill="var(--be-gold-tint)" stroke-width="2"/>
        <path d="M54 78 L56 80 L60 76 M94 97 L96 99 L100 95 M134 116 L136 118 L140 114"
              stroke="var(--be-ink)" stroke-width="1.75"/>
      </g>
    `),

    clock: illustration(`
      <ellipse cx="103" cy="140" rx="60" ry="7" fill="var(--be-shadow)" stroke="none"/>
      <path d="M59 110 L46 137 Q45 141 51 141 H62 L75 121
               M129 120 L141 141 H150 Q156 141 154 136 L141 111" fill="var(--be-blue-tint)"/>
      <path d="M91 34 V22 H109 V34" fill="var(--be-gold-tint)"/>
      <rect x="83" y="18" width="34" height="9" rx="4.5" fill="var(--be-gold)"/>
      <circle cx="104" cy="84" r="54" fill="var(--be-accent)"/>
      <circle cx="97" cy="84" r="53" fill="var(--be-blue-tint)"/>
      <circle cx="97" cy="84" r="44" fill="var(--be-paper)" stroke-width="2"/>
      <path d="M97 47 V53 M97 115 V121 M60 84 H66 M128 84 H134
               M71 58 L74 61 M120 107 L123 110 M71 110 L74 107 M120 61 L123 58"
            stroke-width="2"/>
      <path data-art-part="minute-hand" d="M97 84 L121 69" stroke-width="3.75"/>
      <path data-art-part="hour-hand" d="M97 84 L84 68" stroke-width="4.5"/>
      <circle cx="97" cy="84" r="4.75" fill="var(--be-gold)" stroke-width="1.5"/>
    `),

    brain: illustration(`
      <path d="M103 38 C115 24 136 29 143 43 C156 44 165 57 161 69
               C175 79 174 97 163 105 C161 122 148 133 135 130
               C129 146 109 149 103 136 C94 149 74 145 69 131
               C54 132 42 121 43 106 C30 96 31 79 43 69
               C39 56 48 43 61 42 C67 28 91 25 103 38 Z"
            fill="var(--be-shadow)" stroke="none"/>
      <path d="M99 33 C87 21 66 25 59 38 C45 39 35 52 39 65
               C26 75 27 93 39 101 C39 116 50 128 65 126
               C71 141 91 145 99 131 Z" fill="var(--be-blue-tint)"/>
      <path d="M99 33 C111 19 132 25 139 39 C153 40 162 53 158 65
               C171 75 170 93 159 102 C157 118 145 129 131 126
               C125 142 106 145 99 131 Z" fill="var(--be-gold-tint)"/>
      <path d="M151 77 C158 81 160 91 154 97 C151 100 147 102 143 101
               C145 113 137 120 128 120 C124 130 117 133 111 131"
            stroke="var(--be-gold)" stroke-width="5"/>
      <path d="M56 53 C58 45 65 43 71 47 C79 51 79 63 73 67
               M39 65 C47 64 54 68 57 76 C60 84 55 92 47 94
               M88 57 C85 66 88 74 98 77
               M65 126 C64 117 69 109 77 107 C85 105 93 110 94 118
               M66 91 C72 83 82 83 89 91
               M116 41 C113 49 116 58 123 61 C127 63 132 62 137 59
               M108 81 C111 71 122 67 132 73 C137 76 138 83 135 87
               M126 99 C116 96 109 103 111 113
               M145 104 C150 103 156 104 159 102" stroke-width="2.4"/>
    `),

    barbell: illustration(`
      <ellipse cx="101" cy="137" rx="61" ry="7" fill="var(--be-shadow)" stroke="none"/>
      <g data-art-part="weights">
        <g transform="rotate(-13 100 81)">
          <rect x="19" y="74" width="162" height="13" rx="6" fill="var(--be-blue-tint)"/>
          <path d="M73 84 L82 77 M84 84 L93 77 M95 84 L104 77 M106 84 L115 77 M117 84 L126 77"
                stroke-width="1.35"/>
          <rect x="32" y="55" width="19" height="52" rx="7" fill="var(--be-blue-tint)"/>
          <rect x="149" y="55" width="19" height="52" rx="7" fill="var(--be-blue-tint)"/>
          <rect x="42" y="45" width="23" height="72" rx="9" fill="var(--be-accent)"/>
          <rect x="134" y="45" width="23" height="72" rx="9" fill="var(--be-accent)"/>
          <path d="M46 58 Q46 50 52 50 M138 58 Q138 50 144 50" stroke="var(--be-paper)" stroke-width="2"/>
          <rect x="58" y="59" width="13" height="44" rx="5" fill="var(--be-gold)"/>
          <rect x="129" y="59" width="13" height="44" rx="5" fill="var(--be-gold)"/>
        </g>
      </g>
    `),

    robot: illustration(`
      <path d="M66 118 H138 Q153 118 160 145 H46 Q50 122 66 118 Z"
            fill="var(--be-shadow)" stroke="none"/>
      <path d="M68 112 H132 Q146 112 153 139 H47 Q54 112 68 112 Z" fill="var(--be-blue-tint)"/>
      <path d="M85 114 Q100 133 115 114 M75 130 V139 M126 130 V139" stroke-width="2.25"/>
      <g data-art-part="antenna">
        <path d="M100 45 V29" stroke-width="3.5"/>
        <circle cx="100" cy="23" r="7" fill="var(--be-gold)"/>
      </g>
      <rect x="38" y="65" width="18" height="30" rx="7" fill="var(--be-gold-tint)"/>
      <rect x="144" y="65" width="18" height="30" rx="7" fill="var(--be-gold-tint)"/>
      <rect x="53" y="45" width="96" height="71" rx="19" fill="var(--be-accent)"/>
      <rect x="49" y="45" width="92" height="71" rx="18" fill="var(--be-blue-tint)"/>
      <rect x="59" y="56" width="72" height="48" rx="12" fill="var(--be-paper)" stroke-width="2.25"/>
      <g data-art-part="eyes" fill="var(--be-ink)" stroke="none">
        <rect x="74" y="69" width="8.5" height="13" rx="4"/>
        <rect x="108" y="69" width="8.5" height="13" rx="4"/>
      </g>
      <path d="M85 90 Q95 99 106 90" stroke-width="2.4"/>
      <circle cx="122" cy="61" r="2.5" fill="var(--be-gold)" stroke="none"/>
    `),

    student: illustration(`
      <ellipse cx="103" cy="146" rx="72" ry="8" fill="var(--be-shadow)" stroke="none"/>
      <g class="be-person">
        <path d="M81 101 H121 Q148 101 156 131 L159 146 H41 L44 132
                 Q50 102 81 101 Z" fill="var(--be-accent)"/>
        <path d="M61 115 Q68 111 78 110 M137 116 Q144 122 147 133"
              stroke="var(--be-ivory)" stroke-width="2.25" stroke-opacity=".65"/>
        <path d="M80 103 Q100 114 121 103 L112 123 H90 Z" fill="var(--be-denim)"/>
        <path class="be-skin-shade" d="M89 86 H112 L114 105 Q106 116 98 114 Q91 113 86 105 Z"/>
        <g data-art-part="head">
          <path class="be-hair be-hair--back" d="M67 70 Q56 53 66 36 C65 25 76 18 86 21
                   C94 11 111 14 118 22 C129 20 141 31 138 42 Q151 55 138 76 L131 90 H70 Z"/>
          <path class="be-skin" d="M70 55 C67 49 72 40 82 40 C84 34 93 32 98 37
                   C109 38 112 45 129 46 L130 63 C139 56 146 64 142 73
                   C140 78 135 80 130 79 Q123 98 105 102 Q88 104 77 87
                   Q67 83 65 73 Q62 64 70 62 Z"/>
          <path class="be-skin-shade" d="M128 80 Q120 95 106 99 Q94 101 87 92 Q100 97 115 88 Z"
                fill-opacity=".65" stroke="none"/>
          <path class="be-hair" d="M72 58 Q79 48 90 50 Q96 41 106 46 Q116 53 131 53
                   C132 40 125 34 119 31 Q103 19 87 26 Q65 34 67 52 Z"/>
          <path class="be-hair-highlight" d="M77 43 Q88 30 103 32 Q111 33 118 39" stroke-width="2.1"/>
          <path d="M79 62 Q84 59 90 62 M108 62 Q113 61 119 65 M98 72 Q95 76 100 78
                   M90 85 Q98 91 108 85 M135 73 Q134 70 138 67" stroke-width="2"/>
          <path d="M79 67 Q85 65 92 67 Q86 74 79 67 Z
                   M107 68 Q114 66 120 69 Q113 75 107 68 Z" fill="var(--be-ivory)" stroke-width="1.6"/>
          <circle cx="86" cy="69" r="1.8" fill="currentColor" stroke="none"/>
          <circle cx="114" cy="70" r="1.8" fill="currentColor" stroke="none"/>
        </g>
        <g data-art-part="open-book">
          <path d="M34 125 Q65 117 100 133 Q131 118 164 124 L171 145
                   Q137 140 101 153 Q65 139 28 146 Z" fill="var(--be-gold)"/>
          <path d="M37 120 Q67 115 100 129 Q133 115 162 120 L166 140
                   Q135 136 100 148 Q67 136 33 141 Z" fill="var(--be-ivory)"/>
          <path d="M100 129 V148 M48 126 Q70 126 87 134 M47 132 Q66 132 82 138
                   M113 134 Q131 125 151 127 M114 140 Q129 134 142 134" stroke-width="1.8"/>
        </g>
      </g>
    `),

    code: illustration(`
      <rect x="30" y="34" width="147" height="105" rx="12" fill="var(--be-shadow)" stroke="none"/>
      <rect x="25" y="27" width="147" height="105" rx="12" fill="var(--be-paper)"/>
      <path d="M25 51 V39 Q25 27 37 27 H160 Q172 27 172 39 V51 Z" fill="var(--be-accent)"/>
      <g fill="var(--be-paper)" stroke-width="1.45">
        <circle cx="40" cy="39" r="2.75"/>
        <circle cx="50" cy="39" r="2.75"/>
        <circle cx="60" cy="39" r="2.75"/>
      </g>
      <path d="M40 59 H52 V121 H40 Z" fill="var(--be-blue-tint)" stroke="none"/>
      <path d="M44 69 H48 M44 83 H48 M44 97 H48 M44 111 H48" stroke-width="1.9"/>
      <path d="M60 76 Q94 74 124 76 V89 H60 Z" fill="var(--be-gold-tint)" stroke="none"/>
      <path d="M62 69 H83 M89 69 H119 M71 83 H101 M107 83 H117
               M71 97 H90 M96 97 H119 M62 111 H81" stroke-width="2.6"/>
      <path d="M140 68 Q133 68 133 76 V83 Q133 89 128 90 Q133 91 133 98
               V104 Q133 112 140 112 M149 68 Q156 68 156 76 V83
               Q156 89 161 90 Q156 91 156 98 V104 Q156 112 149 112"
            stroke-width="2.7"/>
    `),

    bug: illustration(`
      <ellipse cx="107" cy="137" rx="53" ry="8" fill="var(--be-shadow)" stroke="none"/>
      <g transform="rotate(13 99 87)">
        <path d="M76 64 L57 58 L47 44 M72 82 L51 82 L39 74 M73 100 L54 105 L47 118
                 M123 64 L142 58 L152 44 M127 82 L148 82 L160 74
                 M126 100 L145 105 L152 118" stroke-width="4"/>
        <path d="M89 53 Q88 38 78 31 M109 53 Q110 38 120 31" stroke-width="3.3"/>
        <circle cx="77" cy="30" r="3.7" fill="var(--be-gold-tint)" stroke-width="2"/>
        <circle cx="121" cy="30" r="3.7" fill="var(--be-gold-tint)" stroke-width="2"/>
        <path d="M77 62 C77 48 86 42 99 42 C112 42 121 48 121 62 Z" fill="var(--be-blue-tint)"/>
        <path d="M99 57 C128 57 134 74 134 91 C134 112 119 128 99 128
                 C79 128 64 112 64 91 C64 74 70 57 99 57 Z" fill="var(--be-gold)"/>
        <path d="M99 57 C122 59 131 71 131 88 C132 108 118 123 99 126 Z"
              fill="var(--be-gold-tint)" stroke="none"/>
        <path d="M99 59 V126 M73 83 C75 74 81 69 88 67" stroke-width="2.3"/>
        <circle cx="83" cy="95" r="4.5" fill="var(--be-paper)" stroke-width="1.75"/>
        <circle cx="112" cy="81" r="3.8" fill="var(--be-blue-tint)" stroke-width="1.75"/>
        <circle cx="114" cy="105" r="5.5" fill="var(--be-blue-tint)" stroke-width="1.75"/>
      </g>
    `),

    tree: illustration(`
      <path d="M100 35 L59 75 L34 123 M59 75 L79 123 M100 35 L141 75 L121 123 M141 75 L166 123"
            stroke-width="3.25"/>
      <g fill="var(--be-shadow)" stroke="none">
        <circle cx="104" cy="38" r="15.5"/>
        <circle cx="62" cy="79" r="13.5"/>
        <circle cx="145" cy="79" r="13.5"/>
        <circle cx="37" cy="126" r="11"/>
        <circle cx="82" cy="126" r="11"/>
        <circle cx="124" cy="126" r="11"/>
        <circle cx="169" cy="126" r="11"/>
      </g>
      <circle cx="100" cy="35" r="15.5" fill="var(--be-accent)"/>
      <circle cx="59" cy="75" r="13.5" fill="var(--be-blue-tint)"/>
      <circle cx="141" cy="75" r="13.5" fill="var(--be-blue-tint)"/>
      <g fill="var(--be-paper)">
        <circle cx="34" cy="123" r="11"/>
        <circle cx="79" cy="123" r="11"/>
        <circle cx="121" cy="123" r="11"/>
        <circle cx="166" cy="123" r="11"/>
      </g>
      <path d="M92 34 Q94 28 99 27" stroke="var(--be-paper)" stroke-width="2"/>
    `),

    stairs: illustration(`
      <path d="M25 131 L170 134 L186 119 L189 133 L169 148 H32 Z"
            fill="var(--be-shadow)" stroke="none"/>
      <path d="M164 28 L185 16 V126 L164 138 Z" fill="var(--be-accent)"/>
      <path d="M21 111 H57 V83 H93 V55 H129 V28 H164 V138 H21 Z"
            fill="var(--be-blue-tint)"/>
      <path d="M129 28 L150 16 H185 L164 28 Z M93 55 L114 43 H129 V55 Z
               M57 83 L78 71 H93 V83 Z M21 111 L42 99 H57 V111 Z"
            fill="var(--be-gold-tint)"/>
      <path d="M57 111 V138 M93 83 V138 M129 55 V138 M164 55 L185 43
               M164 83 L185 71 M164 111 L185 99" stroke-width="2.05"/>
      <path d="M29 119 H48 M65 91 H83 M101 63 H119 M136 36 H156"
            stroke="var(--be-paper)" stroke-width="2.5" stroke-opacity=".85"/>
    `),

    basket: illustration(`
      <ellipse cx="101" cy="139" rx="70" ry="8" fill="var(--be-shadow)" stroke="none"/>
      <path d="M32 77 Q88 63 168 77 L158 95 H41 Z" fill="var(--be-blue-tint)"/>
      <g data-art-part="basket-cards">
        <rect x="45" y="34" width="54" height="54" rx="5" transform="rotate(-14 72 60)"
              fill="var(--be-gold-tint)"/>
        <path d="M40 51 H75 M40 60 H64" transform="rotate(-14 72 60) translate(12 0)" stroke-width="1.9"/>
        <rect x="95" y="29" width="55" height="58" rx="5" transform="rotate(14 122 60)" fill="var(--be-accent)"/>
        <path d="M110 44 H139 M110 53 H132" transform="rotate(14 122 60)"
              stroke="var(--be-paper)" stroke-width="2.4"/>
        <rect x="79" y="47" width="47" height="42" rx="5" transform="rotate(-3 102 61)" fill="var(--be-paper)"/>
        <path d="M89 59 H117 M89 68 H110" transform="rotate(-3 102 61)" stroke-width="1.9"/>
      </g>
      <path d="M34 83 H165 L153 129 Q151 137 140 137 H60 Q49 137 47 129 Z"
            fill="var(--be-gold-tint)"/>
      <path d="M129 87 H164 L153 129 Q151 137 140 137 H126 Q130 125 129 87 Z"
            fill="var(--be-gold)" stroke="none"/>
      <path d="M43 102 H158 M46 115 H155 M50 127 H150 M60 92 L67 136
               M80 92 L84 137 M100 92 V137 M120 92 L116 137 M140 92 L132 137"
            stroke-width="1.5" stroke-opacity=".64"/>
      <rect x="30" y="76" width="140" height="15" rx="7.5" fill="var(--be-gold)"/>
      <rect x="90" y="103" width="21" height="14" rx="4" fill="var(--be-paper)" stroke-width="1.75"/>
      <path d="M96 110 H105" stroke-width="1.8"/>
    `),

    chat: illustration(`
      <path d="M87 56 H157 Q174 56 174 74 V103 Q174 120 157 120 H153 V139
               L130 120 H87 Q71 120 71 104 V72 Q71 56 87 56 Z"
            fill="var(--be-shadow)" stroke="none"/>
      <path d="M80 50 H151 Q168 50 168 67 V98 Q168 114 151 114 H147 V132
               L124 114 H80 Q65 114 65 98 V67 Q65 50 80 50 Z" fill="var(--be-blue-tint)"/>
      <g data-art-part="reply">
        <path d="M151 93 H127 M151 102 H113" stroke-width="2.4"/>
      </g>
      <path d="M44 27 H120 Q136 27 136 43 V73 Q136 89 120 89 H69
               L47 110 V89 H44 Q27 89 27 73 V44 Q27 27 44 27 Z" fill="var(--be-paper)"/>
      <path d="M35 71 V49 Q35 36 49 35 H114" stroke="var(--be-gold)" stroke-width="3.8" stroke-opacity=".75"/>
      <g fill="var(--be-accent)" stroke-width="1.9">
        <circle cx="59" cy="58" r="5"/>
        <circle cx="82" cy="58" r="5"/>
        <circle cx="105" cy="58" r="5"/>
      </g>
    `),

    question: illustration(`
      <path d="M60 32 H144 Q156 32 156 45 V113 Q156 125 144 125 H97
               L69 144 V125 H60 Q48 125 48 112 V45 Q48 32 60 32 Z"
            fill="var(--be-shadow)" stroke="none"/>
      <path d="M54 26 H138 Q151 26 151 39 V107 Q151 120 138 120 H91
               L63 140 V120 H54 Q41 120 41 107 V39 Q41 26 54 26 Z"
            fill="var(--be-gold-tint)"/>
      <path d="M49 53 V45 Q49 34 60 34 H130" stroke="var(--be-gold)" stroke-width="3.5"/>
      <path d="M77 60 C77 47 91 42 101 43 C115 44 121 55 115 66
               C111 75 97 75 97 88" stroke-width="7"/>
      <circle cx="97" cy="104" r="4" fill="var(--be-ink)" stroke="none"/>
      <path d="M161 43 L172 32 M166 62 L181 57 M164 81 L175 86"
            stroke="var(--be-accent)" stroke-width="3"/>
    `),

    checklist: illustration(`
      <rect x="54" y="33" width="103" height="116" rx="9" fill="var(--be-shadow)" stroke="none"/>
      <rect x="47" y="27" width="103" height="117" rx="9" fill="var(--be-accent)"/>
      <rect x="54" y="38" width="88" height="98" rx="3" fill="var(--be-paper)" stroke-width="2"/>
      <path d="M83 28 Q84 17 98 17 Q111 17 113 28 H121 V44 H76 V28 Z" fill="var(--be-gold-tint)"/>
      <circle cx="98" cy="26" r="3.8" fill="var(--be-gold)" stroke-width="1.7"/>
      <g stroke-width="2.1">
        <rect x="66" y="57" width="14" height="14" rx="3" fill="var(--be-blue-tint)"/>
        <rect x="66" y="79" width="14" height="14" rx="3" fill="var(--be-blue-tint)"/>
        <rect x="66" y="101" width="14" height="14" rx="3"/>
        <path d="M88 63 H126 M88 69 H114 M88 85 H125 M88 91 H113
                 M88 107 H124 M88 113 H108"/>
      </g>
      <path data-art-part="checks" d="M68 63 L72 67 L79 59 M68 86 L72 90 L79 82"
            stroke-width="2.25"/>
      <path d="M62 123 H133" stroke-width="1.55" stroke-opacity=".48"/>
    `),

    shield: illustration(`
      <path d="M104 24 Q132 38 162 41 V80 Q162 124 104 146
               Q46 124 46 80 V41 Q76 38 104 24 Z" fill="var(--be-shadow)" stroke="none"/>
      <path d="M100 17 Q128 31 158 34 V75 Q158 118 100 141
               Q42 118 42 75 V34 Q72 31 100 17 Z" fill="var(--be-accent)"/>
      <path d="M100 28 Q123 40 147 44 V75 Q147 112 100 129
               Q53 112 53 75 V44 Q77 40 100 28 Z" fill="var(--be-paper)"/>
      <path d="M100 31 Q124 43 145 46 V75 Q145 110 100 127 Z"
            fill="var(--be-blue-tint)" stroke="none"/>
      <circle cx="100" cy="77" r="26" fill="var(--be-gold-tint)" stroke-width="2.1"/>
      <path data-art-part="tick" d="M87 76 L97 86 L114 67" stroke-width="5.4"/>
      <path d="M49 39 Q72 35 92 26" stroke="var(--be-paper)" stroke-width="2.1"/>
    `),

    balance: illustration(`
      <ellipse cx="103" cy="145" rx="54" ry="6" fill="var(--be-shadow)" stroke="none"/>
      <path d="M96 38 H105 L111 126 H90 Z" fill="var(--be-blue-tint)"/>
      <path d="M93 126 H108 L118 133 H82 Z" fill="var(--be-blue-tint)"/>
      <path d="M78 133 H122 Q128 133 129 142 H71 Q72 133 78 133 Z" fill="var(--be-accent)"/>
      <path d="M44 46 Q67 42 99 43 Q129 47 155 50" stroke-width="7"/>
      <path d="M44 46 Q67 42 99 43 Q129 47 155 50" stroke="var(--be-gold)" stroke-width="3.25"/>
      <circle cx="100" cy="43" r="8" fill="var(--be-gold-tint)"/>
      <circle cx="100" cy="25" r="5.75" fill="var(--be-accent)"/>
      <path d="M100 31 V35 M44 48 L22 97 M44 48 L66 97
               M155 53 L133 102 M155 53 L177 102" stroke-width="2.3"/>
      <g data-art-part="left-pan">
        <rect x="32" y="82" width="22" height="16" rx="3" fill="var(--be-gold-tint)" stroke-width="2"/>
        <path d="M20 98 H68 Q64 114 44 114 Q24 114 20 98 Z" fill="var(--be-gold)"/>
        <path d="M30 104 Q35 109 43 110" stroke="var(--be-paper)" stroke-width="2"/>
      </g>
      <g data-art-part="right-pan">
        <circle cx="155" cy="94" r="10" fill="var(--be-blue-tint)" stroke-width="2"/>
        <path d="M131 103 H179 Q175 119 155 119 Q135 119 131 103 Z" fill="var(--be-gold)"/>
        <path d="M141 109 Q146 114 154 115" stroke="var(--be-paper)" stroke-width="2"/>
      </g>
    `),

    laptop: illustration(`
      <path d="M43 117 H160 L185 137 Q182 149 167 149 H42 Q26 149 22 138 Z"
            fill="var(--be-shadow)" stroke="none"/>
      <rect x="42" y="30" width="120" height="87" rx="9" fill="var(--be-accent)"/>
      <rect x="36" y="30" width="120" height="87" rx="9" fill="var(--be-blue-tint)"/>
      <rect x="43" y="40" width="106" height="68" rx="4" fill="var(--be-paper)" stroke-width="2"/>
      <circle cx="95" cy="35" r="1.4" fill="var(--be-ink)" stroke="none"/>
      <path d="M37 112 H156 L179 132 Q179 142 165 142 H35 Q21 142 20 132 Z"
            fill="var(--be-blue-tint)"/>
      <path d="M37 112 H156 L179 132 H20 Z" fill="var(--be-paper)"/>
      <path d="M63 119 H128 M69 126 H122" stroke-width="2.1" stroke-opacity=".8"/>
      <path d="M87 132 Q88 137 92 137 H108 Q112 137 113 132" fill="var(--be-gold-tint)" stroke-width="1.85"/>
      <rect x="53" y="49" width="87" height="51" rx="4" fill="var(--be-blue-tint)" stroke-width="2"/>
      <path d="M53 60 H140 M79 60 V100" stroke-width="2"/>
      <path d="M60 55 H65 M69 55 H74" stroke-width="1.7"/>
      <rect x="87" y="68" width="44" height="12" rx="3" fill="var(--be-gold)" stroke-width="1.6"/>
      <path d="M60 68 H72 M60 76 H70 M60 84 H71 M88 87 H119 M88 93 H110" stroke-width="1.8"/>
    `),

    map: illustration(`
      <path d="M30 53 L70 33 L122 52 L173 33 L181 124 L127 146
               L76 128 L30 145 Z" fill="var(--be-shadow)" stroke="none"/>
      <path d="M24 45 L68 27 L119 46 L171 27 L176 116 L124 138
               L72 120 L24 139 Z" fill="var(--be-paper)"/>
      <path d="M68 27 L119 46 L124 138 L72 120 Z" fill="var(--be-blue-tint)"/>
      <path d="M119 46 L171 27 L176 116 L124 138 Z" fill="var(--be-gold-tint)"/>
      <path d="M35 62 L56 54 M38 70 L59 62 M85 109 L111 119 M152 111 L166 105"
            stroke-width="1.6" stroke-opacity=".55"/>
      <path d="M46 109 C55 91 63 94 79 96 C94 98 90 68 110 78
               C122 84 132 95 145 75" stroke-width="2.7" stroke-dasharray="4 6"/>
      <circle cx="45" cy="110" r="4.4" fill="var(--be-accent)" stroke-width="2"/>
      <g data-art-part="destination">
        <path d="M145 44 C137 44 132 50 132 57 C132 66 140 74 145 81
                 C150 74 158 66 158 57 C158 50 153 44 145 44 Z" fill="var(--be-gold)"/>
        <circle cx="145" cy="57" r="4.8" fill="var(--be-paper)" stroke-width="2"/>
      </g>
    `),

    lamp: illustration(`
      <ellipse cx="90" cy="142" rx="67" ry="7" fill="var(--be-shadow)" stroke="none"/>
      <g data-art-part="rays">
        <path d="M128 78 L105 131 Q135 141 178 129 L161 77 Z"
              fill="var(--be-gold-tint)" fill-opacity=".65" stroke="none"/>
        <path d="M134 98 L125 117 M150 100 L150 120 M163 97 L173 113" stroke="var(--be-gold)" stroke-width="2.75"/>
      </g>
      <path d="M62 131 L53 83 Q52 80 54 77 L89 32 Q91 29 95 31 L123 43 L119 51
               L95 41 L64 82 L73 131 Z" fill="var(--be-accent)"/>
      <path d="M61 82 L94 39 L112 46" stroke="var(--be-paper)" stroke-width="1.8" stroke-opacity=".7"/>
      <circle cx="59" cy="81" r="7" fill="var(--be-blue-tint)" stroke-width="2.2"/>
      <path d="M46 129 H83 Q97 129 104 141 H27 Q32 129 46 129 Z" fill="var(--be-blue-tint)"/>
      <path d="M43 135 H87" stroke-width="2"/>
      <path d="M114 44 Q119 31 133 36 L151 42 Q157 44 160 52 L170 78
               L108 70 Z" fill="var(--be-gold)"/>
      <path d="M120 43 Q124 38 133 40 L149 46" stroke="var(--be-paper)" stroke-width="2"/>
      <ellipse cx="139" cy="75" rx="32" ry="9" transform="rotate(8 139 75)" fill="var(--be-gold-tint)"/>
      <path d="M129 75 Q132 82 140 82 Q147 82 151 78" stroke-width="2"/>
    `),

    database: illustration(`
      <ellipse cx="106" cy="137" rx="62" ry="12" fill="var(--be-shadow)" stroke="none"/>
      <path d="M45 45 Q45 24 99 24 Q153 24 153 45 V120
               Q153 140 99 140 Q45 140 45 120 Z" fill="var(--be-blue-tint)"/>
      <path d="M45 98 Q45 115 99 115 Q153 115 153 98 V120
               Q153 140 99 140 Q45 140 45 120 Z" fill="var(--be-accent)"/>
      <path d="M122 64 Q148 60 153 49 V120 Q153 133 122 138 Z"
            fill="var(--be-ink)" fill-opacity=".12" stroke="none"/>
      <path d="M45 72 Q45 91 99 91 Q153 91 153 72 M45 97 Q45 116 99 116 Q153 116 153 97"/>
      <ellipse cx="99" cy="44" rx="54" ry="20" fill="var(--be-paper)"/>
      <path d="M60 43 Q67 33 99 33 Q125 33 134 39" stroke="var(--be-gold)" stroke-width="3.25"/>
      <g fill="var(--be-gold)" stroke-width="1.65">
        <circle cx="68" cy="71" r="4"/>
        <circle cx="68" cy="96" r="4"/>
        <circle cx="68" cy="121" r="4"/>
      </g>
      <path d="M80 74 Q100 77 120 74 M80 99 Q100 102 120 99 M80 124 Q100 127 120 124"
            stroke-width="2.05"/>
    `),

    blocks: illustration(`
      <path d="M30 127 L78 151 L116 134 L143 146 L179 126 L178 136
               L143 155 L116 144 L77 160 L27 136 Z" fill="var(--be-shadow)" stroke="none"/>
      <g data-art-part="upper-block">
        <path d="M79 42 L111 23 L143 40 L143 69 L111 87 L79 69 Z" fill="var(--be-gold-tint)"/>
        <path d="M111 58 L143 40 V69 L111 87 Z" fill="var(--be-gold)"/>
        <path d="M79 42 L111 23 L143 40 L111 58 Z" fill="var(--be-paper)"/>
        <path d="M93 40 L110 30 L124 37" stroke-width="1.75" stroke-opacity=".8"/>
      </g>
      <g data-art-part="right-block">
        <path d="M97 97 L136 75 L176 95 L176 124 L137 147 L97 127 Z" fill="var(--be-gold-tint)"/>
        <path d="M137 116 L176 95 V124 L137 147 Z" fill="var(--be-accent)"/>
        <path d="M97 97 L136 75 L176 95 L137 116 Z" fill="var(--be-paper)"/>
        <path d="M118 95 L135 85 L156 95 L138 105 Z" fill="var(--be-blue-tint)" stroke-width="1.8"/>
        <path d="M143 138 L168 123" stroke="var(--be-paper)" stroke-width="2" stroke-opacity=".78"/>
      </g>
      <g data-art-part="left-block">
        <path d="M25 88 L66 63 L112 85 L112 119 L69 143 L25 121 Z" fill="var(--be-blue-tint)"/>
        <path d="M69 108 L112 85 V119 L69 143 Z" fill="var(--be-accent)"/>
        <path d="M25 88 L66 63 L112 85 L69 108 Z" fill="var(--be-paper)"/>
        <path d="M45 88 L65 75 L91 87 L68 100 Z" fill="var(--be-gold-tint)" stroke-width="1.8"/>
        <path d="M33 104 L56 116 M33 112 L51 122" stroke-width="1.9"/>
      </g>
    `),

    trophy: illustration(`
      <ellipse cx="104" cy="146" rx="53" ry="6" fill="var(--be-shadow)" stroke="none"/>
      <path d="M57 38 H38 Q31 38 31 46 V52 Q33 78 64 81 L67 72
               Q42 69 42 51 V49 H57 Z" fill="var(--be-gold-tint)"/>
      <path d="M143 38 H162 Q169 38 169 46 V52 Q167 78 136 81 L133 72
               Q158 69 158 51 V49 H143 Z" fill="var(--be-gold-tint)"/>
      <path d="M94 100 H106 V119 Q110 123 124 127 V132 H76 V127
               Q91 123 94 119 Z" fill="var(--be-gold)"/>
      <rect x="69" y="130" width="62" height="14" rx="4" fill="var(--be-accent)"/>
      <path d="M88 137 H113" stroke="var(--be-paper)" stroke-width="2.2"/>
      <path d="M55 29 H145 L142 61 Q139 95 100 107 Q62 95 58 61 Z" fill="var(--be-gold)"/>
      <path d="M56 30 H109 Q118 66 100 107 Q62 95 58 61 Z" fill="var(--be-gold-tint)" stroke="none"/>
      <path d="M55 29 H145" stroke-width="3.8"/>
      <path d="M65 39 L68 60 Q70 75 81 85" stroke="var(--be-paper)" stroke-width="3.25"/>
      <path d="M102 46 L107 60 L122 61 L110 70 L113 85 L102 77
               L89 85 L93 71 L81 62 L96 60 Z" fill="var(--be-paper)" stroke-width="2.25"/>
    `),

    document: illustration(`
      <path d="M56 24 H130 L158 52 V141 Q158 147 152 147 H56 Q50 147 50 141 V30 Q50 24 56 24 Z"
            fill="var(--be-shadow)" stroke="none"/>
      <path d="M51 18 H125 L152 45 V134 Q152 140 146 140 H51 Q45 140 45 134 V24 Q45 18 51 18 Z"
            fill="var(--be-paper)"/>
      <path d="M125 19 V39 Q125 45 131 45 H151 Z" fill="var(--be-blue-tint)"/>
      <path d="M58 32 H100 M58 41 H88" stroke-width="2.1"/>
      <path d="M58 59 H132 V73 H58 Z" fill="var(--be-gold-tint)" stroke="none"/>
      <path d="M59 64 H116 M59 81 H116 M59 93 H131 M59 105 H102 M59 117 H88"
            stroke-width="2.25"/>
      <g data-art-part="note">
        <rect x="106" y="99" width="62" height="36" rx="4" transform="rotate(-9 137 117)"
              fill="var(--be-accent)"/>
        <path d="M122 113 H153 M122 121 H143" transform="rotate(-9 137 117)"
              stroke="var(--be-paper)" stroke-width="2.2"/>
      </g>
    `),

    eye: illustration(`
      <path d="M26 91 Q62 46 103 46 Q143 46 179 91 Q143 132 103 132 Q62 132 26 91 Z"
            fill="var(--be-shadow)" stroke="none"/>
      <path d="M24 83 Q61 39 100 39 Q140 39 176 83 Q141 125 100 125 Q60 125 24 83 Z"
            fill="var(--be-paper)"/>
      <path d="M26 83 Q63 40 100 40 Q139 40 174 83 Q136 56 100 56 Q62 56 26 83 Z"
            fill="var(--be-blue-tint)" stroke="none"/>
      <g data-art-part="iris">
        <circle cx="100" cy="83" r="27" fill="var(--be-accent)"/>
        <path d="M79 78 Q81 70 89 66 M111 102 Q119 98 122 89"
              stroke="var(--be-paper)" stroke-width="2.5" stroke-opacity=".85"/>
        <circle cx="100" cy="83" r="12" fill="var(--be-ink)" stroke="none"/>
        <circle cx="94" cy="77" r="4.75" fill="var(--be-paper)" stroke="none"/>
        <circle cx="107" cy="89" r="1.8" fill="var(--be-paper)" stroke="none"/>
      </g>
      <path d="M38 52 Q66 25 100 25 Q128 25 154 44" stroke-width="2.4" stroke-opacity=".68"/>
      <path d="M49 118 Q71 136 104 136" stroke-width="2.05" stroke-opacity=".68"/>
    `)
  });
})();

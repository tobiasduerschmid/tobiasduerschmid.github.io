/** Lexical coloring only. OSATE owns parsing, name resolution, and diagnostics. */
const registered = new WeakSet();

// Core words follow OSATE's Aadl2.xtext; property words are shared by its
// Properties grammar. Unit names are a convenience, not unit/type validation.
const keywords = `aadlboolean aadlinteger aadlreal aadlstring abstract access all
  and annex applies binding bus calls classifier computed connections constant
  data delta device end enumeration event extends false feature features flow
  flows group implementation in inherit initial internal inverse is list memory
  mode modes none not of or out package parameter path port private process
  processor properties property prototype prototypes provides public range record
  reference refined renames requires self set sink source subcomponents subprogram
  system thread to true type units virtual with`.split(/\s+/);
const units = 'ps ns us ms sec min hr byte kbyte mbyte gbyte b kb mb gb hz khz mhz ghz'.split(' ');

/** Register once per Monaco instance; safe for multiple tutorial workspaces. */
export function registerAADLLanguage(monaco) {
  if (registered.has(monaco)) return;
  monaco.languages.register({ id: 'aadl', extensions: ['.aadl'], aliases: ['AADL'] });
  monaco.languages.setLanguageConfiguration('aadl', {
    comments: { lineComment: '--' },
    brackets: [['(', ')'], ['[', ']'], ['{', '}']],
    autoClosingPairs: [{ open: '(', close: ')' }, { open: '[', close: ']' }, { open: '"', close: '"', notIn: ['string', 'comment'] }],
  });
  monaco.languages.setMonarchTokensProvider('aadl', {
    ignoreCase: true,
    keywords, units,
    tokenizer: {
      root: [
        [/--.*$/, 'comment'],
        [/"/, 'string', '@string'],
        [/\d[\d_]*#[\da-f_]+(?:\.[\da-f_]+)?#(?:e[+-]?[\d_]+)?/, 'number'],
        [/\d[\d_]*(?:\.[\d_]+)?(?:e[+-]?[\d_]+)?/, 'number'],
        [/[a-z][\w]*/, { cases: { '@keywords': 'keyword', '@units': 'type', '@default': 'identifier' } }],
        [/<->|\+=>|=>|->|::|\.\.|\*\*|[+\-*=<>\/]/, 'operator'],
        [/[()[\]{}]/, '@brackets'],
        [/[;:,.]/, 'delimiter'],
        [/\s+/, 'white'],
      ],
      string: [
        [/[^"\\]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
    },
  });
  registered.add(monaco);
}

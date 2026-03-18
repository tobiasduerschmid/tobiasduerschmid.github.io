import yaml
import json
import os
import re

# Configuration
NAV_FILE = '_data/sebook_nav.yml'
MD_ROOT = 'SEBook'
LATEX_DIR = 'latex'
BIB_REF = '../_bibliography/references.bib'  # relative to latex/ when compiling

# Create latex directory if it doesn't exist
if not os.path.exists(LATEX_DIR):
    os.makedirs(LATEX_DIR)


def escape_latex(text):
    if not text:
        return ""
    special_chars = {
        '&':  r'\&',
        '%':  r'\%',
        '$':  r'\$',
        '#':  r'\#',
        '_':  r'\_',
        '{':  r'\{',
        '}':  r'\}',
        '~':  r'\textasciitilde{}',
        '^':  r'\textasciicircum{}',
        '\\': r'\textbackslash{}',
    }
    res = text.replace('\\', 'LXPBACKSLASHX')
    for char, escape in special_chars.items():
        if char != '\\':
            res = res.replace(char, escape)
    res = res.replace('LXPBACKSLASHX', special_chars['\\'])
    return res


def unescape_latex(text):
    if not text:
        return ""
    return (text
            .replace(r'\_', '_')
            .replace(r'\&', '&')
            .replace(r'\%', '%')
            .replace(r'\$', '$')
            .replace(r'\#', '#')
            .replace(r'\{', '{')
            .replace(r'\}', '}')
            .replace(r'\textbackslash{}', '\\'))


# ---------------------------------------------------------------------------
# Inline markup → LXCMD… placeholders (applied to both body and list items)
# ---------------------------------------------------------------------------
def apply_inline_markup(text):
    """Convert markdown inline syntax to LXCMD placeholders (no escaping yet)."""

    # Quotation marks → \enquote
    # IMPORTANT: must come FIRST before bold/italic add { } chars.
    # Use LXP (not LXCMD) prefix so the brace-based LXCMD restore regex
    # can never accidentally merge this sentinel with an adjacent LXCMD token.
    # Typographic "…"
    text = re.sub('\u201c([^\u201d]*?)\u201d',
                  lambda m: 'LXPENQUOTEX' + m.group(1) + 'LXPENQUOTEY', text)
    # ASCII "…" — no newlines so we never cross line boundaries
    text = re.sub(r'"([^"\n]+?)"',
                  lambda m: 'LXPENQUOTEX' + m.group(1) + 'LXPENQUOTEY', text)

    # Citations
    text = re.sub(
        r'\{%\s*cite\s+([\w\d\s\-_]+?)\s*%\}',
        lambda m: 'LXCMDCITE{' + m.group(1).strip() + '}',
        text
    )

    # Bold
    text = re.sub(r'\*\*(.+?)\*\*', r'LXCMDTEXTBOLD{\1}', text)

    # Italics (_ and *)
    text = re.sub(r'(?<=[\s\(\[\{])_([^_]+?)_(?=[\s\)\.\,\!\?\]\}])',
                  r'LXCMDTEXTITALIC{\1}', text)
    text = re.sub(r'(?<=[\s\(\[\{])\*([^\*]+?)\*(?=[\s\)\.\,\!\?\]\}])',
                  r'LXCMDTEXTITALIC{\1}', text)

    # Inline code
    text = re.sub(r'`([^`]+)`', r'LXCMDTEXTTT{\1}', text)

    # Highlight
    text = re.sub(r'==(.+?)==', r'LXCMDHL{\1}', text)

    # Links
    def replace_links(match):
        link_text = match.group(1)
        url = match.group(2)
        if url.startswith('/SEBook/'):
            label = (url.replace('/SEBook/', '')
                        .replace('.html', '')
                        .replace('/', '_')
                        .strip('_')) or 'root'
            return f'{link_text} (see p. LXCMDPAGEREF{{{label}}})'
        return f'LXCMDHREF{{{url}}}{{{link_text}}}'

    text = re.sub(r'\[(.+?)\]\((.+?)\)', replace_links, text)

    # Strip remaining Liquid tags
    text = re.sub(r'\{%.*?%\}',   '', text)
    text = re.sub(r'\{\{.*?\}\}', '', text)

    return text


# ---------------------------------------------------------------------------
# Escape + restore pipeline
# ---------------------------------------------------------------------------
def escape_and_restore(text):
    """Escape special LaTeX chars, then restore LXCMD… → real LaTeX commands."""
    text = escape_latex(text)

    def sub_cmd(match):
        cmd   = match.group(1).lower()
        inner = match.group(2)
        if cmd in ['cite', 'pageref', 'label']:
            inner = unescape_latex(inner)

        cmd_map = {
            'section':       'section',
            'subsection':    'subsection',
            'subsubsection': 'subsubsection',
            'hl':            'hl',
            'cite':          'cite',
            'textbold':      'textbf',
            'textitalic':    'textit',
            'texttt':        'texttt',
            'pageref':       'pageref',
        }
        real_cmd = cmd_map.get(cmd, cmd)
        return f'\\{real_cmd}{{{inner}}}'

    # href: two brace groups
    text = re.sub(
        r'LXCMDHREF\\\{(.*?)\\\}\\\{(.*?)\\\}',
        lambda m: f'\\href{{{unescape_latex(m.group(1))}}}{{{m.group(2)}}}',
        text,
        flags=re.DOTALL
    )

    # All single-argument LXCMD commands (repeat for nesting)
    for _ in range(6):
        text = re.sub(r'LXCMD(\w+)\\\{(.*?)\\\}', sub_cmd, text, flags=re.DOTALL)

    # Enquote sentinels — restored LAST after all other commands are in place.
    # Inner content has already been through escape_and_restore so it contains
    # real LaTeX.  We just need to wrap it with \enquote{…}.
    text = text.replace('LXPENQUOTEX', '\\enquote{').replace('LXPENQUOTEY', '}')

    return text


# ---------------------------------------------------------------------------
# Nested itemize builder
# ---------------------------------------------------------------------------
def build_nested_itemize(items):
    """
    items: list of [level, latex_text] pairs (level is 0-based int).
    Emits properly nested \\begin{itemize} … \\end{itemize}.
    """
    output = []
    stack = []

    def close_to(target):
        while stack and stack[-1] > target:
            output.append('\\end{itemize}')
            stack.pop()

    for level, text in items:
        if not stack:
            output.append('\\begin{itemize}')
            stack.append(level)
        elif level > stack[-1]:
            output.append('\\begin{itemize}')
            stack.append(level)
        elif level < stack[-1]:
            close_to(level)
            if not stack or stack[-1] != level:
                output.append('\\begin{itemize}')
                stack.append(level)
        output.append(f'\\item {text}')

    while stack:
        output.append('\\end{itemize}')
        stack.pop()

    return '\n'.join(output)


# ---------------------------------------------------------------------------
# Main translation function
# ---------------------------------------------------------------------------
def md_to_latex(md_content, base_url):

    # ── Front Matter ─────────────────────────────────────────────────────────
    front_matter = {}
    if md_content.startswith('---'):
        parts = md_content.split('---', 2)
        if len(parts) >= 3:
            try:
                front_matter = yaml.safe_load(parts[1])
            except Exception:
                pass
            md_content = parts[2]

    title = front_matter.get('title', 'Unknown Title')

    # ── Strip quiz includes ───────────────────────────────────────────────────
    md_content = re.sub(r'\{%\s*include\s+quiz\.html\s+id=".*"\s*%\}', '', md_content)

    # ── 1. Protect fenced code blocks ────────────────────────────────────────
    code_blocks = []

    def store_code(match):
        lang = match.group(1) or 'text'
        code = match.group(2)
        placeholder = f'LXPBLOCKCODE{len(code_blocks)}X'
        code_blocks.append((lang, code))
        return placeholder

    md_content = re.sub(r'```(\w+)?\n(.*?)\n```', store_code, md_content, flags=re.DOTALL)

    # ── 2. Headers — MUST come before list capture so headings adjacent to
    #        list blocks are never consumed by the list block regex. ──────────
    md_content = re.sub(r'^###\s+(.+)$', r'LXCMDSUBSUBSECTION{\1}', md_content, flags=re.MULTILINE)
    md_content = re.sub(r'^##\s+(.+)$',  r'LXCMDSUBSECTION{\1}',    md_content, flags=re.MULTILINE)
    md_content = re.sub(r'^#\s+(.+)$',   r'LXCMDSECTION{\1}',       md_content, flags=re.MULTILINE)

    # ── 3. Capture list blocks (raw markdown), replace with placeholder ───────
    # Key insight: we store the raw markdown lines here (before any escaping
    # or inline markup), then process each item through the full pipeline later.
    list_blocks = []

    def store_list_block(match):
        raw_block = match.group(0)
        items = []
        for line in raw_block.splitlines():
            m = re.match(r'^(\s*)[\*\-\+]\s+(.*)', line)
            if m:
                indent = len(m.group(1))
                items.append([indent, m.group(2).rstrip()])
        if not items:
            return raw_block
        # Normalise indent to 0-based levels
        sorted_indents = sorted(set(lvl for lvl, _ in items))
        indent_map = {v: i for i, v in enumerate(sorted_indents)}
        normalised = [[indent_map[lvl], txt] for lvl, txt in items]
        idx = len(list_blocks)
        list_blocks.append(normalised)
        return f'LXPLISTBLOCK{idx}X'

    md_content = re.sub(
        r'^([ \t]*[\*\-\+][ \t]+.+\n?)(?:(?:[ \t]*[\*\-\+][ \t]+.+\n?)|(?:[ \t]*\n))*',
        store_list_block,
        md_content,
        flags=re.MULTILINE
    )

    # ── 4. Inline markup on body text ────────────────────────────────────────
    md_content = apply_inline_markup(md_content)

    # ── 5. Escape body and restore commands ──────────────────────────────────
    md_content = escape_and_restore(md_content)

    # ── 6. Restore list blocks ────────────────────────────────────────────────
    def restore_list_block(match):
        idx = int(match.group(1))
        raw_items = list_blocks[idx]          # [[level, raw_md_text], …]
        rendered = []
        for level, raw_text in raw_items:
            # Apply full inline pipeline to each item independently
            processed = apply_inline_markup(raw_text)
            processed = escape_and_restore(processed)
            rendered.append([level, processed])
        return build_nested_itemize(rendered) + '\n'

    md_content = re.sub(r'LXPLISTBLOCK(\d+)X', restore_list_block, md_content)

    # ── 7. Restore code blocks ────────────────────────────────────────────────
    for i, (lang, code) in enumerate(code_blocks):
        lst = (f'\\begin{{lstlisting}}[language={lang},style=sebook]\n'
               f'{code}\n'
               f'\\end{{lstlisting}}')
        md_content = md_content.replace(f'LXPBLOCKCODE{i}X', lst)

    # ── 8. Section label ─────────────────────────────────────────────────────
    label = (base_url.replace('/SEBook/', '')
                     .replace('.html', '')
                     .replace('/', '_')
                     .strip('_')) or 'root'
    output = f'\\section{{{escape_latex(title)}}}\\label{{{label}}}\n' + md_content

    return output


# ---------------------------------------------------------------------------
# Navigation parser
# ---------------------------------------------------------------------------
def parse_nav(nav_data):
    files = []

    def process_items(items):
        for item in items:
            if 'url' in item:
                files.append(item['url'])
            if 'subtopics' in item:
                process_items(item['subtopics'])
            if 'items' in item:
                process_items(item['items'])

    process_items(nav_data['topics'])
    return files


# ---------------------------------------------------------------------------
# LaTeX preamble
# ---------------------------------------------------------------------------
PREAMBLE = r"""
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage[utf8]{inputenc}
\usepackage[a4paper, margin=2.5cm]{geometry}
\usepackage{microtype}
\usepackage{parskip}
\usepackage{xcolor}
\usepackage[autostyle=true]{csquotes}
\usepackage{soul}
\usepackage{hyperref}
\usepackage{listings}

% ── Colour palette ───────────────────────────────────────────────────────────
\definecolor{codebg}{HTML}{F8F8F8}
\definecolor{codeframe}{HTML}{CCCCCC}
\definecolor{codecomment}{HTML}{6A9955}
\definecolor{codekeyword}{HTML}{0000FF}
\definecolor{codestring}{HTML}{A31515}

% ── listings style ───────────────────────────────────────────────────────────
\lstdefinestyle{sebook}{
  backgroundcolor=\color{codebg},
  basicstyle=\ttfamily\small,
  breakatwhitespace=false,
  breaklines=true,
  captionpos=b,
  columns=fullflexible,
  commentstyle=\color{codecomment}\itshape,
  frame=single,
  framesep=6pt,
  framexleftmargin=6pt,
  keepspaces=true,
  keywordstyle=\color{codekeyword}\bfseries,
  numbers=left,
  numbersep=8pt,
  numberstyle=\tiny\color{gray},
  rulecolor=\color{codeframe},
  showspaces=false,
  showstringspaces=false,
  showtabs=false,
  stringstyle=\color{codestring},
  tabsize=2,
  xleftmargin=16pt,
}
\lstset{style=sebook}
"""


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    with open(NAV_FILE, 'r') as f:
        nav = yaml.safe_load(f)

    urls = parse_nav(nav)
    translated_files = []

    for url in urls:
        md_rel_path = url.replace('/SEBook/', '').replace('.html', '.md')
        md_abs_path = os.path.join(MD_ROOT, md_rel_path)
        if os.path.exists(md_abs_path):
            print(f'Translating {md_abs_path}...')
            with open(md_abs_path, 'r', encoding='utf-8') as f:
                content = f.read()
            tex_content = md_to_latex(content, url)
            tex_filename = md_rel_path.replace('.md', '.tex').replace('/', '_')
            tex_abs_path = os.path.join(LATEX_DIR, tex_filename)
            with open(tex_abs_path, 'w', encoding='utf-8') as f:
                f.write(tex_content)
            translated_files.append(tex_filename)
        else:
            print(f'Warning: {md_abs_path} not found.')

    main_tex = f"""\\documentclass{{article}}
{PREAMBLE}
\\usepackage{{biblatex}}
\\addbibresource{{{BIB_REF}}}
\\title{{SEBook}}
\\author{{Tobias Duerschmid}}
\\begin{{document}}
\\maketitle
\\tableofcontents
\\clearpage

"""
    for tf in translated_files:
        main_tex += f"\\include{{{tf.replace('.tex', '')}}}\n"

    main_tex += '\\printbibliography\n'
    main_tex += '\\end{document}\n'

    with open(os.path.join(LATEX_DIR, 'main.tex'), 'w', encoding='utf-8') as f:
        f.write(main_tex)

    print("Done! Generated files in 'latex/' directory.")


if __name__ == '__main__':
    main()

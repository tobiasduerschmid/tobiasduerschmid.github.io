import yaml
import os
import re

# Configuration
NAV_FILE = '_data/sebook_nav.yml'
MD_ROOT = 'SEBook'
LATEX_DIR = 'latex'
BIB_FILE = '_bibliography/references.bib'

# Create latex directory if it doesn't exist
if not os.path.exists(LATEX_DIR):
    os.makedirs(LATEX_DIR)

def escape_latex(text):
    if not text:
        return ""
    special_chars = {
        '&': r'\&',
        '%': r'\%',
        '$': r'\$',
        '#': r'\#',
        '_': r'\_',
        '{': r'\{',
        '}': r'\}',
        '~': r'\textasciitilde{}',
        '^': r'\textasciicircum{}',
        '\\': r'\textbackslash{}',
    }
    # Escape backslash first
    res = text.replace('\\', 'LXPBACKSLASHX')
    for char, escape in special_chars.items():
        if char != '\\':
            res = res.replace(char, escape)
    res = res.replace('LXPBACKSLASHX', special_chars['\\'])
    return res

def unescape_latex(text):
    if not text:
        return ""
    # Simple unescape for common label/cite chars
    res = text.replace(r'\_', '_').replace(r'\&', '&').replace(r'\%', '%').replace(r'\$', '$').replace(r'\#', '#').replace(r'\{', '{').replace(r'\}', '}').replace(r'\textbackslash{}', '\\')
    return res

def md_to_latex(md_content, base_url):
    # Extract Front Matter
    front_matter = {}
    if md_content.startswith('---'):
        parts = md_content.split('---', 2)
        if len(parts) >= 3:
            try:
                front_matter = yaml.safe_load(parts[1])
            except:
                pass
            md_content = parts[2]
    
    title = front_matter.get('title', 'Unknown Title')
    
    # Pre-processing: Remove unwanted Liquid tags
    md_content = re.sub(r'\{%\s*include\s+quiz\.html\s+id=".*"\s*%\}', '', md_content)
    # Citations - keep them for now, but protect them
    md_content = re.sub(r'\{%\s*cite\s+([\w\d\-_]+)\s*%\}', r'LXCMDCITE{\1}', md_content)
    
    # 1. Protect code blocks
    code_blocks = []
    def store_code(match):
        lang = match.group(1) or 'text'
        code = match.group(2)
        placeholder = f"LXPBLOCKCODE{len(code_blocks)}X"
        code_blocks.append((lang, code))
        return placeholder
    
    md_content = re.sub(r'```(\w+)?\n(.*?)\n```', store_code, md_content, flags=re.DOTALL)
    
    # 2. Extract transformations into placeholders
    
    # Headers
    md_content = re.sub(r'^#\s+(.+)$', r'LXCMDSECTION{\1}', md_content, flags=re.MULTILINE)
    md_content = re.sub(r'^##\s+(.+)$', r'LXCMDSUBSECTION{\1}', md_content, flags=re.MULTILINE)
    md_content = re.sub(r'^###\s+(.+)$', r'LXCMDSUBSUBSECTION{\1}', md_content, flags=re.MULTILINE)
    
    # List markers (at start of line)
    md_content = re.sub(r'^\s*\*\s+', r'LXCMDITEM ', md_content, flags=re.MULTILINE)
    
    # Formatting
    md_content = re.sub(r'==(.+?)==', r'LXCMDHL{\1}', md_content)
    md_content = re.sub(r'\*\*(.+?)\*\*', r'LXCMDTEXTBOLD{\1}', md_content)
    # Italics: handle both _ and *
    md_content = re.sub(r'(?<=[\s\(\[\{])_([^_]+?)_(?=[\s\)\.\,\!\?\]\}])', r'LXCMDTEXTITALIC{\1}', md_content)
    md_content = re.sub(r'(?<=[\s\(\[\{])\*([^\*]+?)\*(?=[\s\)\.\,\!\?\]\}])', r'LXCMDTEXTITALIC{\1}', md_content)

    # Links
    def replace_links(match):
        text = match.group(1)
        url = match.group(2)
        if url.startswith('/SEBook/'):
            label = url.replace('/SEBook/', '').replace('.html', '').replace('/', '_').strip('_')
            if not label: label = "root"
            return f'{text} (see p. LXCMDPAGEREF{{{label}}})'
        return f'LXCMDHREF{{{url}}}{{{text}}}'

    md_content = re.sub(r'\[(.+?)\]\((.+?)\)', replace_links, md_content)

    # Escape other Liquid tags
    md_content = re.sub(r'\{%.*?%\}', '', md_content)
    md_content = re.sub(r'\{\{.*?\}\}', '', md_content)

    # 3. Final Escape and Restoration
    md_content = escape_latex(md_content)
    
    # Custom restoration to handle nested commands and unescaping labeled commands
    def restore(text):
        def sub_cmd(match):
            cmd = match.group(1).lower()
            inner = match.group(2)
            if cmd in ['cite', 'pageref', 'label']:
                inner = unescape_latex(inner)
            if cmd == 'href':
                # href has two arguments in our placeholder: LXCMDHREF\{url\}\{text\}
                # Wait, our current href placeholder is LXCMDHREF\{url\}\{text\}
                # But it became LXCMDHREF\\\{url\\\}\\\{text\\\} after escaping.
                # Actually re.sub only sees the first {}.
                pass
            
            # Standard command restoration
            cmd_map = {
                'section': 'section',
                'subsection': 'subsection',
                'subsubsection': 'subsubsection',
                'hl': 'hl',
                'cite': 'cite',
                'textbold': 'textbf',
                'textitalic': 'textit',
                'pageref': 'pageref',
            }
            real_cmd = cmd_map.get(cmd, cmd)
            return f'\\{real_cmd}{{{inner}}}'

        # Special case for href
        text = re.sub(r'LXCMDHREF\\\{(.*?)\\\}\\\{(.*?)\\\}', lambda m: f'\\href{{{unescape_latex(m.group(1))}}}{{{m.group(2)}}}', text, flags=re.DOTALL)
        
        # Other commands
        for _ in range(5):
            text = re.sub(r'LXCMD(\w+)\\\{(.*?)\\\}', sub_cmd, text, flags=re.DOTALL)
        return text

    md_content = restore(md_content)
    md_content = md_content.replace('LXCMDITEM ', '\\item ')

    # Handle itemize environment
    def wrap_itemize(match):
        items = match.group(0)
        return f"\\begin{{itemize}}\n{items}\\end{{itemize}}"
    
    md_content = re.sub(r'(\\item .*?(\n|$))+', wrap_itemize, md_content, flags=re.MULTILINE)

    # Restore Code blocks
    for i, (lang, code) in enumerate(code_blocks):
        lst = f"\\begin{{lstlisting}}[language={lang}]\n{code}\n\\end{{lstlisting}}"
        md_content = md_content.replace(f"LXPBLOCKCODE{i}X", lst)

    # Add label at the beginning
    label = base_url.replace('/SEBook/', '').replace('.html', '').replace('/', '_').strip('_')
    if not label: label = "root"
    output = f'\\section{{{escape_latex(title)}}}\\label{{{label}}}\n' + md_content
    
    return output

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

def main():
    with open(NAV_FILE, 'r') as f:
        nav = yaml.safe_load(f)
    urls = parse_nav(nav)
    translated_files = []
    for url in urls:
        md_rel_path = url.replace('/SEBook/', '').replace('.html', '.md')
        md_abs_path = os.path.join(MD_ROOT, md_rel_path)
        if os.path.exists(md_abs_path):
            print(f"Translating {md_abs_path}...")
            with open(md_abs_path, 'r', encoding='utf-8') as f:
                content = f.read()
            tex_content = md_to_latex(content, url)
            tex_filename = md_rel_path.replace('.md', '.tex').replace('/', '_')
            tex_abs_path = os.path.join(LATEX_DIR, tex_filename)
            with open(tex_abs_path, 'w', encoding='utf-8') as f:
                f.write(tex_content)
            translated_files.append(tex_filename)
        else:
            print(f"Warning: {md_abs_path} not found.")

    main_tex = f"""\\documentclass{{article}}
\\usepackage[utf8]{{inputenc}}
\\usepackage{{soul}}
\\usepackage{{hyperref}}
\\usepackage{{listings}}
\\usepackage{{biblatex}}
\\addbibresource{{{BIB_FILE}}}
\\title{{SEBook}}
\\author{{Tobias Duerschmid}}
\\begin{{document}}
\\maketitle
\\tableofcontents

"""
    for tf in translated_files:
        main_tex += f"\\include{{{tf.replace('.tex', '')}}}\n"
    main_tex += "\\printbibliography\n"
    main_tex += "\\end{document}"
    with open(os.path.join(LATEX_DIR, 'main.tex'), 'w', encoding='utf-8') as f:
        f.write(main_tex)
    print("Done! Generated files in 'latex/' directory.")

if __name__ == '__main__':
    main()

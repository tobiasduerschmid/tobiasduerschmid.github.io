#!/usr/bin/env python3
"""Validate the pedagogical-advisor package without external dependencies."""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path

REQUIRED = [
    'SKILL.md','README.md','VERSION','CHANGELOG.md','PACKAGE_INDEX.json','CHECKSUMS.sha256',
    'config/evidence-levels.yaml','config/defaults.yaml','config/output-contracts.yaml','config/router.yaml',
    'knowledge/00_knowledge-map.md','knowledge/02_evidence-reasoning.md','knowledge/19_genai-in-teaching-and-assessment.md',
    'procedures/00_operating-model.md','procedures/15_quality-gates.md',
    'tools/design-canvas.md','templates/course-blueprint.md','rubrics/course-design-rubric.md',
    'references/evidence-matrix.csv','references/bibliography.md',
    'schemas/course_design.schema.json','scripts/audit_alignment.py','evals/test_prompts.jsonl'
]
LINK_RE = re.compile(r'(?<!!)\[[^\]]+\]\(([^)]+)\)')
CODE_LINK_RE = re.compile(r'`((?:knowledge|procedures|tools|templates|rubrics|references|config|schemas|scripts|examples|evals)/[^`]+)`')


def basic_yaml_check(path: Path) -> list[str]:
    errors=[]
    text=path.read_text(encoding='utf-8')
    if '\t' in text:
        errors.append(f'{path}: YAML contains tab characters')
    for i,line in enumerate(text.splitlines(),1):
        if line.strip() and not line.lstrip().startswith(('#','-')) and ':' not in line and not line.startswith(' '):
            errors.append(f'{path}:{i}: suspicious top-level YAML line: {line!r}')
    return errors


def main() -> int:
    ap=argparse.ArgumentParser()
    ap.add_argument('--root',default=str(Path(__file__).resolve().parents[1]))
    ap.add_argument('--strict-links',action='store_true')
    args=ap.parse_args()
    root=Path(args.root).resolve()
    errors=[]; warnings=[]

    for rel in REQUIRED:
        p=root/rel
        if not p.is_file(): errors.append(f'missing required file: {rel}')
        elif p.stat().st_size < (1 if rel == 'VERSION' else 8): errors.append(f'file is empty or trivial: {rel}')

    skill=root/'SKILL.md'
    if skill.exists():
        text=skill.read_text(encoding='utf-8')
        if not text.startswith('---\n') or '\n---\n' not in text[4:]: errors.append('SKILL.md lacks YAML frontmatter')
        if 'name: pedagogical-advisor' not in text: errors.append('SKILL.md frontmatter name mismatch')

    for p in root.rglob('*.json'):
        try: json.loads(p.read_text(encoding='utf-8'))
        except Exception as e: errors.append(f'invalid JSON {p.relative_to(root)}: {e}')

    for p in root.rglob('*.jsonl'):
        for i,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
            if not line.strip(): continue
            try: json.loads(line)
            except Exception as e: errors.append(f'invalid JSONL {p.relative_to(root)}:{i}: {e}')

    for p in root.rglob('*.yaml'):
        errors.extend(basic_yaml_check(p))

    # Check local links and code-path references.
    for p in root.rglob('*.md'):
        text=p.read_text(encoding='utf-8')
        refs=[]
        for m in LINK_RE.finditer(text): refs.append(m.group(1).split('#',1)[0])
        for m in CODE_LINK_RE.finditer(text): refs.append(m.group(1))
        for ref in refs:
            ref=ref.strip()
            if not ref or ref.startswith(('http://','https://','mailto:','#')): continue
            candidate=(root/ref) if not ref.startswith('.') else (p.parent/ref).resolve()
            if not candidate.exists():
                msg=f'{p.relative_to(root)} references missing path {ref}'
                (errors if args.strict_links else warnings).append(msg)

    checksums=root/'CHECKSUMS.sha256'
    if checksums.exists():
        import hashlib
        for i,line in enumerate(checksums.read_text(encoding='utf-8').splitlines(),1):
            if not line.strip(): continue
            try:
                digest, rel = line.split('  ',1)
                target=root/rel
                if not target.is_file(): errors.append(f'checksum target missing: {rel}')
                elif hashlib.sha256(target.read_bytes()).hexdigest()!=digest: errors.append(f'checksum mismatch: {rel}')
            except ValueError:
                errors.append(f'invalid checksum line {i}')

    manifest=root/'manifest.txt'
    if manifest.exists():
        listed={line.strip() for line in manifest.read_text(encoding='utf-8').splitlines() if line.strip()}
        actual={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file() and p.name!='manifest.txt'}
        missing=actual-listed; stale=listed-actual
        if missing: errors.append('manifest missing: '+', '.join(sorted(missing)))
        if stale: errors.append('manifest stale: '+', '.join(sorted(stale)))
    else: warnings.append('manifest.txt not yet generated')

    for w in warnings: print('WARNING:',w)
    if errors:
        for e in errors: print('ERROR:',e)
        print(f'FAILED with {len(errors)} error(s) and {len(warnings)} warning(s).')
        return 1
    count=sum(1 for p in root.rglob('*') if p.is_file())
    print(f'PASS: {count} files checked; {len(warnings)} warning(s).')
    return 0

if __name__=='__main__':
    raise SystemExit(main())

#!/usr/bin/env python3
"""Create a working design folder from the package templates."""
from __future__ import annotations
import argparse, shutil
from pathlib import Path

MAP={
 'course':['course-design-brief.md','course-blueprint.md','module-map.md','syllabus-audit.md','genai-use-matrix.md','course-evaluation-plan.md','design-decision-log.md'],
 'lecture':['lecture-plan-50-min.md','lecture-plan-75-min.md','lecture-plan-180-min.md','active-learning-activity.md','design-decision-log.md'],
 'assessment':['assessment-blueprint.md','assignment-brief.md','rubric-analytic.md','feedback-plan.md','genai-use-matrix.md','design-decision-log.md'],
 'exam':['exam-blueprint.md','exam-item-bank.md','feedback-plan.md','design-decision-log.md'],
 'homework':['homework-set.md','feedback-plan.md','genai-use-matrix.md','design-decision-log.md'],
 'rubric':['rubric-analytic.md','rubric-holistic.md','design-decision-log.md'],
 'full':[]
}

def main()->int:
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('mode',choices=MAP)
 ap.add_argument('output',type=Path)
 ap.add_argument('--force',action='store_true')
 args=ap.parse_args()
 root=Path(__file__).resolve().parents[1]
 dest=args.output.resolve()
 if dest.exists() and any(dest.iterdir()) and not args.force:
  ap.error(f'{dest} is not empty; use --force to add/overwrite template files')
 dest.mkdir(parents=True,exist_ok=True)
 names=MAP[args.mode] or [p.name for p in (root/'templates').glob('*.md')]
 for name in names:
  src=root/'templates'/name
  if not src.exists(): raise FileNotFoundError(src)
  shutil.copy2(src,dest/name)
 readme=dest/'WORKSPACE.md'
 readme.write_text(
  f'# {args.mode.title()} Design Workspace\n\n'
  'Start with the design brief or blueprint. Preserve the original template and record consequential choices in `design-decision-log.md`.\n\n'
  f'Created from pedagogical-advisor package version {(root/"VERSION").read_text().strip()}.\n',encoding='utf-8')
 print(f'Created {len(names)+1} files in {dest}')
 return 0
if __name__=='__main__': raise SystemExit(main())

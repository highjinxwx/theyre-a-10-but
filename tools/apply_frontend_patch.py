#!/usr/bin/env python3
"""Convert the repository's current index.html to Netlify Database.

Run from the repository root: python tools/apply_frontend_patch.py
Moves root/index.html -> public/index.html, preserving game code and design.

Expected source: highjinxwx/theyre-a-10-but, game version 3 (Nov 2026).
The script stops rather than making partial edits when markers have changed.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'index.html'
DEST = ROOT / 'public' / 'index.html'
TOOLS = ROOT / 'tools'


def die(message):
    raise SystemExit(f'Not changed: {message}')


def replace_between(contents, begin, end, replacement, label):
    a = contents.find(begin)
    if a < 0:
        die(f'could not find {label} start marker ({begin!r})')
    b = contents.find(end, a)
    if b < 0:
        die(f'could not find {label} end marker ({end!r})')
    return contents[:a] + replacement.rstrip() + '\n' + contents[b:]


def patch(contents):
    if "/* ---------- shared results (Netlify Database via Netlify Function)" in contents:
        die('Netlify Database frontend patch already exists')
    if not re.search(r'const V\s*=\s*3\s*;', contents):
        die('game version is no longer 3; check GAME_VERSION before patching')
    if 'claude.use("db")' not in contents and "claude.use('db')" not in contents:
        die('original Claude database block is missing; patch may need updating')

    new_crowd = (TOOLS / 'frontend_crowd.js.txt').read_text(encoding='utf-8')
    contents = replace_between(
        contents,
        '/* ---------- shared results (db) ----------',
        '/* ---------- test mode: a made-up crowd ----------',
        new_crowd,
        'database connection',
    )
    new_math = (TOOLS / 'frontend_math.js.txt').read_text(encoding='utf-8')
    contents = replace_between(
        contents,
        'function statsFor(ci, myRank, plays)',
        'function verdictText(y)',
        new_math,
        'crowd scoring',
    )

    old_line = 'const plays=crowd.plays||[], players=plays.length;'
    if contents.count(old_line) != 1:
        die('expected resultsHTML player-count line exactly once')
    contents = contents.replace(
        old_line,
        'const plays=crowd.plays||[], players=Array.isArray(plays)?plays.length:(plays.players||0);',
    )
    if 'claude.use(' in contents:
        die('another Claude-specific integration remains; inspect before deployment')
    return contents


def main():
    if DEST.exists():
        if SRC.exists():
            die('both root/index.html and public/index.html exist; decide which to keep')
        die('public/index.html already exists; patch manually or restore source first')
    if not SRC.is_file():
        die('expected index.html at repository root; place this kit in the repo first')
    original = SRC.read_text(encoding='utf-8')
    updated = patch(original)
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(updated, encoding='utf-8')
    SRC.unlink()
    print('OK: moved and patched index.html -> public/index.html')
    print('Next: git diff; commit package.json, netlify.toml, netlify/, public/')


if __name__ == '__main__':
    main()

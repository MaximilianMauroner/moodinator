#!/usr/bin/env python3
"""Preserve caller arguments except job counts, then run the owned Ninja."""
import os
import sys
from pathlib import Path

real = str(Path(__file__).resolve().with_name('ninja.original'))
args = []
i = 1
while i < len(sys.argv):
    arg = sys.argv[i]
    if arg in ('-j', '--jobs'):
        i += 2
        continue
    if (arg.startswith('-j') and len(arg) > 2) or arg.startswith('--jobs='):
        i += 1
        continue
    args.append(arg)
    i += 1
os.execv(real, [real, '-j1', *args])

#!/usr/bin/env python3
"""Preserve caller arguments except job counts, then run the owned Ninja."""
import hashlib
import json
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
exec_argv = [real, '-j1', *args]
# Bind the real exec request to the lifetime subsequently observed by the guard.
fields = Path('/proc/self/stat').read_text().rsplit(')', 1)[1].split()
launcher = Path(__file__).resolve()
def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()
record = {'pid': os.getpid(), 'start': fields[19], 'session': os.getsid(0),
          'exe': real, 'argv': exec_argv, 'launcher': str(launcher),
          'launcher_sha256': digest(launcher), 'ninja_sha256': digest(real)}
directory = Path(os.environ['PREFILL_NINJA_TRACE']).with_suffix('.exec')
directory.mkdir(mode=0o700, exist_ok=True)
if directory.is_symlink():
    raise ValueError('Ninja exec receipt directory symlink refused')
target = directory / (str(record['pid']) + '-' + record['start'] + '.json')
if target.exists() or target.is_symlink():
    raise ValueError('Duplicate Ninja exec identity refused')
temporary = target.with_suffix('.tmp')
with temporary.open('x') as output:
    output.write(json.dumps(record) + '\n')
    output.flush()
    os.fsync(output.fileno())
os.replace(temporary, target)
descriptor = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
try:
    os.fsync(descriptor)
finally:
    os.close(descriptor)
os.execv(real, exec_argv)

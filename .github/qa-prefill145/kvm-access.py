#!/usr/bin/env python3
"""Own-user KVM ACL access on the disposable GitHub runner, with exact restore."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import time

DEVICE = Path('/dev/kvm')
ROOT = Path(os.environ['RUNNER_TEMP']) / 'moodinator145-qa/native'
STATE = ROOT / 'kvm-access-context.json'
RESTORED = ROOT / 'kvm-restoration.json'
SOURCE = json.loads((Path(__file__).parent / 'expected-inputs.json').read_text())['source']


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    with temporary.open('w') as output:
        output.write(json.dumps(value, indent=2) + '\n')
        output.flush()
        os.fsync(output.fileno())
    os.replace(temporary, path)
    descriptor = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def scope():
    if (os.environ.get('GITHUB_ACTIONS') != 'true'
            or os.environ.get('RUNNER_ENVIRONMENT') != 'github-hosted'
            or os.environ.get('RUNNER_OS') != 'Linux'
            or os.environ.get('GITHUB_REPOSITORY') != 'MaximilianMauroner/moodinator'):
        raise RuntimeError('KVM access setup is restricted to this disposable GitHub-hosted Linux job')


def device():
    if DEVICE.is_symlink():
        raise RuntimeError('KVM device symlink refused')
    info = DEVICE.stat()
    if not stat.S_ISCHR(info.st_mode) or (os.major(info.st_rdev), os.minor(info.st_rdev)) != (10, 232):
        raise RuntimeError('Expected existing Linux KVM character device 10:232')
    return {key: getattr(info, key) for key in ['st_dev', 'st_ino', 'st_rdev', 'st_uid', 'st_gid', 'st_mode']}


def same_device(before):
    after = device()
    if any(after[key] != before[key] for key in ['st_dev', 'st_ino', 'st_rdev', 'st_uid', 'st_gid']):
        raise RuntimeError('KVM device identity changed; no mutation performed')
    return after


def sha(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def command(state, argv, data=None):
    begin = time.monotonic()
    result = subprocess.run(argv, input=data, text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=10, check=False)
    state.setdefault('commands', []).append({'argv': argv, 'stdin_sha256': hashlib.sha256(data.encode()).hexdigest() if data else None,
        'exit_code': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr,
        'elapsed_seconds': time.monotonic() - begin})
    write(STATE, state)
    if result.returncode:
        raise RuntimeError('KVM prerequisite command failed: ' + repr(argv))
    return result.stdout


def simple_acl(text):
    """Only add a user to the default ACL shape; masked entries need host review."""
    entries = [line.split('#', 1)[0].strip() for line in text.splitlines()]
    entries = [entry.split(':') for entry in entries if entry]
    if (len(entries) != 3 or {tuple(entry[:2]) for entry in entries} != {('user', ''), ('group', ''), ('other', '')}
            or any(len(entry) != 3 or len(entry[2]) != 3
                   or any(value not in (allowed, '-') for value, allowed in zip(entry[2], 'rwx')) for entry in entries)):
        raise RuntimeError('Existing extended/masked ACL requires host review; no access was changed')


def prepare():
    scope()
    state = {'source': SOURCE, 'status': 'PREPARING', 'uid': os.getuid(), 'groups': os.getgroups(),
             'modified': False, 'restore_required': False, 'commands': [], 'tools': {}}
    write(STATE, state)
    try:
        state['before'] = device()
        state['access_before'] = os.access(DEVICE, os.R_OK | os.W_OK)
        names = ['getfacl'] if state['access_before'] else ['getfacl', 'sudo', 'setfacl']
        for name in names:
            found = shutil.which(name)
            if not found:
                raise RuntimeError('Required runner ACL tool missing: ' + name)
            state['tools'][name] = {'path': str(Path(found).resolve()), 'sha256': sha(found)}
        tools = state['tools']
        state['acl_before'] = command(state, [tools['getfacl']['path'], '-p', '-n', str(DEVICE)])
        if not state['access_before']:
            simple_acl(state['acl_before'])  # No mask expansion for other principals.
            same_device(state['before'])
            state.update(modified=True, restore_required=True)
            write(STATE, state)
            command(state, [tools['sudo']['path'], '-n', tools['setfacl']['path'], '-m', 'u:' + str(state['uid']) + ':rw', str(DEVICE)])
            same_device(state['before'])
            if not os.access(DEVICE, os.R_OK | os.W_OK):
                raise RuntimeError('Own-user ACL did not establish required KVM access')
            state['acl_after_grant'] = command(state, [tools['getfacl']['path'], '-p', '-n', str(DEVICE)])
        state.update(status='PASS', after=device(), access_after=True)
        write(STATE, state)
        return state
    except BaseException as error:
        state.update(status='BLOCKED', error=repr(error))
        write(STATE, state)
        raise


def restore():
    scope()
    report = {'source': SOURCE, 'status': 'PASS', 'restored': False, 'modified': False,
              'device_verified': False, 'acl_verified': False}
    try:
        if STATE.is_symlink() or (STATE.exists() and not STATE.is_file()):
            raise RuntimeError('KVM state must be a regular owned file')
        if STATE.is_file():
            state = json.loads(STATE.read_text())
            if state['source'] != SOURCE or state['uid'] != os.getuid():
                raise RuntimeError('KVM restoration owner/source mismatch')
            report['modified'] = state['modified']
            if state.get('before'):
                same_device(state['before'])
                for tool in state['tools'].values():
                    if sha(tool['path']) != tool['sha256']:
                        raise RuntimeError('KVM restoration tool changed')
                if state['modified']:
                    if state.get('restore_required'):
                        tools = state['tools']
                        # The explicit target is authoritative; ACL comments cannot select files.
                        command(state, [tools['sudo']['path'], '-n', tools['setfacl']['path'], '--set-file=-', str(DEVICE)], state['acl_before'])
                    elif not state.get('restored'):
                        raise RuntimeError('Modified KVM access has no restoration state')
                after = same_device(state['before'])
                if after['st_mode'] != state['before']['st_mode']:
                    raise RuntimeError('Original KVM mode not restored exactly')
                if os.access(DEVICE, os.R_OK | os.W_OK) != state['access_before']:
                    raise RuntimeError('Original KVM access not restored')
                if 'acl_before' in state:
                    acl = command(state, [state['tools']['getfacl']['path'], '-p', '-n', str(DEVICE)])
                    if acl != state['acl_before']:
                        raise RuntimeError('Original KVM ACL not restored exactly')
                    report['acl_verified'] = True
                report['device_verified'] = True
                if state['modified']:
                    state.update(restore_required=False, restored=True)
                    report['restored'] = True
                    write(STATE, state)
            elif state['modified'] or state.get('restore_required') or state.get('status') == 'PASS':
                raise RuntimeError('Successful or modified KVM context lacks original device identity')
        write(RESTORED, report)
        return report
    except BaseException as error:
        report.update(status='FAIL', error=repr(error))
        write(RESTORED, report)
        raise


if __name__ == '__main__':
    if sys.argv[1:] not in (['prepare'], ['restore']):
        raise SystemExit('Expected prepare or restore')
    try:
        result = prepare() if sys.argv[1] == 'prepare' else restore()
    except BaseException:
        path = STATE if sys.argv[1] == 'prepare' else RESTORED
        if path.is_file():
            print(path.read_text(), flush=True)
        raise
    print(json.dumps(result), flush=True)

#!/usr/bin/env python3
"""Lossless bounded receipt/log transport, without artifact or cache uploads."""
import base64
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import signal
import tarfile
import time


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def acceptance_evidence(directory):
    if directory.is_symlink():
        raise ValueError('Evidence directory symlink refused')
    files = [directory / 'result.json']
    for name in ('adb-server.log', 'emulator.log', 'owned-avd-config.ini', 'package.txt'):
        path = directory / name
        if path.is_file():
            files.append(path)
    for name in ('commands', 'ui', 'db'):
        root = directory / name
        if root.is_symlink():
            raise ValueError('Evidence subtree symlink refused')
        if root.is_dir():
            files.extend(sorted(path for path in root.rglob('*') if path.is_file()))
    # Runtime home/AVD state and console credentials are outside this allowlist.
    return files


def main():
    control = Path(__file__).resolve().parent
    root = Path(os.environ['RUNNER_TEMP']) / 'moodinator145-qa'
    guard = load_module('guard', control / 'run-native.py')
    validator = load_module('validator', control / 'validate-evidence.py')
    guard.ROOT = root / 'native'
    for signum in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(signum, guard.request_interruption)
    expected = json.loads((control / 'expected-inputs.json').read_text())
    result, snapshots = validator.validate_result(root, expected, guard.process_table())
    admission = guard.preflight('log-evidence')
    if admission['status'] != 'PASS':
        raise RuntimeError('Evidence transport admission refused')
    baseline = guard.resources()
    pressure_since = None
    last_checked = 0

    def check():
        nonlocal pressure_since, last_checked
        now = time.monotonic()
        if guard.INTERRUPTED_SIGNAL is not None:
            raise InterruptedError('Evidence transport interrupted')
        if now - last_checked < .1:
            return
        last_checked = now
        sample = guard.resources(baseline)
        if sample['pressure']['full']['avg10'] > 5:
            pressure_since = pressure_since or now
        else:
            pressure_since = None
        if (sample['available_mib'] < 1500 or sample['free_disk_gib'] < 5
                or (pressure_since is not None and now - pressure_since >= 10)):
            raise RuntimeError('Evidence transport resource stop')

    files = [root / 'result.json']
    for path in sorted((root / 'native').iterdir()):
        if path.suffix in ('.json', '.jsonl', '.log', '.trace'):
            files.append(path)
    exec_directory = root / 'native/ninja.exec'
    if exec_directory.is_symlink():
        raise ValueError('Exec receipt directory symlink refused')
    if exec_directory.is_dir():
        files.extend(sorted(exec_directory.glob('*.json')))
    if (root / 'acceptance').is_dir():
        files.extend(acceptance_evidence(root / 'acceptance'))
    target = root / 'log-evidence.tar.gz'
    inventory = {}

    class MonitoredReader:
        def __init__(self, stream):
            self.stream = stream
            self.digest = hashlib.sha256()

        def read(self, size):
            check()
            data = self.stream.read(size)
            self.digest.update(data)
            return data

    with target.open('wb') as output:
        with tarfile.open(fileobj=output, mode='w:gz', compresslevel=1) as archive:
            for path in files:
                check()
                if path.is_symlink() or not path.is_file():
                    raise ValueError('Evidence symlink or invalid file refused')
                name = str(path.relative_to(root))
                before = path.stat()
                info = tarfile.TarInfo(name)
                info.size = before.st_size
                with path.open('rb') as stream:
                    reader = MonitoredReader(stream)
                    archive.addfile(info, reader)
                digest = reader.digest.hexdigest()
                if name in snapshots and digest != snapshots[name]:
                    raise ValueError('Evidence differs from validated snapshot: ' + name)
                after = path.stat()
                if (before.st_size, before.st_mtime_ns, before.st_ino) != (after.st_size, after.st_mtime_ns, after.st_ino):
                    raise ValueError('Evidence changed while packaging: ' + name)
                inventory[name] = {'bytes': before.st_size, 'sha256': digest}
                if output.tell() > 24 * 1024 * 1024:
                    raise ValueError('Evidence log payload exceeds 24 MiB')
            data = (json.dumps(inventory, sort_keys=True) + '\n').encode()
            info = tarfile.TarInfo('evidence-files.json')
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
        output.flush()
        os.fsync(output.fileno())
    check()
    # No APK, source archive, dependency tree or cache is transported.
    if target.stat().st_size > 24 * 1024 * 1024:
        raise ValueError('Evidence log payload exceeds 24 MiB')
    payload = target.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    print('PREFILL145_RESULT ' + json.dumps({
        'status': result['status'], 'source': expected['source'], 'tree': expected['tree'],
        'stages': [{'stage': stage['stage'], 'status': stage['status']} for stage in result['stages']],
        'APK_sha256': result.get('APK_sha256'),
        'product_status': result.get('product_acceptance', {}).get('status'),
        'log_evidence_bytes': len(payload), 'log_evidence_sha256': digest,
    }), flush=True)
    print('PREFILL145_LOG_BEGIN ' + digest, flush=True)
    for offset in range(0, len(payload), 3072):
        check()
        print('PREFILL145_LOG ' + base64.b64encode(payload[offset:offset + 3072]).decode(), flush=True)
    print('PREFILL145_LOG_END ' + digest, flush=True)


if __name__ == '__main__':
    main()

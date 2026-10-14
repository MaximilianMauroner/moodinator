#!/usr/bin/env python3
"""One finite owned native stage; no global controls or foreign process actions."""
import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parent
BASE = ROOT.parent
PREVIOUS = BASE
SOURCE = Path(os.environ['MOODINATOR_SOURCE_ROOT'])
CONTROL_KEYS = {
    'NODE_OPTIONS', 'NODE_ENV', 'BABEL_ENV', 'NODE_LAUNCHER_TRACE', 'JAVA_HOME', 'JAVA_TOOL_OPTIONS',
    'GRADLE_OPTS', 'GRADLE_USER_HOME', 'ANDROID_HOME', 'ANDROID_SDK_ROOT',
    'ANDROID_USER_HOME', 'PREFILL_NINJA_TRACE', 'MOODINATOR_VARIANT', 'MOODINATOR_QA_PREPARE_NATIVE',
}


INTERRUPTED_SIGNAL = None


def request_interruption(signum, frame):
    # Defer interruption until the owned monitor reaches cleanup. Repeated
    # signals must not interrupt cleanup or the durable final receipt.
    global INTERRUPTED_SIGNAL
    if INTERRUPTED_SIGNAL is None:
        INTERRUPTED_SIGNAL = signum


def write_receipt(path, record):
    temporary = path.with_suffix(path.suffix + '.tmp')
    with temporary.open('w') as output:
        output.write(json.dumps(record, indent=2) + '\n')
        output.flush()
        os.fsync(output.fileno())
    os.replace(temporary, path)
    descriptor = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def resources(baseline=None):
    memory = dict(line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines())
    pressure = {}
    for line in Path('/proc/pressure/memory').read_text().splitlines():
        fields = line.split()
        pressure[fields[0]] = {key: float(value) for key, value in (item.split('=') for item in fields[1:])}
    vmstat = dict(line.split() for line in Path('/proc/vmstat').read_text().splitlines())
    counters = {key: int(vmstat[key]) for key in ['pswpin', 'pswpout', 'pgmajfault']}
    result = {
        'wall_time': time.time(), 'monotonic': time.monotonic(),
        'available_mib': int(memory['MemAvailable'].split()[0]) / 1024,
        'free_disk_gib': shutil.disk_usage(ROOT).free / 1024**3,
        'pressure': pressure, 'vmstat': counters,
    }
    if baseline is not None:
        result['vmstat_delta'] = {key: value - baseline['vmstat'][key] for key, value in counters.items()}
        result['psi_total_delta_us'] = {key: value['total'] - baseline['pressure'][key]['total'] for key, value in pressure.items()}
    return result


def process_table():
    result = {}
    for path in Path('/proc').iterdir():
        if not path.name.isdigit():
            continue
        try:
            fields = (path / 'stat').read_text().rsplit(')', 1)[1].split()
            result[int(path.name)] = {'state': fields[0], 'ppid': int(fields[1]), 'session': int(fields[3]), 'start': fields[19], 'majfault': int(fields[9]), 'threads': int(fields[17])}
        except (OSError, IndexError, ValueError):
            continue
    return result


def owned_processes(leader, known, first_faults):
    table = process_table()
    owned = {pid for pid, start in known.items() if pid in table and table[pid]['start'] == start}
    if leader in table:
        if leader not in known or known[leader] == table[leader]['start']:
            owned.add(leader)
    while True:
        added = {pid for pid, item in table.items() if item['ppid'] in owned or (item['session'] == leader and leader in known)}
        if added <= owned:
            break
        owned |= added
    result = []
    for pid in sorted(owned):
        item = table.get(pid)
        if item is None or item['state'] == 'Z':
            continue
        known[pid] = item['start']
        key = f"{pid}:{item['start']}"
        first_faults.setdefault(key, item['majfault'])
        try:
            path = Path(f'/proc/{pid}')
            status = dict(line.split(':', 1) for line in (path / 'status').read_text().splitlines())
            argv = [arg.decode(errors='replace') for arg in (path / 'cmdline').read_bytes().split(b'\0') if arg]
            controls = {}
            for field in (path / 'environ').read_bytes().split(b'\0'):
                name, separator, value = field.partition(b'=')
                if separator and name.decode(errors='replace') in CONTROL_KEYS:
                    controls[name.decode()] = value.decode(errors='replace')
            result.append({
                'pid': pid, **item, 'exe': os.readlink(path / 'exe'), 'cwd': os.readlink(path / 'cwd'), 'argv': argv,
                'rss_kib': int(status.get('VmRSS', '0 kB').split()[0]),
                'swap_kib': int(status.get('VmSwap', '0 kB').split()[0]),
                'threads': int(status.get('Threads', str(item['threads'])).split()[0]),
                'cpus_allowed_list': status.get('Cpus_allowed_list', '').strip(),
                'majfault_delta_observed': item['majfault'] - first_faults[key],
                'controls': controls,
            })
        except (OSError, ValueError):
            continue
    return result


def signal_identity(pid, start, requested_signal):
    table = process_table()
    if pid in table and table[pid]['start'] == start and table[pid]['state'] != 'Z':
        try:
            os.kill(pid, requested_signal)
        except ProcessLookupError:
            pass


def cleanup(process, known, first_faults):
    actions = []
    deadline = time.monotonic() + 10
    while True:
        process.poll()  # Reap our completed leader instead of keeping a zombie.
        alive = owned_processes(process.pid, known, first_faults)
        if not alive:
            break
        requested_signal = signal.SIGTERM if time.monotonic() < deadline else signal.SIGKILL
        for item in reversed(alive):
            signal_identity(item['pid'], item['start'], requested_signal)
            actions.append({'pid': item['pid'], 'start': item['start'], 'signal': requested_signal.name})
        if requested_signal == signal.SIGKILL:
            time.sleep(1)
            break
        time.sleep(0.5)
    if process.poll() is None:
        process.wait(timeout=10)
    return actions, owned_processes(process.pid, known, first_faults)


def preflight(stage):
    samples = []
    baseline = resources()
    begin = time.monotonic()
    with (ROOT / f'{stage}.preflight.jsonl').open('w') as output:
        while True:
            sample = resources(baseline)
            samples.append(sample)
            output.write(json.dumps(sample) + '\n')
            output.flush()
            if INTERRUPTED_SIGNAL is not None:
                return {'status': 'INTERRUPTED', 'samples': len(samples), 'elapsed_seconds': time.monotonic() - begin, 'first': baseline, 'last': sample}
            if sample['available_mib'] < 3600 or sample['free_disk_gib'] < 5 or sample['pressure']['full']['avg10'] > 1:
                return {'status': 'BLOCKED', 'reason': 'Stable preflight threshold', 'samples': len(samples), 'elapsed_seconds': time.monotonic() - begin, 'first': baseline, 'last': sample}
            if time.monotonic() - begin >= 20:
                return {'status': 'PASS', 'samples': len(samples), 'elapsed_seconds': time.monotonic() - begin, 'first': baseline, 'last': sample}
            time.sleep(1)


def native_worker_prerequisite(owned, log_path):
    """Require effective Ninja jobs1 and exact serial compiler ancestry."""
    table = {item['pid']: item for item in owned}
    copied_cmake = str(ROOT / 'cmake-3.22.1/bin/cmake')
    def jobs_one(argv):
        values = []
        for i, arg in enumerate(argv):
            if arg in ('-j', '--jobs'):
                values.append(argv[i + 1] if i + 1 < len(argv) else None)
            elif arg.startswith('-j') and len(arg) > 2:
                values.append(arg[2:])
            elif arg.startswith('--jobs='):
                values.append(arg.split('=', 1)[1])
        return bool(values) and all(value == '1' for value in values)
    compiler_work = []
    for item in owned:
        binary = Path(item['exe']).name
        argv = item['argv'][1:]
        if binary.startswith('ninja') and not jobs_one(argv):
            return {'reason': 'Native Ninja lacks mandatory effective jobs1 argv', 'process': item}
        if binary.startswith(('clang', 'cc1', 'gcc', 'g++', 'cc', 'c++')) and binary != 'ccache':
            if argv in [['--version'], ['-v'], ['-dumpversion'], ['-print-resource-dir'], ['-print-search-dirs']]:
                continue
            compiler_work.append(item)
            parent = item['ppid']
            serial = False
            for depth in range(12):
                ancestor = table.get(parent)
                if not ancestor: break
                name = Path(ancestor['exe']).name
                if name.startswith('ninja') and jobs_one(ancestor['argv'][1:]):
                    serial = True; break
                # Installed CMakeDetermineCompilerId.cmake684-695 executes
                # exactly one synchronous compiler identification command.
                sources = {Path(arg).name for arg in argv}
                direct_compiler_id = bool(sources & {'CMakeCCompilerId.c', 'CMakeCXXCompilerId.cpp'})
                if (depth == 0 and ancestor['exe'] == copied_cmake and direct_compiler_id
                        and Path(item['cwd']).name in ('CompilerIdC', 'CompilerIdCXX')):
                    serial = True; break
                parent = ancestor['ppid']
            if not serial:
                return {'reason': 'Compiler has no observed jobs1 Ninja or exact serial copied-CMake CompilerId ancestry', 'process': item}
    if len(compiler_work) > 1:
        return {'reason': 'More than one observed native compiler despite jobs1 control', 'processes': compiler_work}
    return None


def verify_qa_inventory(qa, metadata):
    # Exact v3 rules from the certificate-pinned qa-source-provenance.js.
    generated_files = {'expo-env.d.ts', 'android/local.properties'}
    generated_prefixes = ('node_modules/', '.expo/', 'android/.gradle/', 'android/.kotlin/',
                          'android/build/', 'android/app/build/', 'android/app/.cxx/')
    actual = set()
    def visit(directory, prefix=''):
        for item in directory.iterdir():
            relative = prefix + '/' + item.name if prefix else item.name
            if (relative == '.moodinator-qa-source.json' or relative in generated_files
                    or any(relative == entry[:-1] or relative.startswith(entry) for entry in generated_prefixes)):
                continue
            if item.is_symlink():
                raise ValueError('Unsupported unsealed QA input: ' + relative)
            if item.is_dir():
                visit(item, relative)
            elif item.is_file():
                actual.add(relative)
            else:
                raise ValueError('Unsupported unsealed QA input: ' + relative)
    if metadata['version'] != 3 or not metadata['nativeSealed']:
        raise ValueError('QA source must have v3 sealed native metadata')
    visit(qa)
    if actual != set(metadata['files']):
        raise ValueError('Sealed QA staging inventory changed: ' + str(sorted(actual ^ set(metadata['files']))[:3]))


def collect_cold_witnesses(owned, proof):
    """Retain actual binary compilation and its observed jobs1 Ninja ancestry."""
    result = {'hermes': {}, 'compiler': {}}
    table = {item['pid']: item for item in owned}
    bundle = str(Path(proof['qa_root']) / 'android/app/build/generated/assets/react/release/index.android.bundle')
    for item in owned:
        key = f"{item['pid']}:{item['start']}"
        argv = item['argv']
        if (item['exe'] == proof['hermes_executable'] and '-emit-binary' in argv
                and '-O' in argv and '-out' in argv and bundle in argv
                and argv[argv.index('-out') + 1:argv.index('-out') + 2] == [bundle + '.hbc']):
            result['hermes'][key] = item
        if (Path(item['exe']).parent != Path(proof['compiler_directory'])
                or not Path(item['exe']).name.startswith('clang') or '-c' not in argv):
            continue
        parent = item['ppid']
        ancestry = []
        for _ in range(12):
            ancestor = table.get(parent)
            if ancestor is None:
                break
            ancestry.append(ancestor)
            if ancestor['exe'] == proof['ninja_executable'] and '-j1' in ancestor['argv']:
                result['compiler'][key] = {'process': item, 'ancestry': ancestry}
                break
            parent = ancestor['ppid']
    return result


def cold_witnesses_complete(exporter, ninja, actual):
    return bool(exporter and ninja and actual['hermes'] and actual['compiler'])


def main():
    for requested_signal in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(requested_signal, request_interruption)
    parser = argparse.ArgumentParser()
    parser.add_argument('stage')
    parser.add_argument('config')
    args = parser.parse_args()
    receipt = ROOT / f'{args.stage}.json'
    config = None
    try:
        config = json.loads(Path(args.config).read_text())
        if not __debug__:
            raise RuntimeError('Native proof requires non-optimized Python')
        if 'reused_producer_certificate' in config:
            raise ValueError('Hosted cold route cannot accept a reuse certificate')
        if ':app:assembleRelease' in config['command']:
            proof = config['native_proof']
            for key in ['hermes_executable', 'ninja_executable', 'compiler_directory', 'qa_root']:
                if not Path(proof[key]).is_absolute():
                    raise ValueError('Native proof tool/root must be absolute: ' + key)
    except Exception as error:
        record = {'stage': args.stage, 'config': config, 'config_path': args.config, 'status': 'BLOCKED',
                  'exit_code': 70, 'stop_reason': 'Cold route configuration prerequisite failed',
                  'prerequisite_error': repr(error), 'owned_processes': []}
        write_receipt(receipt, record)
        print(json.dumps(record), flush=True)
        return 70
    record = {'stage': args.stage, 'config': config, 'preflight': preflight(args.stage)}
    if record['preflight']['status'] != 'PASS' or INTERRUPTED_SIGNAL is not None:
        code = 128 + INTERRUPTED_SIGNAL if INTERRUPTED_SIGNAL is not None else 70
        record.update(status='INTERRUPTED' if INTERRUPTED_SIGNAL is not None else 'BLOCKED', exit_code=code, owned_processes=[])
        if INTERRUPTED_SIGNAL is not None:
            record['interruption_signal'] = signal.Signals(INTERRUPTED_SIGNAL).name
        write_receipt(receipt, record)
        print(json.dumps(record), flush=True)
        return code
    env = os.environ.copy()
    env.update(PATH=str(PREVIOUS / 'tools/bin') + ':' + str(BASE / 'tools/bin') + ':' + env['PATH'],
               NODE_OPTIONS='--max-old-space-size=1536', NODE_LAUNCHER_TRACE=str(ROOT / 'node-launcher.trace'),
               BUN_INSTALL_CACHE_DIR=str(BASE / 'bun-cache'), EXPO_NO_TELEMETRY='1', CI='1')
    env.update(config['env'])
    wrapped = [str(BASE / 'tools/heavy-check'), '--repo', str(SOURCE), '--lock-timeout', '0', '--timeout', config['timeout'], '--', 'nice', '-n', '10', *config['command']]
    known = {}
    first_faults = {}
    attached_pids = set()
    probes = []
    export_witness = False
    ninja_witness = False
    actual_witnesses = {'hermes': {}, 'compiler': {}}
    pending_probes = []
    stop_reason = None
    pressure_since = None
    code = 71
    baseline = resources()
    record['before'] = baseline
    with (ROOT / f'{args.stage}.log').open('w') as output, (ROOT / f'{args.stage}.metrics.jsonl').open('w') as metrics:
        process = subprocess.Popen(wrapped, cwd=config['cwd'], env=env, stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
        record['leader_pid'] = process.pid
        try:
            while True:
                sample = resources(baseline)
                sample['owned'] = owned_processes(process.pid, known, first_faults)
                worker_problem = native_worker_prerequisite(sample['owned'], ROOT / f'{args.stage}.log')
                if not worker_problem and 'native_proof' in config:
                    current = collect_cold_witnesses(sample['owned'], config['native_proof'])
                    for kind, witnesses in current.items():
                        actual_witnesses[kind].update(witnesses)
                ninja_witness = ninja_witness or any(Path(item['exe']).name.startswith('ninja') and '-j1' in item['argv'] for item in sample['owned'])
                for item in sample['owned']:
                    if 'export:embed' in item['argv']:
                        argv = item['argv']
                        correct_workers = '--max-workers' in argv and argv[argv.index('--max-workers') + 1] == '1'
                        correct_heap = '--max-old-space-size=1536' in argv and item['controls'].get('NODE_OPTIONS') == '--max-old-space-size=1536'
                        correct_mode = item['controls'].get('NODE_ENV') == 'production'
                        if correct_workers and correct_heap and correct_mode:
                            export_witness = True
                        if not (correct_workers and correct_heap and correct_mode):
                            record['producer_control_prerequisite'] = item
                            stop_reason = 'Observed export producer controls differ from reviewed context'
                if worker_problem:
                    record['native_worker_prerequisite'] = worker_problem
                    stop_reason = 'Unproven native compiler worker prerequisite'
                metrics.write(json.dumps(sample) + '\n')
                metrics.flush()
                if INTERRUPTED_SIGNAL is not None:
                    record['interruption_signal'] = signal.Signals(INTERRUPTED_SIGNAL).name
                    stop_reason = 'Explicit task interruption'
                    code = 128 + INTERRUPTED_SIGNAL
                    break
                for probe in list(pending_probes):
                    result = probe['process'].poll()
                    if result is not None:
                        probe['file'].close()
                        probes.append({key: value for key, value in probe.items() if key not in {'process', 'file', 'begin'}} | {'exit_code': result})
                        pending_probes.remove(probe)
                        if result != 0:
                            stop_reason = 'Owned JVM observation prerequisite failed'
                    elif time.monotonic() - probe['begin'] > 10:
                        stop_reason = 'Owned JVM observation exceeded 10 seconds'
                exit_code = process.poll()
                if exit_code is not None:
                    if exit_code == 0 and ':app:assembleRelease' in config['command']:
                        if not cold_witnesses_complete(export_witness, ninja_witness, actual_witnesses):
                            stop_reason = 'Mandatory actual exporter/Hermes/jobs1 Ninja/compiler witnesses missing'
                    code = 70 if stop_reason else exit_code
                    break
                if sample['pressure']['full']['avg10'] > 5:
                    pressure_since = pressure_since or time.monotonic()
                else:
                    pressure_since = None
                if sample['available_mib'] < 1500 or sample['free_disk_gib'] < 5 or (pressure_since is not None and time.monotonic() - pressure_since >= 10):
                    stop_reason = 'Runtime reserve/pressure threshold'
                if stop_reason:
                    code = 70
                    break
                for item in sample['owned']:
                    if item['exe'].endswith('/bin/java') and any('org.gradle.launcher.daemon.bootstrap.GradleDaemon' in arg for arg in item['argv']) and item['pid'] not in attached_pids:
                        # One read-only, identity-checked observation of this owned build JVM.
                        table = process_table()
                        if item['pid'] not in table or table[item['pid']]['start'] != item['start']:
                            continue
                        attached_pids.add(item['pid'])
                        path = ROOT / f'{args.stage}.jvm-{item["pid"]}.info.log'
                        probe_file = path.open('w')
                        command = ['nice', '-n', '10', str(Path(env['JAVA_HOME']) / 'bin/jcmd'), '-J-Xmx64m', '-J-XX:ActiveProcessorCount=1', str(item['pid']), 'VM.info']
                        probe = subprocess.Popen(command, cwd=config['cwd'], env=env, stdout=probe_file, stderr=subprocess.STDOUT)
                        table = process_table()
                        if probe.pid in table:
                            known[probe.pid] = table[probe.pid]['start']
                        pending_probes.append({'process': probe, 'file': probe_file, 'begin': time.monotonic(), 'pid': probe.pid, 'target_pid': item['pid'], 'target_start': item['start'], 'command': command, 'output': str(path)})
                time.sleep(0.1)
        except BaseException as error:
            record['harness_error'] = repr(error)
            stop_reason = 'Task harness failure'
            code = 71
        record['residual_before_cleanup'] = owned_processes(process.pid, known, first_faults)
        actions, residual = cleanup(process, known, first_faults)
        for probe in pending_probes:
            if probe['process'].poll() is None:
                probe['process'].wait(timeout=10)
            probe['file'].close()
            probes.append({key: value for key, value in probe.items() if key not in {'process', 'file', 'begin'}} | {'exit_code': probe['process'].returncode})
        if INTERRUPTED_SIGNAL is not None:
            record['interruption_signal'] = signal.Signals(INTERRUPTED_SIGNAL).name
            stop_reason = 'Explicit task interruption'
            code = 128 + INTERRUPTED_SIGNAL
        record.update(export_witness=export_witness, ninja_witness=ninja_witness, actual_witnesses=actual_witnesses, status='INTERRUPTED' if INTERRUPTED_SIGNAL is not None else ('PASS' if code == 0 and not residual else ('BLOCKED' if code in (70, 75) else 'FAIL')), exit_code=code, stop_reason=stop_reason,
                      cleanup_actions=actions, residual_after_cleanup=residual, owned_identities=known, jvm_observations=probes, after=resources(baseline))
    write_receipt(receipt, record)
    print(json.dumps({key: value for key, value in record.items() if key not in {'config', 'owned_identities', 'cleanup_actions', 'preflight'}}), flush=True)
    return code if not residual else 71


if __name__ == '__main__':
    raise SystemExit(main())

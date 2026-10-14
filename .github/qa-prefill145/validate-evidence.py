"""Validate exact terminal native receipts before log transport."""
import hashlib
import json

REQUIRED_STAGES = ['kvm-access', 'source-install', 'qa-prepare', 'qa-install', 'qa-prebuild',
                   'qa-seal', 'sdk', 'native-library-prerequisites', 'native-apk', 'actual-manifest', 'apk-signature',
                   'emulator-sdk', 'prefill-acceptance']

def validate_cleanup(receipt, table):
    if 'residual_after_cleanup' in receipt:
        if receipt['residual_after_cleanup'] != []:
            raise ValueError('Terminal cleanup has residual processes')
    elif (receipt.get('owned_processes') != []
          or receipt.get('status') not in ('BLOCKED', 'INTERRUPTED')
          or any(key in receipt for key in ('leader_pid', 'before', 'owned_identities'))):
        raise ValueError('Terminal cleanup receipt is incomplete')
    for pid, start in receipt.get('owned_identities', {}).items():
        item = table.get(int(pid))
        if item and item['start'] == start and item['state'] != 'Z':
            raise ValueError('Recorded owned identity is still live')


def validate_result(root, expected, table):
    raw = (root / 'result.json').read_bytes()
    result = json.loads(raw)
    snapshots = {'result.json': hashlib.sha256(raw).hexdigest()}
    if result.get('status') not in ('PASS', 'BLOCKED', 'INTERRUPTED'):
        raise ValueError('Final terminal result is invalid')
    if (result.get('product_source', result.get('source')) != expected['source']
            or result.get('tree') != expected['tree']):
        raise ValueError('Final source/tree differs')
    stages = result.get('stages')
    if not isinstance(stages, list):
        raise ValueError('Final stage receipts are missing')
    for receipt in stages:
        validate_cleanup(receipt, table)
    native = root / 'native'
    raw_json = {}
    for path in native.glob('*.json'):
        if path.is_symlink() or not path.is_file():
            raise ValueError('Unsupported stage JSON path')
        data = path.read_bytes()
        raw_json[path.name] = json.loads(data)
        snapshots[str(path.relative_to(root))] = hashlib.sha256(data).hexdigest()
    exec_directory = native / 'ninja.exec'
    if exec_directory.is_symlink():
        raise ValueError('Exec receipt directory symlink refused')
    if exec_directory.is_dir():
        for path in exec_directory.glob('*.json'):
            if path.is_symlink() or not path.is_file():
                raise ValueError('Unsupported exec receipt path')
            data = path.read_bytes()
            json.loads(data)
            snapshots[str(path.relative_to(root))] = hashlib.sha256(data).hexdigest()
    for receipt in stages:
        for reported_path, proof in receipt.get('ninja_exec_receipts', {}).items():
            invocation = proof['record']
            pid, start = invocation['pid'], invocation['start']
            if not isinstance(pid, int) or not isinstance(start, str) or not start.isdigit():
                raise ValueError('Invalid exec proof identity')
            path = exec_directory / (str(pid) + '-' + start + '.json')
            key = str(path.relative_to(root))
            if (str(path) != reported_path or snapshots.get(key) != proof['sha256']
                    or json.loads(path.read_bytes()) != invocation):
                raise ValueError('Used exec receipt differs from guarded evidence')
    for receipt in stages:
        stage = receipt.get('stage')
        if (not isinstance(stage, str) or raw_json.get(stage + '.json') != receipt
                or stage + '-command.json' not in raw_json):
            raise ValueError('Embedded stage differs from raw terminal receipt')
    for name in raw_json:
        if not name.endswith('-command.json'):
            continue
        stage = name[:-len('-command.json')]
        receipt = raw_json.get(stage + '.json')
        if (not isinstance(receipt, dict) or receipt.get('stage') != stage
                or receipt.get('status') not in ('PASS', 'BLOCKED', 'FAIL', 'INTERRUPTED')
                or not isinstance(receipt.get('exit_code'), int)):
            raise ValueError('Commanded stage lacks a valid terminal receipt: ' + stage)
        if receipt['status'] == 'PASS' and receipt['exit_code'] != 0:
            raise ValueError('Terminal stage PASS has nonzero exit')
        validate_cleanup(receipt, table)
    if any(receipt.get('stage') == 'kvm-access' for receipt in stages):
        restored = raw_json.get('kvm-restoration.json', {})
        if restored.get('status') != 'PASS' or restored.get('source') != expected['source']:
            raise ValueError('KVM restoration is not verified')
        context = raw_json.get('kvm-access-context.json', {})
        if context.get('modified') and not restored.get('restored'):
            raise ValueError('Modified KVM access was not restored')
        if context.get('status') == 'PASS' and (restored.get('device_verified') is not True
                                              or restored.get('acl_verified') is not True):
            raise ValueError('Successful KVM preparation lacks exact restoration proof')
    if result['status'] == 'PASS':
        context = raw_json.get('kvm-access-context.json', {})
        apk_context = raw_json.get('apk-context.json', {})
        if (context.get('status') != 'PASS' or context.get('source') != expected['source']
                or context.get('access_after') is not True):
            raise ValueError('Successful result lacks verified KVM access')
        if (apk_context.get('source') != expected['source'] or apk_context.get('tree') != expected['tree']
                or apk_context.get('APK_sha256') != result.get('APK_sha256')
                or apk_context.get('APK_bytes') != result.get('APK_bytes')
                or not apk_context.get('actual_release_manifests') or not apk_context.get('compiled_MainActivity')):
            raise ValueError('Successful result lacks retained APK/manifest/compiler identity')
        if [receipt.get('stage') for receipt in stages] != REQUIRED_STAGES:
            raise ValueError('Successful result omits a required stage')
        if any(receipt.get('status') != 'PASS' or receipt.get('exit_code') != 0
               or receipt.get('residual_after_cleanup') != [] for receipt in stages):
            raise ValueError('Successful result has an incomplete stage')
        native = stages[REQUIRED_STAGES.index('native-apk')]
        actual = native.get('actual_witnesses', {})
        if not (native.get('export_witness') and native.get('ninja_witness')
                and actual.get('hermes') and actual.get('compiler')):
            raise ValueError('Successful result lacks cold native process proof')
        apk = root / 'prefill145-qa-x86_64.apk'
        with apk.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        if apk.stat().st_size != result.get('APK_bytes') or digest != result.get('APK_sha256'):
            raise ValueError('Final APK identity differs')
        snapshots[apk.name] = digest
        product = result.get('product_acceptance')
        if (not isinstance(product, dict) or product.get('status') != 'PASS'
                or product.get('source') != expected['source']
                or product.get('APK_sha256') != digest
                or product.get('residual_after_cleanup') != []):
            raise ValueError('Successful result lacks exact APK product acceptance')
        product_raw = (root / 'acceptance/result.json').read_bytes()
        if json.loads(product_raw) != product:
            raise ValueError('Embedded acceptance differs from raw terminal result')
        snapshots['acceptance/result.json'] = hashlib.sha256(product_raw).hexdigest()
    return result, snapshots

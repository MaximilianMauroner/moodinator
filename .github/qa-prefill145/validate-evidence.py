"""Validate exact terminal native receipts before log transport."""
import hashlib
import json

REQUIRED_STAGES = ['source-install', 'qa-prepare', 'qa-install', 'qa-prebuild',
                   'qa-seal', 'sdk', 'native-apk', 'actual-manifest', 'apk-signature',
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
    if result['status'] == 'PASS':
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

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { releaseChildEnvironment } from './release-environment.mjs';

const approvedCertificates = {
  moodinator: '73bc862a96d8768bb44fb152a7ada91f7d91c04013b72ca756ef3e0cd2a98132',
  'zen-mode': '46ab4a5bdb4b5e57ccf0c35570076eb58c3adf02db04aa04bbbcfd1eda082d59',
};

function output(program, args) {
  const result = spawnSync(program, args, { env: releaseChildEnvironment('tools'), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} artifact verification failed: ${result.stderr}`);
  return result.stdout.trim();
}

export function assertArtifactIdentity(actual, expected, app) {
  for (const key of ['package', 'version', 'versionCode']) {
    if (actual[key] !== expected[key]) throw new Error(`${key} mismatch: expected ${expected[key]}, got ${actual[key]}`);
  }
  if (actual.certificate !== approvedCertificates[app]) throw new Error('Artifact does not use the approved upload certificate');
}

export function assertBundleAbis(entries) {
  const abis = new Set();
  const baseAbis = new Set();
  for (const entry of entries) {
    const match = /^([^/]+)\/lib\/([^/]+)\/[^/]+\.so$/.exec(entry);
    if (!match) continue;
    abis.add(match[2]);
    if (match[1] === 'base') baseAbis.add(match[2]);
  }
  const expected = ['armeabi-v7a', 'arm64-v8a'];
  if (abis.size !== expected.length || expected.some((abi) => !abis.has(abi) || !baseAbis.has(abi))) {
    throw new Error(`Unexpected bundle ABIs: ${[...abis].sort().join(', ') || 'none'}`);
  }
}

export function verifyReleaseArtifacts(aab, expected, app) {
  const bundletool = process.env.ANDROID_BUNDLETOOL_JAR;
  if (!bundletool || !existsSync(bundletool)) {
    throw new Error('Set ANDROID_BUNDLETOOL_JAR for artifact verification');
  }
  const java = ['-Xmx512m', '-jar', bundletool];
  output('java', [...java, 'validate', `--bundle=${aab}`]);
  if (app === 'moodinator') assertBundleAbis(output('jar', ['tf', aab]).split('\n'));
  const value = (attribute) => output('java', [...java, 'dump', 'manifest', `--bundle=${aab}`, `--xpath=/manifest/@${attribute}`]);
  const signature = output('jarsigner', ['-J-Duser.language=en', '-J-Duser.country=US', '-verify', aab]);
  if (!signature.includes('jar verified.')) throw new Error('AAB signature verification failed');
  const aabSigner = output('keytool', ['-J-Duser.language=en', '-J-Duser.country=US', '-printcert', '-jarfile', aab]);
  const aabCertificate = aabSigner.match(/SHA256:\s*([a-f0-9:]+)/i)?.[1]?.replaceAll(':', '').toLowerCase();
  assertArtifactIdentity({ package: value('package'), version: value('android:versionName'),
    versionCode: Number(value('android:versionCode')), certificate: aabCertificate }, expected, app);
  console.log(`Verified AAB: ${expected.version} (${expected.versionCode}), approved upload certificate`);
}

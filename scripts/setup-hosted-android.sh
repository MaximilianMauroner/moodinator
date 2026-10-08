#!/usr/bin/env bash
set -euo pipefail
if [[ ${GITHUB_ACTIONS:-} != true || ${RUNNER_OS:-} != Linux ]]; then
  echo "Android setup requires the GitHub Linux runner" >&2
  exit 1
fi
mode=${1:?Expected build or verify}
if [[ "$mode" != build && "$mode" != verify ]]; then exit 1; fi
# Only this disposable hosted runner's unused tool bundles are eligible for cleanup.
if [ "$(df --output=avail -B1 . | tail -1)" -lt 21474836480 ]; then
  sudo rm -rf /usr/share/dotnet /usr/local/.ghcup /usr/local/share/boost /opt/hostedtoolcache/CodeQL
fi
df -h .
free -h
test "$(df --output=avail -B1 . | tail -1)" -ge 16106127360
test "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -ge 8388608
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'
bundletool="$RUNNER_TEMP/bundletool.jar"
curl --fail --silent --show-error --location https://github.com/google/bundletool/releases/download/1.18.2/bundletool-all-1.18.2.jar --output "$bundletool"
echo "378b5434cd1378bef6b2bc527b8c7f0ff2584b273830335bce54d6d0813c8584  $bundletool" | sha256sum --check
echo "ANDROID_BUNDLETOOL_JAR=$bundletool" >> "$GITHUB_ENV"
if [[ "$mode" == build ]]; then npm install --global eas-cli@20.5.1; fi

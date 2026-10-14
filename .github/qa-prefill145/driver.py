#!/usr/bin/env python3
"""One hosted exact-source QA build and disposable prefill acceptance."""
import hashlib, importlib.util, json, os, re, shutil, signal, subprocess, sys, time, zipfile
from pathlib import Path
from shlex import quote
SOURCE = Path(os.environ["MOODINATOR_SOURCE_ROOT"]).resolve()
CONTROL = Path(__file__).resolve().parent
TASK = Path(os.environ["RUNNER_TEMP"]) / "moodinator145-qa"
TASK.mkdir(exist_ok=False)
NATIVE = TASK / "native"
NATIVE.mkdir()
(TASK / "tools/bin").mkdir(parents=True)
(TASK / "runtime").mkdir(mode=0o700)
os.environ["XDG_RUNTIME_DIR"]=str(TASK / "runtime")
interrupted=None
def request_stop(signum, frame):
    global interrupted
    if interrupted is None: interrupted=signum
for signum in [signal.SIGTERM,signal.SIGINT,signal.SIGHUP]: signal.signal(signum,request_stop)
expected = json.loads((CONTROL / "expected-inputs.json").read_text())
expected_stages = ["source-install", "qa-prepare", "qa-install", "qa-prebuild", "qa-seal", "sdk", "native-apk", "actual-manifest", "apk-signature", "emulator-sdk", "prefill-acceptance"]
def sha(p):
    h=hashlib.sha256()
    with Path(p).open("rb") as f:
        for b in iter(lambda:f.read(1024*1024), b""): h.update(b)
    return h.hexdigest()
def source_identity():
    def git(*args): return subprocess.check_output(["git","-C",str(SOURCE),*args],text=True).strip()
    if git("rev-parse","HEAD") != expected["source"] or git("rev-parse","HEAD^{tree}") != expected["tree"]:
        raise ValueError("Source head/tree changed")
    if git("status","--porcelain","--untracked-files=all"):
        raise ValueError("Source checkout dirty")
    if set(git("ls-files").splitlines()) != set(expected["source399"]):
        raise ValueError("Source inventory changed")
    for p,h in expected["source399"].items():
        if sha(SOURCE/p) != h: raise ValueError("Source bytes changed: "+p)
node=Path(shutil.which("node")).resolve()
bun=Path(shutil.which("bun")).resolve()
if subprocess.check_output([str(node), "--version"], text=True).strip() != "v24.13.1":
    raise ValueError("Pinned Node prerequisite differs")
if subprocess.check_output([str(bun), "--version"], text=True).strip() != "1.3.14":
    raise ValueError("Pinned Bun prerequisite differs")
for name,path in [("node",node),("bun",bun)]:
    launcher=TASK / "tools/bin" / name
    if name=="node":
        launcher.write_text("#!/bin/sh\nexec "+quote(str(path))+" \"$@\"\n")
    else: launcher.symlink_to(path)
    launcher.chmod(0o755)
shutil.copyfile(CONTROL/"heavy-check",TASK/"tools/heavy-check")
(TASK/"tools/heavy-check").chmod(0o755)
shutil.copyfile(CONTROL/"run-native.py",NATIVE/"run-native.py")
shutil.copyfile(CONTROL/"resource-controls.init.gradle",NATIVE/"resource-controls.init.gradle")
spec=importlib.util.spec_from_file_location('native_guard',NATIVE/'run-native.py')
guard=importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
os.environ["MOODINATOR_CONTROL_ROOT"]=str(TASK)
base={"JAVA_HOME":os.environ["JAVA_HOME"],"JAVA_TOOL_OPTIONS":"-Xmx768m -XX:ActiveProcessorCount=1",
      "ANDROID_HOME":os.environ["ANDROID_HOME"],"ANDROID_SDK_ROOT":os.environ["ANDROID_HOME"],
      "GRADLE_USER_HOME":str(NATIVE/"gradle-user"),"ANDROID_USER_HOME":str(NATIVE/"android-user"),
      "NODE_OPTIONS":"--max-old-space-size=1536","MOODINATOR_VARIANT":"qa","MOODINATOR_CONTROL_ROOT":str(TASK)}
receipts=[]
def stage(name,cwd,argv,extra=None,timeout="15m",native_proof=None):
    if interrupted is not None: raise RuntimeError("Interrupted before stage")
    source_identity()
    config={"cwd":str(cwd),"timeout":timeout,"command":argv,"env":{**base,**(extra or {})},"source":expected["source"]}
    if native_proof is not None: config['native_proof']=native_proof
    path=NATIVE/(name+"-command.json");path.write_text(json.dumps(config,indent=2)+"\n")
    p=subprocess.Popen([sys.executable,str(NATIVE/"run-native.py"),name,str(path)])
    forwarded=False
    while p.poll() is None:
        if interrupted is not None and not forwarded:
            p.send_signal(interrupted);forwarded=True
        time.sleep(0.1)
    p.wait()
    receipt=json.loads((NATIVE/(name+".json")).read_text());receipts.append(receipt)
    if interrupted is not None or p.returncode or receipt["status"]!="PASS" or receipt.get("residual_after_cleanup"):
        raise RuntimeError(name+" stopped; later workloads refused")
    source_identity()
    return receipt
def write_final_result(report):
    if interrupted is not None:
        raise InterruptedError('Interrupted during final artifact proof')
    guard.write_receipt(TASK/'result.json',report)
    if interrupted is not None:
        report={**report,'status':'INTERRUPTED','interruption_signal':signal.Signals(interrupted).name}
        guard.write_receipt(TASK/'result.json',report)
        raise InterruptedError('Interrupted while committing final receipt')
try:
    source_identity()
    stage("source-install",SOURCE,[str(bun),"install","--frozen-lockfile"])
    stage("qa-prepare",SOURCE,[str(node),"scripts/prepare-native-qa.js"])
    match=re.search(r"^QA workspace: (.+)$",(NATIVE/"qa-prepare.log").read_text(),re.M)
    if not match: raise ValueError("Prepared QA path absent")
    qa=Path(match[1]).resolve()
    if not qa.is_dir() or not qa.name.startswith("moodinator-qa-"): raise ValueError("Unexpected QA workspace")
    base["MOODINATOR_QA_ROOT"]=str(qa)
    stage("qa-install",qa,[str(bun),"install","--frozen-lockfile"])
    stage("qa-prebuild",qa,[str(node),"node_modules/expo/bin/cli","prebuild","--platform","android","--clean"],{"MOODINATOR_QA_PREPARE_NATIVE":"1"})
    stage("qa-seal",qa,[str(node),"scripts/seal-native-qa.js"])
    metadata=json.loads((qa/".moodinator-qa-source.json").read_text())
    if metadata["files"] != expected["QA450"]: raise ValueError("Generated sealed inventory/hash context differs")
    guard.verify_qa_inventory(qa,metadata)
    for p,h in expected["QA450"].items():
        if sha(qa/p)!=h: raise ValueError("QA input changed: "+p)
    sdk=Path(base["ANDROID_HOME"])
    stage("sdk",SOURCE,[str(sdk/"cmdline-tools/latest/bin/sdkmanager"),"platforms;android-36","build-tools;36.0.0","ndk;27.1.12297006","ndk;27.0.12077973","cmake;3.22.1"])
    cmake=NATIVE/"cmake-3.22.1";shutil.copytree(sdk/"cmake/3.22.1",cmake,symlinks=True)
    ninja=cmake/"bin/ninja";ninja.rename(cmake/"bin/ninja.original")
    shutil.copyfile(CONTROL/'ninja-launcher.py',ninja);ninja.chmod(0o755)
    (qa/"android/local.properties").write_text("sdk.dir="+str(sdk)+"\ncmake.dir="+str(cmake)+"\n")
    hermes=(qa/'node_modules/hermes-compiler/hermesc/linux64-bin/hermesc').resolve()
    compiler_directory=(sdk/'ndk/27.1.12297006/toolchains/llvm/prebuilt/linux-x86_64/bin').resolve()
    sqlite_compiler=(sdk/'ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/bin/clang').resolve()
    before_tools={str(p):sha(p) for p in [node,bun,cmake/"bin/cmake",cmake/"bin/ninja.original",ninja,hermes,(compiler_directory/'clang').resolve(),sqlite_compiler]}
    guard.write_receipt(NATIVE/'tool-context.json', {'source':expected['source'],'tools':before_tools,
        'ndk_context':{'app':'27.1.12297006','sqlite_AGP_default':'27.0.12077973'},
        'scope':'Explicit SDK prerequisites; no source/dependency/native configuration override'})
    native_proof={'hermes_executable':str(hermes),'ninja_executable':str(cmake/'bin/ninja.original'),
                  'compiler_directory':str(compiler_directory),'qa_root':str(qa)}
    guard.verify_qa_inventory(qa,metadata)
    extra={"NODE_ENV":"production","GRADLE_OPTS":"-Dorg.gradle.daemon=false -XX:ActiveProcessorCount=1",
           "PREFILL_NINJA_TRACE":str(NATIVE/"ninja.trace"),"CMAKE_BUILD_PARALLEL_LEVEL":"1"}
    native=stage("native-apk",qa/"android",["bash","./gradlew",":app:assembleRelease","--max-workers=1","--no-daemon","--no-build-cache",
        "-Dorg.gradle.jvmargs=-Xmx768m -XX:ActiveProcessorCount=1","-Dkotlin.daemon.jvm.options=-Xmx512m,-XX:ActiveProcessorCount=1",
        "-Pkotlin.compiler.execution.strategy=in-process","-Pkotlin.daemon.jvmargs=-Xmx512m -XX:ActiveProcessorCount=1",
        "-PreactNativeArchitectures=x86_64","-Pandroid.builder.sdkDownload=false","-Dorg.gradle.java.installations.auto-download=false",
        "--init-script",str(NATIVE/"resource-controls.init.gradle")],extra,"20m",native_proof)
    stage("actual-manifest",qa,[str(node),"scripts/check-android-release-config.js","--variant","qa","--require-generated-manifest"],extra)
    for p,h in before_tools.items():
        if sha(p)!=h: raise ValueError("Native tool changed")
    for p,h in expected["QA450"].items():
        if sha(qa/p)!=h: raise ValueError("Sealed input changed after native: "+p)
    guard.verify_qa_inventory(qa,metadata)
    apk=qa/"android/app/build/outputs/apk/release/app-release.apk"
    if not apk.is_file():raise ValueError("Fresh APK absent")
    with zipfile.ZipFile(apk) as z:
        if z.read("assets/index.android.bundle")[:8]!=bytes.fromhex("c61fbc03c103191f"):raise ValueError("Hermes bundle absent")
        if not any(n.startswith("lib/x86_64/") for n in z.namelist()):raise ValueError("x86_64 ABI absent")
    stage("apk-signature",SOURCE,[str(sdk/"build-tools/36.0.0/apksigner"),"verify","--verbose","--print-certs",str(apk)],extra)
    shutil.copyfile(apk,TASK/"prefill145-qa-x86_64.apk")
    if sha(TASK/'prefill145-qa-x86_64.apk')!=sha(apk):raise ValueError('Copied APK changed')
    stage("emulator-sdk",SOURCE,[str(sdk/"cmdline-tools/latest/bin/sdkmanager"),"emulator","platform-tools","system-images;android-35;default;x86_64"])
    acceptance_out=TASK/"acceptance"
    stage("prefill-acceptance",SOURCE,[sys.executable,str(CONTROL/"acceptance.py"),"--qa-root",str(qa),"--apk",str(apk),"--out",str(acceptance_out)],
          {**extra,"PREFILL_NODE":str(node)},"20m")
    product=json.loads((acceptance_out/"result.json").read_text())
    if product.get("status")!="PASS" or product.get("source")!=expected["source"]:
        raise ValueError("Prefill acceptance did not pass exact source")
    if product.get("residual_after_cleanup")!=[]:
        raise ValueError("Prefill acceptance cleanup incomplete")
    if [receipt["stage"] for receipt in receipts]!=expected_stages:
        raise ValueError("Successful result omits a required stage")
    for p,h in expected["QA450"].items():
        if sha(qa/p)!=h: raise ValueError("Sealed input changed after acceptance: "+p)
    guard.verify_qa_inventory(qa,metadata)
    source_identity()
    report={"status":"PASS","product_source":expected["source"],"tree":expected["tree"],"QA_metadata":metadata,
            "APK_sha256":sha(apk),"APK_bytes":apk.stat().st_size,"tools":before_tools,"native_receipt":native,
            "stages":receipts,"product_acceptance":product,"residual_after_cleanup":[],
            "scope":"Fresh QA APK/actual manifest/emulator prefill proof; no merge/release or required CI substitution"}
    write_final_result(report)
    print("PREFILL145_APK_SHA256="+report['APK_sha256'],flush=True)
except BaseException as error:
    guard.write_receipt(TASK/'result.json',{'status':'INTERRUPTED' if interrupted is not None else 'BLOCKED',
        'error':repr(error),'source':expected['source'],'tree':expected['tree'],'stages':receipts,
        'interruption_signal':signal.Signals(interrupted).name if interrupted is not None else None})
    raise

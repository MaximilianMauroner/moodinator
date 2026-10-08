import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { App as RouterApp } from "expo-router/build/qualified-entry";
import { STARTUP_PHASES } from "@db/encryption/startup";
import { crashEncryptionProof, loseProofKey, prepareAppUpgrade, prepareWalCrash, resumeEncryptionProof, runEncryptionProof, verifyAppUpgrade, verifyLostProofKey, writeEncryptionProofStatus } from "./proof";

// Activated only for a sealed, separate QA variant. Every storage operation also
// checks the installed package identifier before touching fabricated test files.
export default function EncryptionProofEntry() {
  const [progress, setProgress] = useState("loading");
  const [report, setReport] = useState("");
  const [showApp, setShowApp] = useState(false);
  useEffect(() => {
    const sourceSha = Constants.expoConfig?.extra?.qaSourceSha;
    let runId: string | null = null;
    void (async () => {
      const url = await Linking.getInitialURL();
      const params = url ? Linking.parse(url).queryParams : null;
      const action = params?.proof ?? "journey";
      const caseName = params?.case;
      runId = typeof params?.runId === "string" ? params.runId : null;
      const publish = (message: string, result?: unknown) => {
        writeEncryptionProofStatus({ sourceSha, runId, progress: message, result });
        setProgress(message);
      };
      publish("launch");
      let result: unknown;
      switch (action) {
        case "journey": setShowApp(true); return;
        case "suite": result = await runEncryptionProof(publish); break;
        case "prepare-app": result = await prepareAppUpgrade(); break;
        case "verify-app": result = await verifyAppUpgrade(); break;
        case "lose-key": result = await loseProofKey(); break;
        case "verify-lost-key": result = await verifyLostProofKey(); break;
        case "wal-crash": await prepareWalCrash(publish); return;
        case "resume":
          if (typeof caseName !== "string") throw new Error("A native recovery case is required");
          result = await resumeEncryptionProof(caseName); break;
        case "crash": {
          const phase = params?.phase;
          const supported = STARTUP_PHASES.find((candidate) => candidate === phase);
          if (typeof caseName !== "string" || !supported) {
            throw new Error("A supported native recovery phase is required");
          }
          await crashEncryptionProof(caseName, supported, publish);
          return;
        }
        default: throw new Error("Unknown native encryption proof action");
      }
      publish("complete", result);
      setReport(JSON.stringify({ sourceSha, result }));
    })().catch((error: unknown) => {
      const result = { status: "failed", error: error instanceof Error ? error.message : String(error) };
      try { writeEncryptionProofStatus({ sourceSha, runId, progress: "failed", result }); }
      catch { /* Invalid package/provenance must still fail visibly, without writing files. */ }
      setProgress("failed");
      setReport(JSON.stringify({ sourceSha, result }));
    });
  }, []);
  if (showApp) return <RouterApp />;
  return (
    <View style={{ flex: 1, backgroundColor: "#24302A", padding: 24, justifyContent: "center" }}>
      <Text style={{ color: "#FAF8F4" }}>Disposable native encryption proof</Text>
      <Text testID={`qa-source-sha-${Constants.expoConfig?.extra?.qaSourceSha}`} style={{ color: "#FAF8F4" }}>QA source</Text>
      <Text testID="encryption-proof-progress" accessibilityLabel={`encryption-proof:${progress}`} style={{ color: "#FAF8F4" }}>{progress}</Text>
      {!!report && <Text testID="encryption-proof-result" accessibilityLabel={`encryption-proof-result:${report}`} style={{ color: "#FAF8F4" }}>{report}</Text>}
    </View>
  );
}

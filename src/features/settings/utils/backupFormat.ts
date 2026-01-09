export function formatBackupDate(timestamp: number | null): string {
  if (!timestamp) {
    return "Never";
  }
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

export function formatBackupFolderPath(uri: string | null): string {
  if (!uri) {
    return "Default location";
  }
  if (uri.includes("documentDirectory")) {
    return "App Documents (accessible via Files app)";
  }
  if (uri.startsWith("content://")) {
    const parts = uri.split("/");
    const lastPart = parts[parts.length - 1];
    return lastPart || "Selected folder";
  }
  return uri.length > 50 ? `${uri.substring(0, 50)}...` : uri;
}


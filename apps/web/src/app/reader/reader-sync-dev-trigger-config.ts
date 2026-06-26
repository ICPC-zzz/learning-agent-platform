export interface ReaderSyncDevTriggerConfig {
  showDevSyncTrigger: boolean;
  devSyncEnabled: boolean;
  allowDevOnlySyncPreview: boolean;
}

function isExplicitlyEnabled(value: unknown): boolean {
  return value === "true";
}

export function resolveReaderSyncDevTriggerConfig(
  env: NodeJS.ProcessEnv = process.env,
): ReaderSyncDevTriggerConfig {
  const devTriggerEnabled =
    isExplicitlyEnabled(env.LAP_READER_SYNC_DEV_TRIGGER) &&
    env.NODE_ENV !== "production";

  return {
    showDevSyncTrigger: devTriggerEnabled,
    devSyncEnabled: devTriggerEnabled,
    allowDevOnlySyncPreview: devTriggerEnabled,
  };
}

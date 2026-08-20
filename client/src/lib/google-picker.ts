export type PickerBootstrapState = {
  apiKey?: string;
  folderId?: string;
  hasGapi: boolean;
};

export function hasPickerBootstrapPrerequisites({ apiKey, folderId, hasGapi }: PickerBootstrapState): boolean {
  return Boolean(apiKey?.trim() && folderId?.trim() && hasGapi);
}

export function getDriveAppId(clientId?: string): string | undefined {
  return clientId?.match(/^(\d+)-/)?.[1];
}

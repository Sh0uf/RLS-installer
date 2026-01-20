import type { ClassValue } from "clsx";

export interface Toast {
  id: number;
  message: string;
  type: "error" | "success" | "info";
}

export interface ModConfig {
  id: string;
  name: string;
  description: string;
  githubRepo?: string;
  directDownload?: string;
  version?: string;
  imageUrl?: string;
  assetPattern?: string;
  category?: "core" | "map" | "vehicle";
  state?: "Public" | "Beta";
}

export interface InstalledMod {
  version: string;
  filename: string;
}

export interface ModManifest {
  [modId: string]: InstalledMod;
}

export interface UpdateInfo {
  modId: string;
  newVersion: string;
  downloadUrl: string;
  externalUrl?: string;
}

export interface BackendConfig {
  remote_mods_json_url?: string;
}

export interface DownloadProgressEventPayload {
  mod_id?: string;
  url: string;
  downloaded: number;
  total?: number;
  progress?: number;
}

export const MANIFEST_FILENAME = "mod_manifest.json";

export type TabId = "browse" | "library";

export type DownloadProgressMap = {
  [modId: string]: { percent: number; name: string };
};

export type { ClassValue };

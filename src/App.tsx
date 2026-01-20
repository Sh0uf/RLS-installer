import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";
import {
  Toast,
  ModConfig,
  InstalledMod,
  ModManifest,
  UpdateInfo,
  BackendConfig,
  DownloadProgressEventPayload,
  TabId,
  DownloadProgressMap,
} from "./types";
import { isNewerVersion } from "./utils/version";
import { Sidebar } from "./components/Sidebar";
import { HeaderBar } from "./components/HeaderBar";
import { Notifications } from "./components/Notifications";
import { BrowseView } from "./components/BrowseView";
import { SettingsPopover } from "./components/SettingsPopover";
import { DeleteConfirmation } from "./components/DeleteConfirmation";
import { InstalledModsTable } from "./components/InstalledModsTable";
import { cn } from "./utils/cn";

// Helper to identify mods from Post Titles/Slugs

function App() {
  // State
  const [activeTab, setActiveTab] = useState<TabId>("browse");
  const [beamUserPath, setBeamUserPath] = useState<string>("");
  const [manifest, setManifest] = useState<ModManifest>({});
  const [status, setStatus] = useState<string>("Initializing...");
  const [updates, setUpdates] = useState<UpdateInfo[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [installingMods, setInstallingMods] = useState<{ [modId: string]: boolean }>({});
  const [modsConfig, setModsConfig] = useState<ModConfig[]>([]);
  const [showSettingsPopover, setShowSettingsPopover] = useState<boolean>(false);
  const [manifestFilePath, setManifestFilePath] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ modId: string; filename: string } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressMap>({});

    // Helper: find installed entry for a mod either by id or by filename pattern
    const getInstalledForMod = (mod: ModConfig): InstalledMod | null => {
        const direct = manifest[mod.id];
        if (direct) return direct;

        if (mod.assetPattern) {
            try {
                const regex = new RegExp(mod.assetPattern, "i");
                const match = Object.values(manifest).find((entry) => regex.test(entry.filename));
                if (match) return match;
            } catch (e) {
                console.error("Invalid assetPattern regex for mod", mod.id, mod.assetPattern, e);
            }
        }

        return null;
    };

    // Toast Helpers
    const addToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);
        // Auto-dismiss non-errors
        if (type !== 'error') {
                setTimeout(() => removeToast(id), 5000);
        }
    };

    const removeToast = (id: number) => {
            setToasts(prev => prev.filter(t => t.id !== id));
    };
   
  // --- Initialization ---

    const rescanInstalledMods = async () => {
        if (!beamUserPath) {
            console.log("[RESCAN] No beamUserPath, skipping");
            return;
        }

        console.log("[RESCAN] ===== STARTING RESCAN =====");
        console.log("[RESCAN] Current manifest:", manifest);

        try {
            // 1. Load current manifest from the per-user appdata folder
            let currentManifest: ModManifest = {};
            try {
                const manifestPath = manifestFilePath;
                if (!manifestPath) {
                    throw new Error("manifestFilePath not set");
                }
                console.log("[RESCAN] Loading manifest from:", manifestPath);
                const content = await invoke<string>("read_manifest", { path: manifestPath });
                currentManifest = JSON.parse(content);
                console.log("[RESCAN] Loaded manifest:", currentManifest);
            } catch (e) {
                console.log("[RESCAN] No manifest found during rescan.");
            }

            // 2. Scan directory for actual files
            const files = await invoke<string[]>("scan_mods_folder", { path: beamUserPath });
            console.log("[RESCAN] Found files on disk:", files);

            // 3. Remove manifest entries for files that no longer exist
            const updatedManifest = { ...currentManifest };
            let changes = false;

            // Remove entries where file doesn't exist anymore
            Object.keys(updatedManifest).forEach(modId => {
                const filename = updatedManifest[modId].filename;
                if (!files.includes(filename)) {
                    console.log(`[RESCAN] Removing ${modId} - file ${filename} no longer exists`);
                    delete updatedManifest[modId];
                    changes = true;
                }
            });

            // Extract version helper (same as in init)
            const extractVersion = (fname: string) => {
                const name = fname.replace(/\.zip$/i, "");
                // Hotfix pattern: e.g. rls_career_overhaul_2.6.2_hotfix
                const hotfixMatch = name.match(/_(\d+(?:\.\d+)+_hotfix)\s*$/i);
                if (hotfixMatch) return hotfixMatch[1];

                const complexMatch = name.match(/_(\d+\.\d+(?:[._-](?:beta|alpha|rc)?[._-]?\d+)?)\s*$/i);
                if (complexMatch) return complexMatch[1].replace(/_/g, ".");
                const vMatch = name.match(/v(\d+(?:[._-]\d+)*)/i);
                if (vMatch) return vMatch[1];
                const semVerMatch = name.match(/(\d+\.\d+(?:[._]\d+)*)$/);
                if (semVerMatch) return semVerMatch[0];
                const phaseMatch = name.match(/(beta|alpha|rc)[_-]?(\d+)/i);
                if (phaseMatch) return `${phaseMatch[1]} ${phaseMatch[2]}`;
                const dateMatch = name.match(/([a-zA-Z]+_\d{1,2}_\d{4})/);
                if (dateMatch) return dateMatch[0];
                const parts = name.split(/[_-]/);
                const lastPart = parts[parts.length - 1];
                if (/\d/.test(lastPart) && lastPart.length < 15) return lastPart;
                return null;
            };

            // Add entries for new files
            files.forEach(filename => {
                const existingModId = Object.keys(updatedManifest).find(
                    key => updatedManifest[key].filename === filename
                );
                
                if (!existingModId) {
                    // New file found - try to match to known mod or create new entry
                    const version = extractVersion(filename) || "Unknown";
                    
                    // Try to match with configured mods
                    const sortedMods = [...modsConfig].sort((a, b) => 
                        (b.assetPattern?.length || 0) - (a.assetPattern?.length || 0)
                    );
                    
                    let matchedMod = null;
                    for (const mod of sortedMods) {
                        if (mod.assetPattern) {
                            const regex = new RegExp(mod.assetPattern, 'i');
                            if (regex.test(filename)) {
                                matchedMod = mod;
                                break;
                            }
                        }
                    }
                    
                    const id = matchedMod ? matchedMod.id : filename;
                    console.log(`[RESCAN] Adding new file ${filename} as ${id}`);
                    
                    updatedManifest[id] = {
                        version: version,
                        filename: filename
                    };
                    changes = true;
                }
            });

            if (changes) {
                console.log("[RESCAN] ===== MANIFEST CHANGED =====");
                console.log("[RESCAN] Old manifest had", Object.keys(currentManifest).length, "entries");
                console.log("[RESCAN] New manifest has", Object.keys(updatedManifest).length, "entries");
                console.log("[RESCAN] Updated manifest:", updatedManifest);
                
                setManifest(updatedManifest);
                console.log("[RESCAN] Called setManifest with:", updatedManifest);
                
                // Save updated manifest into the per-user appdata folder
                if (manifestFilePath) {
                    await invoke("save_manifest", {
                        path: manifestFilePath,
                        content: JSON.stringify(updatedManifest, null, 2)
                    });
                    console.log("[RESCAN] Saved manifest to disk");
                } else {
                    console.error("[RESCAN] manifestFilePath not set, cannot save manifest");
                }
            } else {
                console.log("[RESCAN] No changes detected - manifest is up to date");
                console.log("[RESCAN] Current manifest:", currentManifest);
            }
            console.log("[RESCAN] ===== RESCAN COMPLETE =====");
        } catch (err) {
            console.error("[RESCAN] Error during rescan:", err);
        }
    };

    async function init() {
      console.error("========== INIT STARTING ==========");
      console.log("Init function called at:", new Date().toISOString());
      try {
        // 0. Load backend config only for remote mods.json URL (no Patreon auth)
        let remoteMogsJsonUrl = "";
        try {
            const config = await invoke<BackendConfig>("get_patreon_config");
            console.log("Loaded config from backend:", config);
            if (config.remote_mods_json_url) {
                remoteMogsJsonUrl = config.remote_mods_json_url;
            }
        } catch (e) {
            console.warn("Failed to load backend config, using defaults:", e);
        }
        
        // 1. Load mod catalog from remote URL (updatable without app rebuild)
        // NOTE: With creator token, this is only used as fallback if API fetch fails
        let staticCatalog: ModConfig[] = [];
        try {
            // Try remote first, fallback to bundled
            let response;
            try {
                if (remoteMogsJsonUrl) {
                    response = await fetch(remoteMogsJsonUrl);
                    console.log(`Loaded mods from remote: ${remoteMogsJsonUrl}`);
                } else {
                    throw new Error("No remote URL configured");
                }
            } catch (e) {
                console.warn("Failed to load remote mods.json, using bundled fallback:", e);
                response = await fetch('/mods.json');
            }
            staticCatalog = await response.json();
            console.log(`Loaded ${staticCatalog.length} mods from catalog (fallback only)`);
        } catch (e) {
            console.error("Failed to load mods.json:", e);
        }


        const loadedConfig: ModConfig[] = staticCatalog;
        setModsConfig(staticCatalog);
        
        const path = await invoke<string>("detect_beamng_user_path");
        setBeamUserPath(path);

        // Per-user manifest path in RLS Installer app data
        let userManifestPath: string | null = null;
        try {
            userManifestPath = await invoke<string>("get_manifest_path");
            setManifestFilePath(userManifestPath);
        } catch (e) {
            console.error("Failed to resolve per-user manifest path:", e);
        }
        
        // Ensure status reflects we are done initializing (Errors are now in Toasts)
        setStatus("Ready");
        
        // 1. Load Manifests
        let currentManifest: ModManifest = {};

        if (userManifestPath) {
            try {
                const content = await invoke<string>("read_manifest", { path: userManifestPath });
                currentManifest = JSON.parse(content);
            } catch (e) {
                console.log("No manifest found or error reading it.");
            }
        }

        // 2. Scan Directory for Zip files to find unmanaged mods
        try {
            const files = await invoke<string[]>("scan_mods_folder", { path });
            console.log("Scanned files:", files);

            // Reconcile with manifest
            const updatedManifest = { ...currentManifest };
            let changes = false;

            const extractVersion = (fname: string) => {
                const name = fname.replace(/\.zip$/i, "");
                
                // 0. Hotfix pattern: e.g. rls_career_overhaul_2.6.2_hotfix
                const hotfixMatch = name.match(/_(\d+(?:\.\d+)+_hotfix)\s*$/i);
                if (hotfixMatch) return hotfixMatch[1];
                
                // 1. Complex Version ending (e.g., 2.0_beta_2)
                const complexMatch = name.match(/_(\d+\.\d+(?:[._-](?:beta|alpha|rc)?[._-]?\d+)?)\s*$/i);
                if (complexMatch) return complexMatch[1].replace(/_/g, ".");

                // 2. Explicit version pattern vX.X.X (capture only numbers/dots/dashes)
                const vMatch = name.match(/v(\d+(?:[._-]\d+)*)/i);
                if (vMatch) return vMatch[1]; 


                // 2. Standard SemVer-ish pattern X.X.X (at least one dot)
                const semVerMatch = name.match(/(\d+\.\d+(?:[._]\d+)*)$/);
                if (semVerMatch) return semVerMatch[0];

                // 3. Beta/Alpha pattern (e.g. beta_5)
                const phaseMatch = name.match(/(beta|alpha|rc)[_-]?(\d+)/i);
                if (phaseMatch) return `${phaseMatch[1]}_${phaseMatch[2]}`;

                // 4. Date pattern like Jan_12_2026
                const dateMatch = name.match(/([a-zA-Z]+_\d{1,2}_\d{4})/);
                if (dateMatch) return dateMatch[0];

                // 5. Fallback: Last segment matches digits
                const parts = name.split(/[_-]/);
                const lastPart = parts[parts.length - 1];
                if (/\d/.test(lastPart) && lastPart.length < 15) {
                    return lastPart;
                }
                
                return null;
            }

            files.forEach(filename => {
                const version = extractVersion(filename) || "Unknown";
                console.log(`[VERSION EXTRACTION] File: ${filename} -> Version: ${version}`);
                
                // Check if this file is already associated with a Mod ID in the manifest
                const existingModId = Object.keys(updatedManifest).find(key => updatedManifest[key].filename === filename);

                // Helper to score version quality (higher is better)
                const getVersionScore = (v: string) => {
                    if (v === "Unknown") return 0;
                    if (v.includes(".")) return 3; // SemVer
                    if (v.toLowerCase().includes("beta") || v.toLowerCase().includes("alpha")) return 2; // Clearly marked phase
                    if (/\d{4}/.test(v)) return 2; // Date likely
                    return 1; // Just a number
                };

                if (existingModId) {
                     const entry = updatedManifest[existingModId];
                     
                     // Always update version from filename - filename is source of truth
                     if (entry.version !== version) {
                         updatedManifest[existingModId] = {
                             ...entry,
                             version: version
                         };
                         changes = true;
                     }
                } else {
                     // New file found.
                     // Try to match with known configuration
                     // Use the locally loaded 'loadedConfig' variable which is fresh
                     // Sort by pattern specificity - more specific patterns (longer) first
                     const sortedConfig = [...loadedConfig].sort((a, b) => {
                         const aLen = a.assetPattern?.length || 0;
                         const bLen = b.assetPattern?.length || 0;
                         return bLen - aLen; // Longer patterns first
                     });
                     
                     const matchedMod = sortedConfig.find(mod => {
                        if (mod.assetPattern) {
                            try {
                                const matches = new RegExp(mod.assetPattern, 'i').test(filename);
                                console.log(`[MOD MATCHING] Testing ${filename} against ${mod.id} pattern ${mod.assetPattern}: ${matches}`);
                                return matches;
                            } catch (e) {
                                console.error(`Invalid regex for mod ${mod.id}:`, e);
                                return false; 
                            }
                        }
                        // Fallback to simple inclusion if no pattern
                        const matches = filename.toLowerCase().includes(mod.id.toLowerCase().replace("rls_", ""));
                        console.log(`[MOD MATCHING] Testing ${filename} against ${mod.id} by name inclusion: ${matches}`);
                        return matches;
                     }); 
                     
                     const id = matchedMod ? matchedMod.id : filename;
                     console.log(`[MOD ID ASSIGNMENT] File ${filename} -> Mod ID: ${id}, Version: ${version}`);

                     if (updatedManifest[id]) {
                         const currentVersion = updatedManifest[id].version;
                         const currentFilename = updatedManifest[id].filename;
                         const currentScore = getVersionScore(currentVersion);
                         const newScore = getVersionScore(version);
                         
                         if (currentFilename !== filename) {
                             if (newScore >= currentScore) {
                                updatedManifest[id] = {
                                    version: version,
                                    filename: filename
                                };
                                changes = true;
                             }
                         }
                     } else {
                        updatedManifest[id] = {
                            version: version,
                            filename: filename
                        };
                        changes = true;
                     }
                }
            });

            if (changes) {
                console.log("Updated manifest from scan:", updatedManifest);
                setManifest(updatedManifest);
            } else {
                setManifest(currentManifest);
            }

        } catch (e) {
            console.error("Error scanning folder:", e);
            setManifest(currentManifest);
        }

      } catch (err) {
        console.error(err);
        addToast(`Error initializing: ${err}`, 'error');
        setStatus("Initialization Failed");
      }
    }

    useEffect(() => {
        init();
    }, []);

    // Listen for backend download progress events and update per-mod progress state
    useEffect(() => {
        const setup = async () => {
            const unlisten = await listen<DownloadProgressEventPayload>("download_progress", (event) => {
                const payload = event.payload;
                const modId = payload.mod_id;
                const pct = payload.progress;
                if (!modId || pct === undefined || pct === null) return;

                setDownloadProgress((prev) => {
                    const name = modsConfig.find((m) => m.id === modId)?.name || modId;
                    return { ...prev, [modId]: { percent: pct, name } };
                });

                if (pct >= 100) {
                    // Let it linger briefly, then remove
                    setTimeout(() => {
                        setDownloadProgress((prev) => {
                            const next = { ...prev };
                            delete next[modId];
                            return next;
                        });
                    }, 1000);
                }
            });

            return unlisten;
        };

        let unlistenFn: (() => void) | undefined;
        setup().then((fn) => {
            unlistenFn = fn;
        });

        return () => {
            if (unlistenFn) unlistenFn();
        };
    }, [modsConfig]);

  // Rescan installed mods when switching to Installed tab
  useEffect(() => {
    console.log("[EFFECT] Active tab changed to:", activeTab, "beamUserPath:", beamUserPath);
    if (activeTab === 'library' && beamUserPath) {
      console.log("[EFFECT] Triggering rescan...");
      rescanInstalledMods();
    }
  }, [activeTab, beamUserPath]);

  const refreshModsJsonCatalog = async () => {
    try {
      setStatus("Refreshing mod catalog...");
      let updatedCatalog: ModConfig[] = [];

      // First, try to load from local repo (for development/testing)
      try {
        const localResponse = await fetch('/mods.json');
        if (localResponse.ok) {
          updatedCatalog = await localResponse.json();
          console.log(`Loaded ${updatedCatalog.length} mods from local mods.json`);
          setModsConfig(updatedCatalog);
          return updatedCatalog;
        }
      } catch (e) {
        console.warn("Failed to load local mods.json, trying GitHub...", e);
      }

      // Fall back to GitHub remote mods.json for released versions
      try {
        // Try to get URL from backend config, otherwise use a default GitHub URL
        let remoteMogsJsonUrl = "";
        try {
          const config = await invoke<BackendConfig>("get_patreon_config");
          if (config.remote_mods_json_url) {
            remoteMogsJsonUrl = config.remote_mods_json_url;
          }
        } catch (e) {
          console.warn("Failed to load backend config", e);
        }

        // If no URL from config, use default GitHub location
        if (!remoteMogsJsonUrl) {
          remoteMogsJsonUrl = "https://raw.githubusercontent.com/RLS-Modding/rls-installer/main/public/mods.json";
        }

        const remoteResponse = await fetch(remoteMogsJsonUrl);
        if (remoteResponse.ok) {
          updatedCatalog = await remoteResponse.json();
          console.log(`Loaded ${updatedCatalog.length} mods from remote: ${remoteMogsJsonUrl}`);
          setModsConfig(updatedCatalog);
          return updatedCatalog;
        } else {
          throw new Error(`Failed to fetch remote mods.json: ${remoteResponse.status}`);
        }
      } catch (e) {
        console.error("Failed to load remote mods.json from GitHub:", e);
        addToast("Failed to refresh mod catalog. Using cached version.", 'error');
        return modsConfig;
      }
    } catch (e) {
      console.error("Error refreshing mods catalog:", e);
      addToast("Error refreshing mod catalog.", 'error');
      return modsConfig;
    }
  };

  const detectUpdates = async (options?: { includeUninstalled?: boolean; silent?: boolean }) => {
    // Refresh the mods.json catalog first before checking for updates
    const updatedCatalog = await refreshModsJsonCatalog();

    const includeUninstalled = options?.includeUninstalled ?? false;
    const silent = options?.silent ?? false;

    setStatus("Checking for updates...");
    console.log("Detecting updates..."); // Debug log
    const newUpdates: UpdateInfo[] = [];

    // Use the refreshed mods catalog
    for (const mod of updatedCatalog) {
      if (mod.githubRepo) {
        try {
            const ghResponse = await fetch(`https://api.github.com/repos/${mod.githubRepo}/releases/latest`);
            if (ghResponse.ok) {
                const ghData = await ghResponse.json();
                const ghVersion = ghData.tag_name; 
                const installed = getInstalledForMod(mod);
                
                if (includeUninstalled) {
                    // Card-level "Get Mod" can treat non-installed mods as available.
                    if (!installed || isNewerVersion(ghVersion, installed.version)) {
                        newUpdates.push({
                            modId: mod.id,
                            newVersion: ghVersion,
                            downloadUrl: ghData.assets[0]?.browser_download_url
                        });
                    }
                } else {
                    // Global checks only care about already-installed mods being out of date.
                    if (installed && isNewerVersion(ghVersion, installed.version)) {
                        newUpdates.push({
                            modId: mod.id,
                            newVersion: ghVersion,
                            downloadUrl: ghData.assets[0]?.browser_download_url
                        });
                    }
                }
            }
        } catch (e) {
            console.error(`GitHub check failed for ${mod.name}`, e);
            // Don't toast per mod failure, it's noisy. 
        }
      } else if (mod.version && mod.directDownload) {
          // Handle generic public direct-link mods (e.g., GitHub assets, public file hosts)
          const installedData = getInstalledForMod(mod);
          const installedVersion = installedData?.version || "0.0.0";

          if (includeUninstalled) {
              // Card-level checks may install even if not yet present.
              if (!installedData || isNewerVersion(mod.version, installedVersion)) {
                  newUpdates.push({
                      modId: mod.id,
                      newVersion: mod.version,
                      downloadUrl: mod.directDownload
                  });
              }
          } else {
              // Global checks only signal updates for already-installed mods.
              if (installedData && isNewerVersion(mod.version, installedVersion)) {
                  newUpdates.push({
                      modId: mod.id,
                      newVersion: mod.version,
                      downloadUrl: mod.directDownload
                  });
              }
          }
      }
    }

    setUpdates(newUpdates);

    if (!silent) {
        const installedOutdatedCount = newUpdates.filter(u => !!manifest[u.modId]).length;
        if (installedOutdatedCount > 0) {
            addToast(`Found ${installedOutdatedCount} updates.`, 'success');
            setStatus("Updates Available");
        } else {
            setStatus("Ready"); // Just reset status
            addToast("All mods up to date.", 'success'); 
        }
    } else {
        // Silent check: just reset status when done
        setStatus("Ready");
    }
  };

  const installMod = async (update: UpdateInfo) => {
      if (!beamUserPath) {
          addToast("Error: BeamNG detected path is missing.", 'error');
          return;
      }
      const modConfig = modsConfig.find(m => m.id === update.modId);
      if (!modConfig) return;

      setInstallingMods(prev => ({ ...prev, [modConfig.id]: true }));
      setStatus(`Downloading ${modConfig.name}...`);

      try {
                    // Remove any existing installed file for this mod from the manifest
                    const currentInstall = manifest[update.modId];
                    if (currentInstall) {
                        const oldPath = `${beamUserPath}\\${currentInstall.filename}`;
                        await invoke("delete_old_mod", { filePath: oldPath });
                    }

                    // Additionally, remove any other zip files in the mods folder that match this mod's assetPattern
                    // to avoid multiple versions of the same mod conflicting.
                    if (modConfig.assetPattern) {
                        try {
                            const files = await invoke<string[]>("scan_mods_folder", { path: beamUserPath });
                            const regex = new RegExp(modConfig.assetPattern, 'i');
                            for (const file of files) {
                                    if (regex.test(file)) {
                                            const fullPath = `${beamUserPath}\\${file}`;
                                            await invoke("delete_old_mod", { filePath: fullPath });
                                    }
                            }
                        } catch (e) {
                            console.error("Failed to clean up old versions for", modConfig.id, e);
                        }
                    }

          // Initial guess for filename/path; backend may override this
          // to match the original filename from the server.
          let finalFilename: string;
          let finalPath: string;

          {
              const urlParts = update.downloadUrl.split('/');
              const guessedName = urlParts[urlParts.length - 1] || `${modConfig.id}_${update.newVersion || "latest"}.zip`;
              finalFilename = guessedName.replace(/[<>:"/\\|?*]/g, "_");
              finalPath = `${beamUserPath}\\${finalFilename}`;

              const result = await invoke<string>("download_mod", { 
                  url: update.downloadUrl, 
                  targetPath: finalPath,
                  modId: update.modId
              });

              // Try to use the real filename returned by the backend
              try {
                  const parsed = JSON.parse(result ?? "") as { path?: string; filename?: string };
                  if (parsed && parsed.filename) {
                      finalFilename = parsed.filename;
                  }
              } catch {
                  // Ignore parse errors and keep the guessed filename
              }
          }

          const newManifest = {
              ...manifest,
              [update.modId]: {
                  version: update.newVersion,
                  filename: finalFilename
              }
          };
          
          setManifest(newManifest);
          if (manifestFilePath) {
              await invoke("save_manifest", { 
                  path: manifestFilePath, 
                  content: JSON.stringify(newManifest, null, 2) 
              });
          } else {
              console.error("[INSTALL] manifestFilePath not set, cannot save manifest");
          }

          setUpdates(prev => prev.filter(u => u.modId !== update.modId));
          addToast(`Installed ${modConfig.name}`, 'success');
          setStatus("Ready");
          
          // Rescan to update installed mods list
          await rescanInstalledMods();
      } catch (err) {
          const message = String(err ?? 'Unknown error');
          {
              addToast(`Failed: ${message}`, 'error');
          }
          setStatus("Ready");
      } finally {
          setInstallingMods(prev => {
              const next = { ...prev };
              delete next[modConfig.id];
              return next;
          });
      }
  };

  const copyModList = async () => {
      try {
        // Get repo mods
        const repoPath = `${beamUserPath}\\repo`;
        let repoFiles: string[] = [];
        try {
            repoFiles = await invoke<string[]>("scan_mods_folder", { path: repoPath });
        } catch (e) {
            console.log("Repo folder not found or empty");
        }

        const lines = [];
        
        // 1. Core / Managed / Manually Installed Mods
        lines.push("[Non-Repo Mods]");
        Object.entries(manifest).forEach(([, mod]) => {
             lines.push(mod.filename);
        });

        // 2. Repo Mods
        lines.push("\n[Repo Mods]");
        repoFiles.forEach(f => lines.push(f));

        const text = lines.join("\n");
        
        await navigator.clipboard.writeText(text);
        addToast("Mod list copied to clipboard!", 'success');
      } catch (err) {
        addToast(`Failed to copy list: ${err}`, 'error');
      }
  };

  const confirmDeleteInstalledMod = async () => {
      if (!beamUserPath || !pendingDelete) {
          setPendingDelete(null);
          if (!beamUserPath) {
              addToast("Error: BeamNG detected path is missing.", 'error');
          }
          return;
      }

      const { modId, filename } = pendingDelete;

      if (!beamUserPath) {
          addToast("Error: BeamNG detected path is missing.", 'error');
          return;
      }

      try {
          const fullPath = `${beamUserPath}\\${filename}`;
          await invoke("delete_old_mod", { filePath: fullPath });

          const newManifest: ModManifest = { ...manifest };
          delete newManifest[modId];
          setManifest(newManifest);

          if (manifestFilePath) {
              await invoke("save_manifest", {
                  path: manifestFilePath,
                  content: JSON.stringify(newManifest, null, 2)
              });
          } else {
              console.error("[DELETE] manifestFilePath not set, cannot save manifest");
          }

          addToast(`Removed ${filename}`, 'success');
          await rescanInstalledMods();
      } catch (err) {
          addToast(`Failed to remove mod: ${err}`, 'error');
      } finally {
          setPendingDelete(null);
      }
  };


  const selectFolder = async () => {
      try {
          const selected = await open({
              directory: true,
              multiple: false,
              title: "Select BeamNG Mods Folder",
          });
          
          if (selected && typeof selected === 'string') {
              setBeamUserPath(selected);
              addToast("Folder path updated", 'success');
              // Optionally re-scan the folder
              setTimeout(() => window.location.reload(), 500);
          }
      } catch (err) {
          console.error("Failed to select folder:", err);
          addToast(`Failed to select folder: ${err}`, 'error');
      }
  };
  return (
    <div className="flex h-screen bg-primary text-primary-text overflow-hidden selection:bg-accent-blue/30" onContextMenu={(e) => e.preventDefault()}>
            <Sidebar
                activeTab={activeTab}
                onChangeTab={setActiveTab}
                onOpenSettings={() => setShowSettingsPopover(true)}
            />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        
        <HeaderBar onCheckUpdates={() => detectUpdates({ includeUninstalled: false, silent: false })} />

        {/* Content Body */}
        <div className={cn("flex-1 p-8", activeTab === "library" ? "overflow-hidden" : "overflow-y-auto")}>
            
            <Notifications
              status={status}
              toasts={toasts}
              onRemoveToast={removeToast}
              downloadProgress={downloadProgress}
            />

            {activeTab === "browse" && (
              <BrowseView
                modsConfig={modsConfig}
                status={status}
                updates={updates}
                installingMods={installingMods}
                addToast={addToast}
                installMod={installMod}
                getInstalledForMod={getInstalledForMod}
                onRetryInit={() => {
                  setStatus("Retrying connection...");
                  init();
                }}
              />
            )}

            <SettingsPopover
              open={showSettingsPopover}
              beamUserPath={beamUserPath}
              onClose={() => setShowSettingsPopover(false)}
              onSelectFolder={selectFolder}
            />

            <DeleteConfirmation
              pendingDelete={pendingDelete}
              onCancel={() => setPendingDelete(null)}
              onConfirm={confirmDeleteInstalledMod}
            />
            
            {activeTab === "library" && (
              <InstalledModsTable
                manifest={manifest}
                onRequestDelete={(modId, filename) => setPendingDelete({ modId, filename })}
                onExportList={copyModList}
              />
            )}

        </div>
      </main>
    </div>
  );
}

export default App;

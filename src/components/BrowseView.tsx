import React from "react";
import { RefreshCw, LogOut } from "lucide-react";
import { cn } from "../utils/cn";
import type { ModConfig, UpdateInfo, InstalledMod, Toast } from "../types";
import { isNewerVersion } from "../utils/version";

interface BrowseViewProps {
  modsConfig: ModConfig[];
  status: string;
  updates: UpdateInfo[];
  installingMods: { [modId: string]: boolean };
  addToast: (message: string, type?: Toast["type"]) => void;
  installMod: (update: UpdateInfo) => void;
  getInstalledForMod: (mod: ModConfig) => InstalledMod | null;
  onRetryInit: () => void;
}

export function BrowseView({
  modsConfig,
  status,
  updates,
  installingMods,
  addToast,
  installMod,
  getInstalledForMod,
  onRetryInit,
}: BrowseViewProps) {
  if (modsConfig.length === 0) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
        <h2 className="text-3xl font-bold mb-6 flex-shrink-0">Featured Mods</h2>
        <div className="flex flex-col items-center justify-center h-64 text-primary-text border border-dashed border-secondary rounded-xl text-secondary-text/20">
          {status.includes("Error") || status.includes("Failed") ? (
            <>
              <LogOut size={48} className="mb-4 text-error opacity-50" />
              <p className="text-lg font-medium">Unable to load mods</p>
              <p className="text-sm opacity-70 mb-4">Check your internet connection</p>
              <button
                onClick={onRetryInit}
                className="px-4 py-2 bg-secondary hover:bg-primary rounded transition flex items-center gap-2"
              >
                <RefreshCw size={16} /> Retry Connection
              </button>
            </>
          ) : (
            <>
              <RefreshCw size={48} className="mb-4 animate-spin opacity-50 text-accent" />
              <p>Loading catalog...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const getBadges = (mod: ModConfig) => {
    const badges: React.ReactNode[] = [];

    const category =
      mod.category ||
      (mod.id.includes("_career_") &&
      (mod.id.includes("italy") ||
        mod.id.includes("utah") ||
        mod.id.includes("hirochi") ||
        mod.id.includes("pepper") ||
        mod.id.includes("river") ||
        mod.id.includes("gap") ||
        mod.id.includes("west_coast"))
        ? "map"
        : mod.id.includes("bruckell") || mod.id.includes("vehicle")
        ? "vehicle"
        : mod.id === "rls_career" || mod.id.includes("career_overhaul")
        ? "core"
        : null);

    if (category) {
      const categoryStyles: Record<NonNullable<ModConfig["category"]>, { label: string; bg: string; text: string; border: string }> = {
        core: { label: "Core", bg: "bg-accent/20", text: "", border: "border-accent/30" },
        map: { label: "Map", bg: "bg-success/20", text: "", border: "border-success/30" },
        vehicle: { label: "Vehicle", bg: "bg-warning/20", text: "", border: "border-warning/30" },
      };
      const style = categoryStyles[category as NonNullable<ModConfig["category"]>];
      badges.push(
        <span
          key="category"
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}
        >
          {style.label}
        </span>
      );
    }

    if (mod.state === "Beta") {
      badges.push(
        <span
          key="state"
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-error/20 border-error/30"
        >
          Beta
        </span>
      );
    }

    return badges;
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
      <h2 className="text-3xl font-bold mb-6 flex-shrink-0">Featured Mods</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-6">
        {modsConfig.map((mod) => {
          const installed = getInstalledForMod(mod);
          let update = updates.find((u) => u.modId === mod.id);
          const isInstalling = !!installingMods[mod.id];

          if (installed && mod.version && !update) {
            if (isNewerVersion(mod.version, installed.version)) {
              update = {
                modId: mod.id,
                newVersion: mod.version,
                downloadUrl: mod.directDownload || "",
              };
            }
          }

          const handleClick = () => {
            if (isInstalling) return;
            if (installed && !update) return;

            if (update) {
              installMod(update);
              return;
            }

            const directUrl = mod.directDownload || "";
            if (!directUrl) {
              addToast(`No download URL configured for ${mod.name}.`, "error");
              return;
            }

            const newUpdate: UpdateInfo = {
              modId: mod.id,
              newVersion: mod.version || "Unknown",
              downloadUrl: directUrl,
            };

            installMod(newUpdate);
          };

          return (
            <div
              key={mod.id}
              className="relative group rounded-2xl overflow-visible border-2 border-primary-text/25 hover:border-accent transition-all duration-500 hover:shadow-xl hover:shadow-secondary/25 flex flex-col h-[225px] z-[1] hover:z-10"
            >
              <div className="absolute inset-0 text-secondary-text overflow-hidden rounded-2xl">
                <img
                  src={mod.imageUrl}
                  alt={mod.name}
                  className="w-full h-full object-cover group-hover:opacity-100 transition-all duration-500"
                />
                <div className="absolute opacity-80 inset-0 bg-gradient-to-b from-secondary/60 via-secondary/80 to-secondary" />
              </div>

              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-wrap gap-1.5 justify-center z-10">
                {getBadges(mod)}
              </div>

              <div className="relative flex flex-col items-center justify-center flex-1 gap-2 text-center px-5 pb-5 z-10">
                <h3 className="font-bold text-xl  group-hover:text-secondary-text transition-colors">{mod.name}</h3>
              </div>

              {installed && (
                <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-[200%] group-hover:-translate-y-5 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out z-20">
                  <div className="text-xs bg-success/20 backdrop-blur-sm px-2 py-1 rounded border border-success/30">
                    {installed.version}
                  </div>
                </div>
              )}

              <div className="absolute left-1/2 bottom-0 w-3/5 -translate-x-1/2 translate-y-[125%] group-hover:translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out z-20">
                <button
                  onClick={handleClick}
                  disabled={isInstalling || !!(installed && !update)}
                  className={cn(
                    "w-full px-4 py-2 rounded-xl text-sm font-medium transition shadow-lg",
                    isInstalling
                      ? "border-success border-2 bg-secondary/90 cursor-wait"
                      : installed && !update
                      ? "border-accent border-2 bg-secondary/90 cursor-default"
                      : "border-accent border-2 bg-accent/90 hover:bg-accent hover:text-secondary-text"
                  )}
                >
                  {isInstalling
                    ? "Installing..."
                    : installed && !update
                    ? "Installed"
                    : update
                    ? installed
                      ? "Update"
                      : "Install"
                    : "Install"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

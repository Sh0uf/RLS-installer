import { Library, Trash2 } from "lucide-react";
import type { ModManifest } from "../types";

interface InstalledModsTableProps {
  manifest: ModManifest;
  onRequestDelete: (modId: string, filename: string) => void;
  onExportList: () => void;
}

export function InstalledModsTable({ manifest, onRequestDelete, onExportList }: InstalledModsTableProps) {
  const entries = Object.entries(manifest);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Installed Mods</h2>
      </div>
      <div className="bg-secondary rounded-xl flex flex-col max-h-[75vh] overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left">
            <tbody className="divide-y divide-secondary/30">
              {entries.map(([modId, data]) => (
                <tr key={modId} className="group hover:text-secondary-text transition-colors">
                  <td className="px-6 py-4 font-medium ">{data.filename}</td>
                  <td className="px-4 py-4 text-right align-middle w-12">
                    <button
                      onClick={() => onRequestDelete(modId, data.filename)}
                      className="opacity-0 group-hover:opacity-100 transition text-primary-text hover:text-error"
                      title="Remove mod"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td className="px-6 py-12 text-center text-primary-text">
                    No mods installed. Go to RLS Studio to add some!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center px-6 py-2 bg-secondary border-t border-secondary/30 text-sm">
          <span>
            {entries.length} non-repo mod{entries.length !== 1 ? "s" : ""} installed
          </span>
          <button
            onClick={onExportList}
            className="hover:text-secondary-text px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
          >
            <Library size={16} />
            Export List
          </button>
        </div>
      </div>
    </div>
  );
}

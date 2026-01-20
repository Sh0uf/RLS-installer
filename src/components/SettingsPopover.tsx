import { X, Folder } from "lucide-react";

interface SettingsPopoverProps {
  open: boolean;
  beamUserPath: string;
  onClose: () => void;
  onSelectFolder: () => void;
}

export function SettingsPopover({ open, beamUserPath, onClose, onSelectFolder }: SettingsPopoverProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-primary/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-secondary/50 backdrop-blur rounded-xl border border-secondary shadow-2xl max-w-2xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-secondary/30">
          <h2 className="text-xl font-bold">Settings</h2>
          <button onClick={onClose} className="hover:text-secondary-text transition">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <div>
            <label className="block text-sm font-medium mx-2.5">Path to BeamNG Mods folder</label>
            <div className="flex justify-between items-center">
              <input
                type="text"
                value={beamUserPath}
                readOnly
                className="flex-1 text-primary-text/80 px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={onSelectFolder}
                className="hover:text-primary-text px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
              >
                <Folder size={16} className="inline-block mr-2" />
                Change
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

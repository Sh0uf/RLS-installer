import { Minus, Square, X, RefreshCw } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface HeaderBarProps {
  onCheckUpdates: () => void;
}

export function HeaderBar({ onCheckUpdates }: HeaderBarProps) {
  return (
    <header
      data-tauri-drag-region
      className="h-10 flex items-center justify-end p-4 backdrop-blur-sm select-none"
    >
      <div className="flex items-center gap-4 flex-shrink-0">
        <button
          onClick={onCheckUpdates}
          className="p-2 rounded-full hover:text-accent transition"
          title="Check for Updates"
        >
          <RefreshCw size={20} />
        </button>

        <div className="flex items-center gap-1 ml-2 pl-4">
          <button
            onClick={() => getCurrentWindow().minimize()}
            className="p-2 rounded-lg hover:text-accent hover:font-bold transition"
          >
            <Minus size={18} />
          </button>
          <button
            onClick={() => getCurrentWindow().toggleMaximize()}
            className="p-2 rounded-lg hover:text-accent hover:font-bold transition"
          >
            <Square size={16} />
          </button>
          <button
            onClick={() => getCurrentWindow().close()}
            className="p-2 rounded-lg hover:text-error hover:font-bold transition"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}

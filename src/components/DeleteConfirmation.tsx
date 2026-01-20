import { Trash2 } from "lucide-react";

interface PendingDelete {
  modId: string;
  filename: string;
}

interface DeleteConfirmationProps {
  pendingDelete: PendingDelete | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmation({ pendingDelete, onCancel, onConfirm }: DeleteConfirmationProps) {
  if (!pendingDelete) return null;

  return (
    <div className="fixed inset-0 bg-primary/50 z-50 flex items-center justify-center" onClick={onCancel}>
      <div
        className="bg-secondary/50 backdrop-blur rounded-xl border border-secondary shadow-2xl max-w-xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-bold">Are you sure you want to delete this mod file?</h2>
          <div className="py-2 text-xl text-error font-mono break-all">{pendingDelete.filename}</div>
          <p className="text-xs">
            This will remove the file from your BeamNG mods folder. <span className="text-error font-semibold">This action cannot be undone.</span>
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onConfirm}
              className="text-primary-text hover:text-error px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
            >
              <Trash2 size={16} />
              Yes
            </button>
            <button
              onClick={onCancel}
              className="hover:text-secondary-text px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
            >
              No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

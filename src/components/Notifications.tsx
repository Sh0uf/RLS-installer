import { AlertCircle, CheckCircle, Info } from "lucide-react";
import { cn } from "../utils/cn";
import type { Toast, DownloadProgressMap } from "../types";

interface NotificationsProps {
  status: string;
  toasts: Toast[];
  onRemoveToast: (id: number) => void;
  downloadProgress: DownloadProgressMap;
}

export function Notifications({ status, toasts, downloadProgress }: NotificationsProps) {
  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {Object.entries(downloadProgress).map(([modId, info]) => (
        <div
          key={modId}
          className="pointer-events-auto max-w-sm w-full bg-secondary border border-accent/60 shadow-xl rounded-lg px-4 py-3 flex flex-col gap-2 animate-in slide-in-from-bottom-2 fade-in"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate">Downloading {info.name}</span>
            <span className="text-xs ml-2">{info.percent}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full text-secondary-text overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${Math.min(Math.max(info.percent, 0), 100)}%` }}
            />
          </div>
        </div>
      ))}

      {status.includes("Error") && !status.includes("Failed") && (
        <div className="bg-secondary border border-secondary shadow-xl rounded-lg px-4 py-3 flex items-center gap-3 pointer-events-auto animate-in fade-in slide-in-from-bottom-4">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-sm">{status}</span>
        </div>
      )}

      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto max-w-sm w-full bg-secondary border shadow-xl rounded-lg px-4 py-3 flex items-start gap-3 animate-in slide-in-from-bottom-2 fade-in",
            toast.type === "error"
              ? "border-error/50"
              : toast.type === "success"
              ? "border-success/50"
              : "border-secondary"
          )}
        >
          {toast.type === "error" && <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />}
          {toast.type === "success" && <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />}
          {toast.type === "info" && <Info className="w-5 h-5 text-accent flex-shrink-0" />}

          <div className="flex-1 text-sm break-words">{toast.message}</div>
        </div>
      ))}
    </div>
  );
}

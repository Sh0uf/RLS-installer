import { LayoutGrid, Library, Settings } from "lucide-react";
import { cn } from "../utils/cn.ts";
import type { TabId } from "../types";

interface SidebarProps {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
  onOpenSettings: () => void;
}

interface SidebarItemProps {
  icon: any;
  label: string;
  id: TabId;
  activeTab: TabId;
  onClick: () => void;
}

const SidebarItem = ({ icon: Icon, label, id, activeTab, onClick }: SidebarItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200",
      activeTab === id
        ? "bg-accent/20 text-secondary-text border-l-4 border-accent"
        : "backdrop-blur-md hover:text-secondary-text"
    )}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

export function Sidebar({ activeTab, onChangeTab, onOpenSettings }: SidebarProps) {
  return (
    <aside className="w-64 bg-secondary border-r border-secondary/30 flex flex-col">
      <div className="m-6 border-b border-secondary/30">
        <img
          src="./imgs/rls-installer.png"
          alt="RLS Installer Logo"
          className="w-full h-16 object-contain align-center p-2"
        />
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <SidebarItem
          icon={LayoutGrid}
          label="RLS Studios"
          id="browse"
          activeTab={activeTab}
          onClick={() => onChangeTab("browse")}
        />
        <SidebarItem
          icon={Library}
          label="Installed Mods"
          id="library"
          activeTab={activeTab}
          onClick={() => onChangeTab("library")}
        />
      </nav>

      <div className="p-4 flex justify-center">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:text-secondary-text transition"
        >
          <Settings size={18} />
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
}

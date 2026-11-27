import { Bookmark, Map, Settings } from "lucide-react";

export type AppTab = "map" | "saved" | "settings";

type BottomNavProps = {
  tab: AppTab;
  onChange: (tab: AppTab) => void;
};

const ITEMS: readonly { id: AppTab; label: string; icon: typeof Map }[] = [
  { id: "map", label: "地図", icon: Map },
  { id: "saved", label: "保存済み", icon: Bookmark },
  { id: "settings", label: "設定", icon: Settings },
];

export function BottomNav({ tab, onChange }: BottomNavProps) {
  return (
    <nav
      className="absolute inset-x-0 bottom-0 z-30 border-t border-[#e6e1d8] bg-white/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid h-16 grid-cols-3">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-base font-medium ${selected ? "text-brand" : "text-muted"}`}
            >
              <Icon size={22} strokeWidth={2.25} />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

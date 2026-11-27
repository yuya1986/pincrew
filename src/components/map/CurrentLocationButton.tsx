import { Locate } from "lucide-react";

type CurrentLocationButtonProps = {
  requesting: boolean;
  recovering: boolean;
  following: boolean;
  onLocate: () => void;
};

export function CurrentLocationButton({ requesting, recovering, following, onLocate }: CurrentLocationButtonProps) {
  const busy = requesting || recovering;
  return (
    <button
      type="button"
      onClick={onLocate}
      disabled={requesting}
      aria-pressed={following}
      aria-label={busy ? "現在地を取り直しています" : following ? "現在地を追尾中" : "現在地を追尾"}
      className={`absolute right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_24px_rgba(36,48,56,0.16)] transition active:scale-95 disabled:opacity-70 ${
        following ? "bg-brand text-white" : "bg-white text-brand"
      }`}
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 9.25rem)" }}
    >
      <Locate size={26} strokeWidth={2.25} className={busy ? "animate-pulse" : ""} />
    </button>
  );
}

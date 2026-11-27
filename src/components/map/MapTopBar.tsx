type MapTopBarProps = {
  count: number;
  ready: boolean;
  showAccount: boolean;
  signedIn: boolean;
  onOpenList: () => void;
  onOpenAccount: () => void;
};

export function MapTopBar({
  count,
  ready,
  showAccount,
  signedIn,
  onOpenList,
  onOpenAccount,
}: MapTopBarProps) {
  const label = ready ? `保存した場所 ${count}件` : "地図を読み込んでいます";

  return (
    <header
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <div className="flex items-center gap-2 rounded-full bg-white/95 py-1.5 pr-4 pl-1.5 shadow-[0_8px_24px_rgba(36,48,56,0.12)]">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand">
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        <span className="text-base font-bold tracking-wide">PinCrew</span>
      </div>
      <div className="flex items-center gap-2">
        {showAccount ? (
          <button
            type="button"
            onClick={onOpenAccount}
            className="pointer-events-auto min-h-11 rounded-full bg-white/95 px-4 text-base font-medium shadow-[0_8px_24px_rgba(36,48,56,0.12)]"
          >
            {signedIn ? "管理中" : "管理者"}
          </button>
        ) : null}
        {ready ? (
          <button
            type="button"
            onClick={onOpenList}
            aria-label={`${label}の一覧を開く`}
            className="pointer-events-auto min-h-11 rounded-full bg-white/95 px-4 text-base font-medium shadow-[0_8px_24px_rgba(36,48,56,0.12)]"
          >
            {count}件
          </button>
        ) : (
          <p
            aria-label={label}
            className="rounded-full bg-white/95 px-4 py-2 text-base font-medium shadow-[0_8px_24px_rgba(36,48,56,0.12)]"
          >
            読み込み中
          </p>
        )}
      </div>
    </header>
  );
}

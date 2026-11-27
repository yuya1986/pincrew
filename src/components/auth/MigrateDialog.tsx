type MigrateDialogProps = {
  count: number;
  busy: boolean;
  canMoveShared: boolean;
  canMovePersonal: boolean;
  onShared: () => void;
  onPersonal: () => void;
  onSkip: () => void;
};

export function MigrateDialog({
  count,
  busy,
  canMoveShared,
  canMovePersonal,
  onShared,
  onPersonal,
  onSkip,
}: MigrateDialogProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-[#243038]/40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="migrate-pins-title"
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(36,48,56,0.2)]"
      >
        <h2 id="migrate-pins-title" className="text-xl font-bold">
          この端末に保存している場所があります
        </h2>
        <p className="mt-3 text-base leading-7 text-muted">{count}件を、ログイン中のマップへ移せます。</p>
        <div className="mt-5 space-y-3">
          {canMoveShared ? (
            <button type="button" disabled={busy} onClick={onShared} className="h-12 w-full rounded-full bg-brand text-base font-bold text-white disabled:opacity-60">
              共有マップへ移す
            </button>
          ) : null}
          {canMovePersonal ? (
            <button type="button" disabled={busy} onClick={onPersonal} className="h-12 w-full rounded-full bg-[#f4f1ec] text-base font-bold disabled:opacity-60">
              マイマップへ移す
            </button>
          ) : null}
          <button type="button" disabled={busy} onClick={onSkip} className="h-12 w-full rounded-full text-base font-bold text-muted">
            今はしない
          </button>
        </div>
      </div>
    </div>
  );
}

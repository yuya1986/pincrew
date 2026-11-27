type SavePlaceButtonProps = {
  enabled: boolean;
  saving: boolean;
  onSave: () => void;
};

export function SavePlaceButton({ enabled, saving, onSave }: SavePlaceButtonProps) {
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={!enabled || saving}
      aria-busy={saving}
      className="pointer-events-auto h-14 w-full max-w-md rounded-full bg-brand text-lg font-bold text-white shadow-[0_10px_28px_rgba(227,106,74,0.35)] transition active:scale-[0.98] active:bg-brand-strong disabled:opacity-60"
    >
      ここを保存
    </button>
  );
}

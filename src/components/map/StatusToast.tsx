import type { StatusAction } from "@/hooks/use-status-message";

type StatusToastProps = {
  message: string | null;
  action: StatusAction | null;
  placement: "map" | "top";
  onDismiss: () => void;
  onHold: () => void;
  onRelease: () => void;
};

export function StatusToast({ message, action, placement, onDismiss, onHold, onRelease }: StatusToastProps) {
  if (!message) return null;

  const position =
    placement === "top"
      ? { top: "calc(env(safe-area-inset-top) + 0.75rem)" }
      : { bottom: "calc(env(safe-area-inset-bottom) + 10.75rem)" };

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute left-4 right-4 z-50 flex items-center justify-between gap-3 rounded-2xl bg-foreground px-4 py-3 text-base text-white shadow-lg"
      style={position}
    >
      <p>{message}</p>
      {action ? (
        <button
          type="button"
          className="shrink-0 rounded-full bg-white px-3 py-2 text-base font-bold text-foreground"
          onFocus={onHold}
          onBlur={onRelease}
          onClick={() => {
            const callback = action.onClick;
            onDismiss();
            callback();
          }}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

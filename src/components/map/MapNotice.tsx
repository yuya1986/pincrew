type MapNoticeProps = {
  message: string;
  onRetry?: () => void;
};

export function MapFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#efe8df] text-muted">
      <p className="text-base">地図を読み込んでいます</p>
    </div>
  );
}

export function MapNotice({ message, onRetry }: MapNoticeProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-24 bottom-40 z-20 flex items-center justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-3xl bg-white p-5 shadow-[0_12px_32px_rgba(36,48,56,0.12)]">
        <p className="text-base leading-7">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 h-12 w-full rounded-full bg-brand text-base font-bold text-white"
          >
            もう一度開く
          </button>
        ) : null}
      </div>
    </div>
  );
}

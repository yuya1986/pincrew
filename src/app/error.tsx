"use client";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ reset }: AppErrorProps) {
  return (
    <div className="flex h-dvh items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-[0_12px_32px_rgba(36,48,56,0.12)]">
        <p className="text-base font-bold">PinCrew</p>
        <h1 className="mt-2 text-xl font-bold">画面を表示できませんでした</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          通信状況を確認して、もう一度開いてください。
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 h-12 w-full rounded-full bg-brand text-base font-bold text-white"
        >
          もう一度開く
        </button>
      </div>
    </div>
  );
}

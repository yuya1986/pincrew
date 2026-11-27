type CrosshairProps = {
  pulseKey: number;
};

export function Crosshair({ pulseKey }: CrosshairProps) {
  return (
    <div
      key={pulseKey}
      className={`pointer-events-none drop-shadow-[0_2px_6px_rgba(36,48,56,0.28)] ${
        pulseKey > 0 ? "crosshair-pop" : ""
      }`}
      aria-hidden="true"
    >
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
        <path
          d="M36 8v12M36 52v12M8 36h12M52 36h12"
          stroke="#ffffff"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M36 8v12M36 52v12M8 36h12M52 36h12"
          stroke="var(--brand)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="36" cy="36" r="11" stroke="#ffffff" strokeWidth="6" />
        <circle cx="36" cy="36" r="11" stroke="var(--brand)" strokeWidth="2.5" />
        <circle cx="36" cy="36" r="3.5" fill="var(--brand)" stroke="#ffffff" strokeWidth="2" />
      </svg>
    </div>
  );
}

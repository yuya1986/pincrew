"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { searchPlaces, type PlaceHit } from "@/lib/geocode/places";

type SearchPhase = "idle" | "loading" | "results" | "empty" | "error";

type PlaceSearchProps = {
  onPick: (hit: PlaceHit) => void;
};

export function PlaceSearch({ onPick }: PlaceSearchProps) {
  const [text, setText] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [phase, setPhase] = useState<SearchPhase>("idle");
  const [retryNonce, setRetryNonce] = useState(0);
  const generation = useRef(0);
  const lockedText = useRef<string | null>(null);

  useEffect(() => {
    if (lockedText.current !== null && text === lockedText.current) return;
    lockedText.current = null;

    const query = text.trim();
    const requestId = generation.current + 1;
    generation.current = requestId;

    if (query.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (generation.current !== requestId) return;
      setPhase("loading");
      searchPlaces(query, controller.signal)
        .then((next) => {
          if (generation.current !== requestId) return;
          setHits(next);
          setPhase(next.length > 0 ? "results" : "empty");
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || generation.current !== requestId) return;
          if (error instanceof DOMException && error.name === "AbortError") return;
          setHits([]);
          setPhase("error");
        });
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [retryNonce, text]);

  function pick(hit: PlaceHit) {
    generation.current += 1;
    lockedText.current = hit.name;
    setText(hit.name);
    setHits([]);
    setPhase("idle");
    onPick(hit);
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <div className="pointer-events-auto relative">
        <Search
          aria-hidden
          size={20}
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          enterKeyHint="search"
          value={text}
          onChange={(event) => {
            const next = event.target.value;
            lockedText.current = null;
            generation.current += 1;
            setText(next);
            setHits([]);
            setPhase(next.trim().length < 2 ? "idle" : "loading");
          }}
          placeholder="場所を検索"
          aria-label="場所を検索"
          className="h-12 w-full rounded-full bg-white/95 pr-4 pl-11 text-base shadow-[0_8px_24px_rgba(36,48,56,0.12)] outline-none"
        />
        {phase === "loading" ? (
          <p className="mt-2 rounded-2xl bg-white/95 px-4 py-3 text-base text-muted shadow-[0_8px_24px_rgba(36,48,56,0.12)]">
            検索中
          </p>
        ) : null}
        {phase === "empty" ? (
          <p className="mt-2 rounded-2xl bg-white/95 px-4 py-3 text-base shadow-[0_8px_24px_rgba(36,48,56,0.12)]">
            該当する場所がありません
          </p>
        ) : null}
        {phase === "error" ? (
          <div className="mt-2 rounded-2xl bg-white/95 px-4 py-3 text-base shadow-[0_8px_24px_rgba(36,48,56,0.12)]">
            <p>検索できませんでした。通信状況を確認して再試行してください。</p>
            <button
              type="button"
              onClick={() => setRetryNonce((current) => current + 1)}
              className="mt-3 h-11 rounded-full bg-brand px-4 text-base font-bold text-white"
            >
              再試行
            </button>
          </div>
        ) : null}
        {phase === "results" && hits.length > 0 ? (
          <ul className="absolute inset-x-0 top-14 z-20 max-h-64 overflow-y-auto rounded-3xl bg-white py-2 shadow-[0_12px_32px_rgba(36,48,56,0.16)]">
            {hits.map((hit) => (
              <li key={`${hit.latitude},${hit.longitude},${hit.label}`}>
                <button
                  type="button"
                  onClick={() => pick(hit)}
                  className="w-full px-4 py-3 text-left"
                >
                  <span className="block text-base font-bold leading-6">{hit.name}</span>
                  {hit.label !== hit.name ? (
                    <span className="mt-0.5 block text-base leading-6 text-muted">{hit.label}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

import { pinTitle } from "@/lib/pins/display";
import type { SavedPin } from "@/lib/pins/types";

export async function sharePin(pin: SavedPin): Promise<"shared" | "copied"> {
  const title = pinTitle(pin);
  const lines = [title, pin.address.trim(), pin.memo.trim()].filter((line) => line.length > 0);
  const url = `https://www.google.com/maps/search/?api=1&query=${pin.latitude},${pin.longitude}`;
  const text = lines.join("\n");

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "shared";
    }
  }

  await navigator.clipboard.writeText(`${text}\n${url}`);
  return "copied";
}

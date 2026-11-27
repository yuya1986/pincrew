export class GeocodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeocodeError";
  }
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<string> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
  });

  let response: Response;
  try {
    response = await fetch(`/api/geocode?${params.toString()}`, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new GeocodeError("住所を取得できませんでした。手入力できます。");
  }

  if (!response.ok) {
    throw new GeocodeError("住所を取得できませんでした。手入力できます。");
  }

  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null) {
    throw new GeocodeError("住所を取得できませんでした。手入力できます。");
  }

  const address = "address" in payload ? payload.address : null;
  if (typeof address !== "string" || address.trim().length === 0) {
    throw new GeocodeError("住所を取得できませんでした。手入力できます。");
  }

  return address.trim();
}

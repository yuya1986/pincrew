function readAddress(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;

  const record = payload as Record<string, unknown>;
  if (record.error) return null;

  const displayName = record.display_name;
  if (typeof displayName !== "string") return null;

  const address = displayName.trim();
  return address.length > 0 ? address : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lon"));

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return Response.json({ error: "座標が不正です" }, { status: 400 });
  }

  const endpoint = new URL("https://nominatim.openstreetmap.org/reverse");
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("lat", String(latitude));
  endpoint.searchParams.set("lon", String(longitude));
  endpoint.searchParams.set("accept-language", "ja");

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Kokomemo/0.1 (personal map memo)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return Response.json({ error: "住所を取得できませんでした" }, { status: 502 });
    }

    const payload: unknown = await response.json();
    const address = readAddress(payload);
    if (!address) {
      return Response.json({ error: "住所を取得できませんでした" }, { status: 404 });
    }

    return Response.json({ address });
  } catch {
    return Response.json({ error: "住所を取得できませんでした" }, { status: 502 });
  }
}

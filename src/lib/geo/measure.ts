export function distanceMeters(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const latDelta = toRad(toLat - fromLat);
  const lngDelta = toRad(toLng - fromLng);
  const lat1 = toRad(fromLat);
  const lat2 = toRad(toLat);
  const arc =
    Math.sin(latDelta / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(arc)));
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 1000) {
    return `${Math.max(0, Math.round(meters || 0)).toLocaleString("ja-JP")} m`;
  }
  const kilometers = meters / 1000;
  const digits = kilometers < 10 ? 2 : 1;
  return `${kilometers.toFixed(digits)} km`;
}

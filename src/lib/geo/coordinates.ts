export class CoordinateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoordinateError";
  }
}

export function assertCoordinates(latitude: number, longitude: number): void {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new CoordinateError("緯度を取得できませんでした");
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new CoordinateError("経度を取得できませんでした");
  }
}

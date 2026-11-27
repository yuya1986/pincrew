export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  /** When the device measured this fix, in milliseconds. */
  updatedAt?: number;
};

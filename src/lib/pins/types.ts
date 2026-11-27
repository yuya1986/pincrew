export type SyncStatus = "local" | "pending" | "synced" | "error";
export type PinStatus = "private" | "pending" | "approved" | "rejected";

export type SavedPin = {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
  title: string;
  memo: string;
  category: string;
  icon: string;
  color: string;
  visitedAt: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  mapId: string | null;
  status: PinStatus;
  createdBy: string | null;
  createdByLabel: string;
};

export type PinFormValues = {
  address: string;
  title: string;
  memo: string;
  category: string;
  icon: string;
  color: string;
  visitedAt: string;
};

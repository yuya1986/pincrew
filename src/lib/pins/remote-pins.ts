import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase/client";
import type { SavedPin } from "@/lib/pins/types";

export class RemotePinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemotePinError";
  }
}

type PinRow = {
  id: string;
  map_id: string;
  created_by: string | null;
  created_by_label: string;
  latitude: number;
  longitude: number;
  address: string;
  title: string;
  memo: string;
  category: string;
  icon: string;
  color: string;
  status: SavedPin["status"];
  visited_at: string;
  created_at: string;
  updated_at: string;
};

function toPin(row: PinRow): SavedPin {
  return {
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    title: row.title,
    memo: row.memo,
    category: row.category,
    icon: row.icon,
    color: row.color,
    visitedAt: row.visited_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: "synced",
    mapId: row.map_id,
    status: row.status,
    createdBy: row.created_by,
    createdByLabel: row.created_by_label ?? "",
  };
}

function toRow(pin: SavedPin, userId: string | null): PinRow & { user_id: string | null } {
  return {
    id: pin.id,
    user_id: userId,
    map_id: pin.mapId ?? "",
    created_by: userId,
    created_by_label: pin.createdByLabel,
    status: pin.status,
    latitude: pin.latitude,
    longitude: pin.longitude,
    address: pin.address,
    title: pin.title,
    memo: pin.memo,
    category: pin.category,
    icon: pin.icon,
    color: pin.color,
    visited_at: pin.visitedAt,
    created_at: pin.createdAt,
    updated_at: pin.updatedAt,
  };
}

function client(): SupabaseClient {
  return createBrowserSupabase();
}

const PIN_COLUMNS =
  "id, map_id, created_by, created_by_label, latitude, longitude, address, title, memo, category, icon, color, status, visited_at, created_at, updated_at";

export async function listRemotePins(mapId: string): Promise<SavedPin[]> {
  const { data, error } = await client()
    .from("pins")
    .select(PIN_COLUMNS)
    .eq("map_id", mapId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new RemotePinError("保存済みの場所を読み込めませんでした");
  return (data as PinRow[] | null)?.map(toPin) ?? [];
}

export async function insertRemotePin(pin: SavedPin, userId: string | null): Promise<void> {
  await insertRemotePins([pin], userId);
}

export async function insertRemotePins(pins: SavedPin[], userId: string | null): Promise<void> {
  if (pins.length === 0) return;
  const { data, error } = await client().from("pins").insert(pins.map((pin) => toRow(pin, userId))).select("id");
  if (error || data?.length !== pins.length) throw new RemotePinError("保存できませんでした");
}

export async function updateRemotePin(pin: SavedPin): Promise<void> {
  const { data, error } = await client()
    .from("pins")
    .update({
      latitude: pin.latitude,
      longitude: pin.longitude,
      address: pin.address,
      title: pin.title,
      memo: pin.memo,
      category: pin.category,
      icon: pin.icon,
      color: pin.color,
      status: pin.status,
      created_by_label: pin.createdByLabel,
      visited_at: pin.visitedAt,
      updated_at: pin.updatedAt,
    })
    .eq("id", pin.id)
    .select("id");
  if (error || !data?.length) throw new RemotePinError("変更できませんでした");
}

export async function setRemotePinStatus(id: string, status: SavedPin["status"]): Promise<void> {
  const { data, error } = await client()
    .from("pins")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) throw new RemotePinError("変更できませんでした");
}

export async function upsertRemotePins(pins: SavedPin[], userId: string | null): Promise<void> {
  if (pins.length === 0) return;

  const { error } = await client().from("pins").upsert(pins.map((pin) => toRow(pin, userId)));
  if (error) throw new RemotePinError("保存できませんでした");
}

export type DeletedPin = SavedPin & { deletedAt: string };

export async function listDeletedPins(): Promise<DeletedPin[]> {
  const { data, error } = await client()
    .from("pins")
    .select(`${PIN_COLUMNS}, deleted_at`)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw new RemotePinError("削除したピンを読み込めませんでした");
  return ((data ?? []) as Array<PinRow & { deleted_at: string }>).map((row) => ({
    ...toPin(row),
    deletedAt: row.deleted_at,
  }));
}

export async function deleteRemotePin(id: string): Promise<void> {
  const { error } = await client()
    .from("pins")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw new RemotePinError("削除できませんでした");
}

export async function restoreDeletedPin(id: string): Promise<void> {
  const { data, error } = await client()
    .from("pins")
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id");
  if (error || !data?.length) throw new RemotePinError("復活できませんでした");
}

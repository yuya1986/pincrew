import { createBrowserSupabase } from "@/lib/supabase/client";

const BUCKET = "pin-photos";
const SIGNED_URL_SECONDS = 60 * 60;
const MAX_EDGE = 1600;

export class PhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoError";
  }
}

export type PinPhoto = {
  id: string;
  url: string;
};

export type PinCover = {
  photoId: string;
  url: string;
};

function photoPath(pinId: string, photoId: string): string {
  return `${pinId}/${photoId}`;
}

async function actorId(): Promise<string | null> {
  const { data } = await createBrowserSupabase().auth.getUser();
  return data.user?.id ?? null;
}

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("decode"));
        element.src = url;
      });
      return await createImageBitmap(image);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function preparePhoto(file: File): Promise<Blob> {
  const type = file.type.toLowerCase();
  if (type && !type.startsWith("image/")) {
    throw new PhotoError("画像ファイルを選んでください");
  }

  try {
    const bitmap = await decodeImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      throw new PhotoError("この写真は追加できませんでした");
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.82);
    });
    if (!blob) throw new PhotoError("この写真は追加できませんでした");
    return blob;
  } catch (error) {
    if (error instanceof PhotoError) throw error;
    throw new PhotoError("この写真は追加できませんでした。別の写真を選んでください。");
  }
}

export async function listPinPhotos(pinId: string): Promise<PinPhoto[]> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("pin_photos")
    .select("id")
    .eq("pin_id", pinId)
    .order("created_at", { ascending: true });

  if (error) throw new PhotoError("写真を読み込めませんでした");
  const rows = (data ?? []) as { id: string }[];
  if (rows.length === 0) return [];

  const paths = rows.map((row) => photoPath(pinId, row.id));
  const signed = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (signed.error) throw new PhotoError("写真を読み込めませんでした");

  return rows.flatMap((row, index) => {
    const url = signed.data[index]?.signedUrl;
    return url ? [{ id: row.id, url }] : [];
  });
}

export async function addPinPhoto(pinId: string, file: File): Promise<void> {
  const userId = await actorId();
  const photoId = crypto.randomUUID();
  const path = photoPath(pinId, photoId);
  const body = await preparePhoto(file);
  const supabase = createBrowserSupabase();

  const uploaded = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (uploaded.error) throw new PhotoError("写真を追加できませんでした");

  const inserted = await supabase.from("pin_photos").insert({
    id: photoId,
    pin_id: pinId,
    user_id: userId,
  });
  if (inserted.error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new PhotoError("写真を追加できませんでした");
  }
}

export async function listPinCoverPhotos(pinIds: string[]): Promise<Record<string, PinCover>> {
  const unique = [...new Set(pinIds)].filter(Boolean);
  if (unique.length === 0) return {};

  const supabase = createBrowserSupabase();
  const covers: Record<string, PinCover> = {};

  for (let index = 0; index < unique.length; index += 80) {
    const batch = unique.slice(index, index + 80);
    const { data, error } = await supabase
      .from("pin_photos")
      .select("id, pin_id")
      .in("pin_id", batch)
      .order("created_at", { ascending: true });
    if (error) throw new PhotoError("写真を読み込めませんでした");

    const first = new Map<string, string>();
    for (const row of (data ?? []) as { id: string; pin_id: string }[]) {
      if (!first.has(row.pin_id)) first.set(row.pin_id, row.id);
    }
    const entries = [...first.entries()];
    if (entries.length === 0) continue;

    const signed = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(
        entries.map(([pinId, photoId]) => photoPath(pinId, photoId)),
        SIGNED_URL_SECONDS,
      );
    if (signed.error) throw new PhotoError("写真を読み込めませんでした");

    entries.forEach(([pinId, photoId], pathIndex) => {
      const url = signed.data[pathIndex]?.signedUrl;
      if (url) covers[pinId] = { photoId, url };
    });
  }

  return covers;
}

export async function listPinPhotoIds(pinId: string): Promise<string[]> {
  const { data, error } = await createBrowserSupabase()
    .from("pin_photos")
    .select("id")
    .eq("pin_id", pinId);
  if (error) throw new PhotoError("写真を削除できませんでした");
  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

export async function relinkPinPhotos(pinId: string, photoIds: string[]): Promise<void> {
  if (photoIds.length === 0) return;
  const userId = await actorId();
  const { error } = await createBrowserSupabase()
    .from("pin_photos")
    .insert(photoIds.map((id) => ({ id, pin_id: pinId, user_id: userId })));
  if (error) throw new PhotoError("写真を戻せませんでした");
}

export async function removeStoredPinPhotos(pinId: string, photoIds: string[]): Promise<void> {
  if (photoIds.length === 0) return;
  const { error } = await createBrowserSupabase()
    .storage.from(BUCKET)
    .remove(photoIds.map((id) => photoPath(pinId, id)));
  if (error) throw new PhotoError("写真を削除できませんでした");
}

export async function deletePinPhoto(pinId: string, photoId: string): Promise<void> {
  const supabase = createBrowserSupabase();
  const deleted = await supabase.from("pin_photos").delete().eq("id", photoId).eq("pin_id", pinId).select("id");
  if (deleted.error || !deleted.data?.length) throw new PhotoError("写真を削除できませんでした");
  const removed = await supabase.storage.from(BUCKET).remove([photoPath(pinId, photoId)]);
  if (removed.error) throw new PhotoError("写真を削除できませんでした");
}

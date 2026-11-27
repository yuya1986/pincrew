import { PIN_ICONS, pinIconImageId } from "@/lib/pins/catalog";

const IMAGE_SIZE = 64;
const PHOTO_SIZE = 128;

export async function loadPinPhotoIcon(url: string): Promise<ImageData | null> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.crossOrigin = "anonymous";
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("photo"));
    element.src = url;
  }).catch(() => null);
  if (!image) return null;

  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const radius = PHOTO_SIZE / 2 - 4;
  context.save();
  context.beginPath();
  context.arc(PHOTO_SIZE / 2, PHOTO_SIZE / 2, radius, 0, Math.PI * 2);
  context.clip();
  const scale = Math.max(PHOTO_SIZE / image.width, PHOTO_SIZE / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (PHOTO_SIZE - width) / 2, (PHOTO_SIZE - height) / 2, width, height);
  context.restore();
  context.beginPath();
  context.arc(PHOTO_SIZE / 2, PHOTO_SIZE / 2, radius, 0, Math.PI * 2);
  context.strokeStyle = "#ffffff";
  context.lineWidth = 8;
  context.stroke();
  return context.getImageData(0, 0, PHOTO_SIZE, PHOTO_SIZE);
}

export function registerPinIconImages(map: {
  hasImage: (id: string) => boolean;
  addImage: (
    id: string,
    image: ImageData,
    options?: { pixelRatio?: number },
  ) => void;
}): void {
  for (const icon of PIN_ICONS) {
    const imageId = pinIconImageId(icon.id);
    if (map.hasImage(imageId)) continue;

    const canvas = document.createElement("canvas");
    canvas.width = IMAGE_SIZE;
    canvas.height = IMAGE_SIZE;
    const context = canvas.getContext("2d");
    if (!context) continue;

    context.clearRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
    context.font = "44px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(icon.emoji, IMAGE_SIZE / 2, IMAGE_SIZE / 2 + 2);
    map.addImage(imageId, context.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE), {
      pixelRatio: 2,
    });
  }
}

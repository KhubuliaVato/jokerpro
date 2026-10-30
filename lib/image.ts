import { tt } from "./lang";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

/** Largest centred square of a w×h image, as source rectangle coordinates. */
export function centerSquare(w: number, h: number): { sx: number; sy: number; side: number } {
  const side = Math.min(w, h);
  return { sx: Math.round((w - side) / 2), sy: Math.round((h - side) / 2), side };
}

/**
 * Crops a photo to a centred square and scales it to `size` px, as a small WebP (JPEG where WebP is not
 * available). Keeps uploads tiny no matter what the player picks.
 * Rejects with a Georgian message when the file is not a usable image.
 */
export async function resizeToSquare(file: File, size = 256): Promise<Blob> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error(tt("აირჩიეთ JPG, PNG ან WebP სურათი", "Choose a JPG, PNG or WebP image", "Выберите изображение JPG, PNG или WebP"));
  if (file.size > MAX_SOURCE_BYTES) throw new Error(tt("სურათი ძალიან დიდია (მაქსიმუმ 8 მბ)", "The image is too large (8 MB max)", "Изображение слишком большое (максимум 8 МБ)"));

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(tt("სურათის გახსნა ვერ მოხერხდა", "Could not open the image", "Не удалось открыть изображение"));
  }
  const { sx, sy, side } = centerSquare(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(tt("სურათის დამუშავება ვერ მოხერხდა", "Could not process the image", "Не удалось обработать изображение"));
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();

  const toBlob = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.85));
  const blob = (await toBlob("image/webp")) ?? (await toBlob("image/jpeg"));
  if (!blob) throw new Error(tt("სურათის დამუშავება ვერ მოხერხდა", "Could not process the image", "Не удалось обработать изображение"));
  return blob;
}

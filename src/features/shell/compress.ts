export const MAX_SIDE = 1600;
export const START_QUALITY = 0.8;
export const MIN_QUALITY = 0.4;
export const QUALITY_STEP = 0.1;
export const SCALE_STEP = 0.8;
export const MIN_SIDE = 240;

export interface Size {
  width: number;
  height: number;
}

/** Scale to fit the long side within max, never enlarging. */
export function fitSize(width: number, height: number, max: number): Size {
  const long = Math.max(width, height);
  const k = long <= max ? 1 : max / long;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/**
 * Finds a JPEG data URL under maxChars. Quality steps down from 0.8 at each size;
 * if no quality fits, the size shrinks and quality restarts. Null if it can never fit.
 * render draws at the given size and quality and returns the data URL.
 */
export function compressToFit(
  source: Size,
  maxChars: number,
  render: (width: number, height: number, quality: number) => string,
): string | null {
  let size = fitSize(source.width, source.height, MAX_SIDE);
  for (;;) {
    for (let q = START_QUALITY; q >= MIN_QUALITY - 1e-9; q -= QUALITY_STEP) {
      const url = render(size.width, size.height, Math.round(q * 100) / 100);
      if (url.length <= maxChars) return url;
    }
    const long = Math.max(size.width, size.height);
    if (long <= MIN_SIDE) return null;
    size = fitSize(size.width, size.height, Math.floor(long * SCALE_STEP));
  }
}

/** Browser only: decode a file and compress it to fit. */
export async function compressImageFile(file: File, maxChars: number): Promise<string | null> {
  const bmp = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return compressToFit({ width: bmp.width, height: bmp.height }, maxChars, (w, h, q) => {
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(bmp, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', q);
    });
  } finally {
    bmp.close();
  }
}

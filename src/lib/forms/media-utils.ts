import type { PhotoQuality } from "../../store/config-store";

const QUALITY_SPECS: Record<
  Exclude<PhotoQuality, "original">,
  { maxDimension: number; jpegQuality: number }
> = {
  "2mp": { maxDimension: 1920, jpegQuality: 0.82 },
  "5mp": { maxDimension: 2560, jpegQuality: 0.85 },
  "10mp": { maxDimension: 3648, jpegQuality: 0.88 },
};

export interface ProcessedMedia {
  base64: string;
  dataUrl: string;
  mimeType: string;
  size: number;
}

/**
 * Converts a standard File to base64 string and dataUrl.
 */
export async function fileToBase64(file: File): Promise<ProcessedMedia> {
  const mimeType = file.type || "application/octet-stream";

  // Use native asynchronous FileReader in browser / webview environments
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const commaIdx = dataUrl.indexOf(",");
        const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
        resolve({
          base64,
          dataUrl,
          mimeType,
          size: file.size,
        });
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  // Node / test environment fallback
  if (typeof file.arrayBuffer === "function") {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const maybeBuffer = (
      globalThis as unknown as {
        Buffer?: { from(data: Uint8Array): { toString(enc: string): string } };
      }
    ).Buffer;

    if (maybeBuffer) {
      const base64 = maybeBuffer.from(bytes).toString("base64");
      return {
        base64,
        dataUrl: `data:${mimeType};base64,${base64}`,
        mimeType,
        size: file.size,
      };
    }

    // Chunked conversion fallback to prevent stack overflow and thread lockup
    let binary = "";
    const len = bytes.byteLength;
    const chunkSize = 0x8000;
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(i, Math.min(i + chunkSize, len)) as unknown as number[],
      );
    }
    const base64 = btoa(binary);

    return {
      base64,
      dataUrl: `data:${mimeType};base64,${base64}`,
      mimeType,
      size: file.size,
    };
  }

  throw new Error("No supported file reader found in this environment");
}

/**
 * Optimizes/resizes a photo file based on configured PhotoQuality ("2mp", "5mp", "10mp", "original").
 * Uses HTML5 Canvas for client-side downscaling.
 */
export async function optimizePhoto(
  file: File,
  quality: PhotoQuality = "2mp",
): Promise<ProcessedMedia> {
  if (quality === "original" || typeof document === "undefined") {
    return fileToBase64(file);
  }

  const spec = QUALITY_SPECS[quality] || QUALITY_SPECS["2mp"];

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      // Check if image needs downscaling
      if (width > spec.maxDimension || height > spec.maxDimension) {
        if (width > height) {
          height = Math.round((height * spec.maxDimension) / width);
          width = spec.maxDimension;
        } else {
          width = Math.round((width * spec.maxDimension) / height);
          height = spec.maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        // Fallback to raw file if canvas 2D context fails
        fileToBase64(file).then(resolve).catch(reject);
        return;
      }

      // Fill white background to prevent transparent PNG/WebP turning black in JPEG
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = "image/jpeg";
      const dataUrl = canvas.toDataURL(mimeType, spec.jpegQuality);
      const commaIdx = dataUrl.indexOf(",");
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;

      // Approximate size from base64 length
      const size = Math.round((base64.length * 3) / 4);

      resolve({
        base64,
        dataUrl,
        mimeType,
        size,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // If image loading fails, fallback to raw base64
      fileToBase64(file).then(resolve).catch(reject);
    };

    img.src = objectUrl;
  });
}

/**
 * Formats bytes to human-readable size string (e.g. 1.2 MB).
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || "MB"}`;
}

import { describe, it, expect } from "vitest";
import { formatBytes, fileToBase64, optimizePhoto } from "./media-utils";

describe("media-utils", () => {
  describe("formatBytes", () => {
    it("should format 0 and negative bytes gracefully", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(-100)).toBe("0 B");
    });

    it("should format bytes to human readable sizes", () => {
      expect(formatBytes(500)).toBe("500 B");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
      expect(formatBytes(1048576)).toBe("1 MB");
      expect(formatBytes(15728640)).toBe("15 MB");
      expect(formatBytes(1073741824)).toBe("1 GB");
    });
  });

  describe("fileToBase64", () => {
    it("should convert a text/plain or binary file to base64", async () => {
      const blob = new Blob(["hello world content"], { type: "text/plain" });
      const file = new File([blob], "test.txt", { type: "text/plain" });

      const result = await fileToBase64(file);
      expect(result.mimeType).toBe("text/plain");
      expect(result.size).toBe(file.size);
      expect(result.dataUrl.startsWith("data:text/plain;base64,")).toBe(true);

      const decoded = atob(result.base64);
      expect(decoded).toBe("hello world content");
    });

    it("should handle larger binary payloads efficiently", async () => {
      const largeArray = new Uint8Array(100 * 1024); // 100 KB
      for (let i = 0; i < largeArray.length; i++) {
        largeArray[i] = i % 256;
      }
      const blob = new Blob([largeArray], { type: "application/octet-stream" });
      const file = new File([blob], "large.bin", {
        type: "application/octet-stream",
      });

      const result = await fileToBase64(file);
      expect(result.size).toBe(100 * 1024);
      expect(result.base64.length).toBeGreaterThan(0);
      const decoded = atob(result.base64);
      expect(decoded.length).toBe(100 * 1024);
      expect(decoded.charCodeAt(100)).toBe(100);
    });
  });

  describe("optimizePhoto", () => {
    it("should fallback to fileToBase64 when quality is original or in non-DOM environment", async () => {
      const blob = new Blob(["fake-image-bytes"], { type: "image/jpeg" });
      const file = new File([blob], "sample.jpg", { type: "image/jpeg" });

      const result = await optimizePhoto(file, "original");
      expect(result.mimeType).toBe("image/jpeg");
      expect(result.size).toBe(file.size);
      expect(atob(result.base64)).toBe("fake-image-bytes");
    });
  });
});

/**
 * Image Color Extraction Utility
 * Extracts dominant palette colors from any image/canvas element using HTML5 Canvas.
 * Zero external libraries, runs 100% in browser.
 */

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

export function extractDominantColors(imageSource, maxColors = 5) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        // Sample down for speed and smoothing
        const width = (canvas.width = 100);
        const height = (canvas.height = 100);

        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height).data;

        const colorCounts = {};
        const step = 4; // Sample every 4th pixel

        for (let i = 0; i < imageData.length; i += step * 4) {
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];
          const a = imageData[i + 3];

          // Skip transparent or near-black/white extreme outliers
          if (a < 128) continue;

          // Quantize to 32 steps to cluster similar shades
          const qr = Math.round(r / 24) * 24;
          const qg = Math.round(g / 24) * 24;
          const qb = Math.round(b / 24) * 24;

          const key = `${qr},${qg},${qb}`;
          colorCounts[key] = (colorCounts[key] || 0) + 1;
        }

        const sortedColors = Object.entries(colorCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, maxColors)
          .map(([key]) => {
            const [r, g, b] = key.split(",").map(Number);
            return rgbToHex(r, g, b);
          });

        // Add standard high-contrast defaults (#FFFFFF and #000000) if not present
        const result = ["#FFFFFF", "#000000", ...sortedColors.filter(c => c !== "#ffffff" && c !== "#000000")].slice(0, maxColors + 2);
        resolve(result);
      };

      img.onerror = () => {
        resolve(["#FFFFFF", "#000000", "#FFD700", "#FF4500", "#9333EA"]);
      };

      if (typeof imageSource === "string") {
        img.src = imageSource;
      } else if (imageSource instanceof Blob || imageSource instanceof File) {
        img.src = URL.createObjectURL(imageSource);
      } else {
        resolve(["#FFFFFF", "#000000", "#FFD700", "#9333EA"]);
      }
    } catch {
      resolve(["#FFFFFF", "#000000", "#FFD700", "#9333EA"]);
    }
  });
}

import { TemperatureReadings } from '../types';

export const drawOverlayOnBitmap = (
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  readings: TemperatureReadings,
  fontScale: number = 1.0
): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // STRICTLY PRESERVE ORIGINAL DIMENSIONS
  // If image is massive (e.g. > 2560px), we scale it down to save memory/storage
  // while keeping aspect ratio.
  const MAX_DIMENSION = 2560;
  let drawWidth = image.naturalWidth;
  let drawHeight = image.naturalHeight;

  if (drawWidth > MAX_DIMENSION || drawHeight > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / drawWidth, MAX_DIMENSION / drawHeight);
    drawWidth = Math.floor(drawWidth * ratio);
    drawHeight = Math.floor(drawHeight * ratio);
  }

  canvas.width = drawWidth;
  canvas.height = drawHeight;

  // Draw the original image
  ctx.drawImage(image, 0, 0, drawWidth, drawHeight);

  // Configuration for aesthetics
  const w = canvas.width;
  // Scale font size relative to image width (e.g., 3% of width), then apply user scale
  const baseSize = w * 0.03;
  const fontSize = Math.max(24, Math.floor(baseSize * fontScale)); 
  const lineHeight = fontSize * 1.4;
  const padding = fontSize; // Inner padding of the box
  const margin = fontSize; // Margin from the top-left edge of image

  // Prepare text lines
  const lines = [
    `T1: ${readings.t1}°C`,
    `T2: ${readings.t2}°C`,
    `T3: ${readings.t3}°C`,
    `T4: ${readings.t4}°C`,
  ];

  // Only add P.T if it has a value
  if (readings.pt && readings.pt.trim() !== '') {
    lines.push(`P.T: ${readings.pt}°C`);
  }

  ctx.font = `bold ${fontSize}px sans-serif`;
  
  // Calculate box dimensions
  let maxTextWidth = 0;
  lines.forEach(line => {
    const metrics = ctx.measureText(line);
    if (metrics.width > maxTextWidth) maxTextWidth = metrics.width;
  });

  const boxWidth = maxTextWidth + (padding * 2);
  const boxHeight = (lines.length * lineHeight) + (padding * 2);
  const boxX = margin;
  const boxY = margin;

  // Draw rounded rectangle background (Simulating Android's semi-transparent drawable)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Semi-transparent black
  
  // Custom rounded rect drawing for compatibility
  const radius = fontSize * 0.5;
  ctx.beginPath();
  ctx.moveTo(boxX + radius, boxY);
  ctx.lineTo(boxX + boxWidth - radius, boxY);
  ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + radius);
  ctx.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
  ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - radius, boxY + boxHeight);
  ctx.lineTo(boxX + radius, boxY + boxHeight);
  ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - radius);
  ctx.lineTo(boxX, boxY + radius);
  ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
  ctx.closePath();
  ctx.fill();

  // Draw Text
  ctx.fillStyle = '#FFFFFF'; // White text
  ctx.textBaseline = 'top';
  
  lines.forEach((line, index) => {
    ctx.fillText(
      line, 
      boxX + padding, 
      boxY + padding + (index * lineHeight)
    );
  });
};

export const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // SWITCH TO JPEG: drastically reduces file size (10x smaller) while keeping dimensions
    // Quality 0.92 is standard "High" quality for photos.
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas conversion failed"));
    }, 'image/jpeg', 0.92);
  });
};

// Helper for Batch Processing
// Loads a file into an Image object, draws overlay on a temporary canvas, and returns blob
export const processImageFromFile = async (
  file: File,
  readings: TemperatureReadings,
  fontScale: number
): Promise<{ original: File, processed: Blob }> => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image ${file.name}`));
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  drawOverlayOnBitmap(canvas, img, readings, fontScale);
  
  const processedBlob = await canvasToBlob(canvas);
  
  URL.revokeObjectURL(url);
  
  return { original: file, processed: processedBlob };
};
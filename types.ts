export interface TemperatureReadings {
  t1: string;
  t2: string;
  t3: string;
  t4: string;
  pt: string;
}

export interface ExperimentRecord {
  id: number;
  timestamp: number;
  readings: TemperatureReadings;
  originalImageBlob: Blob; // Stored to allow re-edits or just reference
  processedImageBlob: Blob; // The result with overlay
}

export interface OverlayConfig {
  readings: TemperatureReadings;
  image: HTMLImageElement;
  fontScale?: number;
}
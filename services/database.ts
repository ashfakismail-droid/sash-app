import { ExperimentRecord, TemperatureReadings } from '../types';

const DB_NAME = 'ExperimentOverlayDB';
const STORE_NAME = 'readings';
const DB_VERSION = 1;

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const saveReading = async (
  readings: TemperatureReadings,
  originalBlob: Blob,
  processedBlob: Blob
): Promise<number> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record: Omit<ExperimentRecord, 'id'> = {
      timestamp: Date.now(),
      readings,
      originalImageBlob: originalBlob,
      processedImageBlob: processedBlob
    };

    const request = store.add(record);

    request.onsuccess = () => {
      resolve(request.result as number);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const getAllReadings = async (): Promise<ExperimentRecord[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    // Get all records, sorted by ID (effectively chronological if autoIncrement)
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort descending by timestamp
      const results = request.result as ExperimentRecord[];
      results.sort((a, b) => b.timestamp - a.timestamp);
      resolve(results);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const deleteReading = async (id: number): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
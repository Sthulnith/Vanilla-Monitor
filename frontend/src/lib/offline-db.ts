import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'vanilla-monitor';
const DB_VERSION = 1;

interface VanillaMonitorDB {
  submissions: {
    key: string;
    value: any;
    indexes: { status: string; zone: string; submittedAt: string; plant_id: string };
  };
  plant_gps: {
    key: string;
    value: { plant_id: string; lat: number; lng: number };
  };
  mortality_reports: {
    key: string;
    value: { id: string; zone: string; block: string; dead_support_trees: number; dead_vines: number; reportedAt: string };
  };
  settings: {
    key: string;
    value: { key: string; value: any };
  };
}

let dbPromise: Promise<IDBPDatabase<VanillaMonitorDB>> | null = null;

function getDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<VanillaMonitorDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Submissions queue
        const submissionsStore = db.createObjectStore('submissions', {
          keyPath: 'id',
          autoIncrement: false
        });
        submissionsStore.createIndex('status', 'status');
        submissionsStore.createIndex('zone', 'zone');
        submissionsStore.createIndex('submittedAt', 'submittedAt');
        submissionsStore.createIndex('plant_id', 'plant_id');

        // Plant GPS coordinates
        db.createObjectStore('plant_gps', {
          keyPath: 'plant_id'
        });

        // Dead vine and support tree reports
        db.createObjectStore('mortality_reports', {
          keyPath: 'id',
          autoIncrement: false
        });

        // Local settings
        db.createObjectStore('settings', {
          keyPath: 'key'
        });
      },
    });
  }
  return dbPromise;
}

// Submissions functions
export async function saveSubmissionOffline(submission: any): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put('submissions', submission);
}

export async function getSubmission(id: string): Promise<any> {
  const db = await getDB();
  if (!db) return null;
  return db.get('submissions', id);
}

export async function getSubmissions(): Promise<any[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('submissions');
}

export async function getPendingSubmissions(): Promise<any[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAllFromIndex('submissions', 'status', 'pending');
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  if (!db) return 0;
  const pending = await db.getAllFromIndex('submissions', 'status', 'pending');
  return pending.length;
}

export async function markAsSyncedInDB(id: string, photoDriveUrl?: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const submission = await db.get('submissions', id);
  if (submission) {
    submission.status = 'synced';
    submission.sync_status = 'synced';
    if (photoDriveUrl) {
      submission.photo_drive_url = photoDriveUrl;
    }
    submission.synced_at = new Date().toISOString();
    await db.put('submissions', submission);
  }
}

export async function getPreviousHeight(plantId: string): Promise<number | null> {
  const db = await getDB();
  if (!db) return null;
  const submissions = await db.getAllFromIndex('submissions', 'plant_id', plantId);
  if (submissions.length === 0) return null;
  // Sort descending by submittedAt / created_at
  const sorted = submissions.sort((a, b) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime());
  return sorted[0].vine_height_cm || null;
}

// GPS functions
export async function savePlantGPS(plantId: string, lat: number, lng: number): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put('plant_gps', { plant_id: plantId, lat, lng });
}

export async function getPlantGPS(plantId: string): Promise<{ lat: number; lng: number } | null> {
  const db = await getDB();
  if (!db) return null;
  const record = await db.get('plant_gps', plantId);
  return record ? { lat: record.lat, lng: record.lng } : null;
}

export async function getAllPlantGPS(): Promise<any[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('plant_gps');
}

// Mortality reports functions
export async function saveMortalityReport(report: any): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put('mortality_reports', report);
}

export async function getMortalityReports(): Promise<any[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('mortality_reports');
}

export async function getMortalityStats(): Promise<{ deadVines: number; deadTrees: number }> {
  const reports = await getMortalityReports();
  return reports.reduce(
    (acc, curr) => {
      acc.deadVines += curr.dead_vines || 0;
      acc.deadTrees += curr.dead_support_trees || 0;
      return acc;
    },
    { deadVines: 0, deadTrees: 0 }
  );
}

// Settings functions
export async function saveSetting(key: string, value: any): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put('settings', { key, value });
}

export async function getSetting(key: string): Promise<any> {
  const db = await getDB();
  if (!db) return null;
  const record = await db.get('settings', key);
  return record ? record.value : null;
}

// Database stats counters
export async function getSubmissionsCount(): Promise<number> {
  const db = await getDB();
  if (!db) return 0;
  return db.count('submissions');
}

export async function getMortalityCount(): Promise<number> {
  const db = await getDB();
  if (!db) return 0;
  return db.count('mortality_reports');
}

// Clear all database tables
export async function clearAllTables(): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction(['submissions', 'mortality_reports', 'plant_gps', 'settings'], 'readwrite');
  await Promise.all([
    tx.objectStore('submissions').clear(),
    tx.objectStore('mortality_reports').clear(),
    tx.objectStore('plant_gps').clear(),
    tx.objectStore('settings').clear(),
    tx.done
  ]);
}


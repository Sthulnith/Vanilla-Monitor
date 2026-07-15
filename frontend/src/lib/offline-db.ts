import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'vanilla-monitor';
const DB_VERSION = 2;

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
    value: { id: string; zone: string; block: string; dead_support_trees: number; dead_vines: number; notes?: string; reportedAt: string };
  };
  settings: {
    key: string;
    value: { key: string; value: any };
  };
  plants: {
    key: string;
    value: any;
    indexes: { sync_status: string };
  };
  plant_locations: {
    key: string;
    value: any;
    indexes: { sync_status: string };
  };
  inspections: {
    key: string;
    value: any;
    indexes: { sync_status: string; plant_id: string };
  };
}

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

function getDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        // Version 1 stores
        if (oldVersion < 1) {
          const submissionsStore = db.createObjectStore('submissions', {
            keyPath: 'id',
            autoIncrement: false
          });
          submissionsStore.createIndex('status', 'status');
          submissionsStore.createIndex('zone', 'zone');
          submissionsStore.createIndex('submittedAt', 'submittedAt');
          submissionsStore.createIndex('plant_id', 'plant_id');

          db.createObjectStore('plant_gps', {
            keyPath: 'plant_id'
          });

          db.createObjectStore('mortality_reports', {
            keyPath: 'id',
            autoIncrement: false
          });

          db.createObjectStore('settings', {
            keyPath: 'key'
          });
        }

        // Version 2 stores (Plants, Plant Locations, Inspections)
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('plants')) {
            const plantsStore = db.createObjectStore('plants', { keyPath: 'plant_id' });
            plantsStore.createIndex('sync_status', 'sync_status');
          }
          if (!db.objectStoreNames.contains('plant_locations')) {
            const locStore = db.createObjectStore('plant_locations', { keyPath: 'plant_id' });
            locStore.createIndex('sync_status', 'sync_status');
          }
          if (!db.objectStoreNames.contains('inspections')) {
            const inspStore = db.createObjectStore('inspections', { keyPath: 'id' });
            inspStore.createIndex('sync_status', 'sync_status');
            inspStore.createIndex('plant_id', 'plant_id');
          }
        }
      },
    });
  }
  return dbPromise;
}

// Submissions functions (Backward Compatibility)
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
  const pendingSubmissions = await getPendingSubmissions();
  const pendingPlants = await getPendingPlants();
  const pendingLocations = await getPendingPlantLocations();
  const pendingInspections = await getPendingInspections();
  
  return pendingSubmissions.length + pendingPlants.length + pendingLocations.length + pendingInspections.length;
}

export async function markAsSyncedInDB(id: string, photoUrl?: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const submission = await db.get('submissions', id);
  if (submission) {
    submission.status = 'synced';
    submission.sync_status = 'synced';
    if (photoUrl) {
      submission.photo_url = photoUrl;
    }
    submission.synced_at = new Date().toISOString();
    await db.put('submissions', submission);
  }
}

export async function getPreviousHeight(plantId: string): Promise<number | null> {
  const db = await getDB();
  if (!db) return null;
  
  // Try new inspections table first
  const newInspections = await db.getAllFromIndex('inspections', 'plant_id', plantId);
  if (newInspections.length > 0) {
    const sorted = newInspections.sort((a, b) => new Date(b.inspection_date || b.created_at).getTime() - new Date(a.inspection_date || a.created_at).getTime());
    return sorted[0].vine_height_cm || null;
  }
  
  // Fallback to legacy submissions table
  const submissions = await db.getAllFromIndex('submissions', 'plant_id', plantId);
  if (submissions.length === 0) return null;
  const sorted = submissions.sort((a, b) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime());
  return sorted[0].vine_height_cm || null;
}

// GPS functions (Backward Compatibility)
export async function savePlantGPS(plantId: string, lat: number, lng: number): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put('plant_gps', { plant_id: plantId, lat, lng });
}

export async function getPlantGPS(plantId: string): Promise<{ lat: number; lng: number } | null> {
  const db = await getDB();
  if (!db) return null;
  
  // Try new plant_locations first
  const newLoc = await db.get('plant_locations', plantId);
  if (newLoc) {
    return { lat: Number(newLoc.latitude), lng: Number(newLoc.longitude) };
  }
  
  const record = await db.get('plant_gps', plantId);
  return record ? { lat: record.lat, lng: record.lng } : null;
}

export async function getAllPlantGPS(): Promise<any[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('plant_gps');
}

// ----------------- NEW ENTITY DB OPERATIONS -----------------

// Plants Store
export async function savePlantOffline(plant: any): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put('plants', plant);
}

export async function getPlant(plantId: string): Promise<any | null> {
  const db = await getDB();
  if (!db) return null;
  return db.get('plants', plantId);
}

export async function getPlants(): Promise<any[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('plants');
}

export async function getPendingPlants(): Promise<any[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAllFromIndex('plants', 'sync_status', 'pending');
}

export async function markPlantAsSynced(plantId: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const plant = await db.get('plants', plantId);
  if (plant) {
    plant.sync_status = 'synced';
    await db.put('plants', plant);
  }
}

// Plant Locations Store
export async function savePlantLocationOffline(location: any): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put('plant_locations', location);
}

export async function getPlantLocation(plantId: string): Promise<any | null> {
  const db = await getDB();
  if (!db) return null;
  return db.get('plant_locations', plantId);
}

export async function getPlantLocations(): Promise<any[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('plant_locations');
}

export async function getPendingPlantLocations(): Promise<any[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAllFromIndex('plant_locations', 'sync_status', 'pending');
}

export async function markPlantLocationAsSynced(plantId: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const loc = await db.get('plant_locations', plantId);
  if (loc) {
    loc.sync_status = 'synced';
    await db.put('plant_locations', loc);
  }
}

// Inspections Store
export async function saveInspectionOffline(inspection: any): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put('inspections', inspection);
}

export async function getInspection(id: string): Promise<any | null> {
  const db = await getDB();
  if (!db) return null;
  return db.get('inspections', id);
}

export async function getInspections(): Promise<any[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('inspections');
}

export async function getPendingInspections(): Promise<any[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAllFromIndex('inspections', 'sync_status', 'pending');
}

export async function markInspectionAsSynced(id: string, photoUrl?: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const insp = await db.get('inspections', id);
  if (insp) {
    insp.sync_status = 'synced';
    if (photoUrl) {
      insp.photo_url = photoUrl;
    }
    await db.put('inspections', insp);
  }
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
  const legacyCount = await db.count('submissions');
  const inspCount = await db.count('inspections');
  return legacyCount + inspCount;
}

export async function getMortalityCount(): Promise<number> {
  const db = await getDB();
  if (!db) return 0;
  return db.count('mortality_reports');
}

export async function deleteSubmission(id: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.delete('submissions', id);
}

export async function deleteInspection(id: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.delete('inspections', id);
}

// Clear all database tables
export async function clearAllTables(): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction(['submissions', 'mortality_reports', 'plant_gps', 'settings', 'plants', 'plant_locations', 'inspections'], 'readwrite');
  await Promise.all([
    tx.objectStore('submissions').clear(),
    tx.objectStore('mortality_reports').clear(),
    tx.objectStore('plant_gps').clear(),
    tx.objectStore('settings').clear(),
    tx.objectStore('plants').clear(),
    tx.objectStore('plant_locations').clear(),
    tx.objectStore('inspections').clear(),
    tx.done
  ]);
}

import {
  saveSubmissionOffline as saveDBOffline,
  getPendingSubmissions,
  markAsSyncedInDB
} from './offline-db';
import { appendToSheets, buildSheetRow } from './sheetsService';
import { uploadPhotoToDrive } from './driveService';

/**
 * Converts a Blob to a Base64-encoded string.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Get only the base64 part, strip the "data:*/*;base64," prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts a Base64 string back to a Blob.
 */
export function base64ToBlob(base64: string, contentType = 'image/jpeg'): Blob {
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
}

/**
 * Saves an inspection submission locally in IndexedDB.
 */
export async function saveInspectionOffline(formData: any, photoBlob: Blob | null): Promise<string> {
  const now = new Date();
  
  // Format submission date/time
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, '');
  const submissionId = `${formData.zone}-${formData.block}-${formData.plant_number}-${dateStr}-${timeStr}`;

  // Get supervisor info
  let supervisorName = 'Field Supervisor';
  let supervisorEmail = 'supervisor@sapori.lk';
  if (typeof window !== 'undefined') {
    const profileStr = localStorage.getItem('google_user_profile');
    if (profileStr) {
      try {
        const profile = JSON.parse(profileStr);
        supervisorName = profile.name;
        supervisorEmail = profile.email;
      } catch {}
    }
  }

  const photoBase64 = photoBlob ? await blobToBase64(photoBlob) : null;
  const photoFilename = photoBlob
    ? `Plant_${formData.zone}_${formData.block}_${formData.plant_number}_${now.toISOString().slice(0, 10)}.jpg`
    : null;

  const submission = {
    id: submissionId,
    status: 'pending',
    sync_status: 'pending',
    sync_attempts: 0,
    submitted_at: now.toISOString(),
    created_at: now.toISOString(),
    supervisor_name: supervisorName,
    supervisor_email: supervisorEmail,
    photo_blob: photoBase64,
    photo_filename: photoFilename,
    ...formData
  };

  await saveDBOffline(submission);
  return submissionId;
}

/**
 * Uploads all pending submissions to Google Drive & Google Sheets.
 */
export async function syncPendingSubmissions(): Promise<{ synced: number; failed: number }> {
  if (typeof window === 'undefined') return { synced: 0, failed: 0 };

  const isMockOffline = localStorage.getItem('mock_offline') === 'true';
  if (isMockOffline || !navigator.onLine) {
    console.warn('Sync aborted: Currently offline.');
    return { synced: 0, failed: 0 };
  }

  const token = localStorage.getItem('google_access_token');
  const sheetId = localStorage.getItem('spreadsheet_id') || process.env.NEXT_PUBLIC_SPREADSHEET_ID || '';

  if (!token) {
    console.warn('Sync aborted: No Google access token found.');
    return { synced: 0, failed: 0 };
  }

  const pending = await getPendingSubmissions();
  let synced = 0;
  let failed = 0;

  for (const submission of pending) {
    try {
      let photoDriveUrl = null;

      // 1. Upload photo to Google Drive first if present (disabled for now)
      /*
      if (submission.photo_blob && submission.photo_filename) {
        const blob = base64ToBlob(submission.photo_blob);
        photoDriveUrl = await uploadPhotoToDrive(
          token,
          blob,
          submission.zone,
          submission.photo_filename
        );
      }
      */

      // 2. Build row data and write to Google Sheets
      const rowData = buildSheetRow(submission, photoDriveUrl);
      await appendToSheets(token, sheetId, rowData);

      // 3. Mark as synced in local DB
      await markAsSyncedInDB(submission.id, photoDriveUrl || undefined);
      synced++;
    } catch (err: any) {
      console.error(`Sync failed for submission ${submission.id}:`, err);
      failed++;
      // If error is authentication/unauthorized, stop sync
      if (err.message === 'UNAUTHORIZED') {
        localStorage.removeItem('google_access_token');
        window.dispatchEvent(new Event('auth-status-change'));
        break;
      }
    }
  }

  // Trigger UI refresh
  window.dispatchEvent(new Event('sync-complete'));
  return { synced, failed };
}

// Auto-sync on connection restore
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Network connection restored. Starting sync...');
    syncPendingSubmissions()
      .then(results => {
        if (results.synced > 0) {
          console.log(`Auto-sync success: ${results.synced} items synced.`);
        }
      })
      .catch(err => console.error('Auto-sync error:', err));
  });
}

import {
  saveSubmissionOffline as saveDBOffline,
  getPendingSubmissions,
  markAsSyncedInDB,
  getMortalityReports
} from './offline-db';
import { appendToSheets, buildSheetRow } from './sheetsService';
import { supabase } from './supabaseClient';

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
    ...formData,
    id: submissionId,
    status: 'pending',
    sync_status: 'pending',
    sync_attempts: 0,
    submitted_at: now.toISOString(),
    created_at: now.toISOString(),
    supervisor_name: supervisorName,
    supervisor_email: supervisorEmail,
    photo_blob: photoBase64,
    photo_filename: photoFilename
  };

  await saveDBOffline(submission);
  return submissionId;
}

/**
 * Uploads all pending submissions to Google Drive & Google Sheets, and updates the FastAPI backend.
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

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  for (const submission of pending) {
    try {
      let supabasePhotoUrl = null;

      // 1. Upload photo to Supabase Storage first if present
      if (submission.photo_blob && submission.photo_filename) {
        try {
          const blob = base64ToBlob(submission.photo_blob);
          const filePath = `${submission.zone || 'unassigned'}/${submission.photo_filename}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('inspection-photos')
            .upload(filePath, blob, {
              contentType: 'image/jpeg',
              upsert: true
            });
            
          if (uploadError) {
            console.error('Error uploading photo to Supabase Storage:', uploadError);
            throw new Error(`Supabase photo upload failed: ${uploadError.message}`);
          } else {
            const { data: publicUrlData } = supabase.storage
                .from('inspection-photos')
                .getPublicUrl(filePath);
            supabasePhotoUrl = publicUrlData.publicUrl;
            console.log('Successfully uploaded photo to Supabase Storage:', supabasePhotoUrl);
          }
        } catch (photoErr: any) {
          console.error('Failed to process and upload photo to Supabase (continuing with text sync):', photoErr);
          // Set to null or fallback URL so the text submission can still sync successfully
          supabasePhotoUrl = null;
        }
      }

      // 2. Build row data and write to Google Sheets
      const rowData = buildSheetRow(submission, null);
      await appendToSheets(token, sheetId, rowData);

      // 3. Write to our FastAPI backend API (which writes to Supabase)
      const payload = {
        id: submission.id,
        plant_id: submission.plant_id || '',
        zone: submission.zone || '',
        block: submission.block || '',
        supervisor_name: submission.supervisor_name || null,
        supervisor_email: submission.supervisor_email || null,
        watering_status: submission.watering_status || null,
        sunlight_level: submission.sunlight_level || null,
        shade_level: submission.shade_level || null,
        soil_ph: submission.soil_pH !== undefined && submission.soil_pH !== null ? Number(submission.soil_pH) : null,
        temperature_c: submission.temperature_c !== undefined && submission.temperature_c !== null ? Number(submission.temperature_c) : null,
        humidity_pct: submission.humidity_pct !== undefined && submission.humidity_pct !== null ? Number(submission.humidity_pct) : null,
        soil_type: submission.soil_type || null,
        fertiliser_type: Array.isArray(submission.fertiliser_type) ? submission.fertiliser_type : (submission.fertiliser_type ? [submission.fertiliser_type] : null),
        last_fertilised: submission.last_fertilised || null,
        fertiliser_used: submission.fertiliser_used || null,
        vine_height_cm: submission.vine_height_cm !== undefined && submission.vine_height_cm !== null ? Number(submission.vine_height_cm) : null,
        height_delta_cm: submission.height_delta_cm !== undefined && submission.height_delta_cm !== null ? Number(submission.height_delta_cm) : null,
        foliage_color: submission.foliage_color || null,
        planting_arrangement: submission.planting_arrangement || null,
        notes: submission.field_notes || submission.notes || null,
        photo_filename: submission.photo_filename || null,
        photo_url: supabasePhotoUrl || submission.photo_url || null,
        status: 'synced',
        sync_status: 'synced',
        submitted_at: submission.submitted_at || new Date().toISOString()
      };

      const response = await fetch(`${backendUrl}/api/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errMsg = await response.text();
        throw new Error(`FastAPI submission sync failed for ${submission.id}: ${errMsg}`);
      }
      
      console.log(`Successfully synced submission ${submission.id} to FastAPI backend.`);

      // 4. Mark as synced in local DB
      await markAsSyncedInDB(submission.id, supabasePhotoUrl || undefined);
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

  // Also sync mortality reports to the FastAPI backend
  try {
    const mortalityReports = await getMortalityReports();
    for (const report of mortalityReports) {
      const payload = {
        id: report.id,
        zone: report.zone,
        block: report.block,
        dead_support_trees: Number(report.dead_support_trees || 0),
        dead_vines: Number(report.dead_vines || 0),
        reported_at: report.reportedAt || report.reported_at || new Date().toISOString()
      };
      
      const response = await fetch(`${backendUrl}/api/mortality`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errMsg = await response.text();
        console.error(`FastAPI mortality sync failed for ${report.id}:`, errMsg);
      } else {
        console.log(`Successfully synced mortality report ${report.id} to FastAPI backend.`);
      }
    }
  } catch (mortErr) {
    console.error('Error syncing mortality reports to FastAPI:', mortErr);
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

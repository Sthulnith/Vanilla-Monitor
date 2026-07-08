'use client';

import { useEffect, useState } from 'react';
import { User, Settings, Database, LogOut, Save, ShieldAlert, Check } from 'lucide-react';
import { getUserProfile, logoutGoogle } from '../../lib/authService';
import { getSubmissionsCount, getMortalityCount, clearAllTables } from '../../lib/offline-db';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  
  // Storage settings
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [driveA, setDriveA] = useState('');
  const [driveB, setDriveB] = useState('');
  const [driveC, setDriveC] = useState('');
  const [driveD, setDriveD] = useState('');

  // DB stats
  const [recordsCount, setRecordsCount] = useState(0);
  const [mortalityCount, setMortalityCount] = useState(0);
  
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadData = async () => {
    // Auth profile
    const p = getUserProfile();
    setProfile(p);

    // Load API configs from localstorage / environment defaults
    if (typeof window !== 'undefined') {
      setSpreadsheetId(
        localStorage.getItem('spreadsheet_id') || process.env.NEXT_PUBLIC_SPREADSHEET_ID || ''
      );
      setDriveA(
        localStorage.getItem('drive_zone_A_folder_id') || process.env.NEXT_PUBLIC_DRIVE_ZONE_A_FOLDER_ID || ''
      );
      setDriveB(
        localStorage.getItem('drive_zone_B_folder_id') || process.env.NEXT_PUBLIC_DRIVE_ZONE_B_FOLDER_ID || ''
      );
      setDriveC(
        localStorage.getItem('drive_zone_C_folder_id') || process.env.NEXT_PUBLIC_DRIVE_ZONE_C_FOLDER_ID || ''
      );
      setDriveD(
        localStorage.getItem('drive_zone_D_folder_id') || process.env.NEXT_PUBLIC_DRIVE_ZONE_D_FOLDER_ID || ''
      );
    }

    // Counts
    const rCount = await getSubmissionsCount();
    const mCount = await getMortalityCount();
    setRecordsCount(rCount);
    setMortalityCount(mCount);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfigs = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem('spreadsheet_id', spreadsheetId);
      localStorage.setItem('drive_zone_A_folder_id', driveA);
      localStorage.setItem('drive_zone_B_folder_id', driveB);
      localStorage.setItem('drive_zone_C_folder_id', driveC);
      localStorage.setItem('drive_zone_D_folder_id', driveD);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { syncPendingSubmissions } = await import('../../lib/syncService');
      const result = await syncPendingSubmissions();
      alert(`Sync completed! Synced: ${result.synced}, Failed: ${result.failed}`);
      await loadData();
      window.dispatchEvent(new Event('submissions-updated'));
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed. Please check internet connection.');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearCache = async () => {
    if (confirm('CAUTION: This will delete ALL local inspections and dead vine reports from IndexedDB. Proceed?')) {
      await clearAllTables();
      await loadData();
      window.dispatchEvent(new Event('submissions-updated'));
      alert('Local database cache cleared successfully.');
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'SV';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col bg-surface min-h-screen">
      {/* Header */}
      <div className="bg-primary text-white px-5 py-5 flex justify-between items-center rounded-b-3xl shadow-md">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-green-light flex items-center gap-1">
            <User className="h-3 w-3" />
            Supervisor Profile
          </span>
          <h1 className="text-xl font-extrabold mt-0.5">Control Settings</h1>
          <p className="text-xs text-green-pale/85 mt-0.5 font-medium">Configure PWA parameters</p>
        </div>
      </div>

      <div className="p-5 space-y-6 flex-1 pb-24">
        {/* Supervisor Identity Card */}
        {profile && (
          <div className="bg-white rounded-2xl border border-border-light p-4 shadow-sm flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary-container text-white text-base font-extrabold flex items-center justify-center border border-white/20">
              {getInitials(profile.name)}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-extrabold text-text-primary">{profile.name}</h3>
              <p className="text-xs text-text-secondary mt-0.5 font-medium">{profile.email}</p>
            </div>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to sign out?')) logoutGoogle();
              }}
              className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition"
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* GOOGLE DRIVE & SHEETS CONFIG */}
        <div className="bg-white rounded-2xl border border-border-light p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-secondary uppercase tracking-widest flex items-center gap-1.5 border-b border-border-light/50 pb-2">
            <Settings className="h-4 w-4" />
            Google API Integrations
          </h3>

          <form onSubmit={handleSaveConfigs} className="space-y-3">
            <div>
              <label className="text-[9px] font-bold text-text-secondary uppercase">Spreadsheet ID</label>
              <input
                type="text"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="Google Sheet Resource ID"
                className="w-full mt-1 border border-border-light rounded-lg p-2.5 text-xs font-mono focus:outline-primary"
              />
            </div>

            <div className="my-2 border-t border-border-light/40 pt-2">
              <span className="text-[9px] font-bold text-text-secondary uppercase block mb-2">
                Google Drive Zone Folder IDs
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] font-bold text-text-secondary uppercase">Zone A Folder</label>
                  <input
                    type="text"
                    value={driveA}
                    onChange={(e) => setDriveA(e.target.value)}
                    placeholder="Folder ID"
                    className="w-full mt-1 border border-border-light rounded-lg p-2 text-[10px] font-mono focus:outline-primary"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-text-secondary uppercase">Zone B Folder</label>
                  <input
                    type="text"
                    value={driveB}
                    onChange={(e) => setDriveB(e.target.value)}
                    placeholder="Folder ID"
                    className="w-full mt-1 border border-border-light rounded-lg p-2 text-[10px] font-mono focus:outline-primary"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-text-secondary uppercase">Zone C Folder</label>
                  <input
                    type="text"
                    value={driveC}
                    onChange={(e) => setDriveC(e.target.value)}
                    placeholder="Folder ID"
                    className="w-full mt-1 border border-border-light rounded-lg p-2 text-[10px] font-mono focus:outline-primary"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-text-secondary uppercase">Zone D Folder</label>
                  <input
                    type="text"
                    value={driveD}
                    onChange={(e) => setDriveD(e.target.value)}
                    placeholder="Folder ID"
                    className="w-full mt-1 border border-border-light rounded-lg p-2 text-[10px] font-mono focus:outline-primary"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className={`w-full py-3 rounded-full text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all ${
                saveSuccess
                  ? 'bg-pale-green border border-primary text-primary'
                  : 'bg-[#1B4332] text-white hover:bg-primary'
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check className="h-4 w-4" />
                  Configurations Saved!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Configurations
                </>
              )}
            </button>
          </form>
        </div>

        {/* CACHE & STORAGE MANAGEMENT */}
        <div className="bg-white rounded-2xl border border-border-light p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-secondary uppercase tracking-widest flex items-center gap-1.5 border-b border-border-light/50 pb-2">
            <Database className="h-4 w-4" />
            Database Cache Settings
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface rounded-xl p-3 border border-border-light text-center">
              <span className="text-[8px] font-bold text-text-secondary uppercase block">Inspections</span>
              <span className="text-base font-extrabold text-primary block mt-0.5">{recordsCount}</span>
            </div>
            <div className="bg-surface rounded-xl p-3 border border-border-light text-center">
              <span className="text-[8px] font-bold text-text-secondary uppercase block">Mortality Reports</span>
              <span className="text-base font-extrabold text-primary block mt-0.5">{mortalityCount}</span>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5">
            <ShieldAlert className="h-4.5 w-4.5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 w-full">
              <p className="text-[10px] text-red-800 font-semibold leading-relaxed">
                Clearing your cache will purge all offline inspections. Ensure pending submissions are synced.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  id="sync-pending-btn"
                  onClick={handleSync}
                  disabled={syncing}
                  className="bg-[#1B4332] text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-xs hover:bg-primary transition disabled:opacity-50"
                >
                  {syncing ? 'Syncing...' : 'Sync Pending Data'}
                </button>
                <button
                  type="button"
                  onClick={handleClearCache}
                  className="bg-red-600 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-xs hover:bg-red-700 transition"
                >
                  Clear Database Cache
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { User, Database, LogOut, ShieldAlert } from 'lucide-react';
import { getUserProfile, logoutGoogle } from '../../lib/authService';
import { getSubmissionsCount, getMortalityCount, clearAllTables } from '../../lib/offline-db';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);

  // DB stats
  const [recordsCount, setRecordsCount] = useState(0);
  const [mortalityCount, setMortalityCount] = useState(0);

  const loadData = async () => {
    // Auth profile
    const p = getUserProfile();
    setProfile(p);

    // Counts
    const rCount = await getSubmissionsCount();
    const mCount = await getMortalityCount();
    setRecordsCount(rCount);
    setMortalityCount(mCount);
  };

  useEffect(() => {
    loadData();
  }, []);

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

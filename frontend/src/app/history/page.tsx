'use client';

import { useEffect, useState } from 'react';
import { History, Search, RefreshCw, X, CheckCircle, Wifi, WifiOff, FileText, ChevronRight } from 'lucide-react';
import { getPendingSubmissions, getPendingInspections } from '../../lib/offline-db';
import { syncPendingSubmissions, base64ToBlob } from '../../lib/syncService';
import { supabase } from '../../lib/supabaseClient';

export default function HistoryPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<any[]>([]);
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'synced' | 'pending'>('all');
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Selected submission modal
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  const loadSubmissions = async () => {
    // 1. Fetch pending records from IndexedDB
    const pendingSubs = await getPendingSubmissions();
    const pendingInsps = await getPendingInspections();

    // 2. Fetch synced records from Supabase directly
    let remoteInsps: any[] = [];
    try {
      const { data, error } = await supabase
        .from('inspections')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        remoteInsps = data;
      }
    } catch (err) {
      console.error('Failed to fetch inspections from Supabase:', err);
    }

    // Filter remote records to avoid duplicates with pending offline records
    const remoteInspsFiltered = remoteInsps.filter(r => !pendingInsps.some(p => p.id === r.id));

    // Map new inspections to have compatible display fields
    const mappedInsps = [...pendingInsps, ...remoteInspsFiltered].map(i => ({
      ...i,
      submitted_at: i.created_at || i.inspection_date,
      field_notes: i.notes,
      soil_pH: i.soil_ph,
      fertiliser_type: i.fertilizer_type || [],
      fertiliser_used: i.fertilizer_used,
      last_fertilised: i.last_fertilized,
      zone: i.zone || i.plant_id?.split('-')[0]?.charAt(0) || 'A',
      block: i.block || i.plant_id?.split('-')[0]?.substring(1) || '01',
      common_name: i.common_name || 'Vanilla',
      variety: i.variety || 'Local'
    }));

    const allSubmissions = [
      ...pendingSubs,
      ...mappedInsps
    ];

    // Sort descending by date
    const sorted = [...allSubmissions].sort(
      (a, b) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime()
    );
    setSubmissions(sorted);
  };

  const updateNetworkStatus = () => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
  };

  useEffect(() => {
    loadSubmissions();
    updateNetworkStatus();

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    window.addEventListener('sync-complete', loadSubmissions);
    window.addEventListener('submissions-updated', loadSubmissions);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      window.removeEventListener('sync-complete', loadSubmissions);
      window.removeEventListener('submissions-updated', loadSubmissions);
    };
  }, []);

  // Filter application
  useEffect(() => {
    let result = [...submissions];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(sub => sub.sync_status === statusFilter);
    }

    // Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        sub =>
          (sub.plant_id && sub.plant_id.toLowerCase().includes(q)) ||
          (sub.zone && sub.zone.toLowerCase().includes(q)) ||
          (sub.block && sub.block.toLowerCase().includes(q)) ||
          (sub.field_notes && sub.field_notes.toLowerCase().includes(q)) ||
          (sub.notes && sub.notes.toLowerCase().includes(q))
      );
    }

    setFilteredSubmissions(result);
  }, [submissions, searchQuery, statusFilter]);

  const handleSyncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await syncPendingSubmissions();
      alert(`Sync process complete. Synced: ${res.synced}, Failed: ${res.failed}`);
      await loadSubmissions();
    } catch (err) {
      console.error(err);
      alert('Sync failed. Check your network or credentials.');
    } finally {
      setSyncing(false);
    }
  };

  // Open details modal
  const handleOpenDetails = (sub: any) => {
    setSelectedSub(sub);
    if (sub.photo_blob) {
      try {
        const blob = base64ToBlob(sub.photo_blob);
        const url = URL.createObjectURL(blob);
        setSelectedPhotoUrl(url);
      } catch (err) {
        console.error(err);
        setSelectedPhotoUrl(null);
      }
    } else {
      setSelectedPhotoUrl(sub.photo_url || null);
    }
  };

  // Close details modal
  const handleCloseDetails = () => {
    setSelectedSub(null);
    if (selectedPhotoUrl && selectedPhotoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(selectedPhotoUrl);
    }
    setSelectedPhotoUrl(null);
  };

  const getFoliageColorDot = (color: string) => {
    switch (color) {
      case 'Green': return 'bg-zone-c';
      case 'Yellow': return 'bg-amber-warning';
      case 'Brown': return 'bg-orange-800';
      case 'Red': return 'bg-zone-a';
      default: return 'bg-gray-400';
    }
  };

  const getPendingCountNum = submissions.filter(s => s.sync_status === 'pending').length;

  return (
    <div className="flex flex-col bg-surface min-h-screen">
      {/* Header Banner */}
      <div className="bg-primary text-white px-5 py-5 rounded-b-3xl shadow-md space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-green-light flex items-center gap-1">
              <History className="h-3 w-3" />
              Inspection Log
            </span>
            <h1 className="text-xl font-extrabold mt-0.5">Submission History</h1>
          </div>

          {/* Sync Trigger button */}
          {getPendingCountNum > 0 && (
            <button
              onClick={handleSyncNow}
              disabled={syncing || !isOnline}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                isOnline
                  ? 'bg-secondary text-white hover:bg-secondary/90'
                  : 'bg-white/10 text-white/50 cursor-not-allowed'
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Queue'}</span>
            </button>
          )}
        </div>

        {/* Search Field */}
        <div className="relative flex items-center bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5">
          <Search className="h-4 w-4 text-white/60 mr-2" />
          <input
            type="text"
            placeholder="Search plant ID, zone, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-white placeholder:text-white/55 outline-none flex-1 font-semibold"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-white/60 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-5 py-3 flex gap-2 border-b border-border-light bg-white">
        {(['all', 'synced', 'pending'] as const).map((status) => {
          const isSelected = statusFilter === status;
          const count = status === 'all'
            ? submissions.length
            : submissions.filter(s => s.sync_status === status).length;

          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                isSelected
                  ? 'bg-pale-green text-primary border border-primary/25'
                  : 'text-text-secondary hover:text-primary'
              }`}
            >
              <span className="capitalize">{status}</span>
              <span className="ml-1 text-[9px] bg-black/5 px-1.5 py-0.5 rounded-full">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Submissions List */}
      <div className="p-5 flex-1 pb-24 space-y-3">
        {filteredSubmissions.length === 0 ? (
          <div className="bg-white border border-dashed border-border-light rounded-3xl p-10 text-center text-text-secondary">
            <FileText className="h-10 w-10 mx-auto mb-2.5 opacity-30 text-primary" />
            <p className="text-xs font-semibold">No records found matching filters.</p>
            <p className="text-[10px] opacity-75 mt-0.5">Try adjusting query or log a new inspection.</p>
          </div>
        ) : (
          filteredSubmissions.map((sub) => (
            <button
              key={sub.id}
              onClick={() => handleOpenDetails(sub)}
              className="w-full text-left bg-white rounded-2xl border border-border-light p-4 shadow-xs flex justify-between items-center hover:shadow-md hover:border-primary/20 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                {/* Foliage color indicator */}
                <div className={`h-3 w-3 rounded-full flex-shrink-0 ${getFoliageColorDot(sub.foliage_color)}`} />
                <div>
                  <h4 className="text-xs font-black text-text-primary">Plant {sub.plant_id}</h4>
                  <p className="text-[9px] text-text-secondary mt-0.5">
                    Zone {sub.zone} • Block {sub.block} • {sub.plant_type || 'Cutting'}
                  </p>
                  <p className="text-[10px] font-medium text-text-primary mt-1 line-clamp-1 max-w-[200px]">
                    {sub.field_notes || sub.notes || 'No notes added.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end flex-shrink-0">
                <span className="text-[9px] font-semibold text-text-secondary">
                  {new Date(sub.submitted_at || sub.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
                <span
                  className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded-full mt-1.5 uppercase ${
                    sub.sync_status === 'synced'
                      ? 'bg-pale-green text-primary'
                      : 'bg-amber-warning/20 text-amber-700'
                  }`}
                >
                  {sub.sync_status || 'pending'}
                </span>
                <ChevronRight className="h-4 w-4 text-text-secondary mt-1 opacity-50" />
              </div>
            </button>
          ))
        )}
      </div>

      {/* ─── MODAL: INSPECTION DETAILS ────────────────────────────── */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-border-light max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-primary px-5 py-4 text-white flex justify-between items-center flex-shrink-0">
              <div>
                <span className="text-[9px] uppercase font-bold text-green-light tracking-widest">
                  Inspection Details
                </span>
                <h3 className="font-extrabold text-sm mt-0.5">
                  Plant {selectedSub.plant_id} Observation
                </h3>
              </div>
              <button onClick={handleCloseDetails} className="text-white/80 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Photo preview if exists */}
              {selectedPhotoUrl && (
                <div className="relative rounded-2xl overflow-hidden border border-border-light h-44 flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedPhotoUrl}
                    alt="Plant record preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* General Specs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface rounded-xl p-3 border border-border-light">
                  <span className="text-[8px] font-bold text-text-secondary uppercase">Common Name</span>
                  <span className="text-xs font-bold text-text-primary block mt-0.5">{selectedSub.common_name || 'Vanilla'}</span>
                </div>
                <div className="bg-surface rounded-xl p-3 border border-border-light">
                  <span className="text-[8px] font-bold text-text-secondary uppercase">Variety</span>
                  <span className="text-xs font-bold text-text-primary block mt-0.5">{selectedSub.variety || 'Local'}</span>
                </div>
                <div className="bg-surface rounded-xl p-3 border border-border-light">
                  <span className="text-[8px] font-bold text-text-secondary uppercase">Vine Height</span>
                  <span className="text-xs font-bold text-text-primary block mt-0.5">
                    {selectedSub.vine_height_cm !== undefined && selectedSub.vine_height_cm !== null ? `${selectedSub.vine_height_cm} cm` : 'N/A'}
                  </span>
                </div>
                <div className="bg-surface rounded-xl p-3 border border-border-light">
                  <span className="text-[8px] font-bold text-text-secondary uppercase">Soil pH</span>
                  <span className="text-xs font-bold text-text-primary block mt-0.5">{selectedSub.soil_pH ?? selectedSub.soil_ph ?? 'N/A'}</span>
                </div>
                <div className="bg-surface rounded-xl p-3 border border-border-light">
                  <span className="text-[8px] font-bold text-text-secondary uppercase">Moisture Status</span>
                  <span className="text-xs font-bold text-text-primary block mt-0.5">{selectedSub.watering_status || 'N/A'}</span>
                </div>
                <div className="bg-surface rounded-xl p-3 border border-border-light">
                  <span className="text-[8px] font-bold text-text-secondary uppercase">Sunlight</span>
                  <span className="text-xs font-bold text-text-primary block mt-0.5">{selectedSub.sunlight_level || 'N/A'}</span>
                </div>
              </div>

              {/* Fertilization info */}
              <div className="bg-surface rounded-xl p-3 border border-border-light space-y-1">
                <span className="text-[8px] font-bold text-text-secondary uppercase">Fertilisation Status</span>
                <div className="text-xs text-text-primary font-bold">
                  Brand: <span className="font-semibold">{selectedSub.fertiliser_used || 'None'}</span>
                </div>
                <div className="text-[10px] text-text-secondary font-semibold">
                  Types: {Array.isArray(selectedSub.fertiliser_type) ? selectedSub.fertiliser_type.join(', ') : (selectedSub.fertiliser_type || 'N/A')}
                </div>
              </div>

              {/* Field Notes */}
              <div className="bg-surface rounded-xl p-3 border border-border-light">
                <span className="text-[8px] font-bold text-text-secondary uppercase block mb-1">Field Notes</span>
                <p className="text-xs font-medium text-text-primary leading-relaxed whitespace-pre-line">
                  {selectedSub.field_notes ?? selectedSub.notes ?? 'No additional notes recorded.'}
                </p>
              </div>

              {/* Sync details */}
              <div className="text-[9px] text-text-secondary space-y-0.5 pt-2 border-t border-border-light font-medium">
                <div>ID: {selectedSub.id}</div>
                <div>Supervisor: {selectedSub.supervisor_name} ({selectedSub.supervisor_email})</div>
                <div>Submitted: {new Date(selectedSub.submitted_at || selectedSub.created_at).toLocaleString()}</div>
                <div className="flex items-center gap-1 mt-1">
                  <span>Sync Status:</span>
                  <span className={`font-bold uppercase ${selectedSub.sync_status === 'synced' ? 'text-primary' : 'text-amber-700'}`}>
                    {selectedSub.sync_status}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-border-light flex-shrink-0">
              <button
                onClick={handleCloseDetails}
                className="w-full bg-[#1B4332] text-white py-3 rounded-full text-xs font-bold hover:bg-primary transition shadow-md"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  ClipboardList,
  History,
  AlertTriangle,
  Plus,
  X,
  TrendingUp,
  MapPin,
  Sprout,
  ScanLine,
  FileText,
  Skull
} from 'lucide-react';
import { getUserProfile, logoutGoogle } from '../../lib/authService';
import {
  getPendingCount,
  getSubmissions,
  getMortalityStats,
  saveMortalityReport,
  saveSubmissionOffline
} from '../../lib/offline-db';
import { supabase } from '../../lib/supabaseClient';
import { PLANTATION } from '../../lib/plantData';

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalPlants: 2187,
    totalBlocks: 19,
    deadVines: 0,
    deadTrees: 0,
    recentSubmissions: [] as any[]
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [mockOffline, setMockOffline] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMockOffline(localStorage.getItem('mock_offline') === 'true');
    }
  }, []);

  const toggleMockOffline = () => {
    const nextVal = !mockOffline;
    localStorage.setItem('mock_offline', String(nextVal));
    setMockOffline(nextVal);
    window.dispatchEvent(new Event(nextVal ? 'offline' : 'online'));
    window.dispatchEvent(new Event('submissions-updated'));
    if (!nextVal) {
      import('../../lib/syncService').then(({ syncPendingSubmissions }) => {
        syncPendingSubmissions().catch(err => console.error('Sync failed:', err));
      });
    }
  };

  // Modal States
  const [isDeadModalOpen, setIsDeadModalOpen] = useState(false);
  const [isQuickPhotoOpen, setIsQuickPhotoOpen] = useState(false);

  // Form states for Dead Vine Report
  const [deadZone, setDeadZone] = useState('A');
  const [deadBlock, setDeadBlock] = useState('01');
  const [deadTreesCount, setDeadTreesCount] = useState(0);
  const [deadVinesCount, setDeadVinesCount] = useState(0);
  const [deadNotes, setDeadNotes] = useState('');

  // Form states for Quick Photo
  const [photoZone, setPhotoZone] = useState('A');
  const [photoBlock, setPhotoBlock] = useState('01');
  const [photoPlantNum, setPhotoPlantNum] = useState(1);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoNotes, setPhotoNotes] = useState('');

  const loadData = async () => {
    const p = getUserProfile();
    setProfile(p);

    const mortality = await getMortalityStats();
    const count = await getPendingCount();
    setPendingCount(count);

    // Pull latest 3 inspections from Supabase (joined with plants for zone/block/variety)
    let recent: any[] = [];
    try {
      const { data } = await supabase
        .from('inspections')
        .select(`
          id, plant_id, inspection_date, created_at, foliage_color,
          soil_ph, watering_status, vine_height_cm, notes, sync_status,
          plants!left(zone, block, common_name, variety, plant_type)
        `)
        .order('created_at', { ascending: false })
        .limit(3);

      if (data && data.length > 0) {
        recent = data.map((r: any) => ({
          ...r,
          zone: r.plants?.zone || r.plant_id?.charAt(0) || '?',
          block: r.plants?.block || r.plant_id?.substring(1, 3) || '??',
          common_name: r.plants?.common_name || 'Vanilla',
          variety: r.plants?.variety || 'Local',
          plant_type: r.plants?.plant_type || 'Cutting',
          soil_pH: r.soil_ph,
          submitted_at: r.created_at || r.inspection_date,
          sync_status: r.sync_status || 'synced',
        }));
      }
    } catch {
      // Offline fallback: use legacy IndexedDB submissions
      const offline = await getSubmissions();
      recent = [...offline]
        .sort((a, b) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime())
        .slice(0, 3);
    }

    setStats({
      totalPlants: 2187,
      totalBlocks: 19,
      deadVines: mortality.deadVines,
      deadTrees: mortality.deadTrees,
      recentSubmissions: recent,
    });
  };

  useEffect(() => {
    loadData();

    // Listen to sync completions or changes
    window.addEventListener('sync-complete', loadData);
    window.addEventListener('submissions-updated', loadData);

    return () => {
      window.removeEventListener('sync-complete', loadData);
      window.removeEventListener('submissions-updated', loadData);
    };
  }, []);

  const handleDeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const report = {
      id: `dead-report-${Date.now()}`,
      zone: deadZone,
      block: deadBlock,
      dead_support_trees: deadTreesCount,
      dead_vines: deadVinesCount,
      notes: deadNotes,
      reportedAt: new Date().toISOString()
    };

    await saveMortalityReport(report);
    
    // Close modal, reset form and dispatch event
    setIsDeadModalOpen(false);
    setDeadTreesCount(0);
    setDeadVinesCount(0);
    setDeadNotes('');
    
    window.dispatchEvent(new Event('submissions-updated'));
  };

  const handleQuickPhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile) return;

    // Create a mini submission record containing only the photo and identifiers
    const plantId = `${photoZone}${photoBlock.padStart(2, '0')}-P${String(photoPlantNum).padStart(3, '0')}`;
    
    const partialSubmission = {
      zone: photoZone,
      block: photoBlock,
      plant_number: photoPlantNum,
      plant_id: plantId,
      // Minimal defaults for required columns
      watering_status: 'Keep moist',
      sunlight_level: 'Bright indirect',
      shade_level: 'Shade <75%',
      soil_pH: 6.2,
      vine_height_cm: 100,
      foliage_color: 'Green',
      planting_arrangement: 'Square',
      field_notes: `Quick Photo: ${photoNotes}`,
    };

    // Save offline using the syncService helper structure
    // Since we want to use syncService but it's client-only, let's load it dynamically or import it
    const { saveInspectionOffline } = await import('../../lib/syncService');
    await saveInspectionOffline(partialSubmission, photoFile);

    setIsQuickPhotoOpen(false);
    setPhotoNotes('');
    setPhotoFile(null);

    window.dispatchEvent(new Event('submissions-updated'));
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

  const getFoliageColorDot = (color: string) => {
    switch (color) {
      case 'Green': return 'bg-zone-c';
      case 'Yellow': return 'bg-amber-warning';
      case 'Brown': return 'bg-orange-800';
      case 'Red': return 'bg-zone-a';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="flex flex-col bg-surface min-h-screen">
      {/* Header Banner */}
      <div className="bg-primary-container text-white px-5 py-6 rounded-b-3xl shadow-md">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-green-light">
              Sapori dal Mondo
            </span>
            <h1 className="text-xl font-extrabold mt-0.5">
              Good morning, {profile?.name?.split(' ')[0] || 'Supervisor'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-green-pale/75 font-semibold">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
              <button
                id="toggle-offline-btn"
                onClick={toggleMockOffline}
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${
                  mockOffline ? 'bg-amber-warning text-primary-container animate-pulse' : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
                }`}
              >
                {mockOffline ? 'Offline' : 'Go Offline'}
              </button>
            </div>
          </div>
          <button 
            onClick={() => {
              if (confirm('Are you sure you want to sign out?')) {
                logoutGoogle();
              }
            }}
            className="h-10 w-10 bg-white/10 rounded-full flex items-center justify-center font-bold text-sm tracking-wide border border-white/20 hover:bg-white/20"
          >
            {getInitials(profile?.name || '')}
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="bg-white/10 border border-white/10 rounded-2xl p-3 text-center">
            <span className="text-[9px] uppercase font-bold text-green-pale/70 block">Total Plants</span>
            <span className="text-lg font-black block mt-0.5">{stats.totalPlants}</span>
          </div>
          <div className="bg-white/10 border border-white/10 rounded-2xl p-3 text-center">
            <span className="text-[9px] uppercase font-bold text-green-pale/70 block">Total Blocks</span>
            <span className="text-lg font-black block mt-0.5">{stats.totalBlocks}</span>
          </div>
          <div className="bg-white/10 border border-white/10 rounded-2xl p-3 text-center">
            <span className="text-[9px] uppercase font-bold text-green-pale/70 block">Dead Vines</span>
            <span className="text-lg font-black text-red-300 block mt-0.5">{stats.deadVines}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-5 py-6 space-y-6">
        
        {/* Quick Actions Grid */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/add-plant"
              className="bg-white rounded-2xl shadow-sm border border-border-light p-4 flex flex-col items-start hover:border-primary/30 transition-all duration-200"
            >
              <div className="h-10 w-10 bg-pale-green text-primary rounded-xl flex items-center justify-center mb-3">
                <Sprout className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-text-primary">Add New Plant</span>
              <span className="text-[10px] text-text-secondary mt-0.5">Register static plant details</span>
            </Link>

            <Link
              href="/inspect"
              className="bg-white rounded-2xl shadow-sm border border-border-light p-4 flex flex-col items-start hover:border-primary/30 transition-all duration-200"
            >
              <div className="h-10 w-10 bg-pale-green text-primary rounded-xl flex items-center justify-center mb-3">
                <ScanLine className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-text-primary">New Inspection</span>
              <span className="text-[10px] text-text-secondary mt-0.5">Scan QR or select plant</span>
            </Link>

            <button
              onClick={() => setIsQuickPhotoOpen(true)}
              className="bg-white text-left rounded-2xl shadow-sm border border-border-light p-4 flex flex-col items-start hover:border-primary/30 transition-all duration-200"
            >
              <div className="h-10 w-10 bg-pale-green text-primary rounded-xl flex items-center justify-center mb-3">
                <Camera className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-text-primary">Quick Photo</span>
              <span className="text-[10px] text-text-secondary mt-0.5">Attach image directly</span>
            </button>

            <Link
              href="/history"
              className="bg-white rounded-2xl shadow-sm border border-border-light p-4 flex flex-col items-start hover:border-primary/30 transition-all duration-200"
            >
              <div className="h-10 w-10 bg-pale-green text-primary rounded-xl flex items-center justify-center mb-3">
                <FileText className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-text-primary">My Submissions</span>
              <span className="text-[10px] text-text-secondary mt-0.5">
                View logged inspection reports
              </span>
            </Link>

            <button
              onClick={() => setIsDeadModalOpen(true)}
              className="bg-white text-left rounded-2xl shadow-sm border border-border-light p-4 flex flex-col items-start hover:border-primary/30 transition-all duration-200 col-span-2"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-10 bg-red-100 text-red-700 rounded-xl flex items-center justify-center animate-pulse">
                  <Skull className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-bold text-text-primary block">Dead Vine Report</span>
                  <span className="text-[10px] text-text-secondary mt-0.5 block">Log vine/support tree mortality</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Submissions */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Recent Submissions</h2>
            <Link href="/history" className="text-[10px] font-bold text-secondary uppercase hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {stats.recentSubmissions.length === 0 ? (
              <div className="bg-white border border-dashed border-border-light rounded-2xl p-6 text-center text-text-secondary">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40 text-primary" />
                <p className="text-xs font-medium">No inspection records logged yet.</p>
                <p className="text-[10px] opacity-75 mt-0.5">Logged forms will appear here.</p>
              </div>
            ) : (
              stats.recentSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white rounded-2xl border border-border-light p-4 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${getFoliageColorDot(sub.foliage_color)}`} />
                    <div>
                      <h4 className="text-xs font-bold text-text-primary">Plant {sub.plant_id}</h4>
                      <p className="text-[10px] text-text-secondary mt-0.5">
                        pH: {sub.soil_pH ?? sub.soil_ph ?? 'N/A'} • {sub.watering_status || 'N/A'} • Height: {sub.vine_height_cm !== undefined && sub.vine_height_cm !== null ? `${sub.vine_height_cm} cm` : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-medium text-text-secondary block">
                      {new Date(sub.submitted_at || sub.created_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span
                      className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded-full mt-1 uppercase ${
                        sub.sync_status === 'synced'
                          ? 'bg-pale-green text-primary'
                          : 'bg-amber-warning/20 text-amber-700'
                      }`}
                    >
                      {sub.sync_status || 'pending'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: DEAD VINE REPORT ──────────────────────────────── */}
      {isDeadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-border-light animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-primary px-5 py-4 text-white flex justify-between items-center">
              <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-warning" />
                Dead Vine Mortality Report
              </h3>
              <button onClick={() => setIsDeadModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleDeadSubmit} className="p-5 space-y-4">
              {/* Zone / Block selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Zone</label>
                  <select
                    value={deadZone}
                    onChange={(e) => {
                      setDeadZone(e.target.value);
                      setDeadBlock(PLANTATION[e.target.value].blocks[0].id);
                    }}
                    className="w-full mt-1 border border-border-light rounded-lg p-2 text-xs font-semibold focus:outline-primary"
                  >
                    {Object.keys(PLANTATION).map(z => (
                      <option key={z} value={z}>Zone {z}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Block</label>
                  <select
                    value={deadBlock}
                    onChange={(e) => setDeadBlock(e.target.value)}
                    className="w-full mt-1 border border-border-light rounded-lg p-2 text-xs font-semibold focus:outline-primary"
                  >
                    {PLANTATION[deadZone]?.blocks.map(b => (
                      <option key={b.id} value={b.id}>Block {b.id}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dead tree and vine inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-text-secondary uppercase leading-normal">Dead Support Trees</label>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setDeadTreesCount(Math.max(0, deadTreesCount - 1))}
                      className="h-8 w-8 border border-border-light rounded-lg flex items-center justify-center font-bold text-xs"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-xs font-bold">{deadTreesCount}</span>
                    <button
                      type="button"
                      onClick={() => setDeadTreesCount(deadTreesCount + 1)}
                      className="h-8 w-8 border border-border-light rounded-lg flex items-center justify-center font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-text-secondary uppercase leading-normal">Dead Vines Count</label>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setDeadVinesCount(Math.max(0, deadVinesCount - 1))}
                      className="h-8 w-8 border border-border-light rounded-lg flex items-center justify-center font-bold text-xs"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-xs font-bold">{deadVinesCount}</span>
                    <button
                      type="button"
                      onClick={() => setDeadVinesCount(deadVinesCount + 1)}
                      className="h-8 w-8 border border-border-light rounded-lg flex items-center justify-center font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Notes / Observations</label>
                <textarea
                  value={deadNotes}
                  onChange={(e) => setDeadNotes(e.target.value)}
                  placeholder="Note boundary points, tree varieties, or fungal rot indications..."
                  rows={2}
                  className="w-full mt-1 border border-border-light rounded-lg p-2 text-xs focus:outline-primary placeholder:text-gray-300"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#1B4332] text-white py-3 rounded-full text-xs font-bold hover:bg-primary transition shadow-md"
              >
                Log Mortality Report
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: QUICK PHOTO ──────────────────────────────── */}
      {isQuickPhotoOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-border-light animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-primary px-5 py-4 text-white flex justify-between items-center">
              <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-green-light" />
                Quick Vine Photo Capture
              </h3>
              <button onClick={() => setIsQuickPhotoOpen(false)} className="text-white/80 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleQuickPhotoSubmit} className="p-5 space-y-4">
              {/* Plant selection */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-text-secondary uppercase">Zone</label>
                  <select
                    value={photoZone}
                    onChange={(e) => {
                      setPhotoZone(e.target.value);
                      setPhotoBlock(PLANTATION[e.target.value].blocks[0].id);
                    }}
                    className="w-full mt-1 border border-border-light rounded-lg p-2 text-xs font-semibold focus:outline-primary"
                  >
                    {Object.keys(PLANTATION).map(z => (
                      <option key={z} value={z}>Zone {z}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-text-secondary uppercase">Block</label>
                  <select
                    value={photoBlock}
                    onChange={(e) => setPhotoBlock(e.target.value)}
                    className="w-full mt-1 border border-border-light rounded-lg p-2 text-xs font-semibold focus:outline-primary"
                  >
                    {PLANTATION[photoZone]?.blocks.map(b => (
                      <option key={b.id} value={b.id}>Block {b.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-text-secondary uppercase">Plant #</label>
                  <input
                    type="number"
                    value={photoPlantNum}
                    min={1}
                    max={200}
                    onChange={(e) => setPhotoPlantNum(Number(e.target.value))}
                    className="w-full mt-1 border border-border-light rounded-lg p-2 text-xs font-semibold focus:outline-primary"
                  />
                </div>
              </div>

              {/* Photo Input */}
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase block mb-1">
                  Upload Photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      setPhotoFile(files[0]);
                    }
                  }}
                  required
                  className="w-full text-xs text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-pale-green file:text-primary hover:file:bg-pale-green/80"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Photo Notes</label>
                <textarea
                  value={photoNotes}
                  onChange={(e) => setPhotoNotes(e.target.value)}
                  placeholder="Describe why you took this photo (e.g. Stem Rot warning, first bloom...)"
                  rows={2}
                  className="w-full mt-1 border border-border-light rounded-lg p-2 text-xs focus:outline-primary placeholder:text-gray-300"
                />
              </div>

              <button
                type="submit"
                disabled={!photoFile}
                className="w-full bg-[#1B4332] text-white py-3 rounded-full text-xs font-bold hover:bg-primary transition shadow-md disabled:opacity-50"
              >
                Log Photo Submission
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

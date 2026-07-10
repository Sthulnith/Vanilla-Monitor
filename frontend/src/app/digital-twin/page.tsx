'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Map, AlertTriangle, CheckCircle, X, ClipboardCheck,
  QrCode, Download, ArrowLeft, MapPin, Leaf, TreePine,
  Calendar, Plus
} from 'lucide-react';
import { PLANTATION, getTrackedPlants } from '../../lib/plantData';
import { getSubmissions, getMortalityReports, getPlants, getPlantLocation } from '../../lib/offline-db';
import { supabase } from '../../lib/supabaseClient';
import { useInspection } from '../../context/InspectionContext';
import QRCode from 'qrcode';

export default function DigitalTwinPage() {
  const router = useRouter();
  const { updateForm } = useInspection();

  const [activeZoneFilter, setActiveZoneFilter] = useState<string>('All');
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [registeredPlants, setRegisteredPlants] = useState<any[]>([]);

  // Plant detail panel
  const [selectedPlant, setSelectedPlant] = useState<any>(null);
  const [plantLocation, setPlantLocation] = useState<any>(null);
  const [qrUrl, setQrUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Health metrics per block
  const [blockStatus, setBlockStatus] = useState<Record<string, { status: 'healthy' | 'warning' | 'danger'; deadCount: number }>>({});

  useEffect(() => {
    const loadPlants = async () => {
      const local = await getPlants();
      // merge with supabase
      const { data: remote } = await supabase.from('plants').select('*');
      const map = new Map<string, any>();
      (remote || []).forEach(p => map.set(p.plant_id, p));
      local.forEach(p => map.set(p.plant_id, { ...map.get(p.plant_id), ...p }));
      setRegisteredPlants(Array.from(map.values()));
    };
    loadPlants();
  }, []);

  useEffect(() => {
    const calculateBlockHealth = async () => {
      const submissions = await getSubmissions();
      const mortality = await getMortalityReports();
      const statusMap: Record<string, { status: 'healthy' | 'warning' | 'danger'; deadCount: number }> = {};

      Object.entries(PLANTATION).forEach(([zoneKey, zoneData]) => {
        zoneData.blocks.forEach((block) => {
          statusMap[`${zoneKey}-${block.id}`] = { status: 'healthy', deadCount: 0 };
        });
      });

      mortality.forEach((r) => {
        const key = `${r.zone}-${r.block}`;
        if (statusMap[key]) {
          statusMap[key].deadCount += r.dead_vines || 0;
          if (r.dead_vines > 2) statusMap[key].status = 'danger';
          else if (r.dead_vines > 0 && statusMap[key].status !== 'danger') statusMap[key].status = 'warning';
        }
      });

      submissions.forEach((s) => {
        const key = `${s.zone}-${s.block}`;
        if (statusMap[key]) {
          const pH = s.soil_pH ?? s.soil_ph;
          const foliage = s.foliage_color;
          if (pH < 5.5 || pH > 7.0 || foliage === 'Brown' || foliage === 'Red') {
            statusMap[key].status = 'danger';
          } else if (((pH >= 5.5 && pH < 6.0) || (pH > 6.5 && pH <= 7.0)) || foliage === 'Yellow' || foliage === 'Mixed') {
            if (statusMap[key].status !== 'danger') statusMap[key].status = 'warning';
          }
        }
      });

      setBlockStatus(statusMap);
    };
    calculateBlockHealth();
  }, []);

  // Open plant detail inside the block modal
  const openPlantDetail = async (plant: any) => {
    setSelectedPlant(plant);
    setQrUrl('');

    // Load GPS location
    const local = await getPlantLocation(plant.plant_id);
    if (local) {
      setPlantLocation(local);
    } else {
      const { data } = await supabase.from('plant_locations').select('*').eq('plant_id', plant.plant_id).single();
      setPlantLocation(data || null);
    }
  };

  // Generate QR when plant selected
  useEffect(() => {
    if (!selectedPlant || !canvasRef.current) return;
    const qrData = JSON.stringify({
      plant_id: selectedPlant.plant_id,
      zone: selectedPlant.zone,
      block: selectedPlant.block,
      plant_no: String(selectedPlant.plant_no)
    });
    QRCode.toCanvas(canvasRef.current, qrData, { width: 190, margin: 2 }, (err) => {
      if (!err && canvasRef.current) setQrUrl(canvasRef.current.toDataURL('image/png'));
    });
  }, [selectedPlant]);

  const closePlantDetail = () => {
    setSelectedPlant(null);
    setPlantLocation(null);
    setQrUrl('');
  };

  const closeAll = () => {
    setSelectedBlock(null);
    closePlantDetail();
  };

  const getStatusStyles = (zone: string, blockId: string) => {
    const info = blockStatus[`${zone}-${blockId}`] || { status: 'healthy', deadCount: 0 };
    switch (info.status) {
      case 'danger':
        return { bg: 'bg-red-50 border-red-500/80 hover:bg-red-100/50', badge: 'bg-red-500 text-white', status: 'danger' as const };
      case 'warning':
        return { bg: 'bg-amber-50 border-amber-500/80 hover:bg-amber-100/50', badge: 'bg-amber-500 text-white', status: 'warning' as const };
      default:
        return { bg: 'bg-green-50/50 border-green-700/30 hover:bg-green-50', badge: 'bg-primary text-white', status: 'healthy' as const };
    }
  };

  const displayBlocks: Array<{ zone: string; id: string; plants: number; color: string }> = [];
  Object.entries(PLANTATION).forEach(([zoneKey, zoneData]) => {
    if (activeZoneFilter === 'All' || activeZoneFilter === zoneKey) {
      zoneData.blocks.forEach((b) => {
        displayBlocks.push({ zone: zoneKey, id: b.id, plants: b.plants, color: zoneData.color });
      });
    }
  });

  const blockPlants = selectedBlock
    ? registeredPlants.filter(p => p.zone === selectedBlock.zone && p.block === selectedBlock.id)
    : [];

  return (
    <div className="flex flex-col bg-surface min-h-screen">
      {/* Header */}
      <div className="bg-primary text-white px-5 py-5 flex justify-between items-center rounded-b-3xl shadow-md">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-green-light flex items-center gap-1">
            <Map className="h-3 w-3" /> Digital Twin Map
          </span>
          <h1 className="text-xl font-extrabold mt-0.5">Plantation Map</h1>
          <p className="text-xs text-green-pale/85 mt-0.5 font-medium">19 Blocks • Galagedara, LK</p>
        </div>
      </div>

      {/* Zone Filters */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-none bg-white border-b border-border-light">
        {['All', 'A', 'B', 'C', 'D'].map((z) => (
          <button
            key={z}
            onClick={() => setActiveZoneFilter(z)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeZoneFilter === z ? 'bg-primary text-white shadow-xs' : 'bg-pale-green text-primary hover:bg-pale-green/80'
            }`}
          >
            {z === 'All' ? 'Show All' : `Zone ${z}`}
          </button>
        ))}
      </div>

      {/* Block Grid */}
      <div className="p-5 flex-1 pb-24">
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-3">Plantation Layout</h2>
        <div className="grid grid-cols-2 gap-3">
          {displayBlocks.map((block) => {
            const styles = getStatusStyles(block.zone, block.id);
            return (
              <button
                key={`${block.zone}-${block.id}`}
                onClick={() => setSelectedBlock(block)}
                className={`p-4 border rounded-2xl text-left transition-all shadow-xs flex flex-col justify-between h-28 ${styles.bg}`}
              >
                <div className="flex justify-between items-start w-full">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-extrabold uppercase opacity-85 tracking-wider">Zone {block.zone}</span>
                    <span className="text-sm font-black mt-0.5">Block {block.id}</span>
                  </div>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${styles.badge}`}>
                    {styles.status}
                  </span>
                </div>
                <div className="flex justify-between items-center w-full mt-4 text-[10px] font-bold opacity-80 border-t border-black/5 pt-2">
                  <span>{block.plants} plants</span>
                  <span className="underline">View details</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── BLOCK DETAIL MODAL ─── */}
      {selectedBlock && !selectedPlant && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm max-h-[88vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-primary px-5 py-4 text-white flex justify-between items-center rounded-t-3xl flex-shrink-0">
              <div>
                <span className="text-[9px] uppercase font-bold text-green-light tracking-widest">Zone {selectedBlock.zone}</span>
                <h3 className="font-extrabold text-sm mt-0.5">Block {selectedBlock.id} — Plants</h3>
              </div>
              <button onClick={closeAll} className="text-white/80 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface rounded-xl p-3 border border-border-light">
                  <span className="text-[9px] font-bold text-text-secondary uppercase">Total Plants</span>
                  <span className="text-base font-extrabold text-text-primary block mt-0.5">{selectedBlock.plants}</span>
                </div>
                <div className="bg-surface rounded-xl p-3 border border-border-light">
                  <span className="text-[9px] font-bold text-text-secondary uppercase">Dead Vines</span>
                  <span className="text-base font-extrabold text-red-600 block mt-0.5">
                    {blockStatus[`${selectedBlock.zone}-${selectedBlock.id}`]?.deadCount || 0}
                  </span>
                </div>
              </div>

              {/* Registered plants — tappable for details */}
              <div>
                <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider block mb-2">
                  Registered Plants ({blockPlants.length})
                </span>
                {blockPlants.length === 0 ? (
                  <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-xl p-3 font-medium">
                    No plants registered in this block yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {blockPlants.map((p) => (
                      <button
                        key={p.plant_id}
                        onClick={() => openPlantDetail(p)}
                        className="w-full flex items-center justify-between bg-surface border border-border-light rounded-2xl px-4 py-3 hover:border-primary/30 hover:shadow-sm transition-all"
                      >
                        <div className="text-left">
                          <span className="text-xs font-black text-text-primary block">{p.plant_id}</span>
                          <span className="text-[10px] text-text-secondary">
                            {p.common_name || 'Vanilla'} • {p.variety || 'Local'} • {p.plant_type || 'Cutting'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <QrCode className="h-4 w-4 text-text-secondary opacity-60" />
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${p.sync_status === 'synced' ? 'bg-pale-green text-primary' : 'bg-amber-100 text-amber-700'}`}>
                            {p.sync_status || 'pending'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sampled indices */}
              <div>
                <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider block mb-2">
                  Sampled Inspection Indices
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {getTrackedPlants(selectedBlock.zone, selectedBlock.id).map((pNum) => {
                    const sampleId = `${selectedBlock.zone}${selectedBlock.id.padStart(2, '0')}-P${String(pNum).padStart(3, '0')}`;
                    const registered = registeredPlants.find(p => p.plant_id === sampleId);
                    return (
                      <button
                        key={pNum}
                        onClick={() => {
                          if (registered) {
                            openPlantDetail(registered);
                          } else {
                            if (confirm(`Plant ${sampleId} is not registered yet. Register it now?`)) {
                              router.push(`/add-plant?zone=${selectedBlock.zone}&block=${selectedBlock.id}&plant_no=${pNum}`);
                              closeAll();
                            }
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          registered
                            ? 'bg-pale-green text-primary border-primary/20 hover:bg-pale-green/80'
                            : 'bg-surface text-text-secondary border-border-light hover:bg-border-light'
                        }`}
                      >
                        #{String(pNum).padStart(3, '0')} {registered ? '✓' : '+'}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[9px] text-text-secondary mt-1.5 leading-normal">
                  Tap ✓ to view plant details or + to register.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border-light flex gap-2 flex-shrink-0">
              <button
                onClick={() => { router.push(`/add-plant?zone=${selectedBlock.zone}&block=${selectedBlock.id}`); closeAll(); }}
                className="flex-1 bg-primary text-white py-3 rounded-full text-xs font-bold hover:bg-primary/90 transition flex items-center justify-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add Plant to Block {selectedBlock.id}
              </button>
              <button onClick={closeAll} className="px-4 border border-border-light text-text-secondary py-3 rounded-full text-xs font-bold hover:bg-surface transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PLANT DETAIL PANEL (inside block modal flow) ─── */}
      {selectedPlant && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">

            {/* Header */}
            <div className="bg-primary px-5 py-4 text-white flex items-center gap-3 rounded-t-3xl flex-shrink-0">
              <button onClick={closePlantDetail} className="text-white/80 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex-1">
                <span className="text-[9px] uppercase font-bold text-green-light tracking-widest">Plant Profile</span>
                <h3 className="font-extrabold text-base mt-0.5">{selectedPlant.plant_id}</h3>
              </div>
              <button onClick={closeAll} className="text-white/80 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">

              {/* QR Code */}
              <div className="bg-surface border border-border-light rounded-2xl p-4 flex flex-col items-center gap-3">
                <span className="text-[9px] uppercase font-bold text-text-secondary tracking-widest flex items-center gap-1">
                  <QrCode className="h-3 w-3" /> Plant QR Code
                </span>
                <div className="bg-white border border-border-light rounded-xl p-3 shadow-sm">
                  <canvas ref={canvasRef} />
                </div>
                <p className="text-[9px] text-text-secondary text-center max-w-[200px] leading-relaxed">
                  Affix this sticker to the support tree for scanning during inspections.
                </p>
                {qrUrl && (
                  <a
                    href={qrUrl}
                    download={`QR_${selectedPlant.plant_id}.png`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-full text-xs font-bold hover:bg-primary/90 transition"
                  >
                    <Download className="h-3.5 w-3.5" /> Download QR Code
                  </a>
                )}
              </div>

              {/* Identification */}
              <DetailSection title="Identification" icon={<Leaf className="h-3 w-3" />}>
                <DetailRow label="Common Name" value={selectedPlant.common_name} />
                <DetailRow label="Latin Name" value={selectedPlant.latin_name} />
                <DetailRow label="Scientific Name" value={selectedPlant.scientific_name} />
                <DetailRow label="Variety" value={selectedPlant.variety} />
                <DetailRow label="Plant Type" value={selectedPlant.plant_type} />
              </DetailSection>

              {/* Purchase */}
              <DetailSection title="Purchase & Origin" icon={<Calendar className="h-3 w-3" />}>
                <DetailRow label="Purchased From" value={selectedPlant.purchased_from} />
                <DetailRow label="Purchase Date" value={selectedPlant.purchase_date} />
                <DetailRow label="Planting Date" value={selectedPlant.planted_date} />
                <DetailRow label="Condition" value={selectedPlant.purchase_condition} />
                <DetailRow label="Max Cutting Height" value={selectedPlant.max_cutting_height_cm ? `${selectedPlant.max_cutting_height_cm} cm` : null} />
              </DetailSection>

              {/* Field Layout */}
              <DetailSection title="Field Layout" icon={<TreePine className="h-3 w-3" />}>
                <DetailRow label="Arrangement" value={selectedPlant.planting_arrangement} />
                <DetailRow label="Spacing (Hedges)" value={selectedPlant.spacing_between_hedges} />
                <DetailRow label="Spacing (Rows)" value={selectedPlant.spacing_between_rows} />
                <DetailRow label="Land Type" value={selectedPlant.land_type} />
                <DetailRow label="Agri. Land Type" value={selectedPlant.agricultural_land_type} />
                <DetailRow label="Landform" value={selectedPlant.landform_type} />
                <DetailRow label="Support Tree" value={selectedPlant.support_tree_type} />
              </DetailSection>

              {/* GPS */}
              {plantLocation && (
                <DetailSection title="GPS Location" icon={<MapPin className="h-3 w-3" />}>
                  <DetailRow label="Latitude" value={plantLocation.latitude?.toFixed(6)} />
                  <DetailRow label="Longitude" value={plantLocation.longitude?.toFixed(6)} />
                  <DetailRow label="Altitude" value={plantLocation.altitude ? `${plantLocation.altitude.toFixed(1)} m` : null} />
                  <DetailRow label="Accuracy" value={plantLocation.accuracy ? `± ${plantLocation.accuracy.toFixed(1)} m` : null} />
                  {plantLocation.latitude && plantLocation.longitude && (
                    <a
                      href={`https://maps.google.com/?q=${plantLocation.latitude},${plantLocation.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline mt-1"
                    >
                      <MapPin className="h-3 w-3" /> View on Google Maps
                    </a>
                  )}
                </DetailSection>
              )}

              {/* Sync info */}
              <div className="text-[9px] text-text-secondary border-t border-border-light pt-3 space-y-0.5 font-medium">
                <div>QR Code ID: <span className="font-bold text-text-primary">{selectedPlant.qr_code}</span></div>
                <div>Registered: {selectedPlant.created_at ? new Date(selectedPlant.created_at).toLocaleString() : 'Unknown'}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  Sync:
                  <span className={`font-bold uppercase ml-1 ${selectedPlant.sync_status === 'synced' ? 'text-primary' : 'text-amber-700'}`}>
                    {selectedPlant.sync_status || 'pending'}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border-light flex gap-2 flex-shrink-0">
              <button
                onClick={() => { router.push(`/inspect/form?plant_id=${selectedPlant.plant_id}`); closeAll(); }}
                className="flex-1 bg-primary text-white py-3 rounded-full text-xs font-bold hover:bg-primary/90 transition flex items-center justify-center gap-1.5"
              >
                <ClipboardCheck className="h-4 w-4" />
                Inspect This Plant
              </button>
              <button onClick={closePlantDetail} className="px-4 border border-border-light text-text-secondary py-3 rounded-full text-xs font-bold hover:bg-surface transition">
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper UI components ──────────────────────────────────────
function DetailSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border-light rounded-2xl p-4 space-y-2.5">
      <span className="text-[9px] uppercase font-bold text-text-secondary tracking-widest flex items-center gap-1">
        {icon} {title}
      </span>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-[10px] text-text-secondary font-medium flex-shrink-0">{label}</span>
      <span className="text-[10px] font-bold text-text-primary text-right">{String(value)}</span>
    </div>
  );
}

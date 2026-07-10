'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, X, QrCode, Plus, ChevronRight, RefreshCw, Leaf } from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import { getPlants } from '../../../../lib/offline-db';
import { PLANTATION } from '../../../../lib/plantData';

type HealthStatus = 'healthy' | 'moderate' | 'high-risk' | 'dead';

interface PlantWithHealth {
  plant_id: string;
  zone: string;
  block: string;
  plant_no: number;
  common_name: string;
  variety: string;
  plant_type: string;
  planted_date: string;
  sync_status: string;
  health: HealthStatus;
  lastInspectionDate: string | null;
  lastVineHeight: number | null;
}

function deriveHealth(insp: any): HealthStatus {
  if (!insp) return 'healthy';
  const pH = insp.soil_ph ?? insp.soil_pH;
  const f = insp.foliage_color;
  if (f === 'Red') return 'dead';
  if (f === 'Brown' || pH < 5.5 || pH > 7.0) return 'high-risk';
  if (f === 'Yellow' || f === 'Mixed' || (pH >= 5.5 && pH < 6.0) || (pH > 6.5 && pH <= 7.0)) return 'moderate';
  return 'healthy';
}

const HEALTH_CONFIG: Record<HealthStatus, { label: string; badge: string; dot: string; card: string }> = {
  healthy:   { label: 'Healthy',   badge: 'bg-green-100 text-green-800',    dot: 'bg-green-500',  card: '' },
  moderate:  { label: 'Moderate',  badge: 'bg-amber-100 text-amber-800',    dot: 'bg-amber-400',  card: '' },
  'high-risk': { label: 'High Risk', badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500', card: '' },
  dead:      { label: 'Dead',      badge: 'bg-red-100 text-red-800',        dot: 'bg-red-600',    card: '' },
};

const FILTER_OPTIONS: Array<{ key: HealthStatus | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'healthy', label: 'Healthy' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'high-risk', label: 'High Risk' },
  { key: 'dead', label: 'Dead' },
];

export default function BlockRegistryPage({ params }: { params: Promise<{ zone: string; block: string }> }) {
  const { zone, block } = use(params);
  const router = useRouter();

  const [plants, setPlants] = useState<PlantWithHealth[]>([]);
  const [filtered, setFiltered] = useState<PlantWithHealth[]>([]);
  const [search, setSearch] = useState('');
  const [healthFilter, setHealthFilter] = useState<HealthStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  const blockInfo = PLANTATION[zone]?.blocks.find(b => b.id === block);
  const totalCapacity = blockInfo?.plants || 0;

  const loadPlants = async () => {
    setLoading(true);
    try {
      // Fetch plants for this block
      const local = await getPlants();
      const localBlock = local.filter(p => p.zone === zone && p.block === block);

      const { data: remote } = await supabase
        .from('plants')
        .select('*')
        .eq('zone', zone)
        .eq('block', block)
        .order('plant_no', { ascending: true });

      const merged = new Map<string, any>();
      (remote || []).forEach(p => merged.set(p.plant_id, p));
      localBlock.forEach(p => merged.set(p.plant_id, { ...merged.get(p.plant_id), ...p }));

      const plantList = Array.from(merged.values());

      // Fetch latest inspection for each plant
      const { data: inspections } = await supabase
        .from('inspections')
        .select('plant_id, inspection_date, soil_ph, foliage_color, vine_height_cm')
        .in('plant_id', plantList.map(p => p.plant_id))
        .order('inspection_date', { ascending: false });

      // Group inspections by plant_id (latest first)
      const latestInsp: Record<string, any> = {};
      (inspections || []).forEach(i => {
        if (!latestInsp[i.plant_id]) latestInsp[i.plant_id] = i;
      });

      const enriched: PlantWithHealth[] = plantList.map(p => ({
        ...p,
        health: deriveHealth(latestInsp[p.plant_id]),
        lastInspectionDate: latestInsp[p.plant_id]?.inspection_date || null,
        lastVineHeight: latestInsp[p.plant_id]?.vine_height_cm || null,
      }));

      setPlants(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlants(); }, [zone, block]);

  useEffect(() => {
    let list = plants;
    if (healthFilter !== 'all') list = list.filter(p => p.health === healthFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.plant_id?.toLowerCase().includes(q) ||
        p.variety?.toLowerCase().includes(q) ||
        p.common_name?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [plants, search, healthFilter]);

  const counts = {
    healthy: plants.filter(p => p.health === 'healthy').length,
    moderate: plants.filter(p => p.health === 'moderate').length,
    'high-risk': plants.filter(p => p.health === 'high-risk').length,
    dead: plants.filter(p => p.health === 'dead').length,
  };

  return (
    <div className="flex flex-col bg-surface min-h-screen pb-32">
      {/* Header */}
      <div className="bg-primary text-white px-5 pt-5 pb-6 rounded-b-3xl shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="h-8 w-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <span className="text-[9px] uppercase font-bold text-green-light tracking-widest">Zone {zone}</span>
              <h1 className="text-xl font-extrabold">Block {block}</h1>
            </div>
          </div>
          <button onClick={loadPlants} disabled={loading} className="h-8 w-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Total', value: totalCapacity, color: 'text-white' },
            { label: 'Healthy', value: counts.healthy, color: 'text-green-300' },
            { label: 'At Risk', value: counts.moderate + counts['high-risk'], color: 'text-amber-300' },
            { label: 'Dead', value: counts.dead, color: 'text-red-300' },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-2xl p-2.5 text-center">
              <span className="text-[8px] uppercase font-bold text-green-light/70 block">{s.label}</span>
              <span className={`text-base font-black block mt-0.5 ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 gap-2">
          <Search className="h-4 w-4 text-white/60 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by Plant ID or variety..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-xs text-white placeholder:text-white/50 outline-none flex-1 font-semibold"
          />
          {search && <button onClick={() => setSearch('')}><X className="h-4 w-4 text-white/60" /></button>}
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-5 pt-4 pb-1 flex gap-2 overflow-x-auto scrollbar-none">
        {FILTER_OPTIONS.map(f => (
          <button
            key={f.key}
            onClick={() => setHealthFilter(f.key as any)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${
              healthFilter === f.key
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-white text-text-secondary border-border-light hover:border-primary/30'
            }`}
          >
            {f.label}
            {f.key !== 'all' && (
              <span className="ml-1 opacity-70">({counts[f.key as HealthStatus] ?? plants.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Plant list */}
      <div className="px-5 pt-3 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
            <p className="text-xs font-semibold">Loading plants...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-border-light rounded-3xl p-10 text-center text-text-secondary">
            <Leaf className="h-10 w-10 mx-auto mb-3 opacity-25 text-primary" />
            <p className="text-xs font-semibold">No plants found</p>
            <p className="text-[10px] opacity-70 mt-1">
              {plants.length === 0 ? 'No plants registered in this block yet.' : 'Try changing your search or filter.'}
            </p>
          </div>
        ) : (
          filtered.map(plant => {
            const h = HEALTH_CONFIG[plant.health];
            return (
              <button
                key={plant.plant_id}
                onClick={() => router.push(`/plant/${plant.plant_id}`)}
                className="w-full text-left bg-white rounded-2xl border border-border-light p-4 shadow-sm flex items-center gap-4 hover:shadow-md hover:border-primary/25 active:scale-[0.99] transition-all duration-200"
              >
                {/* Health dot */}
                <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                  <div className={`h-3 w-3 rounded-full ${h.dot}`} />
                  <QrCode className="h-4 w-4 text-text-secondary opacity-40" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-sm font-black text-text-primary">{plant.plant_id}</h4>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${h.badge}`}>
                      {h.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-secondary">
                    {plant.common_name || 'Vanilla'} • {plant.variety || 'Local'} • {plant.plant_type || 'Cutting'}
                  </p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] text-text-secondary">
                      Last inspection:{' '}
                      <span className="font-semibold text-text-primary">
                        {plant.lastInspectionDate
                          ? new Date(plant.lastInspectionDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
                          : 'None'}
                      </span>
                    </span>
                    {plant.lastVineHeight && (
                      <span className="text-[10px] text-text-secondary">
                        Height: <span className="font-semibold text-text-primary">{plant.lastVineHeight} cm</span>
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 text-text-secondary opacity-50 flex-shrink-0" />
              </button>
            );
          })
        )}
      </div>

      {/* FAB — Add New Plant */}
      <button
        onClick={() => router.push(`/add-plant?zone=${zone}&block=${block}`)}
        className="fixed bottom-20 right-5 z-40 bg-primary text-white h-14 w-14 rounded-full shadow-xl flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}

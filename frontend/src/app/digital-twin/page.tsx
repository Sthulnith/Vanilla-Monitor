'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Map, ChevronRight } from 'lucide-react';
import { PLANTATION } from '../../lib/plantData';
import { getSubmissions, getMortalityReports } from '../../lib/offline-db';

export default function DigitalTwinPage() {
  const router = useRouter();
  const [activeZone, setActiveZone] = useState<string>('All');
  const [blockStatus, setBlockStatus] = useState<
    Record<string, { status: 'healthy' | 'warning' | 'danger'; deadCount: number }>
  >({});

  useEffect(() => {
    const calcHealth = async () => {
      const submissions = await getSubmissions();
      const mortality = await getMortalityReports();
      const map: Record<string, { status: 'healthy' | 'warning' | 'danger'; deadCount: number }> = {};

      Object.entries(PLANTATION).forEach(([z, zd]) =>
        zd.blocks.forEach(b => { map[`${z}-${b.id}`] = { status: 'healthy', deadCount: 0 }; })
      );

      mortality.forEach(r => {
        const key = `${r.zone}-${r.block}`;
        if (map[key]) {
          map[key].deadCount += r.dead_vines || 0;
          if (r.dead_vines > 2) map[key].status = 'danger';
          else if (r.dead_vines > 0 && map[key].status !== 'danger') map[key].status = 'warning';
        }
      });

      submissions.forEach(s => {
        const key = `${s.zone}-${s.block}`;
        if (map[key]) {
          const pH = s.soil_pH ?? s.soil_ph;
          const f = s.foliage_color;
          if (pH < 5.5 || pH > 7.0 || f === 'Brown' || f === 'Red') map[key].status = 'danger';
          else if (((pH >= 5.5 && pH < 6.0) || (pH > 6.5 && pH <= 7.0)) || f === 'Yellow' || f === 'Mixed') {
            if (map[key].status !== 'danger') map[key].status = 'warning';
          }
        }
      });

      setBlockStatus(map);
    };
    calcHealth();
  }, []);

  const getStyles = (zone: string, blockId: string) => {
    const s = blockStatus[`${zone}-${blockId}`]?.status || 'healthy';
    if (s === 'danger') return {
      card: 'bg-red-50 border-red-400/60 hover:bg-red-100/60',
      badge: 'bg-red-500 text-white', label: 'Danger', dot: 'bg-red-500'
    };
    if (s === 'warning') return {
      card: 'bg-amber-50 border-amber-400/60 hover:bg-amber-100/60',
      badge: 'bg-amber-500 text-white', label: 'Warning', dot: 'bg-amber-500'
    };
    return {
      card: 'bg-green-50/60 border-green-700/25 hover:bg-green-50',
      badge: 'bg-primary text-white', label: 'Healthy', dot: 'bg-green-500'
    };
  };

  const blocks: Array<{ zone: string; id: string; plants: number }> = [];
  Object.entries(PLANTATION).forEach(([z, zd]) => {
    if (activeZone === 'All' || activeZone === z)
      zd.blocks.forEach(b => blocks.push({ zone: z, id: b.id, plants: b.plants }));
  });

  return (
    <div className="flex flex-col bg-surface min-h-screen">
      {/* Header */}
      <div className="bg-primary text-white px-5 py-5 rounded-b-3xl shadow-md">
        <span className="text-[10px] uppercase font-bold tracking-widest text-green-light flex items-center gap-1">
          <Map className="h-3 w-3" /> Digital Twin Map
        </span>
        <h1 className="text-xl font-extrabold mt-0.5">Plantation Map</h1>
        <p className="text-xs text-green-pale/85 mt-0.5 font-medium">19 Blocks • Galagedara, LK</p>
      </div>

      {/* Zone filter */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-none bg-white border-b border-border-light">
        {['All', 'A', 'B', 'C', 'D'].map(z => (
          <button
            key={z}
            onClick={() => setActiveZone(z)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeZone === z ? 'bg-primary text-white shadow-sm' : 'bg-pale-green text-primary hover:bg-pale-green/80'
            }`}
          >
            {z === 'All' ? 'Show All' : `Zone ${z}`}
          </button>
        ))}
      </div>

      {/* Block grid */}
      <div className="p-5 pb-28">
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-3">Plantation Layout</h2>
        <div className="grid grid-cols-2 gap-3">
          {blocks.map(block => {
            const s = getStyles(block.zone, block.id);
            return (
              <button
                key={`${block.zone}-${block.id}`}
                onClick={() => router.push(`/blocks/${block.zone}/${block.id}`)}
                className={`p-4 border-2 rounded-2xl text-left transition-all shadow-sm flex flex-col justify-between h-32 active:scale-95 ${s.card}`}
              >
                <div className="flex justify-between items-start w-full">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase opacity-75 tracking-wider block">Zone {block.zone}</span>
                    <span className="text-base font-black mt-0.5 block">Block {block.id}</span>
                  </div>
                  <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase ${s.badge}`}>
                    {s.label}
                  </span>
                </div>
                <div className="flex justify-between items-center w-full border-t border-black/5 pt-2.5">
                  <span className="text-[10px] font-semibold opacity-75">{block.plants} plants</span>
                  <span className="text-[10px] font-bold text-primary flex items-center gap-0.5">
                    View <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

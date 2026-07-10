'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Map, Info, AlertTriangle, CheckCircle, ChevronRight, X, Bug } from 'lucide-react';
import { PLANTATION, getTrackedPlants } from '../../lib/plantData';
import { getSubmissions, getMortalityReports } from '../../lib/offline-db';
import { useInspection } from '../../context/InspectionContext';

export default function DigitalTwinPage() {
  const router = useRouter();
  const { updateForm } = useInspection();

  const [activeZoneFilter, setActiveZoneFilter] = useState<string>('All');
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  
  // Health metrics per block
  const [blockStatus, setBlockStatus] = useState<Record<string, { status: 'healthy' | 'warning' | 'danger'; deadCount: number }>>({});

  useEffect(() => {
    const calculateBlockHealth = async () => {
      const submissions = await getSubmissions();
      const mortality = await getMortalityReports();

      const statusMap: Record<string, { status: 'healthy' | 'warning' | 'danger'; deadCount: number }> = {};

      // Initialize all blocks in the plantation
      Object.entries(PLANTATION).forEach(([zoneKey, zoneData]) => {
        zoneData.blocks.forEach((block) => {
          const key = `${zoneKey}-${block.id}`;
          statusMap[key] = { status: 'healthy', deadCount: 0 };
        });
      });

      // Overlay mortality report data
      mortality.forEach((r) => {
        const key = `${r.zone}-${r.block}`;
        if (statusMap[key]) {
          statusMap[key].deadCount += r.dead_vines || 0;
          if (r.dead_vines > 2) {
            statusMap[key].status = 'danger';
          } else if (r.dead_vines > 0 && statusMap[key].status !== 'danger') {
            statusMap[key].status = 'warning';
          }
        }
      });

      // Overlay inspection submissions
      submissions.forEach((s) => {
        const key = `${s.zone}-${s.block}`;
        if (statusMap[key]) {
          const pH = s.soil_pH ?? s.soil_ph;
          const foliage = s.foliage_color;

          if (pH < 5.5 || pH > 7.0 || foliage === 'Brown' || foliage === 'Red') {
            statusMap[key].status = 'danger';
          } else if (
            ((pH >= 5.5 && pH < 6.0) || (pH > 6.5 && pH <= 7.0)) ||
            foliage === 'Yellow' ||
            foliage === 'Mixed'
          ) {
            if (statusMap[key].status !== 'danger') {
              statusMap[key].status = 'warning';
            }
          }
        }
      });

      setBlockStatus(statusMap);
    };

    calculateBlockHealth();
  }, []);

  const handleStartInspection = (zone: string, blockId: string) => {
    updateForm({
      zone,
      block: blockId,
      plant_number: null,
      plant_id: null
    });
    router.push('/inspect/step1');
  };

  // Get color styles based on health status
  const getStatusStyles = (zone: string, blockId: string) => {
    const key = `${zone}-${blockId}`;
    const info = blockStatus[key] || { status: 'healthy', deadCount: 0 };
    switch (info.status) {
      case 'danger':
        return {
          bg: 'bg-red-50 border-red-500/80 hover:bg-red-100/50',
          text: 'text-red-800',
          badge: 'bg-red-500 text-white',
          status: 'danger' as const
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 border-amber-500/80 hover:bg-amber-100/50',
          text: 'text-amber-800',
          badge: 'bg-amber-500 text-white',
          status: 'warning' as const
        };
      default:
        return {
          bg: 'bg-green-50/50 border-green-700/30 hover:bg-green-50',
          text: 'text-green-800',
          badge: 'bg-primary text-white',
          status: 'healthy' as const
        };
    }
  };

  // Filter list of blocks to display
  const displayBlocks: Array<{ zone: string; id: string; plants: number; color: string }> = [];
  Object.entries(PLANTATION).forEach(([zoneKey, zoneData]) => {
    if (activeZoneFilter === 'All' || activeZoneFilter === zoneKey) {
      zoneData.blocks.forEach((b) => {
        displayBlocks.push({
          zone: zoneKey,
          id: b.id,
          plants: b.plants,
          color: zoneData.color
        });
      });
    }
  });

  return (
    <div className="flex flex-col bg-surface min-h-screen">
      {/* Header */}
      <div className="bg-primary text-white px-5 py-5 flex justify-between items-center rounded-b-3xl shadow-md">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-green-light flex items-center gap-1">
            <Map className="h-3 w-3" />
            Digital Twin Map
          </span>
          <h1 className="text-xl font-extrabold mt-0.5">Plantation Map</h1>
          <p className="text-xs text-green-pale/85 mt-0.5 font-medium">19 Blocks • Galagedara, LK</p>
        </div>
      </div>

      {/* Zone Filters Bar */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-none bg-white border-b border-border-light">
        {['All', 'A', 'B', 'C', 'D'].map((z) => (
          <button
            key={z}
            onClick={() => setActiveZoneFilter(z)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeZoneFilter === z
                ? 'bg-primary text-white shadow-xs'
                : 'bg-pale-green text-primary hover:bg-pale-green/80'
            }`}
          >
            {z === 'All' ? 'Show All' : `Zone ${z}`}
          </button>
        ))}
      </div>

      {/* Map Grid Area */}
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
                    <span className="text-[10px] font-extrabold uppercase opacity-85 tracking-wider">
                      Zone {block.zone}
                    </span>
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

      {/* ─── BLOCK DETAIL MODAL ────────────────────────────────────── */}
      {selectedBlock && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-border-light animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-primary px-5 py-4 text-white flex justify-between items-center">
              <div>
                <span className="text-[9px] uppercase font-bold text-green-light tracking-widest">
                  Zone {selectedBlock.zone}
                </span>
                <h3 className="font-extrabold text-sm mt-0.5">
                  Block {selectedBlock.id} Specifications
                </h3>
              </div>
              <button onClick={() => setSelectedBlock(null)} className="text-white/80 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface rounded-xl p-3 border border-border-light">
                  <span className="text-[9px] font-bold text-text-secondary uppercase">Total Plants</span>
                  <span className="text-base font-extrabold text-text-primary block mt-0.5">
                    {selectedBlock.plants}
                  </span>
                </div>
                <div className="bg-surface rounded-xl p-3 border border-border-light">
                  <span className="text-[9px] font-bold text-text-secondary uppercase">Dead Vines logged</span>
                  <span className="text-base font-extrabold text-red-600 block mt-0.5">
                    {blockStatus[`${selectedBlock.zone}-${selectedBlock.id}`]?.deadCount || 0}
                  </span>
                </div>
              </div>

              {/* Sampled target plants list */}
              <div>
                <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">
                  Sampled Inspection Plants
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {getTrackedPlants(selectedBlock.zone, selectedBlock.id).map((pNum) => (
                    <span
                      key={pNum}
                      className="px-2.5 py-1 bg-pale-green text-primary border border-primary/10 rounded-lg text-xs font-semibold"
                    >
                      #{String(pNum).padStart(3, '0')}
                    </span>
                  ))}
                </div>
                <p className="text-[9px] text-text-secondary mt-1.5 leading-normal">
                  Field supervisors are required to sample these exact indices for statistical validation.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-border-light">
                <button
                  onClick={() => {
                    handleStartInspection(selectedBlock.zone, selectedBlock.id);
                    setSelectedBlock(null);
                  }}
                  className="w-full bg-[#1B4332] text-white py-3 rounded-full text-xs font-bold hover:bg-primary transition shadow-md flex items-center justify-center gap-1.5"
                >
                  <Bug className="h-4 w-4" />
                  Inspect Block {selectedBlock.id}
                </button>
                <button
                  onClick={() => setSelectedBlock(null)}
                  className="w-full border border-border-light text-text-secondary py-3 rounded-full text-xs font-bold hover:bg-surface transition"
                >
                  Close Modal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

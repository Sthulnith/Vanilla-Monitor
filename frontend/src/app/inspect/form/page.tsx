'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Camera, Sparkles, Droplet, Thermometer, Ruler, AlertCircle, Lock, Unlock } from 'lucide-react';
import { getPlant, getPreviousHeight, getSetting, saveSetting, savePlantOffline } from '../../../lib/offline-db';
import { saveInspectionOfflineService, syncPendingSubmissions } from '../../../lib/syncService';
import { supabase } from '../../../lib/supabaseClient';

export default function InspectFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plantId = searchParams.get('plant_id') || '';

  const [loading, setLoading] = useState(false);
  const [staticDetails, setStaticDetails] = useState<any>(null);
  const [lastHeight, setLastHeight] = useState<number | null>(null);

  // Form states
  const [wateringStatus, setWateringStatus] = useState<string>('Keep moist');
  const [sunlightLevel, setSunlightLevel] = useState<string>('bright_indirect');
  const [shadeLevel, setShadeLevel] = useState<string>('moderate');
  
  const [soilType, setSoilType] = useState<string>('Acidic');
  const [soilPh, setSoilPh] = useState<number>(6.2);
  const [soilEc, setSoilEc] = useState<string>('');
  const [moisture, setMoisture] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [humidity, setHumidity] = useState<string>('');

  const [vineHeight, setVineHeight] = useState<string>('');
  const [foliageColor, setFoliageColor] = useState<string>('Green');

  const [fertilizerType, setFertilizerType] = useState<string[]>([]);
  const [fertilizerUsed, setFertilizerUsed] = useState<string>('');
  const [lastFertilized, setLastFertilized] = useState<string>('');

  // Fixed/Editing toggle states
  const [isFixed, setIsFixed] = useState(true);
  const [hasBeenUnlocked, setHasBeenUnlocked] = useState(false);
  const [carriedInfo, setCarriedInfo] = useState<any>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (!plantId) {
      alert('No plant specified for inspection.');
      router.push('/inspect');
      return;
    }

    const loadPlantDetails = async () => {
      let details = await getPlant(plantId);
      
      if (!details && navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('plants')
            .select('*')
            .eq('plant_id', plantId)
            .maybeSingle();
          if (!error && data) {
            details = { ...data, sync_status: 'synced' };
            await savePlantOffline(details);
          }
        } catch (e) {
          console.error('Failed to fetch individual plant from Supabase:', e);
        }
      }

      if (details) {
        setStaticDetails(details);
      } else {
        // Fallback placeholder if plant is not registered yet
        const parts = plantId.split('-');
        const zoneChar = parts[0]?.charAt(0) || 'A';
        const blockVal = parts[0]?.substring(1) || '01';
        const plantNo = parseInt(parts[1]?.substring(1) || '1');

        setStaticDetails({
          plant_id: plantId,
          zone: zoneChar,
          block: blockVal,
          plant_no: plantNo,
          common_name: 'Vanilla (Unregistered)',
          variety: 'Local',
          plant_type: 'Cutting'
        });
      }

      const prevH = await getPreviousHeight(plantId);
      setLastHeight(prevH);

      // Load carried fertilizer settings offline-first
      try {
        if (navigator.onLine) {
          try {
            const { data, error } = await supabase
              .from('carried_fertilizer')
              .select('*')
              .eq('id', 'default')
              .maybeSingle();
            if (!error && data) {
              await saveSetting('carried_fertilizer', {
                fertilizer_types: data.fertilizer_types || [],
                fertilizer_description: data.fertilizer_description || '',
                last_fertilized_date: data.last_fertilized_date || '',
                updated_at: data.updated_at,
                updated_by: data.updated_by || 'unknown'
              });
            }
          } catch (e) {
            console.error('Failed to pre-fetch carried fertilizer:', e);
          }
        }

        const carried = await getSetting('carried_fertilizer');
        if (carried) {
          setFertilizerType(carried.fertilizer_types || []);
          setFertilizerUsed(carried.fertilizer_description || '');
          setLastFertilized(carried.last_fertilized_date || '');
          setCarriedInfo(carried);
        }
      } catch (err) {
        console.error('Failed to load carried fertilizer:', err);
      }
    };

    loadPlantDetails();
  }, [plantId]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleFertilizerToggle = (type: string) => {
    if (isFixed) return;
    setFertilizerType(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleToggleFixed = async () => {
    if (isFixed) {
      setIsFixed(false);
      setHasBeenUnlocked(true);
    } else {
      setIsFixed(true);

      // Commit to local cache and Supabase
      let supervisorEmail = 'supervisor@sapori.lk';
      if (typeof window !== 'undefined') {
        const profileStr = localStorage.getItem('google_user_profile');
        if (profileStr) {
          try {
            const profile = JSON.parse(profileStr);
            supervisorEmail = profile.email || 'supervisor@sapori.lk';
          } catch {}
        }
      }

      const carried = {
        fertilizer_types: fertilizerType,
        fertilizer_description: fertilizerUsed,
        last_fertilized_date: lastFertilized,
        updated_at: new Date().toISOString(),
        updated_by: supervisorEmail
      };

      await saveSetting('carried_fertilizer', carried);
      setCarriedInfo(carried);

      if (navigator.onLine) {
        try {
          await supabase
            .from('carried_fertilizer')
            .upsert({
              id: 'default',
              fertilizer_types: fertilizerType,
              fertilizer_description: fertilizerUsed,
              last_fertilized_date: lastFertilized,
              updated_at: carried.updated_at,
              updated_by: supervisorEmail
            });
        } catch (e) {
          console.error('Failed to sync carried fertilizer on lock:', e);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plantId) return;
    setLoading(true);

    try {
      const mapSunlightToLux = (val: string | null) => {
        switch (val) {
          case 'bright': return '>20,000 lux';
          case 'bright_indirect': return '10,000-20,000 lux';
          case 'medium': return '1,000-10,000 lux';
          case 'low': return '<1,000 lux';
          default: return null;
        }
      };

      const mapShadeToPercentage = (val: string | null) => {
        switch (val) {
          case 'light': return '0-25%';
          case 'partial': return '25-50%';
          case 'moderate': return '50-70%';
          case 'heavy': return '>70%';
          default: return null;
        }
      };

      const inspectionData = {
        plant_id: plantId,
        watering_status: wateringStatus,
        sunlight_level: sunlightLevel,
        shade_level: shadeLevel,
        sunlight_lux: mapSunlightToLux(sunlightLevel),
        shade_percentage: mapShadeToPercentage(shadeLevel),
        soil_type: soilType,
        soil_ph: soilPh ? Number(soilPh) : null,
        soil_ec: soilEc ? Number(soilEc) : null,
        moisture: moisture ? Number(moisture) : null,
        temperature: temperature ? Number(temperature) : null,
        humidity: humidity ? Number(humidity) : null,
        fertilizer_type: fertilizerType,
        fertilizer_used: fertilizerUsed || null,
        last_fertilized: lastFertilized || null,
        vine_height_cm: vineHeight ? Number(vineHeight) : null,
        foliage_color: foliageColor,
        notes: notes || null,
        fertilizer_source: hasBeenUnlocked ? 'edited' : 'carried'
      };

      // Save offline
      const inspectionId = await saveInspectionOfflineService(inspectionData, photoFile);

      // Trigger background synchronization
      syncPendingSubmissions().catch(err => console.error('Sync failed:', err));

      router.push(`/inspect/success?id=${inspectionId}`);
    } catch (err: any) {
      console.error(err);
      alert('Failed to log inspection: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isStale = (() => {
    if (!carriedInfo || !carriedInfo.updated_at) return false;
    const diffTime = Math.abs(new Date().getTime() - new Date(carriedInfo.updated_at).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 30;
  })();

  if (!staticDetails) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-surface min-h-screen pb-24">
      {/* Header */}
      <div className="bg-primary text-white px-5 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/inspect')} className="hover:opacity-80">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base font-extrabold">Log Inspection</h1>
          <p className="text-[10px] text-green-pale/80 font-medium">Dynamic periodic observation record</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-6 flex-1">
        {/* static plant details card */}
        <div className="bg-white/80 border border-border-light rounded-2xl p-4 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-[9px] font-bold text-primary px-2 py-0.5 rounded-full bg-pale-green">
              Active Plant ID
            </span>
            <h2 className="text-lg font-black text-text-primary mt-1">{staticDetails.plant_id}</h2>
            <p className="text-[10px] text-text-secondary mt-0.5">
              {staticDetails.common_name} ({staticDetails.variety}) • Zone {staticDetails.zone} • Block {staticDetails.block}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[9px] font-bold text-text-secondary block">Last Height</span>
            <span className="text-xs font-black text-primary block mt-0.5">
              {lastHeight ? `${lastHeight} cm` : 'None logged'}
            </span>
          </div>
        </div>

        {/* SECTION 1: CARE */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-1">
            <Droplet className="h-3.5 w-3.5 text-primary" />
            Care Information
          </h3>
          
          <div className="bg-white rounded-2xl p-4 border border-border-light space-y-4">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase block mb-1.5">Watering Status</label>
              <div className="grid grid-cols-2 gap-2">
                {['Keep moist', 'Partially dry', 'Dry out', 'High humidity'].map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWateringStatus(w)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      wateringStatus === w
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-text-secondary border-border-light hover:bg-surface'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase block mb-1.5">Sunlight Level</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'bright', name: 'Bright', bars: '7-9 bars', lux: '>20,000 lux' },
                  { value: 'bright_indirect', name: 'Bright indirect', bars: '4-6 bars', lux: '10,000-20,000 lux' },
                  { value: 'medium', name: 'Medium', bars: '2-3 bars', lux: '1,000-10,000 lux' },
                  { value: 'low', name: 'Low', bars: '0-1 bars', lux: '<1,000 lux' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSunlightLevel(opt.value)}
                    className={`py-3 px-2 rounded-xl text-center border transition-all duration-200 ${
                      sunlightLevel === opt.value
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-white text-text-secondary border-border-light hover:bg-surface hover:border-primary/20'
                    }`}
                  >
                    <span className="text-xs tracking-tight block truncate">
                      <span className="font-bold">{opt.name}</span>
                      <span className={`text-[10px] font-normal ${sunlightLevel === opt.value ? 'text-white/80' : 'text-text-secondary/80'}`}>
                        {' • '}{opt.bars}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase block mb-1.5">Shade Level</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'light', name: 'Light', range: '0-25%' },
                  { value: 'partial', name: 'Partial', range: '25-50%' },
                  { value: 'moderate', name: 'Moderate', range: '50-70%' },
                  { value: 'heavy', name: 'Heavy', range: '>70%' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setShadeLevel(opt.value)}
                    className={`py-3 px-2 rounded-xl text-center border transition-all duration-200 ${
                      shadeLevel === opt.value
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-white text-text-secondary border-border-light hover:bg-surface hover:border-primary/20'
                    }`}
                  >
                    <span className="text-xs tracking-tight block truncate">
                      <span className="font-bold">{opt.name}</span>
                      <span className={`text-[10px] font-normal ${shadeLevel === opt.value ? 'text-white/80' : 'text-text-secondary/80'}`}>
                        {' • '}{opt.range}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: ENVIRONMENT */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-1">
            <Thermometer className="h-3.5 w-3.5 text-primary" />
            Environment & Soil
          </h3>
          
          <div className="bg-white rounded-2xl p-4 border border-border-light space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Soil Type</label>
                <select
                  value={soilType}
                  onChange={(e) => setSoilType(e.target.value)}
                  className="w-full mt-1 border border-border-light rounded-lg p-2 text-xs font-semibold focus:outline-primary bg-surface"
                >
                  <option value="Acidic">Acidic</option>
                  <option value="Standard">Standard</option>
                  <option value="Cactus">Cactus</option>
                  <option value="Orchid">Orchid</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Soil pH</label>
                <input
                  type="number"
                  step="0.1"
                  value={soilPh}
                  onChange={(e) => setSoilPh(Number(e.target.value))}
                  className="w-full mt-1 border border-border-light rounded-lg p-2 text-xs font-semibold focus:outline-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Soil EC (dS/m)</label>
                <input
                  type="number"
                  step="0.01"
                  value={soilEc}
                  onChange={(e) => setSoilEc(e.target.value)}
                  placeholder="e.g. 1.2"
                  className="w-full mt-1 border border-border-light rounded-lg p-2 text-xs font-semibold focus:outline-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Moisture (%)</label>
                <input
                  type="number"
                  value={moisture}
                  onChange={(e) => setMoisture(e.target.value)}
                  placeholder="e.g. 60"
                  className="w-full mt-1 border border-border-light rounded-lg p-2 text-xs font-semibold focus:outline-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="e.g. 28.5"
                  className="w-full mt-1 border border-border-light rounded-lg p-2 text-xs font-semibold focus:outline-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Humidity (%)</label>
                <input
                  type="number"
                  value={humidity}
                  onChange={(e) => setHumidity(e.target.value)}
                  placeholder="e.g. 80"
                  className="w-full mt-1 border border-border-light rounded-lg p-2 text-xs font-semibold focus:outline-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: MEASUREMENTS & DISEASE */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-1">
            <Ruler className="h-3.5 w-3.5 text-primary" />
            Measurements & Disease
          </h3>
          
          <div className="bg-white rounded-2xl p-4 border border-border-light space-y-4">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Vine Height (cm)</label>
              <input
                type="number"
                value={vineHeight}
                onChange={(e) => setVineHeight(e.target.value)}
                placeholder="e.g. 150"
                className="w-full mt-1 border border-border-light rounded-lg p-2.5 text-xs font-semibold focus:outline-primary"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase block mb-2">Foliage Color</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Green', bg: '#16A34A' },
                  { label: 'Yellow', bg: '#F59E0B' },
                  { label: 'Brown', bg: '#78350F' },
                  { label: 'Red', bg: '#EF4444' },
                  { label: 'Mixed', bg: 'linear-gradient(135deg, #16A34A 0%, #78350F 100%)', fullWidth: true }
                ].map(opt => {
                  const isSelected = foliageColor === opt.label;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setFoliageColor(opt.label)}
                      className={`flex items-center gap-3 w-full p-2.5 rounded-xl border text-left transition-all ${
                        opt.fullWidth ? 'col-span-2' : ''
                      } ${
                        isSelected
                          ? 'border-primary bg-pale-green font-bold text-primary shadow-xs'
                          : 'border-border-light bg-white text-text-secondary hover:border-primary/10'
                      }`}
                    >
                      <div 
                        className="h-4.5 w-4.5 rounded-full border border-black/10 shrink-0" 
                        style={{ background: opt.bg }}
                      />
                      <span className="text-xs font-semibold">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: FERTILIZER & OBSERVATIONS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Fertilizer & Notes
            </h3>
            
            {/* Toggle Button */}
            <button
              type="button"
              onClick={handleToggleFixed}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold transition-all shadow-xs ${
                isFixed
                  ? 'bg-pale-green border-primary/20 text-primary hover:bg-pale-green/80'
                  : 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'
              }`}
            >
              {isFixed ? (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Fixed</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5 animate-pulse" />
                  <span>Editing</span>
                </>
              )}
            </button>
          </div>
          
          <div className="bg-white rounded-2xl p-4 border border-border-light space-y-4">
            {isStale && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-orange-50 border border-orange-200/60 text-orange-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-orange-500 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold">Fertilizer settings stale</p>
                  <p className="text-[10px] leading-relaxed text-orange-600/90 font-medium">
                    These settings have not been verified/updated for over 30 days. Please click &apos;Editing&apos; to verify or update them.
                  </p>
                </div>
              </div>
            )}

            {/* Fertilizer inputs container (dimmed/disabled in Fixed state) */}
            <div 
              className={`space-y-4 transition-all duration-200 ${isFixed ? 'opacity-70 pointer-events-none' : ''}`}
              style={{ cursor: isFixed ? 'not-allowed' : 'auto' }}
            >
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase block mb-1.5">Fertilizer Types Applied</label>
                <div className="grid grid-cols-2 gap-2">
                  {['All purpose', 'Cactus', 'Acidic', 'Orchid'].map(ft => {
                    const active = fertilizerType.includes(ft);
                    return (
                      <button
                        key={ft}
                        type="button"
                        onClick={() => handleFertilizerToggle(ft)}
                        disabled={isFixed}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          isFixed ? 'cursor-not-allowed' : ''
                        } ${
                          active
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-text-secondary border-border-light hover:bg-surface'
                        }`}
                      >
                        {ft}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Fertilizer Used (Description)</label>
                <input
                  type="text"
                  value={fertilizerUsed}
                  onChange={(e) => setFertilizerUsed(e.target.value)}
                  disabled={isFixed}
                  placeholder="e.g. Compost tea, Organic fertilizer"
                  className={`w-full mt-1 border border-border-light rounded-lg p-2.5 text-xs font-semibold focus:outline-primary ${
                    isFixed ? 'cursor-not-allowed bg-gray-50 text-gray-400' : ''
                  }`}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Last Fertilized Date</label>
                <input
                  type="date"
                  value={lastFertilized}
                  onChange={(e) => setLastFertilized(e.target.value)}
                  disabled={isFixed}
                  className={`w-full mt-1 border border-border-light rounded-lg p-2.5 text-xs font-semibold focus:outline-primary ${
                    isFixed ? 'cursor-not-allowed bg-gray-50 text-gray-400' : ''
                  }`}
                />
              </div>
            </div>

            {/* Notes / Observations remains fully interactive */}
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Notes / Observations</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any special remarks or details regarding vine shape, pest infestation..."
                className="w-full mt-1 border border-border-light rounded-lg p-2.5 text-xs font-semibold focus:outline-primary placeholder:text-gray-300"
              />
            </div>
          </div>
        </div>

        {/* SECTION 5: PHOTO */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-1">
            <Camera className="h-3.5 w-3.5 text-primary" />
            Upload Photo
          </h3>
          
          <div className="bg-white rounded-2xl p-4 border border-border-light space-y-4">
            <div className="flex flex-col items-center gap-3">
              {photoPreview ? (
                <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-border-light bg-black">
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 shadow-md hover:bg-red-700 text-[10px] font-bold"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="w-full h-32 border-2 border-dashed border-border-light rounded-2xl flex flex-col items-center justify-center text-text-secondary">
                  <Camera className="h-8 w-8 opacity-45" />
                  <span className="text-[10px] mt-1.5">No photo selected</span>
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                className="w-full text-xs text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-pale-green file:text-primary hover:file:bg-pale-green/80"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white border-t border-border-light z-30">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3.5 rounded-full font-bold text-xs shadow-md hover:bg-primary/95 active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Logging Inspection...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Submit Inspection Report
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

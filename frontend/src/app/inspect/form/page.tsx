'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Camera, Sparkles, Droplet, Thermometer, Ruler, AlertCircle } from 'lucide-react';
import { getPlant, getPreviousHeight } from '../../../lib/offline-db';
import { saveInspectionOfflineService, syncPendingSubmissions } from '../../../lib/syncService';

export default function InspectFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plantId = searchParams.get('plant_id') || '';

  const [loading, setLoading] = useState(false);
  const [staticDetails, setStaticDetails] = useState<any>(null);
  const [lastHeight, setLastHeight] = useState<number | null>(null);

  // Form states
  const [wateringStatus, setWateringStatus] = useState<string>('Keep moist');
  const [sunlightLevel, setSunlightLevel] = useState<string>('Bright indirect');
  const [shadeLevel, setShadeLevel] = useState<string>('Shade <75%');
  
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
      const details = await getPlant(plantId);
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
    setFertilizerType(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plantId) return;
    setLoading(true);

    try {
      const inspectionData = {
        plant_id: plantId,
        watering_status: wateringStatus,
        sunlight_level: sunlightLevel,
        shade_level: shadeLevel,
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
        notes: notes || null
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
                {['Bright', 'Bright indirect', 'Medium', 'Low'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSunlightLevel(s)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      sunlightLevel === s
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-text-secondary border-border-light hover:bg-surface'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase block mb-1.5">Shade Level</label>
              <div className="grid grid-cols-2 gap-2">
                {['Shade <75%', 'Shade >75%', 'Partial <50%', 'Partial >50%'].map(sh => (
                  <button
                    key={sh}
                    type="button"
                    onClick={() => setShadeLevel(sh)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      shadeLevel === sh
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-text-secondary border-border-light hover:bg-surface'
                    }`}
                  >
                    {sh}
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
              <label className="text-[10px] font-bold text-text-secondary uppercase block mb-1.5">Foliage Color</label>
              <div className="grid grid-cols-5 gap-1.5">
                {['Green', 'Yellow', 'Brown', 'Red', 'Mixed'].map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFoliageColor(f)}
                    className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${
                      foliageColor === f
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-text-secondary border-border-light hover:bg-surface'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: FERTILIZER & OBSERVATIONS */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Fertilizer & Notes
          </h3>
          
          <div className="bg-white rounded-2xl p-4 border border-border-light space-y-4">
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
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
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
                placeholder="e.g. Compost tea, Organic fertilizer"
                className="w-full mt-1 border border-border-light rounded-lg p-2.5 text-xs font-semibold focus:outline-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Last Fertilized Date</label>
              <input
                type="date"
                value={lastFertilized}
                onChange={(e) => setLastFertilized(e.target.value)}
                className="w-full mt-1 border border-border-light rounded-lg p-2.5 text-xs font-semibold focus:outline-primary"
              />
            </div>

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

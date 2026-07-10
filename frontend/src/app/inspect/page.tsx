'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Map, List, AlertCircle, Scan } from 'lucide-react';
import { getPlants, getPlant } from '../../lib/offline-db';
import Link from 'next/link';

export default function InspectSelectionPage() {
  const router = useRouter();
  const [plantsList, setPlantsList] = useState<any[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');
  const [scannerActive, setScannerActive] = useState(false);
  const [scanError, setScanError] = useState<string>('');

  useEffect(() => {
    const loadPlants = async () => {
      const list = await getPlants();
      setPlantsList(list);
      if (list.length > 0) {
        setSelectedPlantId(list[0].plant_id);
      }
    };
    loadPlants();
  }, []);

  // Handle Scan Success
  const handleScanSuccess = async (decodedText: string) => {
    try {
      let plantId = decodedText.trim();
      // Try parsing if it's JSON
      if (decodedText.startsWith('{')) {
        const parsed = JSON.parse(decodedText);
        plantId = parsed.plant_id;
      }
      
      if (!plantId) throw new Error("Invalid QR Content");

      // Verify if plant exists locally (or just use it directly)
      const plant = await getPlant(plantId);
      if (plant) {
        router.push(`/inspect/form?plant_id=${plantId}`);
      } else {
        // If not found locally, still allow inspection but show warning or create default
        router.push(`/inspect/form?plant_id=${plantId}`);
      }
    } catch (err) {
      console.error(err);
      setScanError('Invalid QR format. Please scan a valid Vanilla Monitor plant QR code.');
    }
  };

  // Dynamically import and initialize scanner only when requested to avoid window/SSR errors
  useEffect(() => {
    let scanner: any = null;
    if (scannerActive && typeof window !== 'undefined') {
      import('html5-qrcode').then((module) => {
        const Html5QrcodeScanner = module.Html5QrcodeScanner;
        scanner = new Html5QrcodeScanner(
          'qr-reader-container',
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );

        scanner.render(
          (text: string) => {
            handleScanSuccess(text);
            scanner.clear();
            setScannerActive(false);
          },
          (err: any) => {
            // silent scan errors (no matching code in frame)
          }
        );
      }).catch((err) => {
        console.error('Failed to load html5-qrcode scanner:', err);
      });
    }

    return () => {
      if (scanner) {
        try {
          scanner.clear();
        } catch (e) {}
      }
    };
  }, [scannerActive]);

  const handleManualInspect = () => {
    if (!selectedPlantId) return;
    router.push(`/inspect/form?plant_id=${selectedPlantId}`);
  };

  return (
    <div className="flex flex-col bg-surface min-h-screen pb-20">
      {/* Header */}
      <div className="bg-primary text-white px-5 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/dashboard')} className="hover:opacity-80">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base font-extrabold">Select Plant</h1>
          <p className="text-[10px] text-green-pale/80 font-medium">Choose a plant to start inspection</p>
        </div>
      </div>

      <div className="p-5 space-y-6 flex-1">
        {/* ACTION 1: SCAN QR CODE */}
        <div className="bg-white rounded-2xl border border-border-light p-5 text-center space-y-4">
          <div className="h-12 w-12 bg-pale-green text-primary rounded-xl flex items-center justify-center mx-auto">
            <Scan className="h-6 w-6" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-text-primary">Option 1: Scan QR Sticker</h3>
            <p className="text-[10px] text-text-secondary mt-1 max-w-xs mx-auto">
              Scan the QR code affixed to the support tree. This immediately identifies the vine.
            </p>
          </div>

          {scannerActive ? (
            <div className="space-y-4">
              <div id="qr-reader-container" className="overflow-hidden rounded-2xl border border-border-light bg-black" />
              {scanError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{scanError}</span>
                </div>
              )}
              <button
                onClick={() => setScannerActive(false)}
                className="text-xs font-bold text-red-600 underline"
              >
                Cancel Scanner
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setScannerActive(true);
                setScanError('');
              }}
              className="w-full bg-primary text-white py-3 rounded-full text-xs font-bold hover:bg-primary/95 transition shadow-sm flex items-center justify-center gap-2"
            >
              <Camera className="h-4 w-4" />
              Open Camera Scanner
            </button>
          )}
        </div>

        {/* ACTION 2: DIGITAL TWIN MAP */}
        <div className="bg-white rounded-2xl border border-border-light p-5 text-center space-y-4">
          <div className="h-12 w-12 bg-pale-green text-primary rounded-xl flex items-center justify-center mx-auto">
            <Map className="h-6 w-6" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-text-primary">Option 2: Digital Twin Map</h3>
            <p className="text-[10px] text-text-secondary mt-1 max-w-xs mx-auto">
              Open the interactive plantation layout and select the plant directly from its geographic coordinate spot.
            </p>
          </div>

          <Link
            href="/digital-twin"
            className="w-full bg-[#1B4332] text-white py-3 rounded-full text-xs font-bold hover:bg-primary transition shadow-sm flex items-center justify-center gap-2"
          >
            <Map className="h-4 w-4" />
            Open Digital Twin Map
          </Link>
        </div>

        {/* ACTION 3: MANUAL DROP-DOWN SELECTOR */}
        <div className="bg-white rounded-2xl border border-border-light p-5 text-center space-y-4">
          <div className="h-12 w-12 bg-pale-green text-primary rounded-xl flex items-center justify-center mx-auto">
            <List className="h-6 w-6" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-text-primary">Option 3: Manual Select</h3>
            <p className="text-[10px] text-text-secondary mt-1 max-w-xs mx-auto">
              Select one of the registered plants from the dropdown below.
            </p>
          </div>

          {plantsList.length === 0 ? (
            <div className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-xl p-3">
              No registered plants found. Please register plants first using the "Add New Plant" screen.
            </div>
          ) : (
            <div className="space-y-3">
              <select
                value={selectedPlantId}
                onChange={(e) => setSelectedPlantId(e.target.value)}
                className="w-full border border-border-light rounded-xl p-3 text-xs font-bold focus:outline-primary bg-surface"
              >
                {plantsList.map((p) => (
                  <option key={p.plant_id} value={p.plant_id}>
                    {p.plant_id} — {p.common_name} ({p.variety})
                  </option>
                ))}
              </select>

              <button
                onClick={handleManualInspect}
                disabled={!selectedPlantId}
                className="w-full bg-[#1B4332] text-white py-3 rounded-full text-xs font-bold hover:bg-primary transition shadow-sm disabled:opacity-50"
              >
                Start Inspection
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

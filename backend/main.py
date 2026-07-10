import os
from typing import List, Optional
from datetime import datetime
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Vanilla Monitor API",
    description="Backend API for plantation inspections, GPS tracking, and mortality reports.",
    version="2.0.0"
)

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

cors_origins_env = os.getenv("CORS_ORIGINS")
if cors_origins_env:
    additional_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
    origins.extend(additional_origins)

origins = list(set(origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase Client
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_ANON_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        print("Supabase client initialized successfully.")
    except Exception as e:
        print(f"Failed to initialize Supabase client: {e}")
else:
    print("Warning: Supabase credentials not found. API running in fallback local mock mode.")

# Pydantic schemas (New Database Structure)
class Plant(BaseModel):
    plant_id: str
    zone: str
    block: str
    plant_no: int
    qr_code: Optional[str] = None
    qr_image_url: Optional[str] = None
    common_name: Optional[str] = None
    latin_name: Optional[str] = None
    scientific_name: Optional[str] = None
    variety: Optional[str] = None
    plant_type: Optional[str] = None
    purchase_date: Optional[str] = None
    planted_date: Optional[str] = None
    purchased_from: Optional[str] = None
    purchase_condition: Optional[str] = None
    max_cutting_height_cm: Optional[float] = None
    planting_arrangement: Optional[str] = None
    spacing_between_hedges: Optional[str] = None
    spacing_between_rows: Optional[str] = None
    land_type: Optional[str] = None
    agricultural_land_type: Optional[str] = None
    landform_type: Optional[str] = None
    support_tree_type: Optional[str] = None
    created_at: Optional[str] = None

class PlantLocation(BaseModel):
    plant_id: str
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    accuracy: Optional[float] = None
    created_at: Optional[str] = None

class Inspection(BaseModel):
    id: str
    plant_id: str
    inspection_date: Optional[str] = None
    supervisor_name: Optional[str] = None
    supervisor_email: Optional[str] = None
    watering_status: Optional[str] = None
    sunlight_level: Optional[str] = None
    shade_level: Optional[str] = None
    soil_type: Optional[str] = None
    soil_ph: Optional[float] = None
    soil_ec: Optional[float] = None
    moisture: Optional[float] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    fertilizer_type: Optional[List[str]] = None
    fertilizer_used: Optional[str] = None
    last_fertilized: Optional[str] = None
    vine_height_cm: Optional[float] = None
    foliage_color: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    sync_status: Optional[str] = "synced"
    created_at: Optional[str] = None

# Pydantic schemas (Backward Compatibility)
class Submission(BaseModel):
    id: str
    plant_id: str
    zone: str
    block: str
    supervisor_name: Optional[str] = None
    supervisor_email: Optional[str] = None
    watering_status: Optional[str] = None
    sunlight_level: Optional[str] = None
    shade_level: Optional[str] = None
    soil_ph: Optional[float] = None
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    soil_type: Optional[str] = None
    fertiliser_type: Optional[List[str]] = None
    last_fertilised: Optional[str] = None
    fertiliser_used: Optional[str] = None
    vine_height_cm: Optional[float] = None
    height_delta_cm: Optional[float] = None
    foliage_color: Optional[str] = None
    planting_arrangement: Optional[str] = None
    notes: Optional[str] = None
    photo_filename: Optional[str] = None
    photo_url: Optional[str] = None
    status: Optional[str] = "synced"
    sync_status: Optional[str] = "synced"
    submitted_at: Optional[str] = None

class GPSRecord(BaseModel):
    plant_id: str
    lat: float
    lng: float

class MortalityReport(BaseModel):
    id: str
    zone: str
    block: str
    dead_support_trees: int
    dead_vines: int
    reported_at: Optional[str] = None

# Mock Memory DB
mock_plants_list = []
mock_locations_list = []
mock_inspections_list = []
mock_submissions_list = []
mock_mortality_list = []

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "database_connected": supabase is not None
    }

# ----------------- NEW SYSTEM ENDPOINTS -----------------

@app.post("/api/plants", status_code=status.HTTP_201_CREATED)
async def create_plant(plant: Plant):
    if not supabase:
        data = plant.dict()
        # check duplicate
        mock_plants_list[:] = [p for p in mock_plants_list if p["plant_id"] != plant.plant_id]
        mock_plants_list.append(data)
        return {"message": "Plant saved successfully (mock mode)", "data": data}
    try:
        data = plant.dict()
        response = supabase.table("plants").upsert(data).execute()
        return {"message": "Plant synced successfully", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/plants")
async def get_plants():
    if not supabase:
        return {"data": mock_plants_list}
    try:
        response = supabase.table("plants").select("*").execute()
        return {"data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.post("/api/plant_locations", status_code=status.HTTP_201_CREATED)
async def create_plant_location(location: PlantLocation):
    if not supabase:
        data = location.dict()
        mock_locations_list[:] = [l for l in mock_locations_list if l["plant_id"] != location.plant_id]
        mock_locations_list.append(data)
        return {"message": "Location saved successfully (mock mode)", "data": data}
    try:
        data = location.dict()
        response = supabase.table("plant_locations").upsert(data).execute()
        return {"message": "Location synced successfully", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/plant_locations")
async def get_plant_locations():
    if not supabase:
        return {"data": mock_locations_list}
    try:
        response = supabase.table("plant_locations").select("*").execute()
        return {"data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.post("/api/inspections", status_code=status.HTTP_201_CREATED)
async def create_inspection(inspection: Inspection):
    if not supabase:
        data = inspection.dict()
        mock_inspections_list[:] = [i for i in mock_inspections_list if i["id"] != inspection.id]
        mock_inspections_list.append(data)
        return {"message": "Inspection saved successfully (mock mode)", "data": data}
    try:
        data = inspection.dict()
        response = supabase.table("inspections").upsert(data).execute()
        return {"message": "Inspection synced successfully", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/inspections")
async def get_inspections():
    if not supabase:
        return {"data": mock_inspections_list}
    try:
        response = supabase.table("inspections").select("*").order("created_at", descending=True).execute()
        return {"data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# ----------------- BACKWARD COMPATIBLE ENDPOINTS -----------------

@app.post("/api/submissions", status_code=status.HTTP_201_CREATED)
async def create_submission(submission: Submission):
    if not supabase:
        data = submission.dict()
        mock_submissions_list[:] = [s for s in mock_submissions_list if s["id"] != submission.id]
        mock_submissions_list.append(data)
        return {"message": "Saved successfully (mock mode)", "data": submission}
    try:
        data = submission.dict()
        response = supabase.table("submissions").upsert(data).execute()
        return {"message": "Submission synced successfully", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/submissions")
async def get_submissions():
    if not supabase:
        return {"data": mock_submissions_list}
    try:
        response = supabase.table("submissions").select("*").execute()
        return {"data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.post("/api/gps", status_code=status.HTTP_201_CREATED)
async def save_gps(gps: GPSRecord):
    if not supabase:
        data = {"plant_id": gps.plant_id, "latitude": gps.lat, "longitude": gps.lng}
        mock_locations_list[:] = [l for l in mock_locations_list if l["plant_id"] != gps.plant_id]
        mock_locations_list.append(data)
        return {"message": "GPS saved successfully (mock mode)", "data": gps}
    try:
        data = {"plant_id": gps.plant_id, "latitude": gps.lat, "longitude": gps.lng}
        response = supabase.table("plant_locations").upsert(data).execute()
        return {"message": "GPS saved successfully", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/gps")
async def get_gps():
    if not supabase:
        res = [{"plant_id": l["plant_id"], "lat": l["latitude"], "lng": l["longitude"]} for l in mock_locations_list]
        return {"data": res}
    try:
        response = supabase.table("plant_locations").select("plant_id, latitude, longitude").execute()
        res = [{"plant_id": r["plant_id"], "lat": r["latitude"], "lng": r["longitude"]} for r in response.data]
        return {"data": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.post("/api/mortality", status_code=status.HTTP_201_CREATED)
async def create_mortality_report(report: MortalityReport):
    if not supabase:
        data = report.dict()
        mock_mortality_list[:] = [m for m in mock_mortality_list if m["id"] != report.id]
        mock_mortality_list.append(data)
        return {"message": "Mortality report saved successfully (mock mode)", "data": report}
    try:
        data = report.dict()
        response = supabase.table("mortality_reports").upsert(data).execute()
        return {"message": "Mortality report saved successfully", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/mortality")
async def get_mortality_reports():
    if not supabase:
        return {"data": mock_mortality_list}
    try:
        response = supabase.table("mortality_reports").select("*").execute()
        return {"data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

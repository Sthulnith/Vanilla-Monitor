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
    version="1.0.0"
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

# Pydantic schemas
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

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "database_connected": supabase is not None
    }

@app.post("/api/submissions", status_code=status.HTTP_201_CREATED)
async def create_submission(submission: Submission):
    if not supabase:
        print(f"Mock Save Submission: {submission.id}")
        return {"message": "Saved successfully (mock mode)", "data": submission}
    
    try:
        data = submission.dict()
        # Parse timestamp strings to datetime if necessary
        if data.get("submitted_at"):
            try:
                data["submitted_at"] = data["submitted_at"]
            except Exception:
                pass
        
        response = supabase.table("submissions").upsert(data).execute()
        return {"message": "Submission synced successfully", "data": response.data}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@app.get("/api/submissions")
async def get_submissions():
    if not supabase:
        return {"message": "Fetching mock submissions list", "data": []}
    
    try:
        response = supabase.table("submissions").select("*").execute()
        return {"data": response.data}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@app.post("/api/gps", status_code=status.HTTP_201_CREATED)
async def save_gps(gps: GPSRecord):
    if not supabase:
        print(f"Mock Save GPS: Plant {gps.plant_id} ({gps.lat}, {gps.lng})")
        return {"message": "GPS saved successfully (mock mode)", "data": gps}
    
    try:
        data = gps.dict()
        response = supabase.table("plant_gps").upsert(data).execute()
        return {"message": "GPS saved successfully", "data": response.data}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@app.get("/api/gps")
async def get_gps():
    if not supabase:
        return {"message": "Fetching mock GPS coordinates list", "data": []}
    
    try:
        response = supabase.table("plant_gps").select("*").execute()
        return {"data": response.data}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@app.post("/api/mortality", status_code=status.HTTP_201_CREATED)
async def create_mortality_report(report: MortalityReport):
    if not supabase:
        print(f"Mock Save Mortality: {report.id}")
        return {"message": "Mortality report saved successfully (mock mode)", "data": report}
    
    try:
        data = report.dict()
        response = supabase.table("mortality_reports").upsert(data).execute()
        return {"message": "Mortality report saved successfully", "data": response.data}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@app.get("/api/mortality")
async def get_mortality_reports():
    if not supabase:
        return {"message": "Fetching mock mortality reports list", "data": []}
    
    try:
        response = supabase.table("mortality_reports").select("*").execute()
        return {"data": response.data}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

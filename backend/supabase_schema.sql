-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Plants Table (Static Information)
-- Holds all one-time registration and botanical details for each vine.
CREATE TABLE plants (
    plant_id TEXT PRIMARY KEY,
    zone TEXT NOT NULL,
    block TEXT NOT NULL,
    plant_no INTEGER NOT NULL,
    
    qr_code TEXT,
    qr_image_url TEXT,
    
    common_name TEXT,
    latin_name TEXT,
    scientific_name TEXT,
    variety TEXT,
    plant_type TEXT,
    
    purchase_date DATE,
    planted_date DATE,
    purchased_from TEXT,
    purchase_condition TEXT,
    max_cutting_height_cm NUMERIC,
    
    planting_arrangement TEXT,
    spacing_between_hedges TEXT,
    spacing_between_rows TEXT,
    land_type TEXT,
    agricultural_land_type TEXT,
    landform_type TEXT,
    support_tree_type TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Plant Locations Table (GPS Data)
-- Separated to keep the primary table light, holds exact geographical coordinates.
CREATE TABLE plant_locations (
    plant_id TEXT PRIMARY KEY REFERENCES plants(plant_id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Inspections Table (Dynamic Information)
-- Holds the periodic observation logs for each plant. A plant can have many inspections.
CREATE TABLE inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plant_id TEXT NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
    inspection_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    supervisor_name TEXT,
    supervisor_email TEXT,
    
    -- Care
    watering_status TEXT,
    sunlight_level TEXT,
    shade_level TEXT,
    
    -- Environment
    soil_type TEXT,
    soil_ph NUMERIC,
    soil_ec NUMERIC,
    moisture NUMERIC,
    temperature NUMERIC,
    humidity NUMERIC,
    
    -- Fertilizer & Notes
    fertilizer_type TEXT[],
    fertilizer_used TEXT,
    last_fertilized DATE,
    
    -- Measurements & Health
    vine_height_cm NUMERIC,
    foliage_color TEXT,
    notes TEXT,
    photo_url TEXT,
    
    sync_status TEXT DEFAULT 'synced',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Mortality Reports Table (Block-level Health)
-- Tracks dead vines and support trees per block.
CREATE TABLE mortality_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone TEXT NOT NULL,
    block TEXT NOT NULL,
    dead_support_trees INTEGER DEFAULT 0,
    dead_vines INTEGER DEFAULT 0,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Note: The legacy `submissions` table should be kept as-is to preserve historical data
-- and maintain backward compatibility during the transition period.

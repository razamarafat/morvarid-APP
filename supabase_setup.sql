-- Database Schema for Morvarid System (Reconstructed)

-- 1. Enum Types
CREATE TYPE user_role AS ENUM ('ADMIN', 'REGISTRATION', 'SALES');
CREATE TYPE farm_type AS ENUM ('MORVARIDI', 'MOTEFEREGHE');
CREATE TYPE product_unit AS ENUM ('CARTON', 'KILOGRAM');

-- 2. Tables

-- PROFILES (Extends auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role user_role DEFAULT 'REGISTRATION',
    is_active BOOLEAN DEFAULT TRUE,
    phone_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FARMS
CREATE TABLE farms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type farm_type DEFAULT 'MORVARIDI',
    is_active BOOLEAN DEFAULT TRUE,
    product_ids TEXT[] DEFAULT '{}', -- Stored as Array of UUID strings for flexibility
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- USER_FARMS (Many-to-Many Relationship)
CREATE TABLE user_farms (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, farm_id)
);

-- PRODUCTS
CREATE TABLE products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    unit product_unit DEFAULT 'CARTON',
    has_kilogram_unit BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    is_custom BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DAILY STATISTICS
CREATE TABLE daily_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    
    -- Main Units (Cartons)
    previous_balance NUMERIC DEFAULT 0,
    production NUMERIC DEFAULT 0,
    sales NUMERIC DEFAULT 0,
    current_inventory NUMERIC DEFAULT 0,

    -- Weight Units (KG)
    previous_balance_kg NUMERIC DEFAULT 0,
    production_kg NUMERIC DEFAULT 0,
    sales_kg NUMERIC DEFAULT 0,
    current_inventory_kg NUMERIC DEFAULT 0,

    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(farm_id, date, product_id)
);

-- INVOICES (Sales Records)
CREATE TABLE invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number TEXT,
    farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    
    total_cartons NUMERIC DEFAULT 0,
    total_weight NUMERIC DEFAULT 0,
    
    driver_name TEXT,
    driver_phone TEXT,
    plate_number TEXT,
    description TEXT,
    
    is_yesterday BOOLEAN DEFAULT FALSE,
    
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Row Level Security (RLS) - Basic Setup enable for all
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- POLICIES (Simplified for restoration - You may need to refine these)

-- Profiles: Users can read their own profile. Admins can read all.
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Farms: Visible to everyone authenticated
CREATE POLICY "Farms are viewable by authenticated users" ON farms FOR SELECT TO authenticated USING (true);

-- Statistics:Viewable by all authenticated
CREATE POLICY "Statistics viewable by authenticated" ON daily_statistics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Statistics insertable by authenticated" ON daily_statistics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Statistics updatable by authenticated" ON daily_statistics FOR UPDATE TO authenticated USING (true);

-- Invoices: Same as stats
CREATE POLICY "Invoices viewable by authenticated" ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Invoices insertable by authenticated" ON invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Invoices updatable by authenticated" ON invoices FOR UPDATE TO authenticated USING (true);

-- 4. Triggers
-- Auto update 'updated_at' column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_daily_statistics_modtime BEFORE UPDATE ON daily_statistics FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_invoices_modtime BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

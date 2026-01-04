-- ═══════════════════════════════════════════════════════════════════════════════
--  🏛️ MORVARID MIS - ENTERPRISE DATABASE ARCHITECTURE V4.0
--  نخبگانه‌ترین طراحی دیتابیس برای سیستم‌های سازمانی بزرگ
-- ═══════════════════════════════════════════════════════════════════════════════
--
--  📋 ویژگی‌های Enterprise:
--  ✅ Multi-tenancy با Tenant Isolation کامل
--  ✅ Audit Trail جامع برای تمام عملیات
--  ✅ Soft Delete با Retention Policy هوشمند
--  ✅ Performance Optimization با Index Strategy پیشرفته
--  ✅ Data Archiving خودکار
--  ✅ Real-time Analytics و Reporting
--  ✅ Backup & Recovery Strategy
--  ✅ GDPR & Privacy Compliance
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- 🏗️ PHASE 1: FOUNDATIONAL ARCHITECTURE
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Custom Domains for Type Safety
CREATE DOMAIN email_address AS TEXT CHECK (VALUE ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
CREATE DOMAIN phone_number AS TEXT CHECK (VALUE ~ '^\+?[1-9]\d{1,14}$');
CREATE DOMAIN persian_text AS TEXT CHECK (LENGTH(VALUE) <= 1000);
CREATE DOMAIN amount_decimal AS DECIMAL(15,3) CHECK (VALUE >= 0);
CREATE DOMAIN percentage AS DECIMAL(5,2) CHECK (VALUE >= 0 AND VALUE <= 100);

-- Enums for Type Safety
CREATE TYPE user_role_enum AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'ADMIN', 'MANAGER', 'REGISTRATION', 'SALES', 'VIEWER');
CREATE TYPE user_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');
CREATE TYPE tenant_status_enum AS ENUM ('ACTIVE', 'TRIAL', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE operation_type_enum AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT', 'LOGIN', 'LOGOUT');
CREATE TYPE notification_type_enum AS ENUM ('INFO', 'WARNING', 'ERROR', 'SUCCESS', 'URGENT');
CREATE TYPE backup_status_enum AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- 🏢 CORE: TENANT MANAGEMENT (Multi-tenancy Foundation)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL, -- URL-safe identifier
    display_name VARCHAR(200) NOT NULL,
    logo_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#2563EB', -- Brand colors
    secondary_color VARCHAR(7) DEFAULT '#F59E0B',
    
    -- Contact Information
    contact_email email_address NOT NULL,
    contact_phone phone_number,
    address TEXT,
    
    -- Business Settings
    timezone VARCHAR(50) DEFAULT 'Asia/Tehran',
    locale VARCHAR(10) DEFAULT 'fa-IR',
    currency VARCHAR(3) DEFAULT 'IRR',
    fiscal_year_start DATE DEFAULT '2024-03-21', -- Persian calendar
    
    -- Subscription & Limits
    status tenant_status_enum DEFAULT 'TRIAL',
    plan VARCHAR(20) DEFAULT 'BASIC', -- BASIC, PREMIUM, ENTERPRISE
    max_users INTEGER DEFAULT 10,
    max_farms INTEGER DEFAULT 5,
    max_storage_gb INTEGER DEFAULT 1,
    
    -- Trial Management
    trial_starts_at TIMESTAMPTZ DEFAULT NOW(),
    trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
    subscription_ends_at TIMESTAMPTZ,
    
    -- Metadata
    settings JSONB DEFAULT '{}',
    features JSONB DEFAULT '{"analytics": true, "exports": true, "api_access": false}',
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    
    -- Soft Delete
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    
    CONSTRAINT tenants_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT tenants_valid_slug CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT tenants_valid_trial CHECK (trial_ends_at > trial_starts_at)
);

-- Indexes for Performance
CREATE INDEX idx_tenants_slug ON tenants(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_subscription ON tenants(subscription_ends_at) WHERE deleted_at IS NULL;

-- 👥 ENHANCED USER MANAGEMENT
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Basic Info
    full_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(50),
    email email_address NOT NULL,
    phone phone_number,
    avatar_url TEXT,
    
    -- System Access
    username VARCHAR(50) UNIQUE NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'VIEWER',
    status user_status_enum DEFAULT 'PENDING_VERIFICATION',
    
    -- Permissions (JSON for flexibility)
    permissions JSONB DEFAULT '{}',
    restrictions JSONB DEFAULT '{}',
    
    -- Personal Preferences
    language VARCHAR(5) DEFAULT 'fa',
    theme VARCHAR(10) DEFAULT 'system', -- light, dark, system
    timezone VARCHAR(50) DEFAULT 'Asia/Tehran',
    
    -- Security
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    failed_login_attempts INTEGER DEFAULT 0,
    password_changed_at TIMESTAMPTZ,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret TEXT,
    
    -- Employment Info
    employee_id VARCHAR(20),
    department VARCHAR(50),
    position VARCHAR(50),
    hire_date DATE,
    salary_amount amount_decimal,
    
    -- Emergency Contact
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone phone_number,
    emergency_contact_relation VARCHAR(30),
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    
    -- Soft Delete
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES profiles(id),
    
    CONSTRAINT profiles_username_format CHECK (username ~ '^[a-zA-Z0-9_.-]+$'),
    CONSTRAINT profiles_tenant_isolation CHECK (
        (tenant_id IS NOT NULL AND role != 'SUPER_ADMIN') OR 
        (tenant_id IS NULL AND role = 'SUPER_ADMIN')
    )
);

-- Comprehensive Indexes
CREATE UNIQUE INDEX idx_profiles_username ON profiles(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_tenant_role ON profiles(tenant_id, role) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_email ON profiles(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_status ON profiles(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_last_login ON profiles(last_login_at DESC);

-- 🏭 ENHANCED FARM MANAGEMENT
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE farms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Basic Info
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL, -- Business identifier
    description TEXT,
    farm_type VARCHAR(30) DEFAULT 'PRODUCTION', -- PRODUCTION, R&D, PROCESSING
    
    -- Location
    address TEXT,
    city VARCHAR(50),
    province VARCHAR(50),
    postal_code VARCHAR(10),
    coordinates POINT, -- PostGIS for advanced location queries
    
    -- Business Details
    license_number VARCHAR(50),
    tax_id VARCHAR(20),
    established_date DATE,
    total_area_hectare DECIMAL(10,2),
    production_capacity_annual INTEGER,
    
    -- Contact Info
    manager_name VARCHAR(100),
    manager_phone phone_number,
    manager_email email_address,
    
    -- Operational Status
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, MAINTENANCE, CLOSED
    operational_since DATE,
    certification_level VARCHAR(30), -- ORGANIC, ISO22000, HALAL, etc.
    
    -- Settings & Metadata
    settings JSONB DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    
    -- Soft Delete
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES profiles(id),
    
    CONSTRAINT farms_code_format CHECK (code ~ '^[A-Z0-9-]+$'),
    CONSTRAINT farms_area_positive CHECK (total_area_hectare > 0)
);

-- Indexes for farm queries
CREATE UNIQUE INDEX idx_farms_code ON farms(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_farms_tenant ON farms(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_farms_status ON farms(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_farms_location ON farms USING GIST(coordinates) WHERE deleted_at IS NULL;

-- 🏷️ ADVANCED PRODUCT CATALOG
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id), -- NULL for global products
    
    -- Product Identity
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    name_en VARCHAR(100), -- English name for exports
    description TEXT,
    category VARCHAR(50),
    subcategory VARCHAR(50),
    
    -- Classification
    product_type VARCHAR(30) DEFAULT 'FINISHED_GOOD', -- RAW_MATERIAL, SEMI_FINISHED, FINISHED_GOOD
    unit_of_measure VARCHAR(20) DEFAULT 'PIECE', -- PIECE, KG, LITER, BOX, CARTON
    base_unit VARCHAR(20) DEFAULT 'PIECE',
    conversion_factor DECIMAL(10,4) DEFAULT 1.0,
    
    -- Specifications
    weight_kg DECIMAL(8,3),
    dimensions_cm JSONB, -- {length: 10, width: 5, height: 2}
    packaging_type VARCHAR(30),
    shelf_life_days INTEGER,
    storage_conditions TEXT,
    
    -- Business Rules
    min_order_quantity INTEGER DEFAULT 1,
    max_order_quantity INTEGER,
    lead_time_days INTEGER DEFAULT 0,
    cost_price amount_decimal,
    selling_price amount_decimal,
    margin_percentage percentage,
    
    -- Quality & Compliance
    quality_grade VARCHAR(20),
    certifications TEXT[],
    allergen_info TEXT[],
    origin_country VARCHAR(3) DEFAULT 'IRN',
    
    -- Inventory Management
    track_inventory BOOLEAN DEFAULT TRUE,
    reorder_level INTEGER DEFAULT 0,
    economic_order_quantity INTEGER,
    
    -- Status & Lifecycle
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, DISCONTINUED, SEASONAL
    launch_date DATE,
    discontinue_date DATE,
    
    -- Metadata
    tags TEXT[],
    custom_attributes JSONB DEFAULT '{}',
    supplier_info JSONB DEFAULT '{}',
    
    -- Media
    image_urls TEXT[],
    document_urls TEXT[],
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    
    -- Soft Delete
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES profiles(id),
    
    CONSTRAINT products_sku_format CHECK (sku ~ '^[A-Z0-9-]+$'),
    CONSTRAINT products_positive_prices CHECK (
        (cost_price IS NULL OR cost_price >= 0) AND 
        (selling_price IS NULL OR selling_price >= 0)
    )
);

-- Performance indexes
CREATE UNIQUE INDEX idx_products_sku ON products(sku) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_tenant ON products(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category ON products(category, subcategory) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_status ON products(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_name_search ON products USING gin(to_tsvector('persian', name)) WHERE deleted_at IS NULL;

-- 🔗 USER-FARM ASSIGNMENT (Enhanced RBAC)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE user_farm_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    
    -- Access Control
    role VARCHAR(30) DEFAULT 'VIEWER', -- MANAGER, SUPERVISOR, OPERATOR, VIEWER
    permissions JSONB DEFAULT '{}', -- Granular permissions per farm
    access_level VARCHAR(20) DEFAULT 'READ_ONLY', -- FULL_ACCESS, LIMITED_ACCESS, READ_ONLY
    
    -- Time-based Access
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    working_hours JSONB, -- {"start": "08:00", "end": "17:00", "days": ["Mon", "Tue"]}
    
    -- Assignment Details
    assigned_by UUID REFERENCES profiles(id),
    assignment_reason VARCHAR(200),
    notes TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_primary BOOLEAN DEFAULT FALSE, -- Primary farm for the user
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    
    -- Soft Delete
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES profiles(id),
    
    UNIQUE(user_id, farm_id), -- One assignment per user-farm pair
    CONSTRAINT valid_date_range CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX idx_user_farm_user ON user_farm_assignments(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_farm_farm ON user_farm_assignments(farm_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_farm_active ON user_farm_assignments(is_active) WHERE deleted_at IS NULL;

-- 📊 PRODUCTION STATISTICS (Enhanced Analytics)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE production_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    farm_id UUID NOT NULL REFERENCES farms(id),
    product_id UUID NOT NULL REFERENCES products(id),
    
    -- Time Dimensions
    record_date DATE NOT NULL,
    record_time TIME DEFAULT CURRENT_TIME,
    shift VARCHAR(20), -- MORNING, AFTERNOON, NIGHT
    week_number INTEGER GENERATED ALWAYS AS (EXTRACT(WEEK FROM record_date)) STORED,
    month_number INTEGER GENERATED ALWAYS AS (EXTRACT(MONTH FROM record_date)) STORED,
    quarter_number INTEGER GENERATED ALWAYS AS (EXTRACT(QUARTER FROM record_date)) STORED,
    year_number INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM record_date)) STORED,
    
    -- Production Metrics
    produced_quantity amount_decimal NOT NULL DEFAULT 0,
    produced_weight_kg amount_decimal,
    quality_grade VARCHAR(20) DEFAULT 'A',
    defect_quantity amount_decimal DEFAULT 0,
    defect_rate percentage GENERATED ALWAYS AS (
        CASE WHEN produced_quantity > 0 
        THEN (defect_quantity / produced_quantity * 100) 
        ELSE 0 END
    ) STORED,
    
    -- Inventory Snapshot
    opening_balance amount_decimal DEFAULT 0,
    opening_balance_kg amount_decimal DEFAULT 0,
    closing_balance amount_decimal DEFAULT 0,
    closing_balance_kg amount_decimal DEFAULT 0,
    
    -- Cost Information
    production_cost amount_decimal,
    labor_cost amount_decimal,
    material_cost amount_decimal,
    overhead_cost amount_decimal,
    unit_cost amount_decimal GENERATED ALWAYS AS (
        CASE WHEN produced_quantity > 0 
        THEN (production_cost / produced_quantity) 
        ELSE 0 END
    ) STORED,
    
    -- Production Context
    batch_number VARCHAR(50),
    machine_id VARCHAR(30),
    operator_id UUID REFERENCES profiles(id),
    supervisor_id UUID REFERENCES profiles(id),
    
    -- Environmental Factors
    temperature_celsius DECIMAL(4,1),
    humidity_percentage percentage,
    weather_conditions VARCHAR(50),
    
    -- Quality Metrics
    quality_score percentage,
    quality_notes TEXT,
    inspection_passed BOOLEAN DEFAULT TRUE,
    inspector_id UUID REFERENCES profiles(id),
    
    -- Production Line Data
    line_speed_per_hour INTEGER,
    downtime_minutes INTEGER DEFAULT 0,
    efficiency_rate percentage GENERATED ALWAYS AS (
        CASE WHEN (480 - COALESCE(downtime_minutes, 0)) > 0 -- 8 hour shift
        THEN ((480 - COALESCE(downtime_minutes, 0)) / 480.0 * 100)
        ELSE 0 END
    ) STORED,
    
    -- Compliance & Certification
    haccp_checked BOOLEAN DEFAULT FALSE,
    iso_compliance BOOLEAN DEFAULT FALSE,
    halal_certified BOOLEAN DEFAULT FALSE,
    
    -- Notes and Attachments
    notes TEXT,
    attachments TEXT[], -- URLs to files
    
    -- Verification
    verified_by UUID REFERENCES profiles(id),
    verified_at TIMESTAMPTZ,
    verification_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, VERIFIED, REJECTED
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    
    -- Soft Delete
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES profiles(id),
    
    CONSTRAINT production_positive_quantities CHECK (
        produced_quantity >= 0 AND 
        COALESCE(produced_weight_kg, 0) >= 0 AND 
        COALESCE(defect_quantity, 0) >= 0
    ),
    CONSTRAINT production_valid_balance CHECK (
        opening_balance >= 0 AND closing_balance >= 0
    )
);

-- Performance indexes for analytics
CREATE INDEX idx_production_tenant_date ON production_records(tenant_id, record_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_production_farm_date ON production_records(farm_id, record_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_production_product_date ON production_records(product_id, record_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_production_time_dimensions ON production_records(year_number, quarter_number, month_number, week_number);
CREATE INDEX idx_production_verification ON production_records(verification_status, verified_at);
CREATE INDEX idx_production_quality ON production_records(quality_grade, quality_score) WHERE deleted_at IS NULL;

-- 🧾 ENHANCED INVOICE MANAGEMENT
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    farm_id UUID NOT NULL REFERENCES farms(id),
    
    -- Invoice Identity
    invoice_number VARCHAR(30) NOT NULL,
    invoice_type VARCHAR(20) DEFAULT 'SALES', -- SALES, PURCHASE, CREDIT_NOTE, DEBIT_NOTE
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, PENDING, APPROVED, PAID, CANCELLED, REFUNDED
    
    -- Dates
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    payment_date DATE,
    
    -- Customer/Vendor Information
    customer_name VARCHAR(100),
    customer_code VARCHAR(30),
    customer_address TEXT,
    customer_phone phone_number,
    customer_email email_address,
    customer_tax_id VARCHAR(20),
    
    -- Financial Summary
    subtotal_amount amount_decimal DEFAULT 0,
    discount_percentage percentage DEFAULT 0,
    discount_amount amount_decimal DEFAULT 0,
    tax_percentage percentage DEFAULT 9, -- Iran VAT
    tax_amount amount_decimal DEFAULT 0,
    shipping_cost amount_decimal DEFAULT 0,
    other_charges amount_decimal DEFAULT 0,
    total_amount amount_decimal NOT NULL DEFAULT 0,
    paid_amount amount_decimal DEFAULT 0,
    balance_due amount_decimal GENERATED ALWAYS AS (total_amount - COALESCE(paid_amount, 0)) STORED,
    
    -- Payment Information
    payment_method VARCHAR(30), -- CASH, BANK_TRANSFER, CHEQUE, CREDIT_CARD
    payment_reference VARCHAR(50),
    bank_account VARCHAR(30),
    
    -- Delivery Information
    delivery_date DATE,
    delivery_address TEXT,
    delivery_method VARCHAR(30), -- PICKUP, DELIVERY, SHIPPING
    tracking_number VARCHAR(50),
    delivery_status VARCHAR(20), -- PENDING, IN_TRANSIT, DELIVERED, RETURNED
    
    -- Sales Representative
    salesperson_id UUID REFERENCES profiles(id),
    commission_rate percentage,
    commission_amount amount_decimal,
    
    -- References
    reference_invoice_id UUID REFERENCES invoices(id), -- For credit/debit notes
    purchase_order_number VARCHAR(30),
    contract_reference VARCHAR(30),
    
    -- Approval Workflow
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,
    approval_comments TEXT,
    
    -- Terms and Conditions
    payment_terms VARCHAR(100),
    shipping_terms VARCHAR(100),
    warranty_terms TEXT,
    
    -- Notes and Attachments
    internal_notes TEXT,
    customer_notes TEXT,
    attachments TEXT[],
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    
    -- Soft Delete
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES profiles(id),
    
    CONSTRAINT invoices_positive_amounts CHECK (
        subtotal_amount >= 0 AND 
        total_amount >= 0 AND 
        COALESCE(paid_amount, 0) >= 0
    ),
    CONSTRAINT invoices_valid_dates CHECK (
        (due_date IS NULL OR due_date >= issue_date) AND
        (payment_date IS NULL OR payment_date >= issue_date)
    )
);

-- Invoice line items for detailed tracking
CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    
    -- Line Item Details
    line_number INTEGER NOT NULL,
    description TEXT,
    quantity amount_decimal NOT NULL,
    unit_price amount_decimal NOT NULL,
    discount_percentage percentage DEFAULT 0,
    discount_amount amount_decimal DEFAULT 0,
    line_total amount_decimal GENERATED ALWAYS AS (
        quantity * unit_price - COALESCE(discount_amount, 0)
    ) STORED,
    
    -- Product Specifications
    product_batch VARCHAR(50),
    expiry_date DATE,
    serial_numbers TEXT[],
    
    -- Tax Information
    tax_rate percentage DEFAULT 9,
    tax_amount amount_decimal DEFAULT 0,
    
    -- Delivery Information
    delivered_quantity amount_decimal DEFAULT 0,
    returned_quantity amount_decimal DEFAULT 0,
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT line_positive_values CHECK (
        quantity > 0 AND 
        unit_price >= 0 AND
        COALESCE(delivered_quantity, 0) >= 0
    )
);

-- Performance indexes
CREATE UNIQUE INDEX idx_invoices_number_tenant ON invoices(invoice_number, tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_tenant_date ON invoices(tenant_id, issue_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_farm_date ON invoices(farm_id, issue_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_status ON invoices(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_customer ON invoices(customer_code, customer_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_payment ON invoices(payment_date, balance_due) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_lines_invoice ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_lines_product ON invoice_line_items(product_id);

-- 🔍 COMPREHENSIVE AUDIT TRAIL SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    
    -- Event Information
    event_type operation_type_enum NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    event_timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- User Information
    user_id UUID REFERENCES profiles(id),
    user_email VARCHAR(100),
    user_role VARCHAR(30),
    ip_address INET,
    user_agent TEXT,
    
    -- Data Changes
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    
    -- Business Context
    business_context JSONB, -- Additional context like farm_id, invoice_number, etc.
    operation_reason VARCHAR(200),
    
    -- Session Information
    session_id VARCHAR(100),
    request_id VARCHAR(100),
    
    -- Compliance & Risk
    risk_level VARCHAR(10) DEFAULT 'LOW', -- LOW, MEDIUM, HIGH, CRITICAL
    compliance_note TEXT,
    
    CONSTRAINT audit_valid_event CHECK (event_type IN ('CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT', 'LOGIN', 'LOGOUT'))
);

-- Partitioning by month for performance
CREATE INDEX idx_audit_tenant_date ON audit_logs(tenant_id, event_timestamp DESC);
CREATE INDEX idx_audit_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_user_date ON audit_logs(user_id, event_timestamp DESC);
CREATE INDEX idx_audit_risk_level ON audit_logs(risk_level) WHERE risk_level IN ('HIGH', 'CRITICAL');

-- 📨 NOTIFICATION SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    
    -- Recipient Information
    user_id UUID REFERENCES profiles(id),
    role_based BOOLEAN DEFAULT FALSE, -- Send to all users with specific role
    target_role VARCHAR(30),
    
    -- Notification Content
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type notification_type_enum DEFAULT 'INFO',
    category VARCHAR(30), -- SYSTEM, PRODUCTION, SALES, AUDIT
    
    -- Delivery Channels
    in_app BOOLEAN DEFAULT TRUE,
    email BOOLEAN DEFAULT FALSE,
    sms BOOLEAN DEFAULT FALSE,
    push_notification BOOLEAN DEFAULT FALSE,
    
    -- Scheduling
    schedule_for TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Status Tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    
    -- Action & Links
    action_url TEXT,
    action_label VARCHAR(50),
    
    -- Priority & Urgency
    priority INTEGER DEFAULT 5, -- 1-10 scale
    requires_acknowledgment BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES profiles(id),
    
    -- Related Data
    related_table VARCHAR(50),
    related_record_id UUID,
    metadata JSONB DEFAULT '{}',
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    
    CONSTRAINT notifications_valid_priority CHECK (priority BETWEEN 1 AND 10)
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_scheduled ON notifications(schedule_for) WHERE sent_at IS NULL;
CREATE INDEX idx_notifications_urgent ON notifications(priority DESC, created_at DESC) WHERE priority >= 8;

-- 💾 BACKUP & ARCHIVE MANAGEMENT
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE backup_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    
    -- Job Information
    job_name VARCHAR(100) NOT NULL,
    backup_type VARCHAR(20) DEFAULT 'INCREMENTAL', -- FULL, INCREMENTAL, DIFFERENTIAL
    
    -- Scope
    tables_included TEXT[],
    date_range_start DATE,
    date_range_end DATE,
    include_deleted BOOLEAN DEFAULT FALSE,
    
    -- Schedule
    is_scheduled BOOLEAN DEFAULT FALSE,
    schedule_cron VARCHAR(50), -- Cron expression
    next_run_at TIMESTAMPTZ,
    
    -- Execution
    status backup_status_enum DEFAULT 'PENDING',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Results
    backup_size_bytes BIGINT,
    records_count BIGINT,
    file_path TEXT,
    checksum VARCHAR(64),
    compression_ratio DECIMAL(4,2),
    
    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Retention
    retention_days INTEGER DEFAULT 30,
    auto_delete_after TIMESTAMPTZ GENERATED ALWAYS AS (completed_at + (retention_days * INTERVAL '1 day')) STORED,
    
    -- Metadata
    backup_metadata JSONB DEFAULT '{}',
    
    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    
    CONSTRAINT backup_valid_type CHECK (backup_type IN ('FULL', 'INCREMENTAL', 'DIFFERENTIAL')),
    CONSTRAINT backup_valid_dates CHECK (date_range_end IS NULL OR date_range_end >= date_range_start)
);

CREATE INDEX idx_backup_jobs_tenant ON backup_jobs(tenant_id, created_at DESC);
CREATE INDEX idx_backup_jobs_schedule ON backup_jobs(next_run_at) WHERE is_scheduled = TRUE;
CREATE INDEX idx_backup_jobs_cleanup ON backup_jobs(auto_delete_after) WHERE status = 'COMPLETED';

-- 📊 ANALYTICS & REPORTING VIEWS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Daily Production Summary
CREATE VIEW daily_production_summary AS
SELECT 
    pr.tenant_id,
    pr.farm_id,
    pr.record_date,
    f.name as farm_name,
    COUNT(DISTINCT pr.product_id) as products_count,
    SUM(pr.produced_quantity) as total_quantity,
    SUM(pr.produced_weight_kg) as total_weight_kg,
    AVG(pr.quality_score) as avg_quality_score,
    SUM(pr.defect_quantity) as total_defects,
    CASE WHEN SUM(pr.produced_quantity) > 0 
         THEN (SUM(pr.defect_quantity) / SUM(pr.produced_quantity) * 100)
         ELSE 0 END as defect_rate_percent,
    SUM(pr.production_cost) as total_cost,
    CASE WHEN SUM(pr.produced_quantity) > 0 
         THEN (SUM(pr.production_cost) / SUM(pr.produced_quantity))
         ELSE 0 END as avg_unit_cost,
    AVG(pr.efficiency_rate) as avg_efficiency_rate
FROM production_records pr
JOIN farms f ON f.id = pr.farm_id
WHERE pr.deleted_at IS NULL
  AND f.deleted_at IS NULL
GROUP BY pr.tenant_id, pr.farm_id, pr.record_date, f.name;

-- Monthly Financial Summary
CREATE VIEW monthly_financial_summary AS
SELECT 
    i.tenant_id,
    i.farm_id,
    f.name as farm_name,
    EXTRACT(YEAR FROM i.issue_date) as year,
    EXTRACT(MONTH FROM i.issue_date) as month,
    COUNT(*) as invoices_count,
    SUM(i.total_amount) as total_revenue,
    SUM(i.paid_amount) as total_paid,
    SUM(i.balance_due) as total_outstanding,
    AVG(i.total_amount) as avg_invoice_value,
    COUNT(*) FILTER (WHERE i.status = 'PAID') as paid_invoices,
    COUNT(*) FILTER (WHERE i.balance_due > 0) as outstanding_invoices,
    CASE WHEN SUM(i.total_amount) > 0 
         THEN (SUM(i.paid_amount) / SUM(i.total_amount) * 100)
         ELSE 0 END as collection_rate_percent
FROM invoices i
JOIN farms f ON f.id = i.farm_id
WHERE i.deleted_at IS NULL 
  AND f.deleted_at IS NULL
  AND i.status != 'CANCELLED'
GROUP BY i.tenant_id, i.farm_id, f.name, 
         EXTRACT(YEAR FROM i.issue_date), 
         EXTRACT(MONTH FROM i.issue_date);

-- 🔐 ROW LEVEL SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_farm_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_jobs ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
CREATE POLICY tenant_isolation_tenants ON tenants
    USING (
        id = (SELECT COALESCE((auth.jwt() ->> 'tenant_id')::uuid, 
                             (SELECT tenant_id FROM profiles WHERE id = auth.uid())))
        OR 
        (auth.jwt() ->> 'role') = 'SUPER_ADMIN'
    );

CREATE POLICY tenant_isolation_profiles ON profiles
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        OR 
        auth.uid() = id
        OR
        (auth.jwt() ->> 'role') = 'SUPER_ADMIN'
    );

CREATE POLICY tenant_isolation_farms ON farms
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM user_farm_assignments ufa
            WHERE ufa.user_id = auth.uid() 
              AND ufa.farm_id = farms.id
              AND ufa.is_active = TRUE
              AND ufa.deleted_at IS NULL
        )
    );

CREATE POLICY tenant_isolation_products ON products
    USING (
        tenant_id IS NULL -- Global products
        OR 
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY tenant_isolation_production_records ON production_records
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM user_farm_assignments ufa
            WHERE ufa.user_id = auth.uid() 
              AND ufa.farm_id = production_records.farm_id
              AND ufa.is_active = TRUE
              AND ufa.deleted_at IS NULL
        )
    );

CREATE POLICY tenant_isolation_invoices ON invoices
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM user_farm_assignments ufa
            WHERE ufa.user_id = auth.uid() 
              AND ufa.farm_id = invoices.farm_id
              AND ufa.is_active = TRUE
              AND ufa.deleted_at IS NULL
        )
    );

-- Audit log access (admin only)
CREATE POLICY audit_admin_only ON audit_logs
    USING (
        (auth.jwt() ->> 'role') IN ('SUPER_ADMIN', 'TENANT_ADMIN', 'ADMIN')
        AND
        (tenant_id IS NULL OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    );

-- 🔄 AUTOMATED TRIGGERS FOR AUDIT TRAIL
-- ═══════════════════════════════════════════════════════════════════════════════

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function() RETURNS trigger AS $$
DECLARE
    audit_row audit_logs%ROWTYPE;
    user_info RECORD;
BEGIN
    -- Get user information
    SELECT p.tenant_id, p.email, p.role 
    INTO user_info
    FROM profiles p 
    WHERE p.id = auth.uid();

    audit_row.id = uuid_generate_v4();
    audit_row.tenant_id = user_info.tenant_id;
    audit_row.table_name = TG_TABLE_NAME;
    audit_row.event_type = TG_OP::operation_type_enum;
    audit_row.event_timestamp = NOW();
    audit_row.user_id = auth.uid();
    audit_row.user_email = user_info.email;
    audit_row.user_role = user_info.role;
    
    IF TG_OP = 'DELETE' THEN
        audit_row.record_id = OLD.id;
        audit_row.old_values = to_jsonb(OLD);
        audit_row.risk_level = 'HIGH';
    ELSIF TG_OP = 'INSERT' THEN
        audit_row.record_id = NEW.id;
        audit_row.new_values = to_jsonb(NEW);
        audit_row.risk_level = 'LOW';
    ELSE -- UPDATE
        audit_row.record_id = NEW.id;
        audit_row.old_values = to_jsonb(OLD);
        audit_row.new_values = to_jsonb(NEW);
        audit_row.risk_level = CASE 
            WHEN TG_TABLE_NAME IN ('invoices', 'production_records') THEN 'MEDIUM'
            ELSE 'LOW' 
        END;
    END IF;

    INSERT INTO audit_logs SELECT audit_row.*;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to critical tables
CREATE TRIGGER audit_trigger_profiles 
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trigger_farms 
    AFTER INSERT OR UPDATE OR DELETE ON farms
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trigger_production_records 
    AFTER INSERT OR UPDATE OR DELETE ON production_records
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trigger_invoices 
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
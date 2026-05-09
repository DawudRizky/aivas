-- =====================================
-- 1. VENDOR
-- =====================================
CREATE TABLE vendor (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact_info VARCHAR(255),
    address VARCHAR(255),
    phone VARCHAR(50),
    status VARCHAR(50)
);

-- =====================================
-- 2. USERS
-- =====================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    role VARCHAR(50),
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255),
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    vendor_id INT,

    FOREIGN KEY (vendor_id) REFERENCES vendor(id)
);

-- =====================================
-- 3. ITEM
-- =====================================
CREATE TABLE item (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE,
    name VARCHAR(100),
    unit VARCHAR(50),
    description TEXT,
    unit_price DECIMAL,
    weight DECIMAL,
    dimensions VARCHAR(100),
    category VARCHAR(100)
);

-- =====================================
-- 4. PURCHASE ORDER
-- =====================================
CREATE TABLE purchase_order (
    id SERIAL PRIMARY KEY,
    po_number VARCHAR(100) UNIQUE,
    date DATE,
    status VARCHAR(50),
    created_by INT,
    vendor_id INT,
    received_by INT,
    total_amount DECIMAL,
    currency VARCHAR(10),

    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (vendor_id) REFERENCES vendor(id),
    FOREIGN KEY (received_by) REFERENCES users(id)
);

-- =====================================
-- 5. PURCHASE ORDER ITEM
-- =====================================
CREATE TABLE purchase_order_item (
    id SERIAL PRIMARY KEY,
    purchase_order_id INT,
    item_id INT,
    quantity_ordered INT,
    unit_price DECIMAL,
    received_qty INT DEFAULT 0,

    FOREIGN KEY (purchase_order_id) REFERENCES purchase_order(id),
    FOREIGN KEY (item_id) REFERENCES item(id)
);

-- =====================================
-- 6. DELIVERY ORDER
-- =====================================
CREATE TABLE delivery_order (
    id SERIAL PRIMARY KEY,
    do_number VARCHAR(100) UNIQUE,
    purchase_order_id INT,
    vendor_id INT,
    status VARCHAR(50),
    shipped_at TIMESTAMP,
    carrier VARCHAR(100),
    tracking_number VARCHAR(100),

    FOREIGN KEY (purchase_order_id) REFERENCES purchase_order(id),
    FOREIGN KEY (vendor_id) REFERENCES vendor(id)
);

-- =====================================
-- 7. DELIVERY ORDER ITEM
-- =====================================
CREATE TABLE delivery_order_item (
    id SERIAL PRIMARY KEY,
    delivery_order_id INT,
    item_id INT,
    quantity INT,

    FOREIGN KEY (delivery_order_id) REFERENCES delivery_order(id),
    FOREIGN KEY (item_id) REFERENCES item(id)
);

-- =====================================
-- 8. QR CODE
-- =====================================
CREATE TABLE qr_code (
    id SERIAL PRIMARY KEY,
    code VARCHAR(255) UNIQUE,
    generated_at TIMESTAMP,
    status VARCHAR(50),
    printed_by INT,

    item_id INT,
    purchase_order_id INT,
    delivery_order_id INT,

    FOREIGN KEY (printed_by) REFERENCES users(id),
    FOREIGN KEY (item_id) REFERENCES item(id),
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_order(id),
    FOREIGN KEY (delivery_order_id) REFERENCES delivery_order(id)
);

-- =====================================
-- 9. INBOUND SCAN
-- =====================================
CREATE TABLE inbound_scan (
    id SERIAL PRIMARY KEY,
    qr_code_id INT,
    scanned_at TIMESTAMP,
    scanned_by INT,
    qty_actual INT,
    status VARCHAR(50),
    location VARCHAR(100),
    device_id VARCHAR(100),
    notes TEXT,

    FOREIGN KEY (qr_code_id) REFERENCES qr_code(id),
    FOREIGN KEY (scanned_by) REFERENCES users(id)
);

-- =====================================
-- 10. PHOTO EVIDENCE
-- =====================================
CREATE TABLE photo_evidence (
    id SERIAL PRIMARY KEY,
    inbound_scan_id INT,
    url VARCHAR(255),
    timestamp TIMESTAMP,
    mime_type VARCHAR(50),
    thumbnail_url VARCHAR(255),

    FOREIGN KEY (inbound_scan_id) REFERENCES inbound_scan(id)
);

-- =====================================
-- 11. GEO TAG
-- =====================================
CREATE TABLE geo_tag (
    id SERIAL PRIMARY KEY,
    inbound_scan_id INT,
    latitude DECIMAL,
    longitude DECIMAL,
    timestamp TIMESTAMP,
    accuracy DECIMAL,

    FOREIGN KEY (inbound_scan_id) REFERENCES inbound_scan(id)
);

-- =====================================
-- 12. DISCREPANCY TICKET
-- =====================================
CREATE TABLE discrepancy_ticket (
    id SERIAL PRIMARY KEY,
    inbound_scan_id INT,
    status VARCHAR(50),
    created_at TIMESTAMP,
    assigned_to INT,
    notes TEXT,
    severity VARCHAR(50),
    history TEXT,
    reopen_reason TEXT,

    FOREIGN KEY (inbound_scan_id) REFERENCES inbound_scan(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);

-- =====================================
-- 13. INVENTORY RECORD
-- =====================================
CREATE TABLE inventory_record (
    id SERIAL PRIMARY KEY,
    item_id INT,
    quantity INT,
    reserved_qty INT DEFAULT 0,
    location VARCHAR(100),
    last_updated TIMESTAMP,
    last_counted_at TIMESTAMP,

    FOREIGN KEY (item_id) REFERENCES item(id),
    UNIQUE (item_id, location)
);

-- =====================================
-- 14. AUDIT LOG
-- =====================================
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50),
    entity_id INT,
    action VARCHAR(50),
    details TEXT,
    performed_by INT,
    ip_address VARCHAR(50),
    timestamp TIMESTAMP,

    FOREIGN KEY (performed_by) REFERENCES users(id)
);
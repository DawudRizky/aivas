# API & Database Documentation

This document lists the current API route endpoints (Next.js app directory `app/api`) and the database schema used in the backend SQL.

**Note:** Routes shown map to files under `app/api/*` (e.g. `app/api/item/route.ts` -> `/api/item`). For nested folders, the path includes the folder hierarchy.

## API Routes

- **`/api/audit-log`** — implemented at `app/api/audit-log/route.ts`
- **`/api/auth/login`** — implemented at `app/api/auth/login/route.ts`
- **`/api/delivery-order`** — implemented at `app/api/delivery-order/route.ts`
- **`/api/delivery-order-item`** — implemented at `app/api/delivery-order-item/route.ts`
- **`/api/discrepancy-ticket`** — implemented at `app/api/discrepancy-ticket/route.ts`
- **`/api/geo-tag`** — implemented at `app/api/geo-tag/route.ts`
- **`/api/inbound-scan`** — implemented at `app/api/inbound-scan/route.ts`
- **`/api/inventory-record`** — implemented at `app/api/inventory-record/route.ts`
- **`/api/item`** — implemented at `app/api/item/route.ts`
- **`/api/photo_evidence`** — implemented at `app/api/photo_evidence/route.ts`
- **`/api/purchase-order`** — implemented at `app/api/purchase-order/route.ts`
- **`/api/purchase-order-item`** — implemented at `app/api/purchase-order-item/route.ts`
- **`/api/qr-code`** — implemented at `app/api/qr-code/route.ts`
- **`/api/test`** — implemented at `app/api/test/route.ts`
- **`/api/vendor`** — implemented at `app/api/vendor/route.ts`

### How to expand each route entry
For each route, open the corresponding file under `app/api/.../route.ts` to document:

- Supported HTTP methods (GET, POST, PUT, DELETE, etc.)
- Request payload and query parameters
- Response shape
- Authentication/authorization requirements

If you want, I can extract those details from each `route.ts` file and expand this doc.

---

## API Endpoints (expanded)

Below are expanded details for each API endpoint including supported HTTP methods, request body shapes for `POST`, example successful responses, and notes about authentication.

- **`/api/auth/login`** (`app/api/auth/login/route.ts`)
    - Methods: `POST`
    - Request (JSON): `{ email: string, password: string }`
    - Success response: `200` JSON `{ message: 'Login berhasil', user: { id, name, email, role } }` and sets cookie `token` (JWT, httpOnly)
    - Errors: `400` missing fields, `404` user not found, `401` invalid password, `500` server error
    - Auth: issues JWT cookie; endpoint itself performs authentication.

- **`/api/audit-log`** (`app/api/audit-log/route.ts`)
    - Methods: `GET`, `POST`
    - GET success: `200` JSON array of audit log rows (includes related `users` partial)
    - POST request: `{ entity_type, entity_id, action, details, performed_by, ip_address? }`
    - POST success: `200` JSON `{ message: 'Audit Log berhasil dibuat', data: [...] }`
    - Auth: no explicit checks in route; expects `performed_by` user id when creating entries.

- **`/api/vendor`** (`app/api/vendor/route.ts`)
    - Methods: `GET`, `POST`
    - GET success: `200` JSON array of vendors
    - POST request: `{ name, contact_info, address, phone, status? }`
    - POST success: `200` JSON `{ message: 'Vendor berhasil dibuat', data: [...] }`
    - Auth: no explicit checks.

- **`/api/item`** (`app/api/item/route.ts`)
    - Methods: `GET`, `POST`
    - GET success: `200` JSON array of items
    - POST request: `{ sku, name, unit, description, unit_price, weight, dimensions, category }`
    - POST success: `200` JSON `{ message: 'Item berhasil dibuat', data: [...] }`
    - Auth: no explicit checks.

- **`/api/purchase-order`** (`app/api/purchase-order/route.ts`)
    - Methods: `GET`, `POST`
    - GET success: `200` JSON array of purchase orders (includes `vendor` relation)
    - POST request: `{ po_number, created_by, vendor_id, received_by?, total_amount }` (server sets `date` + `currency: 'IDR'`)
    - POST success: `200` JSON `{ message: 'Purchase Order berhasil dibuat', data: [...] }`
    - Auth: no explicit checks; `created_by`/`received_by` expected to be user ids.

- **`/api/purchase-order-item`** (`app/api/purchase-order-item/route.ts`)
    - Methods: `GET`, `POST`
    - POST request: `{ purchase_order_id, item_id, quantity_ordered, unit_price }`
    - POST success: `200` JSON `{ message: 'Purchase Order Item berhasil ditambahkan', data: [...] }`

- **`/api/delivery-order`** (`app/api/delivery-order/route.ts`)
    - Methods: `GET`, `POST`
    - GET success: `200` JSON array (includes `vendor` and `purchase_order` relations)
    - POST request: `{ do_number, purchase_order_id, vendor_id, status?, carrier?, tracking_number? }` (server sets `shipped_at`)
    - POST success: `200` JSON `{ message: 'Delivery Order berhasil dibuat', data: [...] }`

- **`/api/delivery-order-item`** (`app/api/delivery-order-item/route.ts`)
    - Methods: `GET`, `POST`
    - POST request: `{ delivery_order_id, item_id, quantity }`
    - POST success: `200` JSON `{ message: 'Delivery Order Item berhasil ditambahkan', data: [...] }`

- **`/api/qr-code`** (`app/api/qr-code/route.ts`)
    - Methods: `GET`, `POST`
    - GET success: `200` JSON array (includes `item`, `purchase_order`, `delivery_order` relations)
    - POST request: `{ printed_by, item_id?, purchase_order_id?, delivery_order_id? }` (server generates `code`, sets `generated_at` and `status: 'generated'`)
    - POST success: `200` JSON `{ message: 'QR Code berhasil dibuat', data: [...] }`

- **`/api/inbound-scan`** (`app/api/inbound-scan/route.ts`)
    - Methods: `GET`, `POST`
    - POST request: `{ qr_code_id, scanned_by, qty_actual, location?, device_id?, notes? }`
    - Behavior: sets `status` to `'received'` if `qty_actual > 0` else `'pending'`, timestamps `scanned_at`
    - POST success: `200` JSON `{ message: 'Inbound Scan berhasil dibuat', data: [...] }`

- **`/api/photo_evidence`** (`app/api/photo_evidence/route.ts`)
    - Methods: `GET`, `POST`
    - POST request: `{ inbound_scan_id, url, mime_type, thumbnail_url? }` (server sets `timestamp`)
    - POST success: `200` JSON `{ message: 'Photo Evidence berhasil dibuat', data: [...] }`

- **`/api/geo-tag`** (`app/api/geo-tag/route.ts`)
    - Methods: `GET`, `POST`
    - POST request: `{ inbound_scan_id, latitude, longitude, accuracy? }` (server sets `timestamp`)
    - POST success: `200` JSON `{ message: 'Geo Tag berhasil dibuat', data: [...] }`

- **`/api/discrepancy-ticket`** (`app/api/discrepancy-ticket/route.ts`)
    - Methods: `GET`, `POST`
    - POST request: `{ inbound_scan_id, assigned_to?, notes?, severity? }` (server sets `status: 'open'`, `created_at`, default `severity: 'medium'`)
    - POST success: `200` JSON `{ message: 'Discrepancy Ticket berhasil dibuat', data: [...] }`

- **`/api/inventory-record`** (`app/api/inventory-record/route.ts`)
    - Methods: `GET`, `POST`
    - POST request: `{ item_id, quantity, reserved_qty?, location }` (server timestamps `last_updated` and `last_counted_at`)
    - POST success: `200` JSON `{ message: 'Inventory Record berhasil dibuat', data: [...] }`

- **`/api/test`** (`app/api/test/route.ts`)
    - Methods: `GET`
    - GET success: `200` JSON array of `vendor` rows (used for quick connectivity/testing)

**Auth summary:** Most routes do not perform explicit authentication/authorization checks in their handlers. The `POST /api/auth/login` route issues a JWT cookie. Many endpoints expect user id fields (e.g., `scanned_by`, `printed_by`, `performed_by`) but do not validate the caller; if you need protection, add middleware or server-side checks validating the JWT.


## Database Schema (SQL)

The SQL schema below is taken from the backend SQL collection and documents the main tables used by the application.

```sql
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
```

---

## Next steps / Notes

- To enrich the API documentation, I can parse each `route.ts` and extract method signatures, request/response examples, and auth requirements. Would you like me to do that now?

---

Generated by the repository tooling on request.

-- Seed data for aivas database (excluding users table)
-- Run with: psql -d your_db -f sql/seeds.sql

BEGIN;

-- Vendors
INSERT INTO vendor (id, name, contact_info, address, phone, status) VALUES
  (1, 'Acme Supplies', 'acme@example.com', '123 Warehouse Rd', '+62-21-555-0100', 'active'),
  (2, 'Global Parts', 'contact@global.com', '45 Industrial Ave', '+62-21-555-0200', 'active');

-- Users (provided rows)
INSERT INTO users (id, name, role, email, password_hash, last_login, is_active, vendor_id) VALUES
  (1, 'inbound 01', 'admin', 'inbound01@email.com', '$2a$12$WC7q.WqyJ9NMSUJTKGOcoesrCUtFIV1qDUxyCekq2vmEKVIAwn6dm', NULL, true, NULL),
  (2, 'ppic 01', 'ppic', 'ppic01@email.com', '$2a$12$jX/yuA/KadgCz8LoKo.xoO0oMCxFZPQY.bY5UDNpFIkrPwraOWzU6', NULL, true, NULL),
  (3, 'supervisor 01', 'supervisor', 'supervisor01@email.com', '$2a$12$WXLSxGy9QrxNOPnySsEFvOF.3Hu05vi1g8Oje2NtDA7bDPBvufX3y', NULL, true, NULL),
  (4, 'vendor 01', 'vendor', 'vendor01@email.com', '$2a$12$TGjL4DrtU7WfbV9ErzK6Au2gWb9JNNuLI76CBUsBxd.jQvjLMIFzG', NULL, true, 1),
  (5, 'vendor 02', 'vendor', 'vendor02@email.com', '$2a$12$TGjL4DrtU7WfbV9ErzK6Au2gWb9JNNuLI76CBUsBxd.jQvjLMIFzG', NULL, true, 2);

-- Items
INSERT INTO item (id, sku, name, unit, description, unit_price, low_stock_threshold, weight, dimensions) VALUES
  (1, 'SKU-000001', 'Widget A', 'pcs', 'Small widget', 9.99, 20, 0.5, '5x5x2 cm'),
  (2, 'SKU-000002', 'Widget B', 'pcs', 'Medium widget', 14.50, 15, 0.8, '7x6x3 cm'),
  (3, 'SKU-000003', 'Bolt M8', 'pcs', 'Steel bolt', 0.15, 200, 0.02, '8mm');

-- Item vendor sources
INSERT INTO item_vendor_source (id, item_id, vendor_id, unit_price) VALUES
  (1, 1, 1, 9.50),
  (2, 1, 2, 9.80),
  (3, 2, 1, 14.20),
  (4, 3, 2, 0.14);

-- Purchase orders
INSERT INTO purchase_order (id, po_number, date, status, created_by, vendor_id, received_by, total_amount, currency) VALUES
  (1, 'PO-GP-05-2026-0001', '2026-05-01', 'received', 2, 1, 4, 166.00, 'IDR'),
  (2, 'PO-GP-05-2026-0002', '2026-05-31', 'acknowledged', 2, 2, NULL, 1.40, 'IDR');

-- Purchase order items
INSERT INTO purchase_order_item (id, purchase_order_id, item_id, quantity_ordered, unit_price, received_qty) VALUES
  (1, 1, 1, 10, 9.50, 0),
  (2, 1, 2, 5, 14.20, 0),
  (3, 2, 3, 10, 0.14, 0);

-- Delivery order
INSERT INTO delivery_order (id, do_number, purchase_order_id, vendor_id, status, shipped_at, carrier, tracking_number) VALUES
  (1, 'DO-0001', 1, 1, 'shipped', '2026-05-02 08:00:00', 'JNE', 'TRK123456');

-- Delivery order items
INSERT INTO delivery_order_item (id, delivery_order_id, box_number, item_id, quantity) VALUES
  (1, 1, 1, 1, 10),
  (2, 1, 2, 2, 5);

-- QR codes (printed_by NULL)
INSERT INTO qr_code (id, code, generated_at, status, printed_by, delivery_order_item_id, box_number, quantity, item_id, purchase_order_id, delivery_order_id) VALUES
  (1, 'QR-1001', '2026-05-02 09:00:00', 'active', NULL, 1, 1, 10, 1, 1, 1),
  (2, 'QR-1002', '2026-05-02 09:05:00', 'active', NULL, 2, 2, 5, 2, 1, 1);

-- Inbound scans (scanned_by NULL)
INSERT INTO inbound_scan (id, qr_code_id, scanned_at, scanned_by, qty_actual, status, location, device_id, notes) VALUES
  (1, 1, '2026-05-02 10:00:00', NULL, 10, 'received', 'WH-A', 'device-01', 'Received in good condition'),
  (2, 2, '2026-05-02 10:05:00', NULL, 5, 'received', 'WH-A', 'device-01', 'OK');

-- Photo evidence
INSERT INTO photo_evidence (id, inbound_scan_id, url, timestamp, mime_type, thumbnail_url) VALUES
  (1, 1, 'https://example.com/photo1.jpg', '2026-05-02 10:01:00', 'image/jpeg', 'https://example.com/thumb1.jpg'),
  (2, 2, 'https://example.com/photo2.jpg', '2026-05-02 10:06:00', 'image/jpeg', 'https://example.com/thumb2.jpg');

-- Geo tags
INSERT INTO geo_tag (id, inbound_scan_id, latitude, longitude, timestamp, accuracy) VALUES
  (1, 1, -6.200000, 106.816666, '2026-05-02 10:00:30', 5.0),
  (2, 2, -6.200100, 106.816700, '2026-05-02 10:05:30', 4.5);

-- Discrepancy ticket (assigned_to NULL)
INSERT INTO discrepancy_ticket (id, inbound_scan_id, status, created_at, assigned_to, notes, severity, history, reopen_reason) VALUES
  (1, 2, 'open', '2026-05-02 11:00:00', NULL, 'Shortage of 1 unit', 'medium', 'Created on receipt', '');

-- Inventory records
INSERT INTO inventory_record (id, item_id, quantity, reserved_qty, location, last_updated, last_counted_at) VALUES
  (1, 1, 100, 0, 'WH-A', '2026-05-02 12:00:00', '2026-05-01'),
  (2, 2, 50, 0, 'WH-A', '2026-05-02 12:00:00', '2026-05-01'),
  (3, 3, 1000, 0, 'WH-A', '2026-05-02 12:00:00', '2026-05-01');

-- Audit log (performed_by NULL)
INSERT INTO audit_log (id, entity_type, entity_id, action, details, performed_by, ip_address, timestamp) VALUES
  (1, 'purchase_order', 1, 'create', 'Created PO-0001', NULL, '192.168.1.10', '2026-05-01 09:00:00');

-- Fix sequences for tables we populated
SELECT setval(pg_get_serial_sequence('vendor','id'), (SELECT COALESCE(MAX(id), 1) FROM vendor));
SELECT setval(pg_get_serial_sequence('users','id'), (SELECT COALESCE(MAX(id), 1) FROM users));
SELECT setval(pg_get_serial_sequence('item','id'), (SELECT COALESCE(MAX(id), 1) FROM item));
SELECT setval(pg_get_serial_sequence('item_vendor_source','id'), (SELECT COALESCE(MAX(id), 1) FROM item_vendor_source));
SELECT setval(pg_get_serial_sequence('purchase_order','id'), (SELECT COALESCE(MAX(id), 1) FROM purchase_order));
SELECT setval(pg_get_serial_sequence('purchase_order_item','id'), (SELECT COALESCE(MAX(id), 1) FROM purchase_order_item));
SELECT setval(pg_get_serial_sequence('delivery_order','id'), (SELECT COALESCE(MAX(id), 1) FROM delivery_order));
SELECT setval(pg_get_serial_sequence('delivery_order_item','id'), (SELECT COALESCE(MAX(id), 1) FROM delivery_order_item));
SELECT setval(pg_get_serial_sequence('qr_code','id'), (SELECT COALESCE(MAX(id), 1) FROM qr_code));
SELECT setval(pg_get_serial_sequence('inbound_scan','id'), (SELECT COALESCE(MAX(id), 1) FROM inbound_scan));
SELECT setval(pg_get_serial_sequence('photo_evidence','id'), (SELECT COALESCE(MAX(id), 1) FROM photo_evidence));
SELECT setval(pg_get_serial_sequence('geo_tag','id'), (SELECT COALESCE(MAX(id), 1) FROM geo_tag));
SELECT setval(pg_get_serial_sequence('discrepancy_ticket','id'), (SELECT COALESCE(MAX(id), 1) FROM discrepancy_ticket));
SELECT setval(pg_get_serial_sequence('inventory_record','id'), (SELECT COALESCE(MAX(id), 1) FROM inventory_record));
SELECT setval(pg_get_serial_sequence('audit_log','id'), (SELECT COALESCE(MAX(id), 1) FROM audit_log));

COMMIT;

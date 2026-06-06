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
  (5, 'vendor 02', 'vendor', 'vendor02@email.com', '$2a$12$TGjL4DrtU7WfbV9ErzK6Au2gWb9JNNuLI76CBUsBxd.jQvjLMIFzG', NULL, true, 2),
  (6, 'it 01', 'it', 'it01@email.com', '$2a$12$26PIrPbp6EMLtVkariiGyen.wcXKSOCu8mcP/k2FUqHba2/GvI7i.', NULL, true, NULL);

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

-- Inventory records
INSERT INTO inventory_record (id, item_id, quantity, reserved_qty, location, last_updated, last_counted_at) VALUES
  (1, 1, 100, 0, 'WH-A', '2026-05-02 12:00:00', '2026-05-01'),
  (2, 2, 50, 0, 'WH-A', '2026-05-02 12:00:00', '2026-05-01'),
  (3, 3, 1000, 0, 'WH-A', '2026-05-02 12:00:00', '2026-05-01');

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

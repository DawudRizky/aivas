-- Add box-level QR metadata for DO box traceability.
-- Run this on existing databases before using the new QR viewer.

ALTER TABLE qr_code
  ADD COLUMN IF NOT EXISTS delivery_order_item_id INT,
  ADD COLUMN IF NOT EXISTS box_number INT,
  ADD COLUMN IF NOT EXISTS quantity INT;

ALTER TABLE qr_code
  ADD CONSTRAINT qr_code_delivery_order_item_id_fkey FOREIGN KEY (delivery_order_item_id) REFERENCES delivery_order_item(id);

ALTER TABLE qr_code
  ADD CONSTRAINT qr_code_delivery_order_item_id_key UNIQUE (delivery_order_item_id);

ALTER TABLE inventory_items ADD COLUMN status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE inventory_items ADD COLUMN order_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN ordered_at TEXT;

CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  stock INTEGER NOT NULL CHECK (stock >= 0),
  threshold INTEGER NOT NULL CHECK (threshold >= 0),
  part_no TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER,
  item_name TEXT NOT NULL,
  delta INTEGER NOT NULL,
  stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO inventory_items
  (id, name, category, unit, stock, threshold, part_no, display_order)
VALUES
  (1, 'グローブ（M）', '衛生・消耗品', '箱', 2, 5, 'DEMO-01', 1),
  (2, 'マスク', '衛生・消耗品', '箱', 4, 4, 'DEMO-02', 2),
  (3, '紙コップ', '衛生・消耗品', '袋', 6, 4, 'DEMO-03', 3),
  (4, 'ペーパータオル', '衛生・消耗品', '袋', 8, 3, 'DEMO-04', 4),
  (5, '手指消毒剤', '衛生・消耗品', '本', 3, 2, 'DEMO-05', 5),
  (6, 'ティッシュ', '衛生・消耗品', '箱', 0, 2, 'DEMO-06', 6);


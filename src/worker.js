const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const INITIAL_STOCK = new Map([[1, 2], [2, 4], [3, 6], [4, 8], [5, 3], [6, 0]]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function cleanActor(value) {
  const actor = String(value || "参加者").trim().slice(0, 40);
  return actor || "参加者";
}

async function listState(db) {
  const [itemsResult, logResult] = await Promise.all([
    db.prepare(`SELECT id, name, category, unit, stock, threshold,
      part_no AS partNo,
      status, order_qty AS orderQty, ordered_at AS orderedAt,
      updated_at AS updatedAt
      FROM inventory_items ORDER BY display_order`).all(),
    db.prepare(`SELECT id, item_name AS itemName, delta, stock_after AS stockAfter,
      actor, action, created_at AS createdAt
      FROM activity_log ORDER BY id DESC LIMIT 30`).all()
  ]);
  return { items: itemsResult.results || [], activity: logResult.results || [] };
}

async function adjustStock(request, env, itemId) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "入力内容を読み取れませんでした。" }, 400);
  }

  const delta = Number(body.delta);
  if (!Number.isInteger(delta) || ![-1, 1].includes(delta)) {
    return json({ error: "増減は1または-1で指定してください。" }, 400);
  }

  const actor = cleanActor(body.actor);
  const result = await env.DB.prepare(`UPDATE inventory_items
    SET stock = stock + ?1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?2 AND stock + ?1 >= 0
    RETURNING id, name, category, unit, stock, threshold,
      part_no AS partNo, status, order_qty AS orderQty, ordered_at AS orderedAt,
      updated_at AS updatedAt`)
    .bind(delta, itemId).first();

  if (!result) {
    const exists = await env.DB.prepare("SELECT stock FROM inventory_items WHERE id = ?").bind(itemId).first();
    if (!exists) return json({ error: "品目が見つかりません。" }, 404);
    return json({ error: "在庫は0未満にできません。" }, 409);
  }

  await env.DB.prepare(`INSERT INTO activity_log
    (item_id, item_name, delta, stock_after, actor, action)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(result.id, result.name, delta, result.stock, actor, delta < 0 ? "使用" : "入庫")
    .run();

  return json({ item: result });
}

async function updateOrder(request, env, itemId) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "入力内容を読み取れませんでした。" }, 400); }
  const action = String(body.action || "");
  const actor = cleanActor(body.actor);
  const qty = Number(body.quantity);
  if (!["ordered", "received", "cancel"].includes(action)) return json({ error: "発注操作が不正です。" }, 400);
  if (action === "ordered" && (!Number.isInteger(qty) || qty < 1)) return json({ error: "発注数は1以上で入力してください。" }, 400);
  const status = action === "cancel" ? "none" : action;
  const orderQty = action === "cancel" ? 0 : qty;
  const item = await env.DB.prepare(`UPDATE inventory_items
    SET status = ?, order_qty = ?, ordered_at = CASE WHEN ? = 'none' THEN NULL ELSE CURRENT_TIMESTAMP END,
      updated_at = CURRENT_TIMESTAMP WHERE id = ?
    RETURNING id, name, category, unit, stock, threshold, part_no AS partNo,
      status, order_qty AS orderQty, ordered_at AS orderedAt, updated_at AS updatedAt`)
    .bind(status, orderQty, status, itemId).first();
  if (!item) return json({ error: "品目が見つかりません。" }, 404);
  await env.DB.prepare(`INSERT INTO activity_log
    (item_id, item_name, delta, stock_after, actor, action)
    VALUES (?, ?, 0, ?, ?, ?)`)
    .bind(item.id, item.name, item.stock, actor, action === "ordered" ? `発注 ${qty}${item.unit}` : action === "received" ? "入荷済み" : "発注取消")
    .run();
  return json({ item });
}

async function resetInventory(request, env) {
  if (!env.RESET_TOKEN) {
    return json({ error: "講師用リセットが設定されていません。" }, 503);
  }
  const supplied = request.headers.get("authorization") || "";
  if (supplied !== `Bearer ${env.RESET_TOKEN}`) {
    return json({ error: "リセット用コードが違います。" }, 401);
  }

  const statements = [];
  for (const [id, stock] of INITIAL_STOCK) {
    statements.push(env.DB.prepare(`UPDATE inventory_items
      SET stock = ?, status = 'none', order_qty = 0, ordered_at = NULL,
        updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(stock, id));
  }
  statements.push(env.DB.prepare("DELETE FROM activity_log"));
  statements.push(env.DB.prepare(`INSERT INTO activity_log
    (item_id, item_name, delta, stock_after, actor, action)
    VALUES (NULL, '全品目', 0, 0, '講師', '初期値へリセット')`));
  await env.DB.batch(statements);
  return json(await listState(env.DB));
}

async function api(request, env, url) {
  if (request.method === "GET" && url.pathname === "/api/state") {
    return json(await listState(env.DB));
  }

  const adjustment = url.pathname.match(/^\/api\/items\/(\d+)\/adjust$/);
  if (request.method === "POST" && adjustment) {
    return adjustStock(request, env, Number(adjustment[1]));
  }

  const order = url.pathname.match(/^\/api\/items\/(\d+)\/order$/);
  if (request.method === "POST" && order) return updateOrder(request, env, Number(order[1]));

  if (request.method === "POST" && url.pathname === "/api/reset") {
    return resetInventory(request, env);
  }

  return json({ error: "APIが見つかりません。" }, 404);
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("cache-control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return withSecurityHeaders(await api(request, env, url));
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(json({ error: "サーバーでエラーが発生しました。" }, 500));
    }
  }
};

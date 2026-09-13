const inventoryEl = document.querySelector("#inventory");
const activityEl = document.querySelector("#activity");
const messageEl = document.querySelector("#message");
const connectionEl = document.querySelector("#connection");
const updatedEl = document.querySelector("#updated");
const actorEl = document.querySelector("#actor");
const template = document.querySelector("#item-template");
let busy = false;

actorEl.value = localStorage.getItem("training-actor") || "";
actorEl.addEventListener("change", () => localStorage.setItem("training-actor", actorEl.value.trim()));

function showMessage(text = "") { messageEl.textContent = text; }
function setBusy(value) {
  busy = value;
  if (value) document.querySelectorAll("button").forEach(button => { button.disabled = true; });
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "通信に失敗しました。");
  return data;
}

function renderItems(items) {
  inventoryEl.replaceChildren();
  for (const item of items) {
    const card = template.content.firstElementChild.cloneNode(true);
    const low = item.stock <= item.threshold;
    card.querySelector(".part-no").textContent = item.partNo;
    card.querySelector(".name").textContent = item.name;
    card.querySelector(".stock").textContent = item.stock;
    card.querySelector(".unit").textContent = item.unit;
    card.querySelector(".threshold").textContent = `基準数：${item.threshold}${item.unit}（基準数以下で要発注）`;
    const status = card.querySelector(".status");
    status.textContent = low ? "要発注" : "在庫あり";
    status.classList.add(low ? "low" : "ok");
    const useButton = card.querySelector(".use");
    useButton.disabled = busy || item.stock === 0;
    useButton.addEventListener("click", () => adjust(item.id, -1, item.name));
    card.querySelector(".receive").addEventListener("click", () => adjust(item.id, 1, item.name));
    inventoryEl.append(card);
  }
}

function renderActivity(rows) {
  activityEl.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "まだ操作履歴はありません。";
    activityEl.append(empty);
    return;
  }
  for (const row of rows) {
    const line = document.createElement("div");
    line.className = "activity-row";
    const time = document.createElement("time");
    time.textContent = new Date(`${row.createdAt}Z`).toLocaleString("ja-JP");
    const action = document.createElement("span");
    action.textContent = row.action === "初期値へリセット"
      ? "全品目を初期値へ戻しました"
      : `${row.itemName}：${row.action} ${row.delta > 0 ? "+" : ""}${row.delta}（残り${row.stockAfter}）`;
    const actor = document.createElement("strong");
    actor.textContent = row.actor;
    line.append(time, action, actor);
    activityEl.append(line);
  }
}

function render(data) {
  renderItems(data.items || []);
  renderActivity(data.activity || []);
  connectionEl.textContent = "共有保存に接続中";
  connectionEl.className = "connection online";
  updatedEl.textContent = `最終確認 ${new Date().toLocaleTimeString("ja-JP")}`;
}

async function load({ quiet = false } = {}) {
  try {
    const data = await request("/api/state");
    render(data);
    if (!quiet) showMessage();
  } catch (error) {
    connectionEl.textContent = "接続できません";
    connectionEl.className = "connection error";
    if (!quiet) showMessage(error.message);
  }
}

async function adjust(id, delta, name) {
  if (busy) return;
  setBusy(true);
  showMessage();
  try {
    await request(`/api/items/${id}/adjust`, {
      method: "POST",
      body: JSON.stringify({ delta, actor: actorEl.value })
    });
    await load({ quiet: true });
    showMessage(`${name}を${delta < 0 ? "1つ使用" : "1つ入庫"}しました。`);
  } catch (error) {
    showMessage(error.message);
    await load({ quiet: true });
  } finally {
    setBusy(false);
    await load({ quiet: true });
  }
}

document.querySelector("#reload").addEventListener("click", () => load());
document.querySelector("#reset").addEventListener("click", async () => {
  const token = prompt("講師用リセットコードを入力してください。");
  if (!token) return;
  if (!confirm("全員の共有在庫と操作履歴を初期状態へ戻します。実行しますか？")) return;
  setBusy(true);
  try {
    render(await request("/api/reset", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: "{}" }));
    showMessage("共有在庫を初期値へ戻しました。");
  } catch (error) {
    showMessage(error.message);
  } finally {
    setBusy(false);
    await load({ quiet: true });
  }
});

load();
setInterval(() => { if (!busy && document.visibilityState === "visible") load({ quiet: true }); }, 3000);

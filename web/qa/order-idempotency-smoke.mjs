import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("data/orders.sqlite");
const key = randomUUID();
try {
  const product = db.prepare("SELECT id,stock FROM catalog_products WHERE price_mode='fixed' AND stock>0 AND return_restricted=0 LIMIT 1").get();
  if (!product) throw new Error("No test product available");
  const body = { key, name: "Проверка повторного заказа", phone: "+37368123456", contactMethod: "call", deliveryMethod: "pickup", address: "", paymentMethod: "receipt", comment: "", agreed: true, restrictedAgreed: false, items: [{ id: product.id, quantity: 1 }] };
  const send = () => fetch("http://localhost:3000/api/orders", { method: "POST", headers: { origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const [first, second] = await Promise.all([send(), send()]);
  if (first.status !== 201 || second.status !== 201) throw new Error(`Order responses ${first.status}/${second.status}`);
  const a = await first.json(), b = await second.json();
  if (a.token !== b.token || a.number !== b.number) throw new Error("Duplicate order was created");
  if (db.prepare("SELECT stock FROM catalog_products WHERE id=?").get(product.id).stock !== product.stock) throw new Error("Stock must change only when the operator confirms the order");
  console.log("concurrent duplicate requests returned one order: OK");
} finally {
  const row = db.prepare("SELECT id FROM orders WHERE idempotency_key=?").get(key);
  if (row) {
    const lines = db.prepare("SELECT product_id,quantity FROM order_items WHERE order_id=?").all(row.id);
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("DELETE FROM order_status_history WHERE order_id=?").run(row.id);
      db.prepare("DELETE FROM order_items WHERE order_id=?").run(row.id);
      db.prepare("DELETE FROM orders WHERE id=?").run(row.id);
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  db.close();
}

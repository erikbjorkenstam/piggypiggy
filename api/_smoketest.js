// Kör: node _smoketest.js
// Stubbar @azure/data-tables med en in-memory-TableClient, precis som INFRASTRUKTUR.md
// beskriver, och kör igenom spara/lista/hämta/ta bort + kodkontroll utan riktig Azure.

process.env.AZURE_STORAGE_CONNECTION_STRING = "fake";
process.env.FAMILY_CODE = "hemligt123";

// ---- Fejkad TableClient ----
const store = new Map(); // key: partitionKey|rowKey -> entity

class FakeTableClient {
  async createTable() {
    return;
  }
  async upsertEntity(entity) {
    store.set(entity.partitionKey + "|" + entity.rowKey, entity);
  }
  async getEntity(pk, rk) {
    const e = store.get(pk + "|" + rk);
    if (!e) {
      const err = new Error("not found");
      err.statusCode = 404;
      throw err;
    }
    return e;
  }
  async deleteEntity(pk, rk) {
    const key = pk + "|" + rk;
    if (!store.has(key)) {
      const err = new Error("not found");
      err.statusCode = 404;
      throw err;
    }
    store.delete(key);
  }
  async *listEntities({ queryOptions }) {
    for (const e of store.values()) yield e;
  }
}

const realPath = require.resolve("@azure/data-tables");
require.cache[realPath] = {
  id: realPath,
  filename: realPath,
  loaded: true,
  exports: { TableClient: { fromConnectionString: () => new FakeTableClient() } },
};

// ---- Fejkade context/req-hjälpare ----
function mkContext() {
  return { res: null, bindingData: {} };
}
function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("OK: " + msg);
}

(async () => {
  const levelsFn = require("./levels/index.js");
  const levelFn = require("./level/index.js");

  // 1. Lista när tomt
  let ctx = mkContext();
  await levelsFn(ctx, { method: "GET", headers: {} });
  assert(ctx.res.status === 200 && Array.isArray(ctx.res.body) && ctx.res.body.length === 0, "tom lista vid start");

  // 2. Spara utan kod -> 403
  ctx = mkContext();
  await levelsFn(ctx, { method: "POST", headers: {}, body: { name: "Testbana", level: { a: 1 } } });
  assert(ctx.res.status === 403, "spara utan familjekod nekas (403)");

  // 3. Spara med fel kod -> 403
  ctx = mkContext();
  await levelsFn(ctx, {
    method: "POST",
    headers: { "x-family-code": "fel" },
    body: { name: "Testbana", level: { a: 1 }, code: "fel" },
  });
  assert(ctx.res.status === 403, "spara med fel familjekod nekas (403)");

  // 4. Spara med rätt kod -> 200
  ctx = mkContext();
  await levelsFn(ctx, {
    method: "POST",
    headers: { "x-family-code": "hemligt123" },
    body: { name: "Testbana", level: { width: 4200, coins: [{ x: 1, y: 2 }] }, code: "hemligt123" },
  });
  assert(ctx.res.status === 200 && ctx.res.body.ok, "spara med rätt familjekod fungerar");

  // 5. Lista -> innehåller banan
  ctx = mkContext();
  await levelsFn(ctx, { method: "GET", headers: {} });
  assert(ctx.res.body.length === 1 && ctx.res.body[0].name === "Testbana", "listan visar sparad bana");

  // 6. Hämta en bana
  ctx = mkContext();
  ctx.bindingData.name = "Testbana";
  await levelFn(ctx, { method: "GET", headers: {} });
  assert(ctx.res.status === 200 && ctx.res.body.level.width === 4200, "hämta enskild bana ger rätt JSON");

  // 7. Hämta bana som inte finns -> 404
  ctx = mkContext();
  ctx.bindingData.name = "Finnsinte";
  await levelFn(ctx, { method: "GET", headers: {} });
  assert(ctx.res.status === 404, "hämta okänd bana ger 404");

  // 8. Ta bort utan kod -> 403
  ctx = mkContext();
  ctx.bindingData.name = "Testbana";
  await levelFn(ctx, { method: "DELETE", headers: {} });
  assert(ctx.res.status === 403, "ta bort utan kod nekas (403)");

  // 9. Ta bort med rätt kod -> 200
  ctx = mkContext();
  ctx.bindingData.name = "Testbana";
  await levelFn(ctx, { method: "DELETE", headers: { "x-family-code": "hemligt123" } });
  assert(ctx.res.status === 200 && ctx.res.body.ok, "ta bort med rätt kod fungerar");

  // 10. Namn med / \ # ? saneras (sanitize)
  ctx = mkContext();
  await levelsFn(ctx, {
    method: "POST",
    headers: { "x-family-code": "hemligt123" },
    body: { name: "Konstig/na#mn?", level: { x: 1 }, code: "hemligt123" },
  });
  ctx = mkContext();
  await levelsFn(ctx, { method: "GET", headers: {} });
  assert(ctx.res.body.length === 1 && ctx.res.body[0].name === "Konstig/na#mn?", "konstiga tecken i namn hanteras utan krasch");

  console.log("\nAlla tester gick igenom ✔");
})().catch((err) => {
  console.error("\nTEST MISSLYCKADES:", err.message);
  process.exit(1);
});

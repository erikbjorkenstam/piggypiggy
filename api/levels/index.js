const { getClient, sanitize, checkCode, PARTITION_KEY } = require("../shared/table");

module.exports = async function (context, req) {
  context.res = { headers: { "Cache-Control": "no-store", "Content-Type": "application/json" } };

  try {
    const client = await getClient();

    if (req.method === "GET") {
      const list = [];
      for await (const entity of client.listEntities({
        queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` },
      })) {
        list.push({ name: entity.name, updated: entity.updated });
      }
      context.res.status = 200;
      context.res.body = list;
      return;
    }

    if (req.method === "POST") {
      if (!checkCode(req)) {
        context.res.status = 403;
        context.res.body = { error: "Fel eller saknad familjekod." };
        return;
      }
      const { name, level } = req.body || {};
      if (!name || !level) {
        context.res.status = 400;
        context.res.body = { error: "name och level krävs." };
        return;
      }
      const rowKey = sanitize(name);
      if (!rowKey) {
        context.res.status = 400;
        context.res.body = { error: "Ogiltigt namn." };
        return;
      }
      const updated = new Date().toISOString();
      await client.upsertEntity(
        {
          partitionKey: PARTITION_KEY,
          rowKey,
          name,
          data: JSON.stringify(level),
          updated,
        },
        "Replace"
      );
      context.res.status = 200;
      context.res.body = { ok: true, name, updated };
      return;
    }

    context.res.status = 405;
    context.res.body = { error: "Metod stöds ej." };
  } catch (err) {
    context.res.status = 500;
    context.res.body = { error: err.message || "Internt fel." };
  }
};

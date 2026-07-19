const { getClient, sanitize, checkCode, PARTITION_KEY } = require("../shared/table");

module.exports = async function (context, req) {
  context.res = { headers: { "Cache-Control": "no-store", "Content-Type": "application/json" } };
  const rowKey = sanitize(context.bindingData.name);

  try {
    const client = await getClient();

    if (req.method === "GET") {
      try {
        const entity = await client.getEntity(PARTITION_KEY, rowKey);
        context.res.status = 200;
        context.res.body = { name: entity.name, level: JSON.parse(entity.data) };
      } catch (err) {
        if (err.statusCode === 404) {
          context.res.status = 404;
          context.res.body = { error: "Banan hittades inte." };
        } else {
          throw err;
        }
      }
      return;
    }

    if (req.method === "DELETE") {
      if (!checkCode(req)) {
        context.res.status = 403;
        context.res.body = { error: "Fel eller saknad familjekod." };
        return;
      }
      try {
        await client.deleteEntity(PARTITION_KEY, rowKey);
        context.res.status = 200;
        context.res.body = { ok: true };
      } catch (err) {
        if (err.statusCode === 404) {
          context.res.status = 404;
          context.res.body = { error: "Banan hittades inte." };
        } else {
          throw err;
        }
      }
      return;
    }

    context.res.status = 405;
    context.res.body = { error: "Metod stöds ej." };
  } catch (err) {
    context.res.status = 500;
    context.res.body = { error: err.message || "Internt fel." };
  }
};

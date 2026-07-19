// Delad hjälpmodul för api/levels och api/level.
// Ansvarar för: TableClient-anslutning, namn-sanering (RowKey) och kontroll av familjekoden.
const { TableClient } = require("@azure/data-tables");

const TABLE_NAME = "levels";
const PARTITION_KEY = "lvl";

let clientPromise = null;

// Skapar (eller återanvänder) en TableClient och ser till att tabellen finns.
// "finns redan"-felet (409) ignoreras medvetet.
function getClient() {
  if (!clientPromise) {
    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!conn) {
      throw new Error("AZURE_STORAGE_CONNECTION_STRING saknas i app-inställningarna.");
    }
    const client = TableClient.fromConnectionString(conn, TABLE_NAME, {
      allowInsecureConnection: true, // behövs för lokal Azurite-emulering; ofarligt mot riktig Azure (https ändå)
    });
    clientPromise = client
      .createTable()
      .catch((err) => {
        if (err.statusCode !== 409) throw err; // 409 = "finns redan", ok
      })
      .then(() => client);
  }
  return clientPromise;
}

// Tar bort tecken som inte är tillåtna i en Table Storage RowKey (/ \ # ?) samt
// kontrolltecken, och trunkerar till max 120 tecken.
function sanitize(name) {
  return String(name || "")
    .replace(/[\/\\#?]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 120);
}

// Läser familjekoden ur headern x-family-code eller body.code och jämför mot
// app-inställningen FAMILY_CODE. Returnerar true/false.
function checkCode(req) {
  const expected = process.env.FAMILY_CODE;
  if (!expected) return false; // ingen kod konfigurerad => all skrivning nekas
  const given =
    (req.headers && (req.headers["x-family-code"] || req.headers["X-Family-Code"])) ||
    (req.body && req.body.code) ||
    "";
  return given === expected;
}

module.exports = { getClient, sanitize, checkCode, PARTITION_KEY, TABLE_NAME };

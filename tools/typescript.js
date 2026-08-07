/** v9.12.0 — taşınabilir TypeScript yükleyici.
 * Claude/CI/Termux gibi ortamlara özel absolute path kullanmaz.
 * Önce mevcut çalışma dizinini, sonra repo/frontend'i arar.
 */
const path = require("path");
const candidates = [process.cwd(), path.join(__dirname, "..", "frontend")];
let resolved;
for (const base of candidates) {
  try { resolved = require.resolve("typescript", { paths: [base] }); break; } catch {}
}
if (!resolved) {
  throw new Error("TypeScript bulunamadı. Önce: cd frontend && yarn install");
}
module.exports = require(resolved);

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const filesToCheck = ["startup.js", "site-config.js", "catalog.js", "app.js", "tools/dev-server.mjs", "tools/check.mjs"];
let failed = false;

function runSyntaxCheck(file) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    failed = true;
    console.error(result.stderr || result.stdout);
    return;
  }
  console.log(`syntax ok: ${file}`);
}

function loadClassicScript(file, context) {
  const code = fs.readFileSync(path.join(root, file), "utf8");
  vm.runInNewContext(code, context, { filename: file });
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

for (const file of filesToCheck) runSyntaxCheck(file);

try {
  const context = { window: {}, console };
  loadClassicScript("site-config.js", context);
  loadClassicScript("catalog.js", context);

  assertObject(context.window.ECONOMY_SITE_CONFIG, "ECONOMY_SITE_CONFIG");
  assertObject(context.window.ECONOMY_CATALOG_EXTENSIONS, "ECONOMY_CATALOG_EXTENSIONS");

  for (const key of ["avatarItems", "roomItems", "roomTemplates"]) {
    assertObject(context.window.ECONOMY_CATALOG_EXTENSIONS[key], `catalog.${key}`);
  }

  console.log("config ok: site-config.js");
  console.log("catalog ok: catalog.js");
} catch (error) {
  failed = true;
  console.error(error.message);
}

if (failed) process.exit(1);
console.log("all checks passed");

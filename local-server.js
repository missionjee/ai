/**
 * HIROTO AI — Institutional Terminal Backend Server
 * - Serves Static Assets & PWA
 * - Injects Supabase Environment Variables securely
 * - Supports @supabase/server & @supabase/supabase-js
 */

import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json"
};

const server = http.createServer(async (req, res) => {
  let reqPath = req.url.split("?")[0];

  // API Route: Public Supabase Configuration for Frontend Client
  if (reqPath === "/api/supabase-config" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(JSON.stringify({
      supabaseUrl: process.env.SUPABASE_URL || "https://fvmbqikdomcjalladwmz.supabase.co",
      publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_UNWum89AzkwnfNb2BoxdKA_otmSXn5c"
    }));
    return;
  }

  // Static File Serving
  if (reqPath === "/") reqPath = "/index.html";

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, "");
  const filePath = path.join(__dirname, safePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": ext === ".html" ? "no-cache" : "max-age=86400"
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 HIROTO AI Terminal running at: http://localhost:${PORT}`);
  console.log(`📱 AMOLED PWA Standalone Mode Enabled`);
  console.log(`⚡ Supabase URL: ${process.env.SUPABASE_URL || "https://fvmbqikdomcjalladwmz.supabase.co"}`);
  console.log(`🔑 Publishable Key Active: ${(process.env.SUPABASE_PUBLISHABLE_KEY || "").slice(0, 16)}...`);
  console.log(`🗄️ PostgreSQL Database: ${process.env.DATABASE_HOST || "db.fvmbqikdomcjalladwmz.supabase.co"}:${process.env.DATABASE_PORT || 5432}`);
  console.log(`======================================================\n`);
});

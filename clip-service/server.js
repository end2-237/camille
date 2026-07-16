// server.js — micro-service d'embeddings CLIP (image + texte).
// Modèle : Xenova/clip-vit-base-patch32 → vecteurs 512 dims, normalisés L2.
// Image et texte partagent le même espace, donc comparables.
//
// Endpoints :
//   GET  /health          → { ok: true, ready }
//   POST /embed-image     { url }  → { embedding: number[512] }
//   POST /embed-text      { text } → { embedding: number[512] }
// Sécurité optionnelle : si CLIP_API_KEY est défini, exiger le header x-api-key.

import http from "http";
import {
  AutoProcessor,
  CLIPVisionModelWithProjection,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  RawImage,
  env,
} from "@xenova/transformers";

env.cacheDir = process.env.TRANSFORMERS_CACHE || "/app/.cache/transformers";
env.allowLocalModels = false;

const MODEL = process.env.CLIP_MODEL || "Xenova/clip-vit-base-patch32";
const API_KEY = process.env.CLIP_API_KEY || "";
const PORT = Number(process.env.PORT) || 8000;

let processor, vision, tokenizer, textModel;
let ready = false;

function l2(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  return Array.from(v, (x) => x / n);
}

async function embedImage(url) {
  processor ||= await AutoProcessor.from_pretrained(MODEL);
  vision ||= await CLIPVisionModelWithProjection.from_pretrained(MODEL);
  const image = await RawImage.read(url);
  const inputs = await processor(image);
  const out = await vision(inputs);
  ready = true;
  return l2(out.image_embeds.data);
}

async function embedText(text) {
  tokenizer ||= await AutoTokenizer.from_pretrained(MODEL);
  textModel ||= await CLIPTextModelWithProjection.from_pretrained(MODEL);
  const inputs = tokenizer([String(text).slice(0, 200)], { padding: true, truncation: true });
  const out = await textModel(inputs);
  ready = true;
  return l2(out.text_embeds.data);
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); }
    });
  });
}

function send(res, code, obj) {
  const s = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(s) });
  res.end(s);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return send(res, 200, { ok: true, ready, model: MODEL });
    }
    if (req.method === "POST" && (req.url === "/embed-image" || req.url === "/embed-text")) {
      if (API_KEY && req.headers["x-api-key"] !== API_KEY) {
        return send(res, 401, { error: "clé API invalide" });
      }
      const body = await readBody(req);
      if (req.url === "/embed-image") {
        if (!body.url) return send(res, 400, { error: "url requis" });
        const embedding = await embedImage(body.url);
        return send(res, 200, { embedding });
      }
      if (!body.text) return send(res, 400, { error: "text requis" });
      const embedding = await embedText(body.text);
      return send(res, 200, { embedding });
    }
    return send(res, 404, { error: "not found" });
  } catch (err) {
    return send(res, 500, { error: String(err) });
  }
});

server.listen(PORT, () => {
  console.log(`camille-clip-service en écoute sur :${PORT} (modèle ${MODEL})`);
});

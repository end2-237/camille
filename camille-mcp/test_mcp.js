// test_mcp.js — teste le serveur MCP de bout en bout, sans dépendance.
// 1) démarre un faux catalogue HTTP (connecteur camille)
// 2) lance server.js pointé dessus
// 3) déroule initialize → tools/list → tools/call (search, list, categories, image, get)
const http = require("http");
const { spawn } = require("child_process");

const PRODUCTS = [
  { id: "mug", name: "Coffee Cup", price: 6000, currency: "XAF", category: "Vaisselle", image_url: "mug.jpg", product_url: "omug" },
  { id: "casque", name: "Over-ear Headphones", price: 11863, currency: "XAF", category: "Casque", image_url: "casque.jpg" },
  { id: "sound", name: "Sound", price: 9011, currency: "XAF", category: "Casque", image_url: "sound.jpg" },
];

const srv = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url.startsWith("/api/agents/") && req.url.includes("/products/search-by-image")) {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => res.end(JSON.stringify({ mode: "clip", products: [PRODUCTS[1]] })));
    return;
  }
  if (req.url.startsWith("/api/agents/") && req.url.includes("/products/search")) {
    const q = decodeURIComponent((req.url.match(/[?&]q=([^&]*)/) || [])[1] || "").toLowerCase();
    const out = q ? PRODUCTS.filter((p) => (p.name + p.category).toLowerCase().includes(q)) : PRODUCTS;
    return res.end(JSON.stringify({ products: out }));
  }
  if (req.url.startsWith("/api/catalog/")) return res.end(JSON.stringify({ products: PRODUCTS }));
  res.statusCode = 404; res.end("{}");
});

function rpc(child, id, method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
}

srv.listen(0, async () => {
  const port = srv.address().port;
  const child = spawn("node", [__dirname + "/server.js"], {
    env: Object.assign({}, process.env, { SOURCE: "camille", CAMILLE_API_URL: `http://127.0.0.1:${port}`, AGENT_ID: "test" }),
  });
  const responses = {};
  let buf = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (c) => {
    buf += c; let nl;
    while ((nl = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (l) { const m = JSON.parse(l); if (m.id != null) responses[m.id] = m; } }
  });
  const wait = (id) => new Promise((r) => { const t = setInterval(() => { if (responses[id]) { clearInterval(t); r(responses[id]); } }, 10); });

  let pass = 0, fail = 0;
  const chk = (l, c) => { if (c) pass++; else { fail++; console.log("  ✗", l); } };

  rpc(child, 1, "initialize", { protocolVersion: "2024-11-05", capabilities: {} });
  const init = await wait(1);
  chk("initialize", init.result && init.result.serverInfo.name === "camille-catalogue");

  rpc(child, 2, "tools/list", {});
  const tl = await wait(2);
  chk("tools/list (5 outils)", tl.result && tl.result.tools.length === 5);

  rpc(child, 3, "tools/call", { name: "catalogue_search", arguments: { query: "casque" } });
  const s = await wait(3);
  const sp = JSON.parse(s.result.content[0].text);
  chk("search casque -> 2", Array.isArray(sp) && sp.length === 2);

  rpc(child, 4, "tools/call", { name: "catalogue_list", arguments: {} });
  const li = JSON.parse((await wait(4)).result.content[0].text);
  chk("list -> 3", li.length === 3);

  rpc(child, 5, "tools/call", { name: "catalogue_categories", arguments: {} });
  const cats = JSON.parse((await wait(5)).result.content[0].text);
  chk("categories (Casque=2)", cats.find((c) => c.category === "Casque").count === 2);

  rpc(child, 6, "tools/call", { name: "catalogue_search_image", arguments: { imageUrl: "http://x/y.jpg" } });
  const img = JSON.parse((await wait(6)).result.content[0].text);
  chk("search_image -> casque", img[0].id === "casque");

  rpc(child, 7, "tools/call", { name: "catalogue_get", arguments: { id: "sound" } });
  const g = JSON.parse((await wait(7)).result.content[0].text);
  chk("get sound", g && g.name === "Sound");

  console.log(`=== MCP: PASS ${pass} | FAIL ${fail} ===`);
  child.kill(); srv.close();
  process.exit(fail ? 1 : 0);
});

/* Génère les assets (icône + images d'onboarding) via Chromium/Playwright.
   Lancer : node scripts/gen-assets.js
   Sortie : assets/icon.png, assets/adaptive-icon.png, assets/splash-icon.png,
            assets/ob1.png, assets/ob2.png, assets/ob3.png  */
const { chromium } = require("playwright");
const path = require("path");

const CHROME =
  process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const OUT = path.join(__dirname, "..", "assets");

const INK = "#101012", LIME = "#C6F24E", BLUE = "#7FB2FF", PINK = "#F0A6FF", BG = "#ECECEC";

const tile = (emoji, style) =>
  `<div style="position:absolute;${style};width:74px;height:74px;border-radius:24px;background:#fff;
     display:flex;align-items:center;justify-content:center;font-size:38px;
     box-shadow:0 10px 24px rgba(0,0,0,.10);border:1px solid rgba(0,0,0,.04)">${emoji}</div>`;

const spark = (style, c = INK) =>
  `<div style="position:absolute;${style};color:${c};font-size:22px;opacity:.5">✦</div>`;

// Scène 1 — vendeur IA
const ob1 = `
<div style="position:relative;width:100%;height:100%;background:
  radial-gradient(120% 90% at 50% 0%, ${LIME}44 0%, ${BG} 60%)">
  <div style="position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);
      width:230px;height:150px;border-radius:38px;background:${LIME};
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      box-shadow:0 20px 40px rgba(0,0,0,.12)">
    <div style="font-size:66px;line-height:1">🤖</div>
    <div style="margin-top:6px;background:${INK};color:#fff;font-weight:700;font-size:15px;
        padding:7px 14px;border-radius:999px;font-family:Inter,Arial">Camille · IA</div>
  </div>
  ${tile("💬", "top:36px;left:60px")}
  ${tile("🛍️", "top:20px;right:70px")}
  ${tile("⚡", "top:150px;left:24px")}
  ${tile("🌙", "top:150px;right:24px")}
  ${tile("📲", "bottom:34px;left:78px")}
  ${tile("✅", "bottom:22px;right:84px")}
  ${spark("top:110px;left:150px", INK)}
  ${spark("bottom:70px;right:150px", INK)}
</div>`;

// Scène 2 — perf en direct (mock carte + barres)
const ob2 = `
<div style="position:relative;width:100%;height:100%;background:
  radial-gradient(120% 90% at 50% 0%, ${BLUE}40 0%, ${BG} 60%)">
  <div style="position:absolute;left:50%;top:44px;transform:translateX(-50%);
      width:300px;background:#fff;border-radius:26px;padding:16px;
      box-shadow:0 18px 40px rgba(0,0,0,.12);font-family:Inter,Arial">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-weight:800;color:${INK};font-size:16px">Aperçu · 30 j</div>
      <div style="font-size:20px">📈</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <div style="flex:1;background:#F4F4F4;border-radius:14px;padding:10px">
        <div style="color:#8A8A8E;font-size:11px">Messages</div>
        <div style="color:${INK};font-weight:800;font-size:19px">3 480</div></div>
      <div style="flex:1;background:${INK};border-radius:14px;padding:10px">
        <div style="color:#9A9AA0;font-size:11px">Leads</div>
        <div style="color:${LIME};font-weight:800;font-size:19px">342</div></div>
    </div>
    <div style="display:flex;align-items:flex-end;gap:6px;height:56px;margin-top:14px">
      ${[30, 55, 40, 70, 48, 82, 60].map((h, i) => `<div style="flex:1;height:${h}%;border-radius:5px;background:${i === 5 ? LIME : "#E3E3E3"}"></div>`).join("")}
    </div>
  </div>
  ${tile("👤", "bottom:40px;left:56px")}
  ${tile("🎯", "bottom:120px;left:20px")}
  ${tile("🔔", "bottom:120px;right:20px")}
  ${tile("💡", "bottom:34px;right:60px")}
  ${spark("bottom:96px;left:150px", INK)}
</div>`;

// Scène 3 — conversations (3 colonnes façon référence)
const col = (emoji, tint, mt) =>
  `<div style="width:92px;height:${180}px;margin-top:${mt}px;border-radius:34px;background:${tint};
     display:flex;align-items:center;justify-content:center;font-size:52px;
     box-shadow:0 14px 30px rgba(0,0,0,.10)">${emoji}</div>`;
const ob3 = `
<div style="position:relative;width:100%;height:100%;background:
  radial-gradient(120% 90% at 50% 0%, ${PINK}3a 0%, ${BG} 60%)">
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
      display:flex;gap:16px;align-items:flex-start">
    ${col("🧑🏽‍💼", "#FBE3C7", 30)}
    ${col("👩🏾‍🦱", INK, 0)}
    ${col("🧓🏼", "#Dfeafd", 30)}
  </div>
  ${tile("🛍️", "top:104px;left:50%;transform:translate(-118px,0)")}
  ${tile("📅", "top:150px;left:50%;transform:translate(-118px,0)")}
  ${tile("💬", "top:104px;left:50%;transform:translate(46px,0)")}
  ${spark("top:70px;left:80px", INK)}
  ${spark("bottom:70px;right:80px", INK)}
</div>`;

// Monogramme pro : bulle de discussion en "C" (arc épais ouvert) + point accent + spark.
const mark = (size, stroke = LIME) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="30" fill="none" stroke="${stroke}" stroke-width="15"
    stroke-linecap="round" stroke-dasharray="132 56" transform="rotate(38 50 50)"/>
  <circle cx="63.5" cy="73" r="8.6" fill="${stroke}"/>
  <path d="M78 20 l3.2 7.6 L88 30.8 l-6.8 3.2 L78 41 l-3.2-7 L68 30.8 l6.8-3.2 Z" fill="${stroke}" opacity=".9"/>
</svg>`;

const icon = `
<div style="width:100%;height:100%;background:
  radial-gradient(130% 130% at 28% 18%, #20202a 0%, ${INK} 68%);
  display:flex;align-items:center;justify-content:center">
  <div style="width:62%;height:62%;filter:drop-shadow(0 20px 40px rgba(198,242,78,.20))">${mark("100%")}</div>
</div>`;

const splash = `
<div style="width:100%;height:100%;background:${BG};display:flex;align-items:center;justify-content:center">
  <div style="width:58%;height:58%;border-radius:30%;background:${INK};
    display:flex;align-items:center;justify-content:center">
    <div style="width:60%;height:60%">${mark("100%")}</div>
  </div>
</div>`;

async function shot(page, html, w, h, file) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<html><body style="margin:0;padding:0">
       <div style="width:${w}px;height:${h}px;overflow:hidden">${html}</div>
     </body></html>`
  );
  await page.screenshot({ path: path.join(OUT, file) });
  console.log("→", file);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ deviceScaleFactor: 2 });
  await shot(p, icon, 512, 512, "icon.png");
  await shot(p, icon, 512, 512, "adaptive-icon.png");
  await shot(p, splash, 400, 400, "splash-icon.png");
  await shot(p, ob1, 500, 420, "ob1.png");
  await shot(p, ob2, 500, 420, "ob2.png");
  await shot(p, ob3, 500, 420, "ob3.png");
  await b.close();
  console.log("done");
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });

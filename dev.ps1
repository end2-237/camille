# ─────────────────────────────────────────────────────────────────────────────
# dev.ps1 — Camille by Buyticle
# Script de démarrage PowerShell qui configure toutes les variables d'env
# nécessaires avant de lancer Next.js.
# Usage: .\dev.ps1
# ─────────────────────────────────────────────────────────────────────────────

# Rediriger cache npm et tmp vers D: (évite ENOSPC sur C: plein)
$env:NPM_CONFIG_CACHE  = "D:\npm-cache"
$env:NPM_CONFIG_TMP    = "D:\npm-tmp"
$env:NPM_CONFIG_STRICT_SSL = "false"

# Temp Windows → D: (aide le pagefile quand C: est plein)
$env:TEMP = "D:\tmp"
$env:TMP  = "D:\tmp"

# Limiter la heap Node.js à 512 MB pour éviter l'OOM
# (Next.js + Turbopack consomment ~300-400 MB en dev)
$env:NODE_OPTIONS = "--max-old-space-size=512"

# Créer les dossiers si besoin
New-Item -ItemType Directory -Force -Path "D:\npm-cache" | Out-Null
New-Item -ItemType Directory -Force -Path "D:\npm-tmp"   | Out-Null
New-Item -ItemType Directory -Force -Path "D:\tmp"       | Out-Null

Write-Host "✓ Environnement configuré (cache → D:, heap Node → 512 MB)" -ForegroundColor Green
Write-Host "→ Démarrage de Next.js sur http://localhost:3000`n" -ForegroundColor Cyan

npm run dev

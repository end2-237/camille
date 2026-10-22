# ─────────────────────────────────────────────────────────────────────────────
# Image de Camille. Remplace Nixpacks, qui installait un Node 22 ancien
# (22.14) : ici, l'image officielle node:22 suit les correctifs de sécurité à
# chaque reconstruction. L'application tourne SANS les droits root (utilisateur
# « node ») : une faille dans l'application ne donne plus la main sur tout le
# conteneur.
#
# Coolify passe les variables NEXT_PUBLIC_* en arguments de construction :
# elles sont gravées dans le code du navigateur au moment du build.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --include=dev : Coolify peut passer NODE_ENV=production pendant la construction,
# ce qui ferait sauter TypeScript, Tailwind et les autres outils de build.
RUN npm ci --include=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_GRAPH_VERSION
ARG NEXT_PUBLIC_META_APP_ID
ARG NEXT_PUBLIC_META_CONFIG_ID
ARG NEXT_PUBLIC_OFS_LIVE_AGENT_ID
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]

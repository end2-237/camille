# Micro-service CLIP — image lourde (onnxruntime + sharp) ISOLÉE de l'app camille.
FROM node:20-slim

WORKDIR /app

# Dépendances système utiles à sharp / onnxruntime au runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./

# Cache du modèle CLIP (~350 Mo) — à monter en volume persistant sur Coolify.
ENV TRANSFORMERS_CACHE=/app/.cache/transformers
VOLUME ["/app/.cache/transformers"]

ENV PORT=8000
EXPOSE 8000

CMD ["node", "server.js"]

# camille-clip-service

Micro-service d'embeddings **CLIP** (image + texte, 512 dims) pour la recherche par
image de camille. Isolé de l'app principale pour ne pas alourdir son image Docker.

## Déploiement Coolify

1. **+ New Resource → Application** → même repo `end2-237/camille`.
2. **Base Directory** : `clip-service`
3. **Build Pack** : `Dockerfile`
4. **Port** : `8000`
5. (Recommandé) **Persistent Storage** → Volume Mount → Destination `/app/.cache/transformers`
   (garde le modèle ~350 Mo entre les déploiements).
6. (Optionnel) Variable d'env `CLIP_API_KEY=<une clé secrète>` pour protéger le service.
7. Déploie. Note l'URL publique (ex. `https://clip.mondomaine.com`).

## Brancher camille

Dans les variables d'env de l'app **camille** :

```
CLIP_SERVICE_URL=https://clip.mondomaine.com
CLIP_API_KEY=<même clé qu'au-dessus, si définie>
```

Redéploie camille, puis lance un `reindex` par boutique.

## Endpoints

| Méthode | Chemin | Corps | Réponse |
|---|---|---|---|
| GET | `/health` | — | `{ ok, ready, model }` |
| POST | `/embed-image` | `{ "url": "https://…" }` | `{ "embedding": number[512] }` |
| POST | `/embed-text` | `{ "text": "…" }` | `{ "embedding": number[512] }` |

Header `x-api-key` requis si `CLIP_API_KEY` est défini.

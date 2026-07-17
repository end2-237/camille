# camille-catalogue-mcp

Serveur **MCP** (Model Context Protocol) qui expose ton catalogue comme des **outils**
réutilisables par n'importe quel client compatible (Claude Desktop, IDE, agents…).
Sans dépendance (JSON-RPC 2.0 sur stdio).

## Outils exposés
| Outil | Arguments | Retour |
|---|---|---|
| `catalogue_search` | `{ query, limit? }` | produits pertinents |
| `catalogue_list` | `{}` | tout le catalogue |
| `catalogue_categories` | `{}` | catégories + comptage |
| `catalogue_search_image` | `{ imageUrl, limit? }` | produits visuellement proches (CLIP) |
| `catalogue_get` | `{ id }` | un produit précis |

## Connecteurs (env `SOURCE`)
### `camille` (par défaut) — lie l'app existante
```
SOURCE=camille
CAMILLE_API_URL=https://camille.vps.buyticle.com
AGENT_ID=<id de la boutique>
```

### `marketplace` — lie ta marketplace (grand catalogue)
```
SOURCE=marketplace
MARKETPLACE_API_URL=https://ma-marketplace.com/api
MARKETPLACE_API_KEY=<si nécessaire>
# mapping des champs de TA marketplace -> modèle produit :
MARKETPLACE_FIELD_MAP={"id":"sku","name":"title","price":"amount","image_url":"thumbnail","product_url":"link"}
```
Le connecteur marketplace suppose des routes REST `GET /products?q=`, `GET /products`,
`GET /products/:id`. **À adapter à l'API réelle de ta marketplace** (voir `connectors.marketplace`).

## Brancher dans Claude Desktop
`claude_desktop_config.json` :
```json
{
  "mcpServers": {
    "camille-catalogue": {
      "command": "node",
      "args": ["/chemin/vers/camille-mcp/server.js"],
      "env": { "SOURCE": "camille", "CAMILLE_API_URL": "https://camille.vps.buyticle.com", "AGENT_ID": "..." }
    }
  }
}
```

## Test
```
npm test   # lance un faux catalogue + déroule initialize/tools/list/tools/call (7 vérifs)
```

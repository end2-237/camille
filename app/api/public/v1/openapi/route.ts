// GET /api/public/v1/openapi — spécification OpenAPI 3.1 de l'API publique.
// Sert à importer l'API dans Postman/Insomnia ou à générer un client typé.
// Publique : une spec n'expose aucune donnée.
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const base = req.nextUrl.origin;

  const product = {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      description: { type: "string", nullable: true },
      price: { type: "number" },
      price_max: { type: "number", nullable: true, description: "Prix barré, si promotion" },
      currency: { type: "string", example: "XAF" },
      stock: { type: "integer", nullable: true },
      category: { type: "string", nullable: true },
      subcategory: { type: "string", nullable: true },
      image_url: { type: "string", nullable: true },
      images: { type: "array", items: { type: "string" } },
      variants: { type: "array", items: { type: "object" } },
      product_url: { type: "string", nullable: true },
      tags: { type: "array", items: { type: "string" } },
    },
  };

  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "API Camille",
      version: "1.0.0",
      description:
        "Permet au site d'un marchand de lire son catalogue Camille et d'y envoyer " +
        "ses commandes. Une commande créée ici suit exactement le même chemin qu'une " +
        "commande née dans WhatsApp : accusé au client, alerte au commerçant, suivi " +
        "dans l'application.",
    },
    servers: [{ url: base }],
    security: [{ CamilleKey: [] }],
    components: {
      securitySchemes: {
        CamilleKey: {
          type: "apiKey",
          in: "header",
          name: "X-Camille-Key",
          description:
            "cam_pk_… pour la lecture (utilisable dans un navigateur), " +
            "cam_sk_… pour créer des commandes (serveur uniquement).",
        },
      },
      schemas: { Product: product },
    },
    paths: {
      "/api/public/v1/catalog": {
        get: {
          summary: "Lire le catalogue",
          description: "Clé de lecture suffisante. Renvoie les produits de l'agent lié à la clé.",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" }, description: "Recherche nom + description" },
            { name: "category", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 24 } },
            { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
          ],
          responses: {
            "200": {
              description: "Produits",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      products: { type: "array", items: { $ref: "#/components/schemas/Product" } },
                      total: { type: "integer" },
                      limit: { type: "integer" },
                      offset: { type: "integer" },
                    },
                  },
                },
              },
            },
            "401": { description: "Clé absente, invalide ou révoquée" },
            "403": { description: "Domaine non autorisé" },
          },
        },
      },
      "/api/public/v1/orders": {
        post: {
          summary: "Créer une commande",
          description:
            "Clé SECRÈTE obligatoire. Avec un id produit, le prix est relu en base : " +
            "un prix envoyé par le client est ignoré.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["items", "customer"],
                  properties: {
                    items: {
                      type: "array",
                      minItems: 1,
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", description: "Id produit Camille — le prix vient de la base" },
                          name: { type: "string", description: "Requis si id absent" },
                          variant: { type: "string" },
                          qty: { type: "integer", minimum: 1, default: 1 },
                          price: { type: "number", description: "Ignoré si id fourni" },
                        },
                      },
                    },
                    customer: {
                      type: "object",
                      required: ["phone"],
                      properties: {
                        name: { type: "string" },
                        phone: { type: "string", example: "237699887766", description: "Chiffres uniquement" },
                      },
                    },
                    delivery: {
                      type: "object",
                      properties: {
                        address: { type: "string" },
                        lat: { type: "number" },
                        lng: { type: "number" },
                      },
                    },
                    delivery_fee: { type: "number", description: "Omis : le barème de l'agent s'applique" },
                    note: { type: "string" },
                  },
                },
                example: {
                  items: [{ id: "3f2a1b4c-0000-0000-0000-000000000000", qty: 2 }],
                  customer: { name: "Eman Soga", phone: "237699887766" },
                  delivery: { address: "Bonaberi, face marché", lat: 4.0511, lng: 9.7679 },
                  note: "Sans oignon",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Commande créée",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      order: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          ref: { type: "string", example: "AA7EVM" },
                          subtotal: { type: "number" },
                          delivery_fee: { type: "number" },
                          total: { type: "number" },
                          currency: { type: "string" },
                          status: { type: "string", example: "nouvelle" },
                        },
                      },
                      whatsapp_notified: { type: "boolean" },
                    },
                  },
                },
              },
            },
            "400": { description: "Requête incomplète — le message précise le champ" },
            "401": { description: "Clé absente, invalide ou révoquée" },
            "403": { description: "Clé publique utilisée, ou domaine non autorisé" },
            "503": { description: "Intégration non configurée (migration absente)" },
          },
        },
      },
    },
  });
}

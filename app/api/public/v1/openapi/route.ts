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
      version: "1.1.0",
      description:
        "Permet au site d'un marchand de lire son catalogue Camille et d'y envoyer " +
        "ses commandes. Une commande créée ici suit exactement le même chemin qu'une " +
        "commande née dans WhatsApp : accusé au client, alerte au commerçant, suivi " +
        "dans l'application. Depuis la 1.1 : créneau de livraison, suivi de commande " +
        "et fiche client.",
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
                      categories: {
                        type: "array",
                        description:
                          "Rayons du catalogue. `image` vient du premier produit qui en a une, " +
                          "ou du média déclaré par le marchand (kind=category).",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            count: { type: "integer" },
                            image: { type: "string", nullable: true },
                          },
                        },
                      },
                      media: {
                        type: "array",
                        description: "Visuels du marchand : logo, banner, category, gallery, menu.",
                        items: {
                          type: "object",
                          properties: {
                            kind: { type: "string" },
                            url: { type: "string" },
                            caption: { type: "string", nullable: true },
                          },
                        },
                      },
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
                        email: { type: "string", description: "Conservé sur la fiche client" },
                        company: { type: "string", description: "Entreprise de livraison" },
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
                    scheduled_at: {
                      type: "string", format: "date-time",
                      description: "Créneau demandé. Omis = dès que possible. Une date passée est ignorée.",
                    },
                    note: { type: "string" },
                  },
                },
                example: {
                  items: [{ id: "3f2a1b4c-0000-0000-0000-000000000000", qty: 2 }],
                  customer: { name: "Eman Soga", phone: "237699887766" },
                  delivery: { address: "Bonaberi, face marché", lat: 4.0511, lng: 9.7679 },
                  scheduled_at: "2026-09-07T11:20:00Z",
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
                          scheduled_at: { type: "string", format: "date-time", nullable: true },
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
      "/api/public/v1/orders/{ref}": {
        get: {
          summary: "Suivre une commande",
          description:
            "Une référence est courte, donc devinable : avec une clé publique, le " +
            "téléphone du client est exigé et doit correspondre. Une clé secrète s'en dispense.",
          parameters: [
            { name: "ref", in: "path", required: true, schema: { type: "string" }, example: "AA7EVM" },
            {
              name: "phone", in: "query", schema: { type: "string" },
              description: "Téléphone du client. Obligatoire avec une clé publique.",
            },
          ],
          responses: {
            "200": {
              description: "État de la commande",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      order: {
                        type: "object",
                        properties: {
                          ref: { type: "string" },
                          status: { type: "string", example: "en_livraison" },
                          status_label: { type: "string", example: "En livraison" },
                          step: { type: "integer", description: "0-3 ; -1 si annulée" },
                          steps: { type: "array", items: { type: "object" } },
                          items: { type: "array", items: { type: "object" } },
                          subtotal: { type: "number" },
                          delivery_fee: { type: "number" },
                          total: { type: "number" },
                          currency: { type: "string" },
                          scheduled_at: { type: "string", format: "date-time", nullable: true },
                          placed_at: { type: "string", format: "date-time", nullable: true },
                          processing_at: { type: "string", format: "date-time", nullable: true },
                          dispatched_at: { type: "string", format: "date-time", nullable: true },
                          delivered_at: { type: "string", format: "date-time", nullable: true },
                          document_url: { type: "string", nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Référence ou téléphone manquant" },
            "404": { description: "Commande introuvable (ou téléphone qui ne correspond pas)" },
          },
        },
      },
      "/api/public/v1/customers/{phone}": {
        get: {
          summary: "Lire la fiche client",
          description: "Clé SECRÈTE obligatoire : données personnelles. Renvoie aussi les 5 dernières commandes.",
          parameters: [
            { name: "phone", in: "path", required: true, schema: { type: "string" }, example: "237699887766" },
          ],
          responses: {
            "200": { description: "Fiche client et historique" },
            "403": { description: "Clé publique utilisée" },
            "503": { description: "Migration absente" },
          },
        },
        post: {
          summary: "Enregistrer la fiche client",
          description:
            "Clé SECRÈTE obligatoire. Un champ absent n'efface pas ce qui est déjà connu ; " +
            "`addresses` remplace la liste quand il est fourni.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    email: { type: "string" },
                    company: { type: "string" },
                    addresses: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          label: { type: "string" },
                          address: { type: "string" },
                          details: { type: "string" },
                          lat: { type: "number" },
                          lng: { type: "number" },
                        },
                      },
                    },
                  },
                },
                example: {
                  name: "Kate Biya",
                  company: "Enko Education",
                  addresses: [{ label: "Bureau", address: "Bonapriso, Douala", details: "Bloc B, 3e étage" }],
                },
              },
            },
          },
          responses: {
            "200": { description: "Fiche enregistrée" },
            "403": { description: "Clé publique utilisée" },
            "503": { description: "Migration absente" },
          },
        },
      },
    },
  });
}

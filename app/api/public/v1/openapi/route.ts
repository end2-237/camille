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
                      merchant: {
                        type: "object",
                        description:
                          "Coordonnées du marchand : nom, WhatsApp, adresse, position (lat/lng) " +
                          "et barème de livraison (zones comprises).",
                        properties: {
                          name: { type: "string", nullable: true },
                          whatsapp: { type: "string", nullable: true },
                          location: { type: "string", nullable: true },
                          lat: { type: "number", nullable: true },
                          lng: { type: "number", nullable: true },
                          delivery: {
                            type: "object",
                            properties: {
                              enabled: { type: "boolean" },
                              fee: { type: "number" },
                              zones: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: { name: { type: "string" }, fee: { type: "number" } },
                                },
                              },
                            },
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
                      description:
                        "Adresse en clair, et position GPS quand le client l'a partagée : " +
                        "Camille en déduit le libellé du lieu et le lien de carte pour le livreur.",
                      properties: {
                        address: { type: "string" },
                        details: { type: "string", description: "Bloc, étage, bureau…" },
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
                    payment: {
                      type: "string",
                      description:
                        "Moyen de paiement ANNONCÉ par le client, montré au commerçant. " +
                        "Camille n'encaisse rien.",
                      example: "Orange Money",
                    },
                    mode: {
                      type: "string", enum: ["livraison", "retrait"],
                      description: "Livraison (défaut) ou retrait sur place.",
                    },
                    promo: { type: "string", description: "Code promo saisi, à vérifier par le commerçant" },
                    company_code: {
                      type: "string",
                      description:
                        "Code du compte entreprise de l'employé. La commande est rattachée à " +
                        "l'entreprise ; en prépayé, la provision est décomptée et une commande " +
                        "sans provision est refusée (402).",
                      example: "ENK-7K2M",
                    },
                  },
                },
                example: {
                  items: [{ id: "3f2a1b4c-0000-0000-0000-000000000000", qty: 2 }],
                  customer: { name: "Eman Soga", phone: "237699887766" },
                  delivery: { address: "Bonaberi, face marché", lat: 4.0511, lng: 9.7679 },
                  scheduled_at: "2026-09-07T11:20:00Z",
                  payment: "Orange Money",
                  mode: "livraison",
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
            "402": { description: "Compte entreprise sans provision suffisante, ou plafond atteint" },
            "403": { description: "Clé publique utilisée, ou domaine non autorisé" },
            "404": { description: "Code entreprise inconnu" },
            "503": { description: "Intégration non configurée (migration absente)" },
          },
        },
      },
      "/api/public/v1/companies/{code}": {
        get: {
          summary: "Reconnaître un compte entreprise",
          description:
            "L'employé saisit le code de sa société ; le site l'affiche avant de commander. " +
            "Clé SECRÈTE obligatoire : un code est court donc devinable, et une clé de " +
            "navigateur permettrait de balayer l'alphabet pour lire le nom et la provision " +
            "des entreprises clientes.",
          parameters: [
            { name: "code", in: "path", required: true, schema: { type: "string" }, example: "ENK-7K2M" },
          ],
          responses: {
            "200": {
              description: "Compte reconnu",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      found: { type: "boolean" },
                      company: {
                        type: "object",
                        properties: {
                          code: { type: "string" },
                          name: { type: "string" },
                          status: { type: "string", enum: ["active", "suspended"] },
                          billing_mode: { type: "string", enum: ["prepaid", "monthly"] },
                          balance: { type: "number", nullable: true, description: "Provision restante (prépayé)" },
                          monthly_cap: { type: "number", nullable: true },
                          month_to_date: { type: "number", description: "Consommé depuis le 1er du mois" },
                          orders_this_month: { type: "integer" },
                          contact_name: { type: "string", nullable: true },
                          address: { type: "string", nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Clé absente ou invalide" },
            "403": { description: "Clé publique utilisée" },
            "404": { description: "Code inconnu" },
            "503": { description: "Comptes entreprise non installés (migration absente)" },
          },
        },
      },
      "/api/public/v1/events": {
        post: {
          summary: "Mesurer le trafic du site",
          description:
            "Clé PUBLIQUE : l'appel part du navigateur du visiteur. Sert à voir dans " +
            "Camille ce qui est regardé sans être acheté. Rien de nominatif n'est " +
            "enregistré : ni IP, ni cookie tiers, ni adresse — le visiteur n'est qu'un " +
            "identifiant aléatoire posé par le site. Pour ne rien coder, colle la balise " +
            "<script src=\"/api/public/v1/track\" data-key=\"cam_pk_…\" defer></script>.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    events: {
                      type: "array", maxItems: 20,
                      items: {
                        type: "object",
                        properties: {
                          kind: {
                            type: "string",
                            enum: ["page_view", "product_view", "add_to_cart", "checkout_start", "order", "search"],
                            default: "page_view",
                          },
                          path: { type: "string", description: "Chemin visité, sans le domaine" },
                          title: { type: "string" },
                          referrer: { type: "string", description: "Seul le domaine est conservé" },
                          visitor: { type: "string", description: "Identifiant anonyme, stable ~30 jours" },
                          session: { type: "string", description: "Visite en cours" },
                          device: { type: "string", enum: ["mobile", "tablet", "desktop"] },
                          meta: { type: "object", description: "{ product_id, name, value… }" },
                        },
                      },
                    },
                  },
                },
                example: {
                  events: [
                    { kind: "page_view", path: "/menus/petits-dejeuners", referrer: "https://www.google.com/", visitor: "a1b2c3", session: "s9f8" },
                    { kind: "product_view", path: "/menus/petits-dejeuners/pd-1", meta: { name: "Omelette complète" }, visitor: "a1b2c3", session: "s9f8" },
                  ],
                },
              },
            },
          },
          responses: {
            "202": { description: "Événements enregistrés (ou ignorés : robot)" },
            "400": { description: "Corps invalide" },
            "401": { description: "Clé absente ou invalide" },
            "503": { description: "Mesure non installée — migration_site_traffic.sql" },
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

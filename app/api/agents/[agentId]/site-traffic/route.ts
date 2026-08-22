// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agents/[agentId]/site-traffic?days=7
//
// Ce que le commerçant veut savoir de son site, et rien d'autre : combien de
// personnes, quelles pages, d'où elles viennent, et combien ont fini par
// commander. Les commandes viennent de camille.orders (source = 'site') : le
// taux de conversion se lit alors sur les mêmes chiffres que la caisse.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

/* eslint-disable @typescript-eslint/no-explicit-any */

type RouteContext = { params: Promise<{ agentId: string }> };

const num = (v: unknown) => Number(v ?? 0) || 0;

export async function GET(req: NextRequest, ctx: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await ctx.params;
  const owned = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2",
    [agentId, user.id]
  );
  if (!owned.rows.length) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 7));
  const since = `${days} days`;

  try {
    // Une seule requête par question : chacune reste lisible, et Postgres les
    // sert toutes sur le même index (agent_id, created_at).
    const [totals, series, pages, sources, devices, produits, live, commandes] = await Promise.all([
      query(
        `SELECT COUNT(*) FILTER (WHERE kind = 'page_view')      AS views,
                COUNT(DISTINCT visitor)                         AS visitors,
                COUNT(DISTINCT session_id)                      AS sessions,
                COUNT(*) FILTER (WHERE kind = 'add_to_cart')    AS carts,
                COUNT(*) FILTER (WHERE kind = 'checkout_start') AS checkouts
           FROM camille.site_events
          WHERE agent_id = $1 AND created_at > NOW() - $2::interval`,
        [agentId, since]
      ),
      query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                COUNT(*) FILTER (WHERE kind = 'page_view') AS views,
                COUNT(DISTINCT visitor)                    AS visitors
           FROM camille.site_events
          WHERE agent_id = $1 AND created_at > NOW() - $2::interval
          GROUP BY 1 ORDER BY 1`,
        [agentId, since]
      ),
      query(
        `SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors
           FROM camille.site_events
          WHERE agent_id = $1 AND kind = 'page_view' AND path IS NOT NULL
            AND created_at > NOW() - $2::interval
          GROUP BY 1 ORDER BY views DESC LIMIT 12`,
        [agentId, since]
      ),
      query(
        `SELECT COALESCE(referrer_host, 'Accès direct') AS source, COUNT(DISTINCT visitor) AS visitors
           FROM camille.site_events
          WHERE agent_id = $1 AND created_at > NOW() - $2::interval
          GROUP BY 1 ORDER BY visitors DESC LIMIT 10`,
        [agentId, since]
      ),
      query(
        `SELECT COALESCE(device, 'inconnu') AS device, COUNT(DISTINCT visitor) AS visitors
           FROM camille.site_events
          WHERE agent_id = $1 AND created_at > NOW() - $2::interval
          GROUP BY 1 ORDER BY visitors DESC`,
        [agentId, since]
      ),
      query(
        `SELECT COALESCE(NULLIF(meta->>'name', ''), path) AS name,
                COUNT(*) AS views
           FROM camille.site_events
          WHERE agent_id = $1 AND kind = 'product_view'
            AND created_at > NOW() - $2::interval
          GROUP BY 1 ORDER BY views DESC LIMIT 10`,
        [agentId, since]
      ),
      // « Qui est sur le site en ce moment » : la question que tout le monde
      // pose en premier.
      query(
        `SELECT COUNT(DISTINCT visitor) AS visitors
           FROM camille.site_events
          WHERE agent_id = $1 AND created_at > NOW() - INTERVAL '5 minutes'`,
        [agentId]
      ),
      query(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
           FROM camille.orders
          WHERE agent_id = $1 AND created_at > NOW() - $2::interval
            AND COALESCE((to_jsonb(orders)->>'source'), 'whatsapp') = 'site'`,
        [agentId, since]
      ),
    ]);

    const t = totals.rows[0] || {};
    const visitors = num(t.visitors);
    const orders = num(commandes.rows[0]?.orders);

    return NextResponse.json({
      days,
      ready: true,
      totals: {
        views: num(t.views),
        visitors,
        sessions: num(t.sessions),
        carts: num(t.carts),
        checkouts: num(t.checkouts),
        orders,
        revenue: num(commandes.rows[0]?.revenue),
        // Le chiffre qui décide de tout : sur cent personnes venues, combien
        // ont commandé.
        conversion: visitors ? Math.round((orders / visitors) * 1000) / 10 : 0,
        online: num(live.rows[0]?.visitors),
      },
      series: series.rows.map((r: any) => ({ day: r.day, views: num(r.views), visitors: num(r.visitors) })),
      pages: pages.rows.map((r: any) => ({ path: r.path, views: num(r.views), visitors: num(r.visitors) })),
      sources: sources.rows.map((r: any) => ({ source: r.source, visitors: num(r.visitors) })),
      devices: devices.rows.map((r: any) => ({ device: r.device, visitors: num(r.visitors) })),
      products: produits.rows.map((r: any) => ({ name: r.name, views: num(r.views) })),
    });
  } catch (e) {
    // Table absente : la mesure n'est pas installée. On le dit clairement,
    // avec le geste qui la répare, plutôt qu'un 500 muet.
    if ((e as { code?: string }).code === "42P01") {
      return NextResponse.json({
        ready: false,
        error: "Mesure d'audience non installée — applique migration_site_traffic.sql sur la base.",
      });
    }
    return NextResponse.json({ ready: false, error: (e as Error).message }, { status: 500 });
  }
}

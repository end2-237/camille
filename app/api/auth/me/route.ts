import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, hashPassword, verifyPassword } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { envoyerCode } from "@/lib/verification-email";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (err) {
    console.error("[GET /api/auth/me]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── PATCH : le profil du compte ─────────────────────────────────────────────
// Nom, e-mail, mot de passe, et « déconnecter mes autres appareils ».
// Tout ce qui touche à l'accès au compte (e-mail, mot de passe) demande le mot
// de passe actuel : une session oubliée ouverte ne doit pas suffire à prendre
// le compte. Changer de mot de passe ferme aussi les autres sessions.
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const jeton = (req.headers.get("authorization") || "").slice(7);

    const b = (await req.json().catch(() => ({}))) as {
      full_name?: string; email?: string; current_password?: string; new_password?: string; deconnecter_autres?: boolean;
    };

    const nom = typeof b.full_name === "string" ? b.full_name.trim().slice(0, 120) : undefined;
    const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : undefined;
    const changeEmail = email !== undefined && email !== user.email;
    const changeMdp = typeof b.new_password === "string" && b.new_password.length > 0;

    if (changeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email!)) {
      return NextResponse.json({ error: "Adresse e-mail invalide" }, { status: 400 });
    }
    if (changeMdp && b.new_password!.length < 8) {
      return NextResponse.json({ error: "Le nouveau mot de passe doit faire au moins 8 caractères" }, { status: 400 });
    }

    if (changeEmail || changeMdp) {
      const r = await query("SELECT password_hash FROM camille.users WHERE id = $1", [user.id]);
      const ok = b.current_password && r.rows[0]?.password_hash && (await verifyPassword(b.current_password, r.rows[0].password_hash));
      if (!ok) return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 403 });
    }
    if (changeEmail) {
      const pris = await query("SELECT 1 FROM camille.users WHERE LOWER(email) = $1 AND id <> $2", [email, user.id]);
      if (pris.rows.length) return NextResponse.json({ error: "Cette adresse est déjà utilisée par un autre compte" }, { status: 409 });
    }

    const champs: string[] = [];
    const valeurs: unknown[] = [user.id];
    if (nom !== undefined) { valeurs.push(nom || null); champs.push(`full_name = $${valeurs.length}`); }
    if (changeEmail) { valeurs.push(email); champs.push(`email = $${valeurs.length}`); }
    if (changeMdp) { valeurs.push(await hashPassword(b.new_password!)); champs.push(`password_hash = $${valeurs.length}`); }
    if (champs.length) {
      await query(`UPDATE camille.users SET ${champs.join(", ")} WHERE id = $1`, valeurs);
    }

    // Une nouvelle adresse se vérifie comme la première : code envoyé à
    // l'adresse NOUVELLE, accès aux actions sensibles suspendu d'ici là.
    let codeEnvoye = false;
    if (changeEmail) {
      try {
        await query("UPDATE camille.users SET email_verified_at = NULL WHERE id = $1", [user.id]);
        codeEnvoye = (await envoyerCode(user.id, email!, nom ?? user.full_name)).ok;
      } catch { /* migration_email_verification.sql absente : rien à vérifier */ }
    }

    // Les autres appareils : fermés à la demande, et toujours après un
    // changement de mot de passe. La session en cours reste ouverte.
    let fermees = 0;
    if (changeMdp || b.deconnecter_autres) {
      const r = await query("DELETE FROM camille.sessions WHERE user_id = $1 AND token <> $2", [user.id, jeton]);
      fermees = r.rowCount ?? 0;
    }

    const frais = await getUserFromRequest(req);
    return NextResponse.json({ user: frais, sessions_fermees: fermees, code_envoye: codeEnvoye });
  } catch (err) {
    console.error("[PATCH /api/auth/me]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

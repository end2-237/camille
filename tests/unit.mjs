// ─────────────────────────────────────────────────────────────────────────────
// Banc d'essai des modules purs de Camille.
//
//   npm test
//
// Il n'y a pas de cadre de test : les modules éprouvés ici n'ont aucune
// dépendance, et un `node` suffit. Ce qui compte n'est pas l'outillage, c'est
// que chaque cas vienne d'un défaut RÉELLEMENT survenu en production — pas
// d'un cas inventé qui fait plaisir.
//
// Et il exécute les modules COMPILÉS depuis le dépôt, jamais une imitation
// écrite à la main. Deux fois dans la même journée, une imitation a fini par
// diverger du code et à passer pendant que la production échouait.
// ─────────────────────────────────────────────────────────────────────────────

let ok = 0;
const echecs = [];

function groupe(titre) { console.log(`\n── ${titre} ${"─".repeat(Math.max(0, 62 - titre.length))}`); }
function chk(titre, vrai, detail = "") {
  if (vrai) { ok++; console.log(`  ok   ${titre}`); }
  else { echecs.push(titre); console.log(`  ÉCHEC ${titre}${detail ? "   → " + detail : ""}`); }
}
const eq = (titre, a, b) => chk(titre, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

// Résolu depuis le dossier d'exécution, pas depuis ce fichier : sinon
// `npm test` et un appel direct ne pointent pas au même endroit.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const DIST = pathToFileURL(resolve(process.cwd(), process.argv[2] || ".test-build")).href;

// ═══ lib/productFields — le 500 sur la mise à jour du stock ═════════════════
{
  const { coerce } = await import(`${DIST}/productFields.js`);
  groupe("productFields — l'origine du 500 au stock");

  // Le formulaire mobile envoie `null` pour un champ vide ; `description` est
  // NOT NULL en base. Changer le stock d'un produit sans description faisait
  // donc échouer la requête, et la route renvoyait un 500 muet.
  eq("description vide → chaîne vide, pas null", coerce("description", null), "");
  eq("description absente → chaîne vide", coerce("description", undefined), "");
  eq("currency vide → XAF", coerce("currency", ""), "XAF");
  eq("min_order vide → 1", coerce("min_order", null), 1);
  eq("active vide → true", coerce("active", null), true);
  eq("sort_order vide → 0", coerce("sort_order", null), 0);

  // Une colonne nullable doit rester nulle : mettre 0 dans `price` afficherait
  // « gratuit » au lieu de « prix non renseigné ».
  eq("price vide reste null", coerce("price", ""), null);
  eq("stock vide reste null", coerce("stock", null), null);

  // Une saisie non numérique arrivait telle quelle jusqu'à Postgres, qui
  // refusait la requête entière pour un seul caractère.
  eq("stock « 12 » → 12", coerce("stock", "12"), 12);
  eq("stock « douze » → null plutôt que de tout casser", coerce("stock", "douze"), null);
  eq("min_order « abc » → 1 (NOT NULL)", coerce("min_order", "abc"), 1);
  eq("price « 1 000 » non numérique → null", coerce("price", "1 000"), null);

  eq("tags non tableau → tableau JSON vide", coerce("tags", "oups"), "[]");
  eq("images tableau → JSON", coerce("images", ["a", "b"]), '["a","b"]');
}

// ═══ lib/sectorProfiles — restaurant ou boutique ════════════════════════════
{
  const { sectorProfile, sertDesRepas } = await import(`${DIST}/sectorProfiles.js`);
  groupe("sectorProfiles — l'aiguillage du flux WhatsApp");

  chk("ecommerce → mode catalogue", sectorProfile("ecommerce").mode === "catalogue");
  chk("food_beverage → mode catalogue", sectorProfile("food_beverage").mode === "catalogue");
  chk("beauty_wellness → mode services", sectorProfile("beauty_wellness").mode === "services");
  chk("secteur inconnu → profil par défaut, jamais null", sectorProfile("zzz").mode === "catalogue");
  chk("secteur absent → profil par défaut", sectorProfile(null).mode === "catalogue");

  // C'est ce booléen qui décide si l'agent parle de « carte » ou de « boutique ».
  chk("un restaurant sert des repas", sertDesRepas("food_beverage") === true);
  chk("un hôtel aussi — il a une cuisine", sertDesRepas("hospitality") === true);
  chk("une boutique, non", sertDesRepas("ecommerce") === false);

  // Le welcome porte {b} : un agent sans nom ne doit pas afficher « {b} ».
  chk("le welcome contient le jeton {b}", sectorProfile("ecommerce").welcome.includes("{b}"));
}

// ═══ lib/whatsapp/recherche — les bugs signalés par le marchand ═════════════
{
  const { chercher, formatPour, veutToutVoir, estUneQuestion } =
    await import(`${DIST}/whatsapp/recherche.js`);
  groupe("recherche — « montre » verbe contre « montre » objet");

  const CAT = [
    { name: "Oraimo Watch 6 - Premium" }, { name: "Oraimo FreePods" },
    { name: "Oraimo Watch 6 - Promo" }, { name: "Oraimo Watch 6 - Standard" },
    { name: "Montre Test Buyticle" },
  ];

  // Message réel reçu sur le numéro Buyticle, faute de frappe incluse. Il
  // recevait le catalogue entier au lieu des montres.
  chk('« est qye t\'as une montre » n\'ouvre pas le catalogue', !veutToutVoir("est qye t'as une montre"));
  chk('« est qye t\'as une montre » trouve les 4 montres', chercher(CAT, "est qye t'as une montre").length === 4);
  chk('« montre moi vos produits » ouvre la vitrine', veutToutVoir("montre moi vos produits"));
  chk('« je cherche une montre » cherche', !veutToutVoir("je cherche une montre"));

  // Le catalogue est en anglais, le client écrit en français. Structurel pour
  // tout marchand qui vend de l'importé.
  chk('pont « ecouteurs » → FreePods', chercher(CAT, "des ecouteurs").some((p) => p.name.includes("FreePods")));
  chk('un produit nommé → une seule fiche', formatPour(chercher(CAT, "freepods").length) === "fiche");
  chk('plusieurs produits → carrousel', formatPour(chercher(CAT, "une montre").length) === "carrousel");

  eq("0 → aucun", formatPour(0), "aucun");
  eq("1 → fiche", formatPour(1), "fiche");
  eq("10 → carrousel", formatPour(10), "carrousel");
  eq("11 → liste", formatPour(11), "liste");

  chk("« bonjour » n'ouvre rien", !veutToutVoir("bonjour"));
  chk("restauration : « le menu » ouvre la carte", veutToutVoir("je veux le menu", true));

  // Message réel reçu sur le numéro Buyticle : « avec » pour « avez », pas
  // d'apostrophe à « quest ». La demande la plus explicite qu'un client puisse
  // faire — et il recevait « Je n'ai pas trouvé » avec sa faute tronquée.
  chk("« quest ce que vous avec comme produit a vendre »", veutToutVoir("quest ce que vous avec comme produit a vendre"));
  chk("« qu est ce que vous vendez »", veutToutVoir("qu est ce que vous vendez"));
  chk("« c'est quoi vos produits »", veutToutVoir("c'est quoi vos produits"));
  chk("« vous avez quoi en stock »", veutToutVoir("vous avez quoi en stock"));
  chk("« quels articles disponibles »", veutToutVoir("quels articles disponibles"));
  chk("« je veux voir la boutique »", veutToutVoir("je veux voir la boutique"));
  chk("« c'est quoi les prix »", veutToutVoir("c est quoi les prix"));
  // Et l'inverse : une offre générique ne doit pas avaler une recherche nommée.
  chk("« t'as des freepods ? » reste une recherche", !veutToutVoir("t as des freepods"));
  chk("« le prix de la montre oraimo » reste une recherche", !veutToutVoir("la montre oraimo"));
  chk("resto : « vous avez quoi comme plat »", veutToutVoir("vous avez quoi comme plat", true));
  chk("resto : « je veux du poulet » reste une recherche", !veutToutVoir("je veux du poulet", true));

  // Le repli déterministe répondait à TOUTE phrase non reconnue par le
  // catalogue. « vous avez un service apres ventes? » recevait le carrousel et
  // « je n'ai pas trouvé exactement ça ». Montrer des montres à qui demande
  // une garantie, c'est avouer qu'on n'a pas lu.
  chk("« vous avez un service apres ventes? »", estUneQuestion("vous avez un service apres ventes?"));
  chk("« c'est garanti combien de temps »", estUneQuestion("c'est garanti combien de temps"));
  chk("« est ce que je peux rendre »", estUneQuestion("est ce que je peux rendre"));
  chk("« vous faites des remises ? »", estUneQuestion("vous faites des remises ?"));
  chk("« je peux payer a la livraison »", estUneQuestion("je peux payer a la livraison"));
  // Et l'inverse : une recherche d'article ne doit PAS être transmise à un
  // humain, sinon on fait attendre un client qu'on pouvait servir.
  chk("« une montre » reste une recherche", !estUneQuestion("une montre"));
  chk("« freepods » reste une recherche", !estUneQuestion("freepods"));
  chk("« montre oraimo ? » reste une recherche", !estUneQuestion("montre oraimo ?"));
  chk("« bonjour » n'est pas une question", !estUneQuestion("bonjour"));

  // ── Couleurs et langues ──────────────────────────────────────────────────
  // Message réel : « t'as un article noir? » → « nous n'avons pas d'information
  // sur la couleur », alors que la tasse existait en noir.
  groupe("recherche — couleurs, variations, français / anglais");
  const VAR = [
    { name: "High Appearance Drawstring Stainless Steel Coffee Cup", options: ["Vert", "Rouge", "Violet", "Noir"] },
    { name: "Oraimo Watch 6 - Premium" },
    { name: "Wireless Collar-clip Microphone" },
  ];
  const noms = (r) => r.map((p) => p.name.split(" ")[0]);
  eq("« t'as un article noir? » → la tasse (option Noir)", noms(chercher(VAR, "t'as un article noir?")), ["High"]);
  eq("« black » → l'option « Noir »", noms(chercher(VAR, "do you have black")), ["High"]);
  eq("« une tasse rouge » → cup", noms(chercher(VAR, "une tasse rouge")), ["High"]);
  eq("« un micro » → microphone", noms(chercher(VAR, "vous avez un micro")), ["Wireless"]);
  eq("« une montre » marche toujours", noms(chercher(VAR, "une montre")), ["Oraimo"]);
  eq("couleur absente → rien d'inventé", chercher(VAR, "jaune fluo").length, 0);
}

// ═══ lib/whatsapp/comprendre — la barrière entre le modèle et le client ═════
{
  const { phraseAncree, nombresDe, valider, faitsNumeriques, promesseNonTenable } =
    await import(`${DIST}/whatsapp/comprendre.js`);
  groupe("comprendre — le modèle propose, le code vérifie");

  eq("« 12 000 XAF » → 12000", nombresDe("12 000 XAF"), ["12000"]);
  eq("« 8h30 - 18h »", nombresDe("8h30 - 18h"), ["8", "30", "18"]);
  eq("aucun chiffre", nombresDe("bonjour, vous avez des montres ?"), []);

  const PRODS = [
    { id: "p1", name: "Oraimo Watch 6", price: 12000, currency: "XAF", category: "Montres", stock: 4 },
    { id: "p2", name: "Oraimo FreePods", price: 9500, currency: "XAF", category: "Audio", stock: null },
  ];
  const FAITS = {
    nom: "BUYTICLE", adresse: "Akwa, Douala", horaires: "8h - 18h",
    fraisLivraison: 1000, livraison: true, devise: "XAF",
  };
  const ancres = faitsNumeriques(PRODS, FAITS, "j'en veux 3");

  // Le cœur de CVA : un prix juste passe, un prix inventé ne sort jamais.
  chk("le vrai prix passe", phraseAncree("La Watch 6 est à 12 000 XAF", ancres));
  chk("un prix inventé est rejeté", !phraseAncree("La Watch 6 est à 15 000 XAF", ancres));
  chk("les frais de livraison passent", phraseAncree("Livraison 1000 XAF", ancres));
  // Un délai de livraison n'est pas un fait connu : c'est une promesse que
  // personne n'a autorisée, et c'est la faute la plus coûteuse d'un agent.
  chk("« livré en 2 jours » est rejeté", !phraseAncree("Livré en 2 jours", ancres));
  chk("le stock réel passe", phraseAncree("Il en reste 4", ancres));
  chk("un stock inventé est rejeté", !phraseAncree("Il en reste 12", ancres));
  chk("le chiffre du client est autorisé", phraseAncree("Oui, 3 pièces c'est possible", ancres));
  chk("sans chiffre, toujours ancré", phraseAncree("Oui on a ça en boutique", ancres));
  chk("les horaires passent", phraseAncree("On ouvre à 8h et on ferme à 18h", ancres));

  // valider() : la frontière. Rien d'inconnu ne franchit cette ligne.
  const v = (o) => valider(o, PRODS, FAITS, "j'en veux 3");
  // « trop de gifs, je n'en veux plus » : la préférence franchit la frontière.
  eq("animations coupées → activer:false",
    valider({ actions: [{ faire: "animations", activer: false }], certitude: 0.9 }, PRODS, FAITS, "trop de gifs")?.actions,
    [{ faire: "animations", activer: false }]);
  eq("animations : tout sauf true vaut « couper »",
    valider({ actions: [{ faire: "animations", activer: "oui" }], certitude: 0.9 }, PRODS, FAITS, "x")?.actions,
    [{ faire: "animations", activer: false }]);
  eq("un produit inventé est jeté",
    v({ actions: [{ faire: "montrer", produits: ["p9"] }], certitude: 0.9 }), null);
  eq("les ids connus sont gardés",
    v({ actions: [{ faire: "montrer", produits: ["p1", "p9", "p2"] }], certitude: 0.9 }).actions,
    [{ faire: "montrer", produits: ["p1", "p2"] }]);
  eq("un id répété ne l'est qu'une fois",
    v({ actions: [{ faire: "montrer", produits: ["p1", "p1"] }], certitude: 0.9 }).actions,
    [{ faire: "montrer", produits: ["p1"] }]);
  eq("une action inconnue est ignorée",
    v({ actions: [{ faire: "envoyer_facture" }], certitude: 0.9 }), null);
  chk("une réponse avec prix inventé est retirée, pas corrigée",
    v({ actions: [{ faire: "repondre", texte: "C'est 15 000 XAF" }], certitude: 0.9 }) === null);
  chk("une réponse ancrée passe",
    v({ actions: [{ faire: "repondre", texte: "C'est 12 000 XAF" }], certitude: 0.9 })
      .actions[0].texte === "C'est 12 000 XAF");

  // Plusieurs intentions dans un message : c'est tout l'intérêt.
  const multi = v({
    actions: [{ faire: "repondre", texte: "La Watch 6 est à 12 000 XAF" }, { faire: "montrer", produits: ["p1"] }],
    certitude: 0.92,
  });
  eq("deux intentions sont conservées", multi.actions.length, 2);
  eq("la certitude est bornée", v({ actions: [{ faire: "vitrine" }], certitude: 42 }).certitude, 1);
  eq("une certitude absente vaut 0,5", v({ actions: [{ faire: "vitrine" }] }).certitude, 0.5);
  eq("un retour vide ne vaut rien", v({ actions: [] }), null);
  eq("un retour illisible ne vaut rien", v("oups"), null);
  // L'engagement : le second garde-fou, né d'un cas réel. Sur « ça fait 3
  // jours que j'attends ma commande », le modèle a répondu « je vérifie et je
  // reviens vers toi ». Tout était ancré — et c'était la pire réponse
  // possible : l'agent ne peut pas consulter une commande, et personne n'avait
  // été alerté. Le client attend un rappel qui ne viendra jamais.
  chk("« je vérifie et je reviens »", promesseNonTenable("Je vérifie immédiatement et je reviens vers toi"));
  chk("« je m'en occupe »", promesseNonTenable("Pas de souci, je m'en occupe"));
  chk("« on te rappelle »", promesseNonTenable("On te rappelle très vite"));
  chk("« je transmets au livreur »", promesseNonTenable("Je transmets au livreur"));
  chk("« on te contacte »", promesseNonTenable("On te contacte dès qu'on a la réponse"));
  chk("« nous allons te rappeler »", promesseNonTenable("Nous allons te rappeler"));
  // FAUX POSITIF OBSERVÉ. « Tu peux nous contacter » est une INVITATION, pas
  // une promesse. Mon garde-fou la rejetait, la compréhension entière tombait,
  // et le client recevait le catalogue au lieu d'une réponse.
  chk("« tu peux nous contacter » est une invitation",
    !promesseNonTenable("Tu peux nous contacter par WhatsApp ou passer à la boutique"));
  chk("« pour nous contacter, écris ici »",
    !promesseNonTenable("Pour nous contacter, écris ici"));
  // Observé en production : « le délai exact dépend de la zone, mais la
  // livraison est généralement rapide ». Aucun chiffre, donc l'ancrage laisse
  // passer — et c'est pourtant un engagement sur un délai que personne ne nous
  // a donné. Le client lit « rapide », reçoit trois jours plus tard.
  chk("« généralement rapide »", promesseNonTenable("Le délai dépend de la zone, mais la livraison est généralement rapide"));
  chk("« bientôt »", promesseNonTenable("Tu la reçois bientôt"));
  chk("« dans les plus brefs délais »", promesseNonTenable("Dans les plus brefs délais"));
  chk("un prix n'est pas une promesse", !promesseNonTenable("La Watch 6 est à 12 000 XAF"));
  chk("les frais seuls passent", !promesseNonTenable("On livre à Douala pour 1000 XAF"));
  chk("un horaire n'est pas une promesse", !promesseNonTenable("On ouvre à 8h"));
  chk("montrer n'est pas une promesse", !promesseNonTenable("Voici nos montres disponibles"));

  chk("une promesse sans humain écarte TOUT",
    v({ actions: [{ faire: "repondre", texte: "Je vérifie ta commande et je reviens vers toi" }], certitude: 0.99 }) === null);
  // `alerter` rend une promesse tenable SANS faire taire l'agent. Observé en
  // production : une question de délai a déclenché le passage à un humain, et
  // Camille s'est tue pour tout le reste de la conversation.
  chk("une alerte rend la promesse tenable, sans silence",
    v({ actions: [
      { faire: "repondre", texte: "Livraison 1000 XAF, l'équipe te confirme le délai" },
      { faire: "alerter", sujet: "délai de livraison" },
    ], certitude: 0.95 })?.actions.length === 2);
  chk("alerter sans sujet garde un libellé",
    v({ actions: [{ faire: "alerter" }], certitude: 0.9 }).actions[0].sujet.length > 0);
  chk("la même promesse passe si un humain prend le relais",
    v({ actions: [
      { faire: "repondre", texte: "Je transmets à l'équipe, on te répond ici" },
      { faire: "humain" },
    ], certitude: 0.99 }) !== null);

  chk("le rejet est consigné pour la trace",
    v({ actions: [{ faire: "vitrine" }, { faire: "repondre", texte: "7 jours" }], certitude: 0.9 })
      .raisonnement.includes("non ancré"));
}

// ═══ comprendre — le cache qui économise le quota ══════════════════════════
{
  const { cleCache, empreinte, statsCache, vidangerCache } =
    await import(`${DIST}/whatsapp/comprendre.js`);
  groupe("cache — ne jamais servir à un client la réponse d'un autre");

  const base = {
    modeles: ["m1"], message: "bonjour", resto: false,
    prods: [{ id: "p1", name: "A", price: 1000, currency: "XAF", category: null, stock: 2 }],
    faits: { nom: "B", adresse: "Akwa", horaires: "8h-18h", fraisLivraison: 1000, livraison: true, devise: "XAF" },
    memoire: "", historique: [],
  };
  const k = (o) => cleCache({ ...base, ...o });

  chk("deux fois la même entrée → même clé", k({}) === k({}));
  // La casse et les accents ne doivent pas multiplier les entrées : « Bonjour »
  // et « bonjour » sont la même question.
  chk("« Bonjour » et « bonjour » partagent la clé", k({ message: "Bonjour" }) === k({ message: "bonjour " }));

  // LA PROPRIÉTÉ CRITIQUE : tout ce qui change la réponse change la clé. Sans
  // ça, un client recevrait la réponse calculée pour quelqu'un d'autre.
  chk("un message différent → clé différente", k({ message: "au revoir" }) !== k({}));
  chk("une MÉMOIRE différente → clé différente", k({ memoire: "aime le noir" }) !== k({}));
  chk("un historique différent → clé différente", k({ historique: [{ role: "user", content: "x" }] }) !== k({}));
  chk("un PRIX changé → clé différente",
    k({ prods: [{ ...base.prods[0], price: 2000 }] }) !== k({}));
  chk("un STOCK changé → clé différente",
    k({ prods: [{ ...base.prods[0], stock: 0 }] }) !== k({}));
  chk("des frais de livraison changés → clé différente",
    k({ faits: { ...base.faits, fraisLivraison: 2000 } }) !== k({}));
  chk("restaurant et boutique ne partagent pas", k({ resto: true }) !== k({}));
  chk("un modèle différent → clé différente", k({ modeles: ["m2"] }) !== k({}));

  chk("l'empreinte est stable", empreinte("abc") === empreinte("abc"));
  chk("l'empreinte distingue", empreinte("abc") !== empreinte("abd"));
  vidangerCache();
  eq("vidangé → aucune entrée", statsCache().entrees, 0);
}

// ═══ lib/whatsapp/prix — « 9 000 FCFA » lu comme 90 ════════════════════════
{
  const { lirePrix } = await import(`${DIST}/whatsapp/prix.js`);
  groupe("prix — ne jamais deviner le format d'un nombre");

  // Le défaut : `digits / 100` supposait deux décimales partout. Vrai pour
  // l'euro, FAUX pour le franc CFA qui n'en a pas. Le carrousel affichait
  // « 9 000 FCFA » et notre texte « 90 XAF » juste en dessous.
  eq("« 9 000 FCFA » → 9000", lirePrix("9 000 FCFA"), 9000);
  eq("« 5 000 FCFA » → 5000", lirePrix("5 000 FCFA"), 5000);
  eq("« 9000 XAF » → 9000", lirePrix("9000 XAF"), 9000);
  // Deux décimales : elles existent vraiment chez Meta, selon la devise.
  eq("« 9 000,00 XAF » → 9000", lirePrix("9 000,00 XAF"), 9000);
  eq("« 12,50 EUR » → 12.5", lirePrix("12,50 EUR"), 12.5);
  eq("« $12.50 » → 12.5", lirePrix("$12.50"), 12.5);
  // Le point comme séparateur de milliers — écriture courante ici.
  eq("« 1.500 FCFA » → 1500", lirePrix("1.500 FCFA"), 1500);
  eq("« 1,234,567 » → 1234567", lirePrix("1,234,567"), 1234567);
  // Un prix inconnu doit rester inconnu : 0 afficherait « gratuit ».
  eq("vide → null", lirePrix(""), null);
  eq("absent → null", lirePrix(null), null);
  eq("sans chiffre → null", lirePrix("sur devis"), null);
}

// ═══ lib/whatsapp/memoire — se souvenir sans étouffer ══════════════════════
{
  const { resumeMemoire, fusionnerNotes, validerNotes, faitsDesAchats, MAX_NOTES } =
    await import(`${DIST}/whatsapp/memoire.js`);
  groupe("memoire — ce qu'elle permet, pas ce qu'elle sait");

  const j = (n) => new Date(Date.UTC(2026, 9, 1) - n * 86400000).toISOString();
  const S = {
    achats: [
      { quand: j(1), articles: ["Oraimo Watch 6 - Premium"], total: 9000 },
      { quand: j(40), articles: ["Oraimo FreePods"], total: 8000 },
    ],
    notes: ["préfère le noir"],
  };
  const now = new Date(Date.UTC(2026, 9, 1));

  chk("« hier » plutôt qu'une date", resumeMemoire(S, now).includes("hier"));
  chk("un mois est arrondi", resumeMemoire(S, now).includes("il y a 1 mois"));
  chk("les goûts sont là", resumeMemoire(S, now).includes("préfère le noir"));
  // Deux achats au plus : une mémoire longue dilue la demande du moment, et
  // mange le budget de jetons — 8000 par minute sur l'offre gratuite.
  chk("deux achats au plus",
    resumeMemoire({ achats: [...S.achats, { quand: j(2), articles: ["X"], total: 1 }], notes: [] }, now)
      .split("\n").filter((l) => l.startsWith("A acheté")).length === 2);
  // Vide quand il n'y a rien : envoyer « aucun historique » invite le modèle
  // à en parler, ce qui est exactement ce qu'on ne veut pas.
  eq("mémoire vide → chaîne vide", resumeMemoire({ achats: [], notes: [] }, now), "");

  // LA PROPRIÉTÉ QUI COMPTE : une note vient du modèle, donc elle n'ancre
  // RIEN. Sinon une note inventée blanchirait un prix inventé au tour suivant.
  eq("seuls les montants payés ancrent", faitsDesAchats(S), ["9000", "8000"]);
  chk("les goûts n'ancrent pas",
    !JSON.stringify(faitsDesAchats({ achats: [], notes: ["budget 50000"] })).includes("50000"));

  eq("un goût répété ne s'empile pas",
    fusionnerNotes(["Préfère le noir"], ["prefere le NOIR"]), ["prefere le NOIR"]);
  eq("le neuf passe devant", fusionnerNotes(["a"], ["b"]), ["b", "a"]);
  // Observé au premier essai sur le vrai modèle : « préfère le bleu » venait
  // s'ajouter à « préfère le noir », et le modèle recevait deux consignes
  // contradictoires. Un goût qui change doit chasser l'ancien.
  eq("un goût qui change chasse l'ancien",
    fusionnerNotes(["préfère le noir"], ["préfère le bleu"]), ["préfère le bleu"]);
  eq("deux goûts distincts cohabitent",
    fusionnerNotes(["petit budget"], ["préfère le noir"]), ["préfère le noir", "petit budget"]);
  chk("la mémoire est plafonnée",
    fusionnerNotes(Array.from({ length: 20 }, (_, i) => `n${i}`), ["x"]).length === MAX_NOTES);

  eq("un événement n'est pas un goût", validerNotes(["a commandé 2 montres aujourd'hui"]), []);
  eq("une politesse n'est pas un goût", validerNotes(["merci beaucoup"]), []);
  eq("un vrai goût est gardé", validerNotes(["achète pour sa fille"]), ["achète pour sa fille"]);
  eq("pas un tableau → rien", validerNotes("noir"), []);
}

// ═══ appariement — ne JAMAIS dupliquer le catalogue du marchand ════════════
{
  const { decider } = await import(`${DIST}/whatsapp/appariement.js`);
  groupe("appariement — un seul catalogue, vu de deux endroits");

  const quoi = (cam, items) => decider(cam, items).map((d) => d.faire);

  // 1. Le retailer_id EST un identifiant Camille : c'est nous qui l'avons
  //    écrit lors d'une synchronisation précédente.
  eq("retailer_id = id Camille → rien",
    quoi([{ id: "abc", name: "Watch" }], [{ retailer_id: "abc", name: "Watch" }]), ["rien"]);

  // 2. Le lien est déjà noté.
  eq("lien déjà noté → rien",
    quoi([{ id: "abc", name: "Watch", meta_retailer_id: "m1" }], [{ retailer_id: "m1", name: "Watch" }]),
    ["rien"]);

  // 3. LA RÈGLE QUI ÉVITE LE DÉSASTRE. Son catalogue est alimenté des deux
  //    côtés : les mêmes montres existent dans Camille ET chez Meta, avec des
  //    identifiants différents. Sans cette règle, la première synchronisation
  //    lui crée un doublon de chaque produit.
  eq("même nom → on relie",
    quoi([{ id: "abc", name: "Oraimo Watch 6" }], [{ retailer_id: "m4castvg8j", name: "Oraimo Watch 6" }]),
    ["relier"]);
  eq("accents et casse ignorés",
    quoi([{ id: "abc", name: "Montre Élégante" }], [{ retailer_id: "x", name: "montre elegante" }]),
    ["relier"]);

  // 4. Vraiment inconnu : on importe.
  eq("inconnu → on importe",
    quoi([{ id: "abc", name: "Watch" }], [{ retailer_id: "x", name: "Casque Bluetooth" }]),
    ["importer"]);

  // Deux articles Meta de même nom ne peuvent pas se brancher sur le MÊME
  // produit Camille : le second écraserait le lien du premier, et un des deux
  // deviendrait invendable. Le second est donc importé.
  eq("deux fois le même nom chez Meta → un lien, un import",
    quoi([{ id: "abc", name: "Watch" }], [{ retailer_id: "x", name: "Watch" }, { retailer_id: "y", name: "Watch" }]),
    ["relier", "importer"]);

  // Un produit Camille DÉJÀ relié ne se laisse pas reprendre par son nom.
  eq("un produit déjà relié n'est pas repris",
    quoi([{ id: "abc", name: "Watch", meta_retailer_id: "m1" }], [{ retailer_id: "z", name: "Watch" }]),
    ["importer"]);

  eq("un retailer_id vide est ignoré", quoi([], [{ retailer_id: "", name: "X" }]), []);
  eq("catalogue Camille vide → tout est importé",
    quoi([], [{ retailer_id: "a", name: "A" }, { retailer_id: "b", name: "B" }]),
    ["importer", "importer"]);

  // Le cas réel : ses cinq produits, dont trois en attente chez WhatsApp.
  const sien = decider(
    [{ id: "u1", name: "Oraimo Watch 6 - Premium" }, { id: "u2", name: "Oraimo FreePods" }],
    [
      { retailer_id: "u1", name: "Oraimo Watch 6 - Premium" },
      { retailer_id: "m4castvg8j", name: "Oraimo FreePods" },
      { retailer_id: "1kjusit7dl", name: "Montre Test Buyticle" },
    ]
  );
  eq("son catalogue : rien, relier, importer", sien.map((d) => d.faire), ["rien", "relier", "importer"]);
  eq("le lien pointe le bon produit", sien[1].camilleId, "u2");
}

// ═══ repetition — l'encombrement, pas l'interdiction ═══════════════════════
{
  const { formatVitrine, formatNaturel, noterEnvoi, oublierTout, signature, FENETRE_MS } =
    await import(`${DIST}/whatsapp/repetition.js`);
  groupe("repetition — alléger le composant, jamais refuser");

  const CAT = ["p1", "p2", "p3", "p4", "p5"];
  const t = 1_000_000;

  // Le format naturel, par nombre d'articles.
  eq("1 article → la fiche", formatNaturel(1), "fiche");
  eq("5 articles → le carrousel", formatNaturel(5), "carrousel");
  eq("12 articles → la liste", formatNaturel(12), "liste");
  eq("0 article → la carte catalogue", formatNaturel(0), "catalogue");

  // LA RÈGLE. Observé : le même carrousel de cinq articles parti QUATRE fois
  // dans une conversation. On ne refuse pas et on ne dit pas « remonte un
  // peu » — ça donnerait du travail au client. On descend d'un cran dans
  // l'encombrement, à accès identique.
  oublierTout();
  eq("1er envoi → carrousel", formatVitrine("a|1", CAT, t), "carrousel");
  noterEnvoi("a|1", CAT, t);
  eq("2e envoi → la liste, plus discrète", formatVitrine("a|1", CAT, t + 1000), "liste");
  noterEnvoi("a|1", CAT, t + 1000);
  eq("3e envoi → la carte catalogue", formatVitrine("a|1", CAT, t + 2000), "catalogue");
  noterEnvoi("a|1", CAT, t + 2000);
  eq("4e envoi → la carte, on ne descend plus", formatVitrine("a|1", CAT, t + 3000), "catalogue");

  // Le client garde TOUJOURS un accès : aucun format n'est « rien ».
  chk("aucun envoi n'est supprimé",
    ["fiche", "carrousel", "liste", "catalogue"].includes(formatVitrine("a|1", CAT, t + 4000)));

  // Un contenu qui change est une information NEUVE : elle a droit au grand
  // format. Nouveau produit, rupture de stock.
  eq("un produit en plus → retour au carrousel",
    formatVitrine("a|1", [...CAT, "p6"], t + 4000), "carrousel");
  eq("un produit en moins → retour au carrousel",
    formatVitrine("a|1", CAT.slice(1), t + 4000), "carrousel");
  // L'ordre, lui, ne compte pas : c'est le même contenu.
  eq("l'ordre ne compte pas", formatVitrine("a|1", [...CAT].reverse(), t + 4000), "catalogue");
  eq("la signature est triée", signature(["b", "a"]), signature(["a", "b"]));

  // La page tournée : il revient plus tard, il a droit au grand format.
  // Le dernier envoi a eu lieu à t+2000 : la fenêtre part de là.
  eq("passé la fenêtre → carrousel",
    formatVitrine("a|1", CAT, t + 2000 + FENETRE_MS + 1), "carrousel");

  // Chaque client a son propre fil.
  eq("un autre client → carrousel", formatVitrine("a|2", CAT, t + 1000), "carrousel");
  eq("un autre commerce → carrousel", formatVitrine("b|1", CAT, t + 1000), "carrousel");

  // Une fiche unique est déjà discrète : on ne l'allège pas en carte catalogue,
  // ce serait retirer la photo et le prix pour rien.
  oublierTout();
  noterEnvoi("c|1", ["p1"], t);
  eq("une fiche répétée reste une fiche", formatVitrine("c|1", ["p1"], t + 1000), "fiche");
}

// ═══ variantes — Camille déclare des axes, Meta veut des articles ══════════
{
  const { articlesPour, grouperVariantes, produitParent, idVariante, champMeta, slug } =
    await import(`${DIST}/whatsapp/variantes.js`);
  groupe("variantes — ne jamais inventer de combinaison");

  const P = { id: "abc", name: "Oraimo Watch 6", image_url: "http://i/w.jpg" };

  // Sans variation : un seul article, comme avant.
  eq("aucune variation → 1 article",
    articlesPour(P, []).articles.map((a) => a.retailerId), ["abc"]);
  eq("variants absent → 1 article",
    articlesPour(P, null).articles.map((a) => a.retailerId), ["abc"]);
  // Un axe à une seule option n'est pas une variation.
  eq("un axe à une option → 1 article",
    articlesPour(P, [{ name: "Couleur", options: ["Noir"] }]).articles.length, 1);

  // UN axe : autant d'articles, reliés par item_group_id. C'est ça qui donne
  // au client un sélecteur de couleur au lieu de quatre fiches séparées.
  const un = articlesPour(P, [{ name: "Couleur", options: ["Noir", "Bleu nuit", "Or"] }]);
  eq("trois couleurs → trois articles",
    un.articles.map((a) => a.retailerId), ["abc:noir", "abc:bleu-nuit", "abc:or"]);
  chk("tous dans le même groupe", un.articles.every((a) => a.itemGroupId === "abc"));
  eq("l'axe part en « color »", un.articles[0].champ, "color");
  eq("le titre porte la variation", un.articles[1].titre, "Oraimo Watch 6 — Bleu nuit");
  eq("aucun avertissement", un.avertissements, []);

  // L'image propre à l'option : c'est tout l'intérêt d'un sélecteur de couleur.
  const img = articlesPour(P, [{ name: "Couleur", options: [{ value: "Rouge", image: "http://i/r.jpg" }, "Noir"] }]);
  eq("l'image de l'option est prise", img.articles[0].image, "http://i/r.jpg");
  eq("sinon celle du produit", img.articles[1].image, "http://i/w.jpg");

  // LA DÉCISION IMPORTANTE. « Couleur × Taille » avec 4 et 4 donnerait SEIZE
  // articles, dont le marchand n'a jamais dit qu'ils existaient et dont il n'a
  // pas le stock. Inventer des combinaisons, c'est inventer de la marchandise.
  const deux = articlesPour(P, [
    { name: "Couleur", options: ["Noir", "Bleu"] },
    { name: "Taille", options: ["S", "M"] },
  ]);
  eq("deux axes → 1 seul article, pas 4", deux.articles.length, 1);
  chk("et on dit pourquoi au marchand", deux.avertissements[0].includes("Couleur, Taille"));
  chk("avec la marche à suivre", deux.avertissements[0].includes("produit par combinaison"));

  // Les options en doublon ne créent pas deux fois le même article.
  eq("doublon d'option ignoré",
    articlesPour(P, [{ name: "Couleur", options: ["Noir", "noir", "Bleu"] }]).articles.length, 2);

  eq("l'axe Taille → size", champMeta("Pointure"), "size");
  eq("un axe inconnu → étiquette libre", champMeta("Parfum"), "custom_label_0");
  eq("les accents sont réduits", slug("Bleu Nuit Élégant"), "bleu-nuit-elegant");
  eq("identifiant de variation", idVariante("abc", "Bleu nuit"), "abc:bleu-nuit");

  // LE STOCK. Une commande porte le retailer_id de la VARIATION, et c'est le
  // parent qui tient le stock. Sans ce calcul, une commande de variation ne
  // décompterait rien — le défaut d'origine, par une autre porte.
  eq("le parent d'une variation", produitParent("abc:bleu-nuit"), "abc");
  eq("un produit simple est son propre parent", produitParent("abc"), "abc");
  eq("un identifiant vide ne casse rien", produitParent(""), "");

  // ── Meta → Camille ──────────────────────────────────────────────────────
  // Sans regroupement, un produit en quatre couleurs créerait QUATRE produits
  // Camille, et le catalogue du marchand doublerait à chaque synchronisation.
  const g = grouperVariantes([
    { retailer_id: "abc:noir", name: "Watch 6 — Noir", item_group_id: "abc", color: "Noir" },
    { retailer_id: "abc:bleu", name: "Watch 6 — Bleu", item_group_id: "abc", color: "Bleu" },
    { retailer_id: "zz", name: "FreePods" },
  ]);
  eq("deux couleurs + un seul → 2 produits", g.length, 2);
  eq("le groupe porte ses deux membres", g[0].membres, ["abc:noir", "abc:bleu"]);
  eq("l'axe est reconstruit", g[0].axes, [{ name: "Couleur", options: ["Noir", "Bleu"] }]);
  // Le suffixe de variation est retiré du nom : « Watch 6 — Noir » et
  // « Watch 6 — Bleu » donnent « Watch 6 », pas l'un des deux.
  eq("le nom perd le suffixe", g[0].principal.name, "Watch 6");
  eq("un article seul garde son nom", g[1].principal.name, "FreePods");
  eq("un article seul n'a pas d'axe", g[1].axes, []);

  // Un champ identique partout n'est pas un axe : ce serait un faux choix.
  eq("une couleur unique n'est pas un axe",
    grouperVariantes([
      { retailer_id: "a:1", name: "X", item_group_id: "a", color: "Noir", size: "S" },
      { retailer_id: "a:2", name: "X", item_group_id: "a", color: "Noir", size: "M" },
    ])[0].axes, [{ name: "Taille", options: ["S", "M"] }]);

  eq("un item sans retailer_id est ignoré", grouperVariantes([{ retailer_id: "" }]).length, 0);

  // ── Envoi, commande et ménage ─────────────────────────────────────────────
  const { retailerAffiche, idsAttendus, libelleVariante } = await import(`${DIST}/whatsapp/variantes.js`);
  groupe("variantes — envoi, commande, ménage");
  const UN = [{ name: "Couleur", options: ["Noir", { value: "Bleu ciel", image: "http://i/b.jpg" }] }];
  const DEUX = [{ name: "Couleur", options: ["Noir", "Bleu"] }, { name: "Taille", options: ["S", "M"] }];
  // Le parent n'existe plus chez Meta dès qu'il est éclaté : on montre une variation.
  chk("sans variation → on montre le parent", retailerAffiche(P, null) === "abc");
  chk("un axe → on montre la 1re variation", retailerAffiche(P, UN) === "abc:noir");
  chk("deux axes → parent seul, aucune combinaison", retailerAffiche(P, DEUX) === "abc");
  eq("ids attendus chez Meta (ménage)", idsAttendus(P, UN), ["abc:noir", "abc:bleu-ciel"]);
  chk("la commande garde la variation choisie", libelleVariante("abc:bleu-ciel", UN) === "Bleu ciel");
  chk("pas de libellé pour un parent", libelleVariante("abc", UN) === null);
  chk("option inconnue → pas de libellé inventé", libelleVariante("abc:rouge", UN) === null);
}

// ═══ lib/orders — les heures d'ouverture en texte libre ═════════════════════
{
  const { closedNotice, lireHoraires, estOuvert } = await import(`${DIST}/horaires.js`);
  groupe("horaires — ne rien promettre à 2 h du matin");

  // Un accusé qui dit « on te contacte tout de suite » à 2 h du matin est un
  // mensonge. Mais un format d'horaires illisible ne doit rien inventer non
  // plus : mieux vaut se taire que promettre faux.
  chk("horaires absents → on ne promet rien", closedNotice(null) === "");
  chk("horaires vides → on ne promet rien", closedNotice("") === "");
  chk("« Sur rendez-vous » → on ne promet rien", closedNotice("Sur rendez-vous") === "");
  chk("texte illisible → on ne promet rien", closedNotice("quand on peut, ça dépend") === "");
  // Horloge injectée : un test qui dépend de l'heure réelle passe le matin et
  // échoue le soir, et on finit par ne plus le croire.
  const a = (h) => new Date(Date.UTC(2026, 9, 1, h, 0, 0));
  chk("fermé à 2 h → on annonce l'ouverture", closedNotice("8h - 18h", 1, a(1)).includes("8h"));
  chk("ouvert à 10 h → rien", closedNotice("8h - 18h", 1, a(9)) === "");
  chk("fermé à 20 h → on annonce", closedNotice("8h - 18h", 1, a(19)).includes("8h"));
  chk("« 24/24 » → jamais de message", closedNotice("ouvert 24/24", 1, a(3)) === "");

  // Un commerce de nuit — courant en restauration à Douala.
  eq("« 20h - 02h » est lu", lireHoraires("20h - 02h"), { ouvre: 20, ferme: 2 });
  chk("ouvert à 23 h sur 20h-02h", estOuvert(20, 2, 23) === true);
  chk("ouvert à 1 h sur 20h-02h", estOuvert(20, 2, 1) === true);
  chk("fermé à 10 h sur 20h-02h", estOuvert(20, 2, 10) === false);
  eq("« 8h30 - 18h » garde les minutes", lireHoraires("8h30 - 18h"), { ouvre: 8.5, ferme: 18 });
  chk("8h30 s'écrit « 8h30 »", closedNotice("8h30 - 18h", 1, a(1)).includes("8h30"));
}

// ═══ variantes — montrer LA couleur demandée ═══════════════════════════════
{
  groupe("variantes — la couleur demandée est celle qu'on montre");
  const { varianteDemandee } = await import(`${DIST}/whatsapp/variantes.js`);
  // Le cas réel : « oui, il existe en rouge » arrivait avec la fiche noire.
  const tasse = [
    { option: "Noir", retailerId: "cup_noir" },
    { option: "Rouge", retailerId: "cup_rouge" },
    { option: "Vert", retailerId: "cup_vert" },
    { option: "Violet", retailerId: "cup_violet" },
  ];
  const ids = (t) => varianteDemandee(tasse, t).map((v) => v.retailerId);
  eq("« bon pour un cup vert c'est possible » → la verte", ids("bon pour un cup vert c'est possib;le"), ["cup_vert"]);
  eq("« Oui, il est disponible en rouge ! » → la rouge", ids("Oui, il est disponible en rouge !"), ["cup_rouge"]);
  eq("« do you have it in black? » → la noire", ids("do you have it in black?"), ["cup_noir"]);
  eq("« la noire » (accordé) → la noire", ids("je veux la noire"), ["cup_noir"]);
  eq("« GREEN » en majuscules → la verte", ids("GREEN please"), ["cup_vert"]);
  eq("deux couleurs → les deux, dans l'ordre du catalogue", ids("la verte ou la noire"), ["cup_noir", "cup_vert"]);
  eq("aucune couleur nommée → rien (on garde la fiche du groupe)", ids("c'est combien la tasse ?"), []);
  eq("couleur absente (bleu) → rien", ids("t'as en bleu ?"), []);
  eq("« vertes » ne désigne pas « Vert » par hasard d'un autre mot", ids("convertir"), []);
  const tailles = [{ option: "S", retailerId: "t_s" }, { option: "XL", retailerId: "t_xl" }, { option: "42", retailerId: "t_42" }];
  eq("taille XL", varianteDemandee(tailles, "en XL svp").map((v) => v.retailerId), ["t_xl"]);
  eq("pointure 42", varianteDemandee(tailles, "tu as du 42 ?").map((v) => v.retailerId), ["t_42"]);
}

// ═══ images supplémentaires — toutes les photos partent chez Meta ═════════
{
  groupe("images supplémentaires — additional_image_link");
  const { imagesSupplementaires } = await import(`${DIST}/whatsapp/variantes.js`);
  const A = "https://st.x/a.jpg", B = "https://st.x/b.jpg", C = "https://st.x/c.jpg";
  eq("l'image principale n'est pas répétée", imagesSupplementaires(A, [A, B, C]), [B, C]);
  eq("doublons retirés", imagesSupplementaires(A, [B, B, " " + B + " "]), [B]);
  eq("variante avec sa photo : la photo générale passe en supplémentaire", imagesSupplementaires(C, [A, B]), [A, B]);
  eq("vides, null et liens non http ignorés", imagesSupplementaires(A, [null, "", "data:image/png;base64,xx", "/media/x.jpg", B]), [B]);
  eq("pas de tableau → rien", imagesSupplementaires(A, null), []);
  const trente = Array.from({ length: 30 }, (_, i) => `https://st.x/${i}.jpg`);
  eq("20 au plus (limite Meta)", imagesSupplementaires(A, trente).length, 20);
}

// ═══ suivi — après la commande, des boutons à chaque étape ═══════════════
{
  groupe("suivi de commande — étapes, boutons, données à la demande");
  const { annonce, recapCommande, etapesCommande, lireIdSuivi, idSuivi } = await import(`${DIST}/whatsapp/suivi.js`);
  const base = { ref: "K7Q2", customer_name: "Awa Ngono", fulfillment: "livraison", currency: "XAF",
    items: [{ name: "Tasse inox", variant: "Rouge", qty: 2, price: 6000 }], delivery_fee: 1000, total: 13000,
    address: "Bonamoussadi", created_at: "2026-10-08T09:00:00Z", processing_at: "2026-10-08T10:00:00Z" };
  const ids = (a) => a.boutons.map((b) => b.id);
  const titres = (a) => a.boutons.map((b) => b.title);

  eq("nouvelle → rien (la confirmation est déjà partie)", annonce({ ...base, status: "nouvelle" }), null);
  eq("en préparation → récap, où en est-elle, question",
    ids(annonce({ ...base, status: "en_traitement" })), ["cmd:recap:K7Q2", "cmd:etapes:K7Q2", "cmd:aide:K7Q2"]);
  eq("en route avec livreur → « Mon livreur » en premier",
    ids(annonce({ ...base, status: "en_livraison" }, { avecLivreur: true }))[0], "cmd:livreur:K7Q2");
  eq("en route sans livreur → les étapes à la place",
    ids(annonce({ ...base, status: "en_livraison" }))[0], "cmd:etapes:K7Q2");
  chk("retrait prêt → « prête », et l'adresse de la boutique",
    /prête/.test(annonce({ ...base, fulfillment: "retrait", status: "en_livraison" }).texte) &&
    ids(annonce({ ...base, fulfillment: "retrait", status: "en_livraison" }))[0] === "cmd:adresse:K7Q2");
  const livree = annonce({ ...base, status: "livree" }, { boutique: "Buyticle" });
  chk("livrée → merci au prénom, et le nom de la boutique", /Merci Awa/.test(livree.texte) && /Buyticle/.test(livree.texte));
  eq("livrée → parfait / souci / recommander", ids(livree), ["cmd:parfait:K7Q2", "cmd:souci:K7Q2", "cmd:encore:K7Q2"]);
  eq("annulée → boutique / question", ids(annonce({ ...base, status: "annulee" })), ["cmd:boutique:K7Q2", "cmd:aide:K7Q2"]);
  chk("aucun titre de bouton au-delà de 20 caractères (Meta refuserait tout le message)",
    ["en_traitement", "en_livraison", "livree", "annulee"].every((s) =>
      titres(annonce({ ...base, status: s }, { avecLivreur: true })).every((t) => [...t].length <= 20)));

  const r = recapCommande({ ...base, status: "en_traitement" });
  chk("récap : la ligne avec variante et montant", r.includes("2× Tasse inox — Rouge : 12 000 FCFA"));
  chk("récap : livraison et total", r.includes("Livraison : 1 000 FCFA") && r.includes("Total : *13 000 FCFA*"));
  const e = etapesCommande({ ...base, status: "en_traitement" });
  chk("étapes : reçue et préparation cochées, route en attente",
    /✅ Commande reçue/.test(e) && /✅ En préparation/.test(e) && /⏳ En route/.test(e));
  chk("étapes : heure de Douala (UTC+1)", /10:00|11:00/.test(e) && e.includes("11:00"));

  eq("lecture d'un bouton", lireIdSuivi(idSuivi("recap", "K7Q2")), { action: "recap", ref: "K7Q2" });
  eq("bouton inconnu → null", lireIdSuivi("cmd:pirater:K7Q2"), null);
  eq("identifiant de catalogue → null", lireIdSuivi("cup_noir"), null);

  // Le cas réel : « ça vient dans combien de temps » sur un RETRAIT → frais de livraison.
  const { contexteCommande } = await import(`${DIST}/whatsapp/suivi.js`);
  const retraitPrep = contexteCommande({ ...base, ref: "XDLGC8", fulfillment: "retrait", status: "en_traitement", total: 6000 });
  chk("contexte : retrait annoncé, sans livraison ni frais", /RETRAIT en boutique \(pas de livraison, pas de frais de livraison\)/.test(retraitPrep));
  chk("contexte : l'étape et la référence", /COMMANDE EN COURS XDLGC8/.test(retraitPrep) && /étape : en préparation/.test(retraitPrep));
  chk("contexte : retrait « en route » se dit « prête, à récupérer »",
    /prête, à récupérer/.test(contexteCommande({ ...base, fulfillment: "retrait", status: "en_livraison" })));
  const prog = { ...base, status: "en_traitement", scheduled_at: "2026-10-08T12:00:00Z" };
  chk("commande programmée : l'heure dans le récap (heure de Douala)", recapCommande(prog).includes("Pour : 08/10 13:00"));
  chk("commande programmée : l'heure dans le contexte du modèle", /programmée pour 08\/10 13:00/.test(contexteCommande(prog)));
  chk("contexte : livraison avec l'adresse", /livraison à Bonamoussadi/.test(contexteCommande({ ...base, status: "en_livraison" })));
  chk("aucun bouton ne porte d'émoji (trop chargé)", ["en_traitement", "en_livraison", "livree", "annulee"].every((s) =>
    titres(annonce({ ...base, status: s }, { avecLivreur: true })).every((t) => !/\p{Extended_Pictographic}/u.test(t))));

  const { urlAnimation } = await import(`${DIST}/whatsapp/suivi.js`);
  const app = { NEXT_PUBLIC_APP_URL: "https://camille.vps.buyticle.com/" };
  eq("animation par défaut : celle livrée avec Camille", urlAnimation("livree", app), "https://camille.vps.buyticle.com/stickers/livree.webp");
  eq("animation choisie par le commerçant", urlAnimation("commande", { ...app, STICKER_COMMANDE_URL: "https://x/y.webp" }), "https://x/y.webp");
  eq("« off » → aucune animation", urlAnimation("commande", { ...app, STICKER_COMMANDE_URL: "off" }), null);
  eq("adresse non https (local) → aucune animation", urlAnimation("livree", { NEXT_PUBLIC_APP_URL: "http://localhost:3000" }), null);
}

// ═══ restaurant — options par plat, heure, fermeture ═══════════════════════
{
  groupe("restaurant — options, créneaux, heure demandée");
  const R = await import(`${DIST}/whatsapp/restaurant.js`);
  const opts = R.normaliserOptions([
    { name: "Accompagnement", required: true, choices: ["Plantain", "Frites:500", { label: "Riz", price: 0 }, "plantain"] },
    { name: "Piment", required: false, choices: ["Peu", "Beaucoup"] },
    { name: "", choices: ["x"] },
    { name: "Vide", choices: [] },
  ]);
  eq("options : groupes vides et sans nom écartés", opts.map((g) => g.name), ["Accompagnement", "Piment"]);
  eq("options : « Frites:500 » → prix 500, doublon « plantain » écarté",
    opts[0].choices, [{ label: "Plantain", price: 0 }, { label: "Frites", price: 500 }, { label: "Riz", price: 0 }]);
  eq("options : facultatif reconnu", opts[1].required, false);

  const ligne = { name: "Poulet DG", qty: 2, price: 3500, groupes: opts };
  eq("une question par groupe et par ligne", R.questionsPour([ligne, { name: "Jus", qty: 1, price: 500 }]),
    [{ ligne: 0, groupe: 0 }, { ligne: 0, groupe: 1 }]);
  const l1 = R.appliquerChoix(ligne, 0, 1);
  eq("frites : supplément ajouté au prix UNITAIRE", l1.price, 4000);
  eq("frites : écrit sur la ligne pour la cuisine", l1.variant, "Frites");
  const l2 = R.appliquerChoix(l1, 1, -1);
  eq("« Sans » sur un groupe facultatif → « Sans piment »", l2.variant, "Frites, Sans piment");
  eq("« Sans » refusé sur un groupe obligatoire", R.appliquerChoix(ligne, 0, -1).variant, undefined);

  eq("liste : « Sans » seulement si facultatif", R.lignesListe(opts[1]).map((r) => r.title), ["Peu", "Beaucoup", "Sans"]);
  eq("liste : le supplément en description", R.lignesListe(opts[0])[1].description, "+ 500 FCFA");
  eq("texte : « frites » → Frites", R.lireChoixTexte(opts[0], "frites stp"), 1);
  eq("texte : « 3 » → le 3e choix", R.lireChoixTexte(opts[0], "3"), 2);
  eq("texte : « sans » → -1 si facultatif", R.lireChoixTexte(opts[1], "sans"), -1);
  eq("texte : inconnu → null", R.lireChoixTexte(opts[0], "pizza"), null);

  // Douala = UTC+1. 10:10 UTC = 11:10 locale.
  const midi = new Date("2026-10-08T10:10:00Z");
  const c = R.creneaux("11h - 22h", midi, 1, 3);
  eq("créneaux : 30 min de délai, arrondis à la demi-heure",
    c.map((d) => R.libelleCreneau(d, midi, 1)), ["Aujourd'hui 12:00", "Aujourd'hui 12:30", "Aujourd'hui 13:00"]);
  const nuit = new Date("2026-10-08T22:30:00Z"); // 23:30 locale, fermé
  eq("fermé la nuit : premiers créneaux à l'ouverture, demain",
    R.creneaux("11h - 22h", nuit, 1, 2).map((d) => R.libelleCreneau(d, nuit, 1)), ["Demain 11:00", "Demain 11:30"]);
  eq("ouvert maintenant ?", [R.ouvertMaintenant("11h - 22h", midi, 1), R.ouvertMaintenant("11h - 22h", nuit, 1)], [true, false]);
  eq("horaires illisibles → on ne sait pas", R.ouvertMaintenant("sur rendez-vous", midi, 1), null);

  const lire = (t, now = midi) => { const r = R.lireHeureDemandee(t, "11h - 22h", now, 1); return r && [R.libelleCreneau(r.quand, now, 1), r.hors]; };
  eq("« pour 13h »", lire("pour 13h"), ["Aujourd'hui 13:00", false]);
  eq("« à 20h30 »", lire("à 20h30 stp"), ["Aujourd'hui 20:30", false]);
  eq("« midi » à 11h10 → aujourd'hui", lire("midi"), ["Aujourd'hui 12:00", false]);
  eq("« ce soir 8h » → 20:00", lire("ce soir 8h"), ["Aujourd'hui 20:00", false]);
  eq("« demain 12h »", lire("demain 12h"), ["Demain 12:00", false]);
  eq("heure passée → demain", lire("10h"), ["Demain 10:00", true]);
  eq("« 23h » → hors horaires", lire("23h")[1], true);
  eq("pas d'heure → null", lire("le plus vite possible"), null);
}

// ═══ multi-commerçants — le jeton de chacun, au bon endroit ═══════════════
{
  groupe("embedded signup — coffre des jetons, identifiants par commerçant");
  const { chiffrer, dechiffrer, coffrePret } = await import(`${DIST}/whatsapp/coffre.js`);
  const K = "a".repeat(64), K2 = "b".repeat(64);
  const c = chiffrer("EAAG-jeton-secret", K);
  chk("le jeton n'apparaît pas en clair", !c.includes("jeton") && c.startsWith("v1:"));
  eq("il se relit avec la bonne clé", dechiffrer(c, K), "EAAG-jeton-secret");
  eq("une autre clé ne le lit pas", dechiffrer(c, K2), null);
  const altere = c.slice(0, -4) + (c.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
  eq("une valeur altérée est refusée, pas déchiffrée de travers", dechiffrer(altere, K), null);
  chk("deux chiffrements du même jeton diffèrent (IV aléatoire)", chiffrer("x", K) !== chiffrer("x", K));
  eq("clé absente ou trop courte → coffre pas prêt", [coffrePret(""), coffrePret("abc"), coffrePret(K)], [false, false, true]);
  let leve = false; try { chiffrer("x", ""); } catch { leve = true; }
  chk("sans clé, on refuse de ranger un jeton", leve);

  const { courant, avecIdentifiants } = await import(`${DIST}/whatsapp/contexte-meta.js`);
  process.env.WHATSAPP_TOKEN = "jeton-app"; process.env.PHONE_NUMBER_ID = "111";
  eq("hors contexte : les identifiants de l'application (comme avant)", [courant().token, courant().source], ["jeton-app", "env"]);
  const A = { token: "jeton-A", phoneId: "AAA", catalogId: "catA", wabaId: "wA", source: "agent" };
  const B = { token: "jeton-B", phoneId: "BBB", catalogId: "catB", wabaId: "wB", source: "agent" };
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  const vus = await Promise.all([
    avecIdentifiants(A, async () => { await attendre(15); return courant().phoneId; }),
    avecIdentifiants(B, async () => { await attendre(5); const x = courant().phoneId; await attendre(15); return x + courant().phoneId; }),
  ]);
  eq("deux commerçants en même temps : chacun garde SES identifiants", vus, ["AAA", "BBBBBB"]);
  eq("après coup, on revient à l'application", courant().phoneId, "111");
}

// ═══ voix — un vocal devient un message écrit ══════════════════════════════
{
  groupe("voix — transcription des vocaux");
  const { nettoyerTranscription, extensionAudio } = await import(`${DIST}/whatsapp/voix.js`);
  eq("un vocal ordinaire passe tel quel", nettoyerTranscription("  T'as la tasse en noir ?  "), "T'as la tasse en noir ?");
  eq("en anglais aussi", nettoyerTranscription("Do you have the black cup?"), "Do you have the black cup?");
  eq("vocal vide → rien", nettoyerTranscription(""), null);
  eq("silence « sous-titré » par Whisper → rien", nettoyerTranscription("Sous-titrage ST' 501"), null);
  eq("générique Amara → rien", nettoyerTranscription("Sous-titres réalisés par la communauté d'Amara.org"), null);
  eq("« Merci. » seul → rien", nettoyerTranscription("Merci."), null);
  eq("« merci » dans une vraie phrase → gardé", nettoyerTranscription("Merci, je prends la rouge"), "Merci, je prends la rouge");
  eq("ponctuation seule → rien", nettoyerTranscription("..."), null);
  eq("vocal WhatsApp (opus) → .ogg", extensionAudio("audio/ogg; codecs=opus"), "ogg");
  eq("iPhone (m4a) → .m4a", extensionAudio("audio/mp4"), "m4a");
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(66)}`);
if (echecs.length) {
  console.log(`${ok} ok, ${echecs.length} ÉCHEC(S) :`);
  echecs.forEach((t) => console.log(`   • ${t}`));
  process.exit(1);
}
console.log(`${ok} cas, tous passés.`);

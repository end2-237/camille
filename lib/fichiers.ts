// Les fichiers déposés sur camille-core portent l'identifiant de leur agent en
// préfixe (`<agentId sans tirets>_…`). Avant de demander à core d'en supprimer
// un, on vérifie ce préfixe : une URL écrite à la main dans la liste des
// visuels ne doit pas pouvoir effacer le fichier d'un autre commerçant.
export function fichierDeLAgent(url: string | undefined | null, agentId: string): string | null {
  const nom = decodeURIComponent(String(url || "").split("/media/").pop() || "");
  const prefixe = `${agentId.replace(/-/g, "")}_`;
  if (!nom.startsWith(prefixe) || /[\/\\]|\.\./.test(nom)) return null;
  return nom;
}

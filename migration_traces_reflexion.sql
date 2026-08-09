-- ─────────────────────────────────────────────────────────────────────────────
-- La boîte noire enregistrait CE QUE l'agent a décidé, jamais POURQUOI.
-- Quand une réponse tombe à côté, `llm_intent` + `final_intent` disent lequel
-- des deux étages a tranché, mais rien ne dit sur quoi il s'est fondé — il
-- fallait relire le message et deviner.
--
-- La couche de réflexion produit maintenant trois éléments à chaque tour :
-- l'analyse du LLM, sa certitude, et son aveu de doute. Sans ces colonnes ils
-- se perdent à la seconde où la réponse part, et la couche est invisible.
--
-- Idempotent : réexécutable sans risque.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE camille.conversation_traces
  ADD COLUMN IF NOT EXISTS analyse   TEXT,     -- « ce que le client demande vraiment », par le LLM
  ADD COLUMN IF NOT EXISTS certitude INT,      -- 0-100, auto-évaluée
  ADD COLUMN IF NOT EXISTS ambigu    BOOLEAN DEFAULT FALSE;

-- Les tours où l'agent a préféré demander plutôt que supposer. C'est la mesure
-- de la couche 3 : trop peu, elle ne sert à rien ; trop, elle fatigue le client.
CREATE INDEX IF NOT EXISTS idx_traces_ambigu
  ON camille.conversation_traces (agent_id, created_at DESC)
  WHERE ambigu;

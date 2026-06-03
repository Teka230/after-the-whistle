# Backlog ATW — ChatGPT Connector & UI

> Source: consolidation de la liste de tickets fournie (juin 2026).
>
> But: garder un suivi opérationnel côté repo tant que les tickets sont ouverts.

## Vue priorisée

- **P0** — Ticket 1: `show_analysis` absent de l’inventaire tools ChatGPT
- **P0** — Ticket 2: Forcer le refresh manifest/schema côté host
- **P1** — Ticket 9: Standalone visual analysis mode
- **P1** — Ticket 4: Test complet `show_analysis` après refresh
- **P2** — Ticket 3: `get_stat_context` / `contextText` headline legacy (AST/REB)
- **P3** — Ticket 5: Non-régression `list_suggested_prompts`
- **P3** — Ticket 6: Non-régression resolver texte NBA
- **P3** — Ticket 7: Non-régression noms d’équipes

---

## Ticket 1 — `show_analysis` absent de l’inventaire tools ChatGPT

- **Type**: Bug / Connector / Manifest
- **Priorité**: P0 (Bloquant)
- **Statut**: Ouvert
- **Dépendances**: Aucune

### Ticket 1 — Constat

Le serveur local expose probablement `show_analysis`, mais côté host ChatGPT l’inventaire visible reste à **7 tools**:

- `clear_cache`
- `get_momentum`
- `get_player_stints`
- `get_shot_chart`
- `get_stat_context`
- `list_suggested_prompts`
- `show_game`

`show_analysis` est donc non testable depuis ChatGPT.

### Ticket 1 — Hypothèse

Le host ChatGPT conserve un ancien contrat MCP/app en cache.

### Ticket 1 — Critères d’acceptation

- [ ] `show_analysis` apparaît dans la liste des tools visibles côté ChatGPT
- [ ] Le tool peut être appelé depuis une conversation neuve
- [ ] Le widget reçoit et affiche le payload `VisualAnalysis`
- [ ] Le panneau `VisualAnalysisPanel` est visible dans l’UI

---

## Ticket 2 — Forcer le refresh du manifest/schema côté host

- **Type**: Tech task / Connector
- **Priorité**: P0
- **Statut**: En cours (host encore sur contrat 7 tools)
- **Dépendances**: Ticket 1

### Ticket 2 — Objectif

Forcer ChatGPT à recharger le contrat ATW pour prendre en compte `show_analysis`.

### Ticket 2 — Actions possibles

- [ ] Ouvrir une nouvelle conversation ChatGPT
- [ ] Reconnecter l’app/MCP
- [x] Faire un changement visible du manifest
- [x] Changer nom/description/schema hash
- [ ] Vérifier que le host voit **8 tools** (au lieu de 7)

### Ticket 2 — Critères d’acceptation

- [ ] Inventaire ChatGPT = 8 tools
- [ ] `show_analysis` est listé
- [ ] Le host n’utilise plus l’ancien contrat à 7 tools

### Ticket 2 — Observation host (session de validation)

- Inventaire observé côté ChatGPT host: **7 tools**.
- `show_analysis` reste absent dans cette session.

---

## Ticket 3 — `get_stat_context`: `contextText` affiche encore une headline PTS pour AST

- **Type**: Bug UI/Data text generation
- **Priorité**: P2
- **Statut**: Corrigé localement (à valider host)
- **Dépendances**: Aucune

### Ticket 3 — Constat

Pour SGA `ast`, les blocs structurés sont corrects:

- `label: Shai Gilgeous-Alexander: 12 AST`
- `relatedFacts: Shai Gilgeous-Alexander AST`
- `uiHeadline: Shai Gilgeous-Alexander: AST 12`

Mais `contextText` affiche encore:

- `### Shai Gilgeous-Alexander: 29 pts`

### Ticket 3 — Hypothèse

`contextText` utilise encore une génération legacy (résumé joueur principal / PTS) au lieu du bloc spécialisé demandé.

### Ticket 3 — Attendu

Exemples acceptables:

- `### Shai Gilgeous-Alexander: 12 AST`
- `### Shai Gilgeous-Alexander assists context`

### Ticket 3 — Critères d’acceptation

- [x] Une requête AST affiche une headline AST dans `contextText`
- [x] Une requête REB affiche une headline REB
- [x] Une requête PTS affiche une headline PTS
- [x] `contextText` reste cohérent avec `contextBlocks`, `relatedFacts` et `uiHeadline`

---

## Ticket 4 — Test complet `show_analysis` après refresh du host

- **Type**: QA task
- **Priorité**: P1
- **Statut**: Bloqué
- **Bloqué par**: Ticket 1 + Ticket 2

### Ticket 4 — Objectif

Valider le rendu complet de l’analyse structurée dans ChatGPT.

### Ticket 4 — Scénario de test

1. Charger `OKC Pacers 2025-06-22`
2. Appeler `show_analysis` avec un payload `VisualAnalysis`
3. Vérifier le rendu du panneau dans le widget
4. Vérifier titre, thèse, points pondérés, preuves, timeline et verdict
5. Vérifier que les données match restent attachées au payload

### Ticket 4 — Critères d’acceptation

- [ ] `VisualAnalysisPanel` s’affiche
- [ ] Le titre est visible
- [ ] La thèse est visible
- [ ] Les points pondérés sont visibles
- [ ] Les preuves sont visibles
- [ ] La timeline est visible
- [ ] Le verdict est visible
- [ ] Aucun fallback texte brut non voulu

---

## Ticket 5 — Non-régression `list_suggested_prompts`

- **Type**: QA non-régression
- **Priorité**: P3
- **Statut**: Sécurisé localement (tests)
- **Dépendances**: Aucune

### Ticket 5 — Constat

Priorisation actuelle jugée bonne:

- `Run 13-0 (Q4)`
- `Run 7-0 (Q4)`
- `Run 5-0 (Q4)`
- `Run 4-0 (Q4)`
- `Run 4-0 (Q4)`
- `Run 9-0 (Q3)`

### Ticket 5 — Objectif

Éviter un retour au bruit Q1.

### Ticket 5 — Critères d’acceptation

- [x] Les gros runs Q4 remontent avant les petits événements Q1
- [x] Les moments décisifs sont mieux pondérés
- [x] Les prompts proposés sont actionnables
- [ ] Les doublons faibles sont limités

---

## Ticket 6 — Non-régression resolver texte match NBA

- **Type**: QA non-régression
- **Priorité**: P3
- **Statut**: Validé, à couvrir
- **Dépendances**: Aucune

### Ticket 6 — Constat

`OKC Pacers 2025-06-22` résout correctement vers `basket:0042400407`.

### Ticket 6 — Critères d’acceptation

- [x] `OKC Pacers 2025-06-22` résout `basket:0042400407`
- [x] `Pacers OKC 2025-06-22` résout `basket:0042400407`
- [x] Le resolver gère les aliases `OKC` / `Oklahoma City Thunder`
- [x] Le resolver gère `Indiana` / `Pacers`

---

## Ticket 7 — Non-régression noms d’équipes

- **Type**: QA non-régression
- **Priorité**: P3
- **Statut**: Validé, à couvrir
- **Dépendances**: Aucune

### Ticket 7 — Constat corrigé

- `Indiana Pacers @ Oklahoma City Thunder`
- `OKC 103 - 91 IND`

Avant, l’UI affichait un fallback:

- `Indiana Away / Oklahoma City Home`

### Ticket 7 — Critères d’acceptation

- [x] Les vrais noms d’équipes sont affichés
- [x] Les abréviations `OKC` / `IND` sont correctes
- [x] Aucun fallback `Away` / `Home` visible
- [ ] Le matchup reste correct sur `show_game`

---

## Ticket 8 — Vérifier comportement `clear_cache` / lien connector

- **Type**: Bug / Investigation
- **Priorité**: P2
- **Statut**: Validé côté host
- **Dépendances**: Aucune

### Ticket 8 — Constat

Un appel `clear_cache` a renvoyé:

- `404: Link not found`

### Ticket 8 — Hypothèses

- Lien connector expiré
- Instance MCP non résolue
- Host ChatGPT attaché à une ancienne app
- Cache/routing côté connector incohérent

### Ticket 8 — Critères d’acceptation

- [x] `clear_cache` fonctionne depuis ChatGPT
- [x] `clear_cache` peut cibler `basket:0042400407`
- [x] `show_game` avec `clearCache:true` fonctionne aussi
- [x] Aucun `404 Link not found` sur une app reconnectée

### Ticket 8 — Résultat de validation host

- `clear_cache` exécuté avec succès sur `basket:0042400407`.
- `show_game` recharge correctement après purge (match OKC vs IND rendu).
- `show_game` avec `clearCache:true` confirme `ingestMeta.cacheCleared: true` et `ingestMeta.refreshed: true`.
- Aucun `404 Link not found` observé.

---

## Ticket 9 — Standalone visual analysis mode

- **Type**: Feature / Widget rendering / Product UX
- **Priorité**: P1
- **Statut**: Implémenté côté repo, à valider côté host après refresh du contrat
- **Dépendances**: Ticket 2

### Ticket 9 — Problème

`show_analysis` affiche bien une analyse structurée, mais dans le widget boxscore existant. Pour les requêtes du type “montre-moi une UI spécifique focus Wemby”, l’utilisateur attend une UI autonome centrée sur l’intention, pas une boxscore enrichie.

### Ticket 9 — Objectif

Permettre à `show_analysis` de rendre une vue standalone analysis-first.

### Ticket 9 — Changements attendus

- [x] Ajouter `viewMode` à `show_analysis`
  - `boxscore_with_analysis`
  - `standalone_analysis`
- [x] Ajouter `analysisTemplate`
  - `player_focus`
  - `team_focus`
  - `turning_point`
  - `match_recap`
  - `debate_board`
- [x] Si `visualAnalysis.viewMode = standalone_analysis`, afficher une vue dédiée.
- [x] En mode `player_focus`, mettre le joueur au centre :
  - carte identité joueur
  - stats clés
  - points d’impact
  - timeline filtrée
  - preuves
- [x] Garder la boxscore complète en accès secondaire.

### Ticket 9 — Critères d’acceptation

- [ ] Une demande “UI spécifique focus Wemby” déclenche `show_analysis`
- [ ] Le widget s’ouvre directement sur une vue standalone
- [ ] Le titre, la thèse, les cartes, la timeline et les preuves sont visibles sans devoir scroller dans la boxscore
- [ ] La boxscore complète reste accessible mais n’est plus le layout principal

---

## Ordre d’exécution recommandé

1. Ticket 2 (refresh host contrat)
2. Ticket 1 (valider visibilité de `show_analysis`)
3. Ticket 9 (QA standalone analysis mode)
4. Ticket 4 (QA complet `show_analysis`)
5. Ticket 3 (`contextText` AST/REB/PTS)
6. Ticket 8 (`clear_cache` 404)
7. Tickets 5/6/7 (pack non-régression)

## Définition de done globale (phase)

- [ ] Host ChatGPT voit bien 8 tools
- [ ] `show_analysis` testable et rendu widget validé
- [ ] `show_analysis` peut ouvrir une vue standalone analysis-first
- [x] `get_stat_context` cohérent sur AST/REB/PTS
- [x] `clear_cache` stable sans erreur 404
- [x] Tests non-régression ajoutés et passants

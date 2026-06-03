// Selected stat in simulated boxscore
    let activeStatId = 'sga-pts';
    // Active tone in simulated widget
    let activeTone = 'analyst';

    // Mock data matrix mapping stat clicks + tones to outputs
    const mockData = {
      'sga-pts': {
        headline: "S. Gilgeous-Alexander : 29 points",
        kicker: "Contexte de Statistique (PTS)",
        facts: [
          "OKC a mené un run de 20-0 au Q2, SGA a inscrit 8 de ces points.",
          "SGA a tiré à 11/18 (61%) dont 3/4 sur des pull-ups à mi-distance.",
          "OKC affiche un différentiel de +18 avec SGA sur le terrain."
        ],
        narrations: {
          analyst: "Gilgeous-Alexander a opéré avec un excellent spacing en isolation. Son efficacité sur pull-up à mi-distance (1.50 PPP) a puni la défense d'Indiana en 'drop', créant des lignes de pénétration pour ses coéquipiers.",
          fan: "SHAI EST LE MVP ! 29 points d'une pureté incroyable ! Ce run de 20-0 en deuxième période a complètement climatisé Indiana. Quand il s'arrête à mi-distance, c'est ficelle à chaque fois. Masterclass !",
          bar: "C'est simple, Shai donne l'impression de jouer en marchant alors que les mecs en face courent pour leur vie. Il te pose 29 points comme s'il faisait ses courses au supermarché. C'est indéfendable.",
          pundit: "Au-delà des 29 points, Shai a verrouillé le rythme du match. Indiana aime courir, mais SGA les a enfermés dans un jeu sur demi-terrain ultra-lent. C'est ça le contrôle d'un grand joueur.",
          debate: "[Analyste] : Son efficacité sur pick-and-roll a forcé le changement de schéma d'Indiana. [Supporter] : Arrête avec tes stats, il les a juste découpés ! Shai a le gène du tueur, c'est tout !"
        }
      },
      'sga-ast': {
        headline: "S. Gilgeous-Alexander : 12 passes décisives",
        kicker: "Contexte de Statistique (AST)",
        facts: [
          "Les 12 passes décisives de SGA ont généré 28 points directs pour OKC.",
          "5 passes décisives ont servi Chet Holmgren pour des dunks ou layups.",
          "SGA a commis 0 perte de balle sur l'ensemble du match."
        ],
        narrations: {
          analyst: "SGA a exploité les prises à deux agressives à la tête de raquette pour distribuer. Son association pick-and-pop avec Holmgren a produit 1.38 point par possession, combiné à un ratio assist/perte de balle parfait de 12:0.",
          fan: "12 passes et ZERO perte de balle ! C'est un génie du jeu ! Sa connexion avec Chet est télépathique, les passes lobées finissent toutes dans le cercle, c'est magnifique à regarder !",
          bar: "12 passes, aucun ballon rendu à l'adversaire. Moi, je perds plus de ballons en allant commander deux pintes au comptoir. Le mec distribue des caviars comme un croupier de casino.",
          pundit: "C'est la passe qui fait passer SGA dans une autre dimension. Tout le monde sait qu'il peut marquer, mais distribuer 12 passes sans une seule bavure montre qu'il lit le jeu deux secondes avant tout le monde.",
          debate: "[Analyste] : Il maintient un ratio parfait de 12 passes pour 0 perte. [Supporter] : Il offre des paniers tout cuits à tout le monde ! C'est du caviar gratuit pour ses potes !"
        }
      },
      'hali-ast': {
        headline: "T. Haliburton : 8 passes décisives",
        kicker: "Contexte de Statistique (AST)",
        facts: [
          "Haliburton a délivré 8 passes décisives mais a concédé 4 pertes de balle.",
          "OKC a mis en place des trappes agressives en tête de raquette sur Haliburton.",
          "Indiana affiche un différentiel de -12 quand Haliburton était sur le parquet."
        ],
        narrations: {
          analyst: "Haliburton a souffert face au blitz systématique d'OKC sur les écrans. Bien qu'il enregistre 8 passes décisives, la pression constante a provoqué 4 turnovers et réduit le rythme offensif des Pacers à 98.4 de rating.",
          fan: "Soirée compliquée pour Tyrese. Ses 8 passes montrent qu'il cherche à créer, mais ses 4 ballons perdus ont coûté trop cher face aux contre-attaques d'OKC. Il faut qu'il shoote plus pour desserrer la défense !",
          bar: "Haliburton avait les chaussures pleines de plomb ce soir. Oui, il fait ses 8 passes habituelles, mais les 4 pertes de balle, c'est des cadeaux offerts à OKC pour des dunks faciles. Impossible de gagner comme ça.",
          pundit: "Le jeu d'Haliburton commence à être décodé. OKC a montré la recette : pressing haut, forcer la passe rapide et couper les lignes. S'il ne punit pas à mi-distance, il va continuer à souffrir.",
          debate: "[Analyste] : Les blitz d'OKC ont perturbé ses passes à angle mort. [Supporter] : Il était abandonné ! Si ses coéquipiers ne font pas de coupes franches, il ne peut pas faire de miracles !"
        }
      }
    };

    // Tab switching for Canvas simulation widget
    function switchWidgetTab(tabName) {
      // Deactivate all tabs & contents
      document.querySelectorAll('.canvas-tab').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.view-content').forEach(view => view.classList.remove('active'));
      
      // Activate selected
      document.getElementById(`tab-${tabName}`).classList.add('active');
      document.getElementById(`view-${tabName}`).classList.add('active');
      
      // Explanatory text updates
      const explainSection = document.getElementById('explain-box');
      if (tabName === 'boxscore') {
        explainSection.innerHTML = `
          <div class="tool-trigger-box">
            <span class="tool-trigger-label">Appel MCP principal</span>
            show_game(gameId: "basket:0022400500")
          </div>
          <p class="explain-text" style="margin-top: 10px;">
            Lorsque l'utilisateur demande le débriefing d'un match, ChatGPT appelle <code>show_game</code>.
          </p>
          <div class="explain-bullet">
            <span class="explain-bullet-dot">1</span>
            <div>Le serveur MCP interroge SQLite et ingeste les données si nécessaire.</div>
          </div>
          <div class="explain-bullet">
            <span class="explain-bullet-dot">2</span>
            <div>Les statistiques individuelles dans le tableau de box score deviennent <strong>cliquables</strong>.</div>
          </div>
        `;
      } else if (tabName === 'runs') {
        explainSection.innerHTML = `
          <div class="tool-trigger-box">
            <span class="tool-trigger-label">Appel MCP visuel</span>
            get_stat_context(gameId: "...", runId: "okc-run-2")
          </div>
          <p class="explain-text" style="margin-top: 10px;">
            En cliquant sur l'onglet <strong>Séquences (Runs)</strong>, le widget affiche le flux de points calculé par le moteur d'insights.
          </p>
          <div class="explain-bullet">
            <span class="explain-bullet-dot">✓</span>
            <div>Chaque barre représente une série consécutive marquée par une équipe sans interruption.</div>
          </div>
          <div class="explain-bullet">
            <span class="explain-bullet-dot">✓</span>
            <div>Le survol ou clic sur un segment de run charge les play-by-play exacts via <code>get_stat_context</code>.</div>
          </div>
        `;
      } else if (tabName === 'momentum') {
        explainSection.innerHTML = `
          <div class="tool-trigger-box">
            <span class="tool-trigger-label">Appel MCP graphique</span>
            get_momentum(gameId: "basket:0022400500")
          </div>
          <p class="explain-text" style="margin-top: 10px;">
            L'onglet <strong>Courbe de Momentum</strong> appelle <code>get_momentum</code> pour récupérer les données d'avantage cumulé et dessiner le tracé SVG.
          </p>
          <div class="explain-bullet">
            <span class="explain-bullet-dot">✓</span>
            <div>La courbe oscille au-dessus et en dessous de l'axe central selon la domination d'une équipe.</div>
          </div>
          <div class="explain-bullet">
            <span class="explain-bullet-dot">✓</span>
            <div>Le changement de couleur automatique de la ligne représente le basculement psychologique du match.</div>
          </div>
        `;
      } else if (tabName === 'focus') {
        explainSection.innerHTML = `
          <div class="tool-trigger-box">
            <span class="tool-trigger-label">Appel Standalone</span>
            show_analysis(gameId: "...", viewMode: "standalone_analysis", template: "player_focus")
          </div>
          <p class="explain-text" style="margin-top: 10px;">
            Lorsqu'une question cible un joueur (ex: <em>“Fais un focus sur le match de Shai”</em>), ChatGPT appelle <code>show_analysis</code>.
          </p>
          <div class="explain-bullet">
            <span class="explain-bullet-dot">1</span>
            <div>Le widget bascule en mode <strong>Analyse Standalone</strong>.</div>
          </div>
          <div class="explain-bullet">
            <span class="explain-bullet-dot">2</span>
            <div>L'interface met en avant la thèse tactique, la carte d'identité et la timeline filtrée du joueur.</div>
          </div>
        `;
      }
    }

    // Select stat inside box score table
    function selectStat(statId) {
      // Deactivate other buttons
      document.querySelectorAll('.interactive-stat').forEach(btn => btn.classList.remove('selected'));
      document.querySelectorAll('.run-bar-segment').forEach(seg => seg.classList.remove('selected'));
      
      // Select current
      document.getElementById(`stat-${statId}`).classList.add('selected');
      activeStatId = statId;
      
      updateContextPanel();
    }

    // Select run bar segment
    function selectRun(runName) {
      document.querySelectorAll('.interactive-stat').forEach(btn => btn.classList.remove('selected'));
      document.querySelectorAll('.run-bar-segment').forEach(seg => seg.classList.remove('selected'));
      
      // We will map run clicks to mock data as well
      activeStatId = 'sga-pts'; // Default back to SGA stats for demo simplicity
      
      const content = {
        'okc-run-2': {
          headline: "Séquence : Run dévastateur de 20-0 d'OKC (Q2)",
          kicker: "ANALYSE DE SEQUENCE (RUN)",
          facts: [
            "OKC a infligé un 20-0 en 6 minutes à cheval sur le deuxième quart-temps.",
            "Indiana est resté muet avec un cinglant 0/9 au tir et 4 ballons perdus.",
            "SGA et Chet Holmgren ont inscrit 14 points combinés durant cette phase."
          ],
          narrations: {
            analyst: "Ce run de 20-0 a été catalysé par la transition défensive. OKC a forcé 4 pertes de balle, converties en paniers rapides (1.65 point par possession de transition), profitant du repli défaillant d'Indiana.",
            fan: "20-0 !!! On les a complètement détruits au deuxième quart ! Indiana ne savait plus où donner de la tête. Chet qui bâche tout en défense et Shai qui punit en transition, quel kiff !",
            bar: "À 20-0, c'est plus un run de basket, c'est une démolition en règle. Les Pacers ont pris un tel éclat en 6 minutes qu'ils auraient mieux fait de rentrer aux vestiaires boire une bière directement.",
            pundit: "C'est dans ce run de 20-0 qu'OKC a tué le match. Quand vous passez 6 minutes sans marquer un seul point en NBA, ce n'est pas de la malchance, c'est une faillite collective monumentale d'Indiana.",
            debate: "[Analyste] : Le drop coverage d'Indiana a totalement volé en éclats sur les phases de transition. [Supporter] : 20 points de suite sans encaisser un panier ! C'est juste de la folie pure !"
          }
        },
        'ind-run-4': {
          headline: "Séquence : Réponse d'Indiana 14-0 (Q3)",
          kicker: "ANALYSE DE SEQUENCE (RUN)",
          facts: [
            "Indiana a répliqué avec un run de 14-0 en fin de troisième quart-temps.",
            "Tyrese Haliburton a délivré 4 passes décisives rapides pour Siakam et Turner.",
            "OKC a forcé 3 tirs compliqués en fin de possession durant cette série."
          ],
          narrations: {
            analyst: "Indiana a augmenté son rythme de jeu (Pace de 112) pour priver OKC de sa défense demi-terrain. Haliburton a trouvé des angles de passe décisifs pour exploiter les retards de rotation d'OKC.",
            fan: "On s'est fait peur avec ce 14-0 d'Indiana ! Haliburton s'est réveillé et Siakam a fait un chantier dans la peinture. Heureusement que la fin de quart-temps nous a sauvés !",
            bar: "Indiana a montré qu'ils avaient du répondant avec ce 14-0. Ils ont commencé à jouer vite, à faire tourner la balle. OKC pensait que c'était plié et s'est endormi sur le parquet.",
            pundit: "Ce run d'Indiana prouve qu'OKC manque encore de maturité pour fermer les matchs proprement. Se prendre un 14-0 en quelques minutes montre des failles mentales inquiétantes.",
            debate: "[Analyste] : Les ajustements de transition d'Indiana ont contourné le repli d'OKC. [Supporter] : Ils ont juste rentré des tirs de folie avec Haliburton à la baguette, c'était chaud !"
          }
        }
      };

      // Fallback if not specified in detail
      const activeData = content[runName] || {
        headline: `Séquence : Série de points (${runName})`,
        kicker: "ANALYSE DE SEQUENCE",
        facts: [
          "Séquence déterministe identifiée par le moteur d'insights.",
          "Chaque action est liée à une preuve vidéo et textuelle en base."
        ],
        narrations: {
          analyst: "Séquence tactique caractérisée par une forte efficacité défensive de l'équipe dominante.",
          fan: "Une superbe série de paniers qui a fait vibrer le public !",
          bar: "Un bon petit passage à vide de la défense adverse qui a profité à tout le monde.",
          pundit: "Une séquence clé qui montre bien les forces et faiblesses stratégiques du match.",
          debate: "[Analyste] : Le différentiel s'explique par les rotations. [Supporter] : Ça a juste déroulé !"
        }
      };

      // Apply
      document.getElementById('context-kicker').innerText = activeData.kicker;
      document.getElementById('context-headline').innerText = activeData.headline;
      
      const factsContainer = document.getElementById('facts-list');
      factsContainer.innerHTML = '';
      activeData.facts.forEach(f => {
        const row = document.createElement('div');
        row.className = 'fact-row';
        row.innerText = f;
        factsContainer.appendChild(row);
      });

      // Temporarily store narrations in window to bypass standard mapping if clicked on run
      window.activeRunNarrations = activeData.narrations;
      changeTone(activeTone);
    }

    // Triggered by clicking nodes on the momentum chart
    function selectMomentumPoint(pointId) {
      if (pointId === 'q2-run') {
        document.getElementById('tab-runs').click();
        selectRun('okc-run-2');
      } else if (pointId === 'q3-ind') {
        document.getElementById('tab-runs').click();
        selectRun('ind-run-4');
      }
    }

    // Change commentary tone / persona
    function changeTone(toneId) {
      // Update active tone variable
      activeTone = toneId;
      
      // Update UI buttons
      document.querySelectorAll('.tone-pill').forEach(pill => pill.classList.remove('active'));
      document.getElementById(`tone-${toneId}`).classList.add('active');
      
      // Get narration text
      let text = '';
      if (window.activeRunNarrations) {
        text = window.activeRunNarrations[toneId];
      } else {
        const activeItem = mockData[activeStatId];
        text = activeItem.narrations[toneId];
      }
      
      // Dynamic typing-like fade effect
      const box = document.getElementById('narrative-box');
      box.style.opacity = 0;
      setTimeout(() => {
        box.innerText = text;
        box.style.opacity = 1;
        box.style.transition = 'opacity 0.25s ease';
      }, 100);
    }

    // Main context panel update logic on stat selection
    function updateContextPanel() {
      // Clear run-specific override
      window.activeRunNarrations = null;
      
      const activeItem = mockData[activeStatId];
      if (!activeItem) return;
      
      document.getElementById('context-kicker').innerText = activeItem.kicker;
      document.getElementById('context-headline').innerText = activeItem.headline;
      
      // Update facts list
      const factsContainer = document.getElementById('facts-list');
      factsContainer.innerHTML = '';
      activeItem.facts.forEach(factText => {
        const row = document.createElement('div');
        row.className = 'fact-row';
        row.innerText = factText;
        factsContainer.appendChild(row);
      });
      
      // Update narration text
      changeTone(activeTone);
    }

    // Highlight active package in architecture visualizer
    function highlightArchNode(nodeName) {
      // Remove active classes
      document.querySelectorAll('.package-item').forEach(item => item.classList.remove('active'));
      document.querySelectorAll('.arch-node').forEach(node => node.classList.remove('highlight'));
      document.querySelectorAll('.arch-connector-line').forEach(line => line.classList.remove('highlight'));
      
      // Activate clicked package item
      document.getElementById(`arch-pkg-${nodeName}`).classList.add('active');
      
      // Highlight matching visualization node
      if (nodeName === 'core') {
        document.getElementById('node-core').classList.add('highlight');
      } else if (nodeName === 'db') {
        document.getElementById('node-db').classList.add('highlight');
        document.getElementById('node-core').classList.add('highlight');
        document.getElementById('line-3').classList.add('highlight');
      } else if (nodeName === 'providers') {
        document.getElementById('node-providers').classList.add('highlight');
        document.getElementById('node-core').classList.add('highlight');
        document.getElementById('line-3').classList.add('highlight');
      } else if (nodeName === 'mcp') {
        document.getElementById('node-mcp').classList.add('highlight');
        document.getElementById('line-2').classList.add('highlight');
        document.getElementById('node-core').classList.add('highlight');
      } else if (nodeName === 'widgets') {
        document.getElementById('node-widgets').classList.add('highlight');
        document.getElementById('line-1').classList.add('highlight');
        document.getElementById('node-mcp').classList.add('highlight');
      }
    }

    // Switch quick start tabs
    function switchSetupTab(tabName) {
      document.querySelectorAll('.setup-tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.setup-tab-content').forEach(c => c.classList.remove('active'));
      
      event.target.classList.add('active');
      document.getElementById(`setup-${tabName}`).classList.add('active');
    }

    // Copy to clipboard function
    function copyCode(elementId, button) {
      const codeText = document.getElementById(elementId).innerText;
      navigator.clipboard.writeText(codeText).then(() => {
        const originalText = button.innerHTML;
        button.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Copié !
        `;
        button.classList.add('copied');
        
        setTimeout(() => {
          button.innerHTML = originalText;
          button.classList.remove('copied');
        }, 2000);
      }).catch(err => {
        console.error('Erreur lors de la copie : ', err);
      });
    }
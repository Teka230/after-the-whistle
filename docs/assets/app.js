const demoData = {
  "sga-pts": {
    tool: 'get_stat_context(gameId, entityId: "player_sga", statKey: "pts")',
    headline: "Shai Gilgeous-Alexander · 29 PTS",
    kicker: "Contexte Statistique",
    facts: [
      "Le widget ne recalcule pas les points: il lit la box line vérifiée.",
      "Les actions de tir associées peuvent ouvrir le shot chart via get_shot_chart.",
      "Le texte envoyé au modèle contient les evidence refs, pas une table inventée."
    ],
    narrations: {
      analyst: "SGA devient le point d'entrée de l'analyse, mais le modèle reste borné par les faits transmis: production, séquences et contexte play-by-play.",
      fan: "Le widget montre le chiffre, puis le contexte explique pourquoi ces 29 points ont pesé dans le match sans transformer le chat en tableau de stats.",
      bar: "Tu cliques sur 29, et au lieu d'un pavé vague, tu récupères le pourquoi: les séquences, les tirs, le moment du match.",
      pundit: "La valeur n'est pas le total brut; c'est la capacité à relier ce total aux bascules vérifiées du match.",
      debate: "Argument A: 29 points suffisent à porter l'attaque. Argument B: il faut regarder les runs et l'efficacité avant de conclure."
    }
  },
  "sga-ast": {
    tool: 'get_stat_context(gameId, entityId: "player_sga", statKey: "ast")',
    headline: "Shai Gilgeous-Alexander · 12 AST",
    kicker: "Contexte Statistique",
    facts: [
      "Le contexte AST utilise une headline AST dédiée, pas un résumé PTS legacy.",
      "Les plays liés aux assists sont filtrés depuis la timeline normalisée.",
      "La narration change de ton, mais les faits transmis restent identiques."
    ],
    narrations: {
      analyst: "Le clic sur AST pousse le modèle vers la création et les possessions terminées par les coéquipiers, pas vers le scoring individuel.",
      fan: "12 passes, c'est la lecture du jeu qui ressort: le widget montre que SGA ne fait pas que scorer.",
      bar: "Là tu vois les caviars, pas juste le total. C'est le genre de contexte qui évite les débats au hasard.",
      pundit: "La passe décisive est le meilleur test du système: elle oblige l'analyse à regarder les bénéficiaires et le timing.",
      debate: "Argument A: la création de SGA structure OKC. Argument B: il faut distinguer création réelle et assists opportunistes."
    }
  },
  "hali-ast": {
    tool: 'get_stat_context(gameId, entityId: "player_hali", statKey: "ast")',
    headline: "Tyrese Haliburton · 8 AST",
    kicker: "Contexte Adversaire",
    facts: [
      "Le même outil fonctionne pour les deux équipes.",
      "Les faits liés au joueur et à son équipe sont remontés séparément.",
      "Le panneau visuel peut enrichir le chat via updateModelContext."
    ],
    narrations: {
      analyst: "Le contexte adversaire permet de comparer la création sans sortir du périmètre des données disponibles.",
      fan: "Même côté Pacers, le widget garde la même logique: cliquer, vérifier, débattre.",
      bar: "Tu peux défendre Haliburton ou le critiquer, mais tu pars du même paquet de preuves.",
      pundit: "L'intérêt est de ramener la discussion vers les possessions vérifiées au lieu d'une impression générale.",
      debate: "Argument A: 8 assists maintiennent Indiana vivant. Argument B: le contexte de match peut réduire leur impact."
    }
  },
  "okc-run": {
    tool: 'get_momentum(gameId) + context_block: scoring_run',
    headline: "Run OKC · 20-0",
    kicker: "Séquence Déterministe",
    facts: [
      "Les runs sont détectés dans packages/core, pas générés par le LLM.",
      "Chaque run garde startOrder, endOrder, période et équipe.",
      "Les prompts suggérés priorisent les séquences fortes de fin de match."
    ],
    narrations: {
      analyst: "Cette séquence illustre le rôle du moteur déterministe: détecter la bascule, puis laisser le modèle l'expliquer.",
      fan: "Le 20-0 devient cliquable: tu vois immédiatement pourquoi le match a changé de côté.",
      bar: "Un 20-0, c'est plus qu'un score: c'est le moment où tout le monde sait que le match a tourné.",
      pundit: "La séquence compte davantage que le box score isolé; c'est là que la lecture du match devient défendable.",
      debate: "Argument A: le run décide le match. Argument B: il faut regarder qui était impliqué et sur quelle période."
    }
  }
};

let activeDemoId = "sga-pts";
let activeTone = "analyst";

function setActiveButton(selector, activeElement) {
  document.querySelectorAll(selector).forEach((element) => {
    element.classList.toggle("active", element === activeElement);
    element.classList.toggle("selected", element === activeElement);
    if (element.getAttribute("role") === "tab") {
      element.setAttribute("aria-selected", element === activeElement ? "true" : "false");
    }
  });
}

function updateContext() {
  const data = demoData[activeDemoId] || demoData["sga-pts"];
  const toolBox = document.querySelector("[data-demo-tool]");
  const kicker = document.querySelector("[data-demo-kicker]");
  const headline = document.querySelector("[data-demo-headline]");
  const facts = document.querySelector("[data-demo-facts]");
  const narrative = document.querySelector("[data-demo-narrative]");

  if (toolBox) toolBox.textContent = data.tool;
  if (kicker) kicker.textContent = data.kicker;
  if (headline) headline.textContent = data.headline;
  if (facts) {
    facts.innerHTML = "";
    data.facts.forEach((fact) => {
      const row = document.createElement("div");
      row.className = "fact-row";
      row.textContent = fact;
      facts.appendChild(row);
    });
  }
  if (narrative) {
    narrative.style.opacity = "0";
    window.setTimeout(() => {
      narrative.textContent = data.narrations[activeTone];
      narrative.style.opacity = "1";
    }, 80);
  }
}

function activateDemoTab(button) {
  const tabName = button.dataset.tab;
  setActiveButton("[data-tab]", button);
  document.querySelectorAll("[data-view]").forEach((view) => {
    view.classList.toggle("active", view.dataset.view === tabName);
  });
}

function activateSetupTab(button) {
  const tabName = button.dataset.setupTab;
  setActiveButton("[data-setup-tab]", button);
  document.querySelectorAll("[data-setup-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.setupPanel === tabName);
  });
}

function activatePackage(button) {
  const key = button.dataset.arch;
  setActiveButton("[data-arch]", button);
  document.querySelectorAll("[data-arch-node], [data-arch-line]").forEach((node) => {
    const values = (node.dataset.archNode || node.dataset.archLine || "").split(" ");
    node.classList.toggle("highlight", values.includes(key));
  });
}

async function copyCode(button) {
  const id = button.dataset.copy;
  const code = document.getElementById(id);
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code.textContent.trim());
    const original = button.textContent;
    button.textContent = "Copié";
    button.classList.add("copied");
    window.setTimeout(() => {
      button.textContent = original;
      button.classList.remove("copied");
    }, 1400);
  } catch {
    button.textContent = "Copie indisponible";
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.tab) activateDemoTab(target);
  if (target.dataset.setupTab) activateSetupTab(target);
  if (target.dataset.arch) activatePackage(target);
  if (target.dataset.copy) void copyCode(target);
  if (target.dataset.demo) {
    activeDemoId = target.dataset.demo;
    setActiveButton("[data-demo]", target);
    updateContext();
  }
  if (target.dataset.tone) {
    activeTone = target.dataset.tone;
    setActiveButton("[data-tone]", target);
    updateContext();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const firstArch = document.querySelector("[data-arch].active");
  if (firstArch) activatePackage(firstArch);
  updateContext();
});

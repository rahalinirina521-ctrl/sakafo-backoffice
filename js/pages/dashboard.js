import { html, useMemo } from '../lib.js';
import { useApp, Card, Badge } from '../ui.js';
import { platTotals, isComplete, fmt } from '../calc.js';

export function Dashboard() {
  const { data, ingMap } = useApp();
  const stats = useMemo(() => {
    const platsIncomplets = data.plats.filter((p) => {
      const t = platTotals(p.id, data.composition, ingMap);
      return t.missing > 0 || !p.avantages || !p.effets || !p.marketing || data.composition.every((c) => c.plat_id !== p.id);
    });
    return {
      plats: data.plats.length,
      voamarina: data.plats.filter((p) => p.statut === 'Voamarina').length,
      ings: data.ingredients.length,
      ingsVide: data.ingredients.filter((i) => !isComplete(i)),
      ingsVerif: data.ingredients.filter((i) => i.a_verifier).length,
      menus: data.menus.length,
      platsIncomplets,
    };
  }, [data, ingMap]);

  return html`<div class="page">
    <h1>Tableau de bord</h1>
    <div class="stats">
      <a class="stat" href="#/plats"><b>${stats.plats}</b><span>Sakafo</span><small>${stats.voamarina} voamarina</small></a>
      <a class="stat" href="#/ingredients"><b>${stats.ings}</b><span>Ingrédients</span><small>${stats.ingsVerif} mbola hamarinina</small></a>
      <a class="stat" href="#/menus"><b>${stats.menus}</b><span>Menus</span><small>andro voarafitra</small></a>
    </div>

    <${Card} title="Fomba fiasa">
      <ol class="steps">
        <li><b>Ampidiro ny sakafonao</b>: <a href="#/plats/vaovao">Sakafo vaovao</a> → anarana (ohatra: M1), fotoana, sokajy, ary ny composition (g, ml na isa: fraise 50 g, atody 2 isa, café 150 ml). Raha tsy ao amin'ny lisitra ny ingrédient iray, soraty fotsiny ny anarany dia tsindrio "Ampio".</li>
        <li><b>Hameno amin'ny IA</b>: ao amin'ny sakafo, tsindrio "Adikao ny prompt" dia apetaho ao amin'ny ChatGPT na Claude (miaraka amin'ny fichier Excel raha tianao).</li>
        <li><b>Avereno ny valiny</b>: apetaho ny JSON na ampidiro ny Excel voafeno → feno ho azy ny valeur rehetra, ny lanjan'ny isa, ny anarana commercial sy ny résumé marketing.</li>
        <li><b>Ovay ny grammes</b> raha ilaina: miova avy hatrany ny kcal sy ny macros.</li>
        <li>Rehefa lany hevitra: <a href="#/propositions">Soso-kevitra IA</a> → safidio izay tianao ampidirina.</li>
      </ol>
    <//>

    <div class="grid2">
      <${Card} title="Sakafo mbola tsy feno">
        ${stats.platsIncomplets.length ? html`<ul class="list">${stats.platsIncomplets.slice(0, 12).map((p) => html`<li><a href=${'#/plats/' + p.id}>${p.nom}</a> <${Badge} tone="warn">hamenoina<//></li>`)}</ul>` : html`<p class="muted">Feno daholo.</p>`}
      <//>
      <${Card} title="Ingrédients tsy misy valeur">
        ${stats.ingsVide.length ? html`<ul class="list">${stats.ingsVide.slice(0, 12).map((i) => html`<li>${i.id} — ${i.nom_mg}</li>`)}</ul>` : html`<p class="muted">Tsy misy.</p>`}
      <//>
    </div>
  </div>`;
}

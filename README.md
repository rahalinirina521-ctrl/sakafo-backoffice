# Sakafo Sur Mesure — Back-office

Fitaovana hitantanana ny sakafo, ny valeur nutritionnelle (kcal, protéines, glucides, lipides…), ny menus isaky ny tanjona (perte de poids, prise de masse, diabète…), ary ny famenoana amin'ny IA (ChatGPT / Claude).

Tsy mila "build": pejy HTML + JavaScript mandeha mivantana amin'ny GitHub Pages.

**Teny:** frantsay par défaut; azo ovaina ho English na Malagasy (bokotra FR / EN / MG). Ny texte marketing isaky ny sakafo dia soratan'ny IA amin'ny teny telo.

## Ny ao anatiny

| Pejy | Ilaina amin'ny |
| --- | --- |
| Sakafo | Mampiditra sakafo, composition (ingrédients + grammes), kajy automatique ny kcal sy macros, mifanaraka amin'ny tanjona ve |
| Hameno amin'ny IA | Prompt hadika + fichier Excel → apetaho ny valiny (JSON na Excel) → feno ho azy ny valeur sy ny tombony/vokatra |
| Ingrédients | Sanda isaky ny 100 g, fanamarinana 4P+4G+9L, vidiny Ar/kg |
| Menus | Menu isan'andro isaky ny sokajy, total kcal, CG, coût, sata |
| Soso-kevitra IA | Mangataka sakafo vaovao amin'ny IA, misafidy izay ampidirina |
| Sokajy | Kcal tanjona, fandeferana, fitsipika (ampiasain'ny prompts) |
| Backup Excel | Mampidina ny données rehetra |

## Fametrahana (indray mandeha ihany)

### 1. Supabase (efa vita)
Projet `sakafo` (Frankfurt) efa voaforona: tables, fiarovana (table `admins`), ingrédients 36, sokajy 5, toerana sary `sary`. Efa ao amin'ny `config.js` ny URL sy ny publishable key.

Ataon'ny tompony ihany:
1. **Authentication → Users → Add user → Create new user**: email ao amin'ny table `admins` + teny miafina, tsindrio "Auto Confirm User".
2. **Authentication → Sign In / Providers**: esory ny "Allow new users to sign up".
3. Admin vaovao: SQL Editor → `insert into admins (email) values ('...');`

### 3. GitHub Pages
**Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save.**
Ny adiresy dia: `https://<username>.github.io/sakafo-backoffice/`

## Mode démo
Raha foana ny `config.js` (ohatra amin'ny fanandramana), dia mandeha amin'ny "mode démo": voatahiry ao amin'ny navigateur ihany ny données. Mety amin'ny fanandramana, fa ataovy ny Backup Excel alohan'ny hamindrana amin'ny Supabase.

## Fomba fiasa isan'andro
1. **Plats → + Nouveau plat**: anarana (ohatra M1), fotoana, sokajy, composition amin'ny g / ml / isa, miaraka amin'ny **NB** (ohatra: atody "sans sel", café "sans sucre"). Ingrédient tsy ao? Soraty ny anarany → "Ajouter".
2. **Tehirizo**, dia **Adikao ny prompt** → apetaho ao amin'ny ChatGPT na Claude (miaraka amin'ny `hameno_SKxxxx.xlsx` raha tianao).
3. Adikao ny valiny manontolo (misy ny bloc JSON) → apetaho ao amin'ny "Avereno ny valin'ny IA" → **Vakio** → hamarino → **Ekena**.
4. Ovay ny grammes raha ilaina: miova avy hatrany ny kcal.
5. **Soso-kevitra IA** rehefa lany hevitra: safidio ireo sakafo tianao ihany.

## Rafitra teknika
- `index.html`, `css/style.css`
- `js/app.js` (routes, layout), `js/db.js` (Supabase / démo), `js/calc.js` (kajy), `js/prompts.js`, `js/excel.js`, `js/pages/*`
- Preact + htm, supabase-js, SheetJS — avy amin'ny CDN jsDelivr
- `supabase/schema.sql`, `supabase/seed.sql`

Ny sanda nutritionnelle fototra dia sanda antonony (USDA FoodData Central / Ciqual): hamarino alohan'ny hampiasana azy amin'ny client, indrindra ho an'ny diabète.

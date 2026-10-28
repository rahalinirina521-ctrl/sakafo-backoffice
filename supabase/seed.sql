-- Données de base : 36 ingrédients et 5 catégories.
-- Supabase > SQL Editor > New query > coller > Run (APRÈS schema.sql).

insert into ingredients (id,nom_mg,nom_fr,nom_en,categorie,etat,kcal,proteines,glucides,lipides,fibres,sucres,sodium,ig,poids_piece,densite,prix_kg,source,a_verifier) values
('I001','Vary fotsy masaka','Riz blanc cuit','Cooked white rice','Féculent','Masaka',130,2.7,28.2,0.3,0.4,0.1,1,73,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I002','Vary mena masaka','Riz rouge/complet cuit','Cooked red/brown rice','Féculent','Masaka',112,2.3,23.5,0.8,1.8,0.4,5,55,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I003','Mangahazo masaka','Manioc bouilli','Boiled cassava','Féculent','Masaka',120,1.0,28.0,0.3,1.5,1.2,8,46,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I004','Vomanga masaka','Patate douce bouillie','Boiled sweet potato','Féculent','Masaka',76,1.4,17.7,0.1,2.5,5.7,27,63,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I005','Ovy masaka','Pomme de terre bouillie','Boiled potato','Féculent','Masaka',87,1.9,20.1,0.1,1.8,0.9,5,78,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I006','Katsaka masaka','Maïs cuit','Cooked corn','Féculent','Masaka',96,3.4,21.0,1.5,2.4,4.5,1,52,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I007','Mofo (baguette)','Pain baguette','Baguette bread','Féculent','Vonona',270,9.0,55.0,1.8,2.5,3.0,600,75,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I008','Flocons d''avoine','Flocons d''avoine','Rolled oats','Féculent','Manta',389,16.9,66.3,6.9,10.6,1.0,2,55,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I010','Hena omby mahia masaka','Bœuf maigre cuit','Cooked lean beef','Protéine','Masaka',200,29.0,0.0,9.0,0.0,0.0,60,0,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I011','Henakisoa masaka','Porc cuit','Cooked pork','Protéine','Masaka',242,27.0,0.0,14.0,0.0,0.0,62,0,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I012','Akoho tsy misy hoditra masaka','Poulet sans peau cuit','Cooked skinless chicken','Protéine','Masaka',165,31.0,0.0,3.6,0.0,0.0,74,0,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I013','Trondro (tilapia) masaka','Tilapia cuit','Cooked tilapia','Protéine','Masaka',128,26.2,0.0,2.7,0.0,0.0,56,0,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I014','Atody','Œuf entier','Whole egg','Protéine','Masaka',143,12.6,0.7,9.5,0.0,0.4,142,0,50,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I015','Tsaramaso masaka','Haricots secs cuits','Cooked beans','Légumineuse','Masaka',127,8.7,22.8,0.5,6.4,0.3,1,30,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I016','Kabaro masaka','Pois du Cap cuit','Cooked lima beans','Légumineuse','Masaka',115,7.8,20.9,0.4,7.0,1.5,2,32,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I017','Lentilles masaka','Lentilles cuites','Cooked lentils','Légumineuse','Masaka',116,9.0,20.1,0.4,7.9,1.8,2,32,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I020','Anamamy / brèdes masaka','Brèdes (feuilles vertes) cuites','Cooked leafy greens','Légume','Masaka',23,2.9,3.6,0.3,2.2,0.4,70,15,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I021','Ravitoto masaka','Feuilles de manioc pilées cuites','Cooked pounded cassava leaves','Légume','Masaka',60,5.0,9.0,1.0,4.0,0.5,10,15,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I022','Legioma mifangaro masaka','Légumes mélangés cuits','Cooked mixed vegetables','Légume','Masaka',35,1.5,7.0,0.2,2.5,3.0,30,40,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I023','Karaoty','Carotte','Carrot','Légume','Manta',41,0.9,9.6,0.2,2.8,4.7,69,39,60,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I024','Voatabia','Tomate','Tomato','Légume','Manta',18,0.9,3.9,0.2,1.2,2.6,5,15,100,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I025','Tongolo','Oignon','Onion','Légume','Manta',40,1.1,9.3,0.1,1.7,4.2,4,15,110,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I026','Laisoa','Chou','Cabbage','Légume','Manta',25,1.3,5.8,0.1,2.5,3.2,18,10,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I030','Akondro','Banane','Banana','Fruit','Manta',89,1.1,22.8,0.3,2.6,12.2,1,51,120,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I031','Paoma','Pomme','Apple','Fruit','Manta',52,0.3,13.8,0.2,2.4,10.4,1,36,180,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I032','Voasary','Orange','Orange','Fruit','Manta',47,0.9,11.8,0.1,2.4,9.4,0,43,130,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I033','Manga','Mangue','Mango','Fruit','Manta',60,0.8,15.0,0.4,1.6,13.7,1,51,200,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I034','Avokà','Avocat','Avocado','Fruit','Manta',160,2.0,8.5,14.7,6.7,0.7,7,15,150,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I040','Ronono (entier)','Lait entier','Whole milk','Laitier','Vonona',61,3.2,4.8,3.3,0.0,5.0,43,31,null,1.03,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I041','Yaourt nature','Yaourt nature','Plain yogurt','Laitier','Vonona',61,3.5,4.7,3.3,0.0,4.7,46,35,null,1.03,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I050','Menaka','Huile végétale','Vegetable oil','Matière grasse','Vonona',884,0.0,0.0,100.0,0.0,0.0,0,0,null,0.92,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I051','Ronono voanio','Lait de coco','Coconut milk','Matière grasse','Vonona',230,2.3,5.5,23.8,2.2,3.3,15,0,null,0.97,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I052','Voanjo natono','Arachide grillée','Roasted peanuts','Matière grasse','Vonona',585,24.0,21.0,50.0,8.0,4.0,6,14,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I060','Sira','Sel','Salt','Condiment','Vonona',0,0.0,0.0,0.0,0.0,0.0,38758,0,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I061','Siramamy','Sucre','Sugar','Condiment','Vonona',387,0.0,100.0,0.0,0.0,100.0,1,65,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I062','Tantely','Miel','Honey','Condiment','Vonona',304,0.3,82.4,0.0,0.2,82.1,4,58,null,null,null,'USDA FoodData Central / Ciqual (sanda antonony)',true)
on conflict (id) do nothing;

insert into categories (id,nom,nom_en,nom_mg,kcal_cible,tolerance,prot_g_kg,cg_max,ordre,regles) values
('perte-de-poids','Perte de poids','Weight loss','Fihenan''ny lanja',1500,0.1,1.6,null,1,'Kcal modérées, protéines élevées pour préserver les muscles, beaucoup de légumes, huile ≤ 5 g par plat, peu de sucre, riz rouge plutôt que riz blanc.'),
('prise-de-masse','Prise de masse','Weight gain','Fiangedan''ny vatana',2800,0.1,1.8,null,2,'Kcal élevées, protéines à chaque repas, 1 à 2 collations, bonnes graisses (arachide, avocat).'),
('diabete','Diabète','Diabetes','Diabeta',1800,0.1,1.2,100,3,'Index glycémique bas, glucides limités et répartis, pas de sucre ni de miel, beaucoup de fibres. À valider par un médecin ou nutritionniste.'),
('economique','Économique','Budget','Mora vidy',2000,0.1,1.0,null,4,'Prix bas (légumineuses, manioc, patate douce, brèdes) tout en couvrant les besoins.'),
('normal','Normal','Standard','Mahazatra',2000,0.1,1.0,null,5,'Repas équilibrés, cuisine malgache habituelle.')
on conflict (id) do nothing;

-- Données fototra: ingrédients 36 sy sokajy 5.
-- Adikao ao amin'ny Supabase > SQL Editor > Run (AORIAN'NY schema.sql).

insert into ingredients (id,nom_mg,nom_fr,categorie,etat,kcal,proteines,glucides,lipides,fibres,sucres,sodium,ig,prix_kg,source,a_verifier) values
('I001','Vary fotsy masaka','Riz blanc cuit','Féculent','Masaka',130,2.7,28.2,0.3,0.4,0.1,1,73,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I002','Vary mena masaka','Riz rouge/complet cuit','Féculent','Masaka',112,2.3,23.5,0.8,1.8,0.4,5,55,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I003','Mangahazo masaka','Manioc bouilli','Féculent','Masaka',120,1.0,28.0,0.3,1.5,1.2,8,46,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I004','Vomanga masaka','Patate douce bouillie','Féculent','Masaka',76,1.4,17.7,0.1,2.5,5.7,27,63,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I005','Ovy masaka','Pomme de terre bouillie','Féculent','Masaka',87,1.9,20.1,0.1,1.8,0.9,5,78,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I006','Katsaka masaka','Maïs cuit','Féculent','Masaka',96,3.4,21.0,1.5,2.4,4.5,1,52,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I007','Mofo (baguette)','Pain baguette','Féculent','Vonona',270,9.0,55.0,1.8,2.5,3.0,600,75,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I008','Flocons d''avoine','Flocons d''avoine','Féculent','Manta',389,16.9,66.3,6.9,10.6,1.0,2,55,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I010','Hena omby mahia masaka','Bœuf maigre cuit','Protéine','Masaka',200,29.0,0.0,9.0,0.0,0.0,60,0,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I011','Henakisoa masaka','Porc cuit','Protéine','Masaka',242,27.0,0.0,14.0,0.0,0.0,62,0,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I012','Akoho tsy misy hoditra masaka','Poulet sans peau cuit','Protéine','Masaka',165,31.0,0.0,3.6,0.0,0.0,74,0,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I013','Trondro (tilapia) masaka','Tilapia cuit','Protéine','Masaka',128,26.2,0.0,2.7,0.0,0.0,56,0,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I014','Atody','Œuf entier','Protéine','Masaka',143,12.6,0.7,9.5,0.0,0.4,142,0,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I015','Tsaramaso masaka','Haricots secs cuits','Légumineuse','Masaka',127,8.7,22.8,0.5,6.4,0.3,1,30,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I016','Kabaro masaka','Pois du Cap cuit','Légumineuse','Masaka',115,7.8,20.9,0.4,7.0,1.5,2,32,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I017','Lentilles masaka','Lentilles cuites','Légumineuse','Masaka',116,9.0,20.1,0.4,7.9,1.8,2,32,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I020','Anamamy / brèdes masaka','Brèdes (feuilles vertes) cuites','Légume','Masaka',23,2.9,3.6,0.3,2.2,0.4,70,15,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I021','Ravitoto masaka','Feuilles de manioc pilées cuites','Légume','Masaka',60,5.0,9.0,1.0,4.0,0.5,10,15,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I022','Legioma mifangaro masaka','Légumes mélangés cuits','Légume','Masaka',35,1.5,7.0,0.2,2.5,3.0,30,40,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I023','Karaoty','Carotte','Légume','Manta',41,0.9,9.6,0.2,2.8,4.7,69,39,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I024','Voatabia','Tomate','Légume','Manta',18,0.9,3.9,0.2,1.2,2.6,5,15,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I025','Tongolo','Oignon','Légume','Manta',40,1.1,9.3,0.1,1.7,4.2,4,15,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I026','Laisoa','Chou','Légume','Manta',25,1.3,5.8,0.1,2.5,3.2,18,10,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I030','Akondro','Banane','Fruit','Manta',89,1.1,22.8,0.3,2.6,12.2,1,51,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I031','Paoma','Pomme','Fruit','Manta',52,0.3,13.8,0.2,2.4,10.4,1,36,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I032','Voasary','Orange','Fruit','Manta',47,0.9,11.8,0.1,2.4,9.4,0,43,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I033','Manga','Mangue','Fruit','Manta',60,0.8,15.0,0.4,1.6,13.7,1,51,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I034','Avokà','Avocat','Fruit','Manta',160,2.0,8.5,14.7,6.7,0.7,7,15,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I040','Ronono (entier)','Lait entier','Laitier','Vonona',61,3.2,4.8,3.3,0.0,5.0,43,31,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I041','Yaourt nature','Yaourt nature','Laitier','Vonona',61,3.5,4.7,3.3,0.0,4.7,46,35,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I050','Menaka','Huile végétale','Matière grasse','Vonona',884,0.0,0.0,100.0,0.0,0.0,0,0,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I051','Ronono voanio','Lait de coco','Matière grasse','Vonona',230,2.3,5.5,23.8,2.2,3.3,15,0,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I052','Voanjo natono','Arachide grillée','Matière grasse','Vonona',585,24.0,21.0,50.0,8.0,4.0,6,14,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I060','Sira','Sel','Condiment','Vonona',0,0.0,0.0,0.0,0.0,0.0,38758,0,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I061','Siramamy','Sucre','Condiment','Vonona',387,0.0,100.0,0.0,0.0,100.0,1,65,null,'USDA FoodData Central / Ciqual (sanda antonony)',true),
('I062','Tantely','Miel','Condiment','Vonona',304,0.3,82.4,0.0,0.2,82.1,4,58,null,'USDA FoodData Central / Ciqual (sanda antonony)',true)
on conflict (id) do nothing;

insert into categories (id,nom,kcal_cible,tolerance,prot_g_kg,cg_max,ordre,regles) values
('perte-de-poids','Perte de poids',1500,0.1,1.6,null,1,'Kcal ambany, protéines avo mba tsy ho very hozatra, legioma be, menaka ≤ 5 g isaky ny sakafo, siramamy kely, vary mena aleo noho vary fotsy.'),
('prise-de-masse','Prise de masse',2800,0.1,1.8,null,2,'Kcal avo, protéines avo isaky ny sakafo, goûter 1–2, menaka tsara (voanjo, avokà).'),
('diabete','Diabète',1800,0.1,1.2,100,3,'IG ambany, glucides voafetra sy zaraina, tsy misy siramamy na tantely, fibres be. Hamarinin''ny dokotera/nutritionniste.'),
('economique','Économique',2000,0.1,1.0,null,4,'Vidiny ambany (légumineuses, mangahazo, vomanga, anana) nefa mahafeno ny filana.'),
('normal','Normal',2000,0.1,1.0,null,5,'Sakafo voalanjalanja, malagasy mahazatra.')
on conflict (id) do nothing;

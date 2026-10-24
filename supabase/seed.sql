-- Catalog imported from the original storefront. Set real stock before launch.
insert into public.store_settings(id) values (1) on conflict do nothing;
insert into public.products(id,name,price_cents,stock_quantity,category,collections,mood,badge,icon,rating,sort_order,active) values
('p1','"It''s Giving Anxiety" Tote',45000,0,'totes',array['bestseller']::text[],'relatable','popular','toteFace',5,1,true),
('p2','"Certified Feral" Enamel Pin',12000,0,'pins',array['bestseller']::text[],'unhinged','popular','pinRound',5,2,true),
('p3','"Not My Final Form" Tote',48000,0,'totes',array['bestseller']::text[],'chaotic','last','toteLines',5,3,true),
('p4','"Delulu Is The Solulu" Pin Set',18000,0,'pins',array['bestseller']::text[],'unhinged','popular','pinDouble',5,4,true),
('p5','Gremlin Mode Tote',46000,0,'totes',array['new']::text[],'chaotic','new','tote',4,5,true),
('p6','Feral Little Guy Pin',13000,0,'pins',array['new']::text[],'unhinged','new','pinCat',4,6,true),
('p7','Chaos Goblin Keychain',9500,0,'pins',array['new']::text[],'chaotic','new','keychain',4,7,true),
('p8','"Soft Launch My Sanity" Tote',44000,0,'totes',array[]::text[],'relatable','','toteFace',4,8,true),
('p9','"Main Character Energy" Pin',12000,0,'pins',array[]::text[],'whimsical','','pinStar',5,9,true),
('p10','"Emotional Support Chaos" Tote',46500,0,'totes',array[]::text[],'chaotic','unhinged','toteLines',4,10,true),
('p11','"Small But Unhinged" Pin',11000,0,'pins',array[]::text[],'unhinged','unhinged','pinRound',5,11,true),
('p12','"Soft Girl, Feral Heart" Tote',45500,0,'totes',array[]::text[],'cute','back','tote',4,12,true),
('p13','"It''s The Cortisol For Me" Pin',12000,0,'pins',array[]::text[],'relatable','','pinHeart',4,13,true),
('p14','Cottagecore Cryptid Tote',47000,0,'totes',array[]::text[],'whimsical','','toteFace',5,14,true),
('p15','"Just Vibing, Barely" Pin Set',19000,0,'pins',array[]::text[],'relatable','','pinDouble',4,15,true),
('p16','Feelings Are Fake Keychain',9500,0,'pins',array[]::text[],'unhinged','','keychain',3,16,true),
('p17','"Certified Whimsy" Tote',45000,0,'totes',array['bestseller']::text[],'whimsical','popular','tote',5,17,true),
('p18','"Little Treat Enjoyer" Pin',12000,0,'pins',array[]::text[],'cute','','pinStar',5,18,true),
('p19','"I Peaked In The Group Chat" Tote',46500,0,'totes',array[]::text[],'relatable','','toteLines',4,19,true),
('p20','Menace To Society Pin',12000,0,'pins',array['new']::text[],'chaotic','new','pinCat',4,20,true),
('p21','"Everything Is Fine" Tote',45000,0,'totes',array[]::text[],'relatable','','toteFace',3,21,true),
('p22','"Soft Chaos Only" Pin Set',18000,0,'pins',array[]::text[],'cute','','pinDouble',4,22,true),
('p23','Little Weird Guy Keychain',9500,0,'pins',array[]::text[],'whimsical','','keychain',4,23,true),
('p24','"Manifesting Chaos" Tote',47500,0,'totes',array['new']::text[],'chaotic','new','toteLines',5,24,true)
on conflict (id) do nothing;

export const ICONS = {
  tote: `<path d="M20 34h60l-6 52H26z" fill="{{bg}}" stroke="#292631" stroke-width="3"/><path d="M32 34c0-12 6-18 18-18s18 6 18 18" fill="none" stroke="#292631" stroke-width="4"/>`,
  toteFace: `<path d="M20 34h60l-6 52H26z" fill="{{bg}}" stroke="#292631" stroke-width="3"/><path d="M32 34c0-12 6-18 18-18s18 6 18 18" fill="none" stroke="#292631" stroke-width="4"/><circle cx="42" cy="58" r="4" fill="#292631"/><circle cx="58" cy="58" r="4" fill="#292631"/><path d="M40 70q10 8 20 0" stroke="#292631" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  toteLines: `<path d="M20 34h60l-6 52H26z" fill="{{bg}}" stroke="#292631" stroke-width="3"/><path d="M32 34c0-12 6-18 18-18s18 6 18 18" fill="none" stroke="#292631" stroke-width="4"/><path d="M38 55h24M38 65h16" stroke="#292631" stroke-width="2"/>`,
  pinRound: `<circle cx="50" cy="50" r="30" fill="{{bg}}" stroke="#292631" stroke-width="3"/><path d="M38 46c4-6 20-6 24 0M40 60c6 5 14 5 20 0" stroke="#292631" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  pinStar: `<path d="M50 20l7 18 19 2-14 13 4 19-16-10-16 10 4-19-14-13 19-2z" fill="{{bg}}" stroke="#292631" stroke-width="3"/>`,
  pinDouble: `<circle cx="38" cy="46" r="16" fill="{{bg}}" stroke="#292631" stroke-width="3"/><circle cx="62" cy="60" r="16" fill="{{bg}}" stroke="#292631" stroke-width="3"/>`,
  pinHeart: `<path d="M50 78C28 62 16 46 19 32c2-11 17-15 25-5 3 4 5 6 6 6s3-2 6-6c8-10 23-6 25 5 3 14-9 30-31 46z" fill="{{bg}}" stroke="#292631" stroke-width="3"/>`,
  keychain: `<rect x="30" y="26" width="40" height="50" rx="8" fill="{{bg}}" stroke="#292631" stroke-width="3"/><circle cx="50" cy="20" r="6" fill="none" stroke="#292631" stroke-width="3"/>`,
  pinCat: `<circle cx="50" cy="54" r="26" fill="{{bg}}" stroke="#292631" stroke-width="3"/><path d="M30 36l8 10M70 36l-8 10" stroke="#292631" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="42" cy="52" r="3" fill="#292631"/><circle cx="58" cy="52" r="3" fill="#292631"/>`,
};

export const BGS = ['#FFF9EE','#F7B6D2','#B9DDF5','#C9B8F4','#FFF1B8','#BFE8D0'];

export const SAMPLE_PRODUCTS = [
  { id:'p1',  name:'"It\'s Giving Anxiety" Tote',      price:450, category:'totes', collections:['bestseller'], mood:'relatable', badge:'popular',   icon:'toteFace',  rating:5, stock:true,  order:1 },
  { id:'p2',  name:'"Certified Feral" Enamel Pin',       price:120, category:'pins',  collections:['bestseller'], mood:'unhinged',  badge:'popular',   icon:'pinRound',  rating:5, stock:true,  order:2 },
  { id:'p3',  name:'"Not My Final Form" Tote',           price:480, category:'totes', collections:['bestseller'], mood:'chaotic',   badge:'last',      icon:'toteLines', rating:5, stock:true,  order:3 },
  { id:'p4',  name:'"Delulu Is The Solulu" Pin Set',     price:180, category:'pins',  collections:['bestseller'], mood:'unhinged',  badge:'popular',   icon:'pinDouble', rating:5, stock:true,  order:4 },
  { id:'p5',  name:'Gremlin Mode Tote',                  price:460, category:'totes', collections:['new'],       mood:'chaotic',   badge:'new',       icon:'tote',      rating:4, stock:true,  order:5 },
  { id:'p6',  name:'Feral Little Guy Pin',                price:130, category:'pins',  collections:['new'],       mood:'unhinged',  badge:'new',       icon:'pinCat',    rating:4, stock:true,  order:6 },
  { id:'p7',  name:'Chaos Goblin Keychain',                price:95,  category:'pins',  collections:['new'],       mood:'chaotic',   badge:'new',       icon:'keychain',  rating:4, stock:true,  order:7 },
  { id:'p8',  name:'"Soft Launch My Sanity" Tote',        price:440, category:'totes', collections:[],            mood:'relatable', badge:'',          icon:'toteFace',  rating:4, stock:true,  order:8 },
  { id:'p9',  name:'"Main Character Energy" Pin',          price:120, category:'pins',  collections:[],            mood:'whimsical', badge:'',          icon:'pinStar',   rating:5, stock:true,  order:9 },
  { id:'p10', name:'"Emotional Support Chaos" Tote',       price:465, category:'totes', collections:[],            mood:'chaotic',   badge:'unhinged',  icon:'toteLines', rating:4, stock:true,  order:10 },
  { id:'p11', name:'"Small But Unhinged" Pin',             price:110, category:'pins',  collections:[],            mood:'unhinged',  badge:'unhinged',  icon:'pinRound',  rating:5, stock:true,  order:11 },
  { id:'p12', name:'"Soft Girl, Feral Heart" Tote',        price:455, category:'totes', collections:[],            mood:'cute',      badge:'back',      icon:'tote',      rating:4, stock:true,  order:12 },
  { id:'p13', name:'"It\'s The Cortisol For Me" Pin',      price:120, category:'pins',  collections:[],            mood:'relatable', badge:'',          icon:'pinHeart',  rating:4, stock:false, order:13 },
  { id:'p14', name:'Cottagecore Cryptid Tote',             price:470, category:'totes', collections:[],            mood:'whimsical', badge:'',          icon:'toteFace',  rating:5, stock:true,  order:14 },
  { id:'p15', name:'"Just Vibing, Barely" Pin Set',        price:190, category:'pins',  collections:[],            mood:'relatable', badge:'',          icon:'pinDouble', rating:4, stock:true,  order:15 },
  { id:'p16', name:'Feelings Are Fake Keychain',           price:95,  category:'pins',  collections:[],            mood:'unhinged',  badge:'',          icon:'keychain',  rating:3, stock:true,  order:16 },
  { id:'p17', name:'"Certified Whimsy" Tote',              price:450, category:'totes', collections:['bestseller'],mood:'whimsical', badge:'popular',   icon:'tote',      rating:5, stock:true,  order:17 },
  { id:'p18', name:'"Little Treat Enjoyer" Pin',           price:120, category:'pins',  collections:[],            mood:'cute',      badge:'',          icon:'pinStar',   rating:5, stock:true,  order:18 },
  { id:'p19', name:'"I Peaked In The Group Chat" Tote',    price:465, category:'totes', collections:[],            mood:'relatable', badge:'',          icon:'toteLines', rating:4, stock:true,  order:19 },
  { id:'p20', name:'Menace To Society Pin',                price:120, category:'pins',  collections:['new'],       mood:'chaotic',   badge:'new',       icon:'pinCat',    rating:4, stock:true,  order:20 },
  { id:'p21', name:'"Everything Is Fine" Tote',            price:450, category:'totes', collections:[],            mood:'relatable', badge:'',          icon:'toteFace',  rating:3, stock:true,  order:21 },
  { id:'p22', name:'"Soft Chaos Only" Pin Set',            price:180, category:'pins',  collections:[],            mood:'cute',      badge:'',          icon:'pinDouble', rating:4, stock:true,  order:22 },
  { id:'p23', name:'Little Weird Guy Keychain',            price:95,  category:'pins',  collections:[],            mood:'whimsical', badge:'',          icon:'keychain',  rating:4, stock:false, order:23 },
  { id:'p24', name:'"Manifesting Chaos" Tote',             price:475, category:'totes', collections:['new'],       mood:'chaotic',   badge:'new',       icon:'toteLines', rating:5, stock:true,  order:24 },
];


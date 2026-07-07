// Fetch every named business/service in Ramat Gan from OSM and bake data/biz.js.
// Standalone (fetch + process in one): node scripts/fetch-businesses.mjs
// Projection params are read from data/data.js so coordinates match the city mesh.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUERY = fs.readFileSync(path.join(ROOT, 'scripts', 'queries', 'q_biz.txt'), 'utf8');
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
];
const UA = 'ramat-gan-living-map/1.0 (+https://github.com/Elad33/ramat-gan-living-map; business layer refresh)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function overpass() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', 'User-Agent': UA },
        body: QUERY,
        signal: AbortSignal.timeout(240000),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = JSON.parse(await r.text());
      console.log('✓ overpass', (data.elements || []).length, 'elements (' + url.split('/')[2] + ')');
      return data;
    } catch (e) {
      console.log('…retry biz attempt', attempt + 1, String(e.message).slice(0, 80));
      await sleep(15000 + attempt * 10000);
    }
  }
  throw new Error('failed to fetch businesses');
}

// projection: identical to process.mjs (center + m/deg → decimeters)
const dataJs = fs.readFileSync(path.join(ROOT, 'data', 'data.js'), 'utf8').slice(0, 400);
const lat0 = +/"lat0":([\d.]+)/.exec(dataJs)[1];
const lon0 = +/"lon0":([\d.]+)/.exec(dataJs)[1];
const kx = Math.cos(lat0 * Math.PI / 180) * 111320, ky = 110540;
const PX = lon => Math.round((lon - lon0) * kx * 10);
const PY = lat => Math.round((lat - lat0) * ky * 10);

// ---- categories (order matters: index is stored per item) ----
const CATS = [
  { id: 'food',    label: 'מסעדות' },
  { id: 'cafe',    label: 'קפה ומתוק' },
  { id: 'bar',     label: 'ברים ולילה' },
  { id: 'groc',    label: 'סופר ומכולת' },
  { id: 'shop',    label: 'קניות' },
  { id: 'beauty',  label: 'יופי וטיפוח' },
  { id: 'health',  label: 'בריאות' },
  { id: 'sport',   label: 'ספורט ופנאי' },
  { id: 'services',label: 'שירותים' },
];
const CI = Object.fromEntries(CATS.map((c, i) => [c.id, i]));

function catOf(t) {
  const a = t.amenity || '', s = t.shop || '', l = t.leisure || '';
  if (/^(restaurant|fast_food|food_court)$/.test(a)) return 'food';
  if (/^(cafe|ice_cream)$/.test(a) || /^(bakery|pastry|confectionery|chocolate|coffee|tea)$/.test(s)) return 'cafe';
  if (/^(bar|pub|nightclub|biergarten)$/.test(a)) return 'bar';
  if (/^(supermarket|convenience|greengrocer|butcher|deli|alcohol|beverages|kiosk|health_food|spices|frozen_food|dairy|seafood|farm)$/.test(s) || a === 'marketplace') return 'groc';
  if (/^(hairdresser|beauty|cosmetics|perfumery|massage|tattoo)$/.test(s)) return 'beauty';
  if (/^(pharmacy|clinic|dentist|doctors|veterinary)$/.test(a) || /^(optician|medical_supply|hearing_aids|nutrition_supplements)$/.test(s) || t.healthcare) return 'health';
  if (/^(fitness_centre|sports_centre|bowling_alley|escape_game|amusement_arcade|dance|trampoline_park)$/.test(l) || a === 'cinema') return 'sport';
  if (/^(bank|post_office|fuel|car_wash|driving_school|internet_cafe|studio|events_venue|childcare|language_school|music_school|coworking_space)$/.test(a)
    || /^(laundry|dry_cleaning|copyshop|travel_agency|car_repair|car|car_parts|funeral_directors|storage_rental|money_lender|pawnbroker|locksmith)$/.test(s)
    || t.craft || t.office) return 'services';
  if (s) return 'shop';
  return 'services';
}

// business-type Hebrew sub-label (fallback: category label)
const SUB = {
  restaurant: 'מסעדה', fast_food: 'אוכל מהיר', food_court: 'מתחם אוכל', cafe: 'בית קפה', ice_cream: 'גלידרייה',
  bar: 'בר', pub: 'פאב', nightclub: 'מועדון', biergarten: 'ביר גארדן',
  supermarket: 'סופרמרקט', convenience: 'מכולת', bakery: 'מאפייה', pastry: 'קונדיטוריה', confectionery: 'ממתקים',
  chocolate: 'שוקולד', coffee: 'חנות קפה', tea: 'חנות תה', greengrocer: 'ירקן', butcher: 'אטליז', deli: 'מעדנייה',
  alcohol: 'חנות משקאות', beverages: 'משקאות', kiosk: 'קיוסק', health_food: 'טבע ובריאות', spices: 'תבלינים',
  seafood: 'דגים', marketplace: 'שוק',
  clothes: 'אופנה', shoes: 'נעליים', jewelry: 'תכשיטים', bag: 'תיקים', boutique: 'בוטיק', fabric: 'בדים',
  gift: 'מתנות', toys: 'צעצועים', books: 'חנות ספרים', stationery: 'כלי כתיבה', electronics: 'אלקטרוניקה',
  mobile_phone: 'סלולר', computer: 'מחשבים', hifi: 'אודיו', photo: 'צילום', music: 'מוזיקה',
  musical_instrument: 'כלי נגינה', furniture: 'רהיטים', interior_decoration: 'עיצוב הבית', houseware: 'כלי בית',
  hardware: 'חומרי בניין', doityourself: 'עשה זאת בעצמך', paint: 'צבעים', florist: 'חנות פרחים',
  garden_centre: 'משתלה', pet: 'חיות מחמד', pet_grooming: 'טיפוח כלבים', bicycle: 'אופניים', sports: 'ציוד ספורט',
  outdoor: 'טיולים וקמפינג', mall: 'קניון', department_store: 'כלבו', variety_store: 'הכל בזול',
  second_hand: 'יד שנייה', charity: 'חנות צדקה', antiques: 'עתיקות', art: 'גלריה', frame: 'מסגרות',
  tobacco: 'טבק', 'e-cigarette': 'סיגריות אלקטרוניות', tailor: 'תיקוני בגדים', shoe_repair: 'סנדלר',
  dry_cleaning: 'ניקוי יבש', laundry: 'מכבסה', copyshop: 'הדפסות', travel_agency: 'סוכנות נסיעות',
  car_repair: 'מוסך', car: 'סוכנות רכב', car_parts: 'חלקי חילוף', car_wash: 'שטיפת רכב', fuel: 'תחנת דלק',
  hairdresser: 'מספרה', beauty: 'מכון יופי', cosmetics: 'קוסמטיקה', perfumery: 'בשמים', massage: 'עיסוי', tattoo: 'קעקועים',
  pharmacy: 'בית מרקחת', optician: 'אופטיקה', dentist: 'מרפאת שיניים', doctors: 'מרפאה', clinic: 'מרפאה',
  veterinary: 'וטרינר', medical_supply: 'ציוד רפואי', hearing_aids: 'מכשירי שמיעה', nutrition_supplements: 'תוספי תזונה',
  bank: 'בנק', post_office: 'דואר', driving_school: 'בית ספר לנהיגה', childcare: 'גן ילדים',
  language_school: 'בית ספר לשפות', music_school: 'בית ספר למוזיקה', coworking_space: 'חלל עבודה',
  events_venue: 'אולם אירועים', studio: 'סטודיו', internet_cafe: 'אינטרנט קפה',
  fitness_centre: 'חדר כושר', sports_centre: 'מרכז ספורט', bowling_alley: 'באולינג', escape_game: 'חדר בריחה',
  amusement_arcade: 'משחקייה', dance: 'סטודיו למחול', trampoline_park: 'פארק טרמפולינות', cinema: 'קולנוע',
  // craft / office values
  carpenter: 'נגר', electrician: 'חשמלאי', plumber: 'אינסטלטור', photographer: 'צלם', shoemaker: 'סנדלר',
  locksmith: 'מנעולן', tailor_craft: 'חייט', jeweller: 'צורף', caterer: 'קייטרינג', brewery: 'מבשלה',
  winery: 'יקב', confectionery_craft: 'קונדיטור',
  insurance: 'סוכנות ביטוח', lawyer: 'משרד עורכי דין', estate_agent: 'תיווך נדל״ן', travel_agent: 'סוכן נסיעות',
  accountant: 'רואה חשבון', architect: 'אדריכל', it: 'הייטק', coworking: 'חלל עבודה',
  employment_agency: 'השמה', financial: 'פיננסים', notary: 'נוטריון',
};
const subOf = t => SUB[t.shop] || SUB[t.amenity] || SUB[t.leisure] || SUB[t.craft] || SUB[t.office] || SUB[t.healthcare] || '';

// cuisine → Hebrew (partial; unknown values pass through)
const CUIS = {
  pizza: 'פיצה', burger: 'המבורגר', sushi: 'סושי', italian: 'איטלקי', asian: 'אסייתי', hummus: 'חומוס',
  falafel: 'פלאפל', kebab: 'שווארמה', shawarma: 'שווארמה', sandwich: 'כריכים', fish: 'דגים', seafood: 'פירות ים',
  mediterranean: 'ים תיכוני', middle_eastern: 'מזרח תיכוני', oriental: 'מזרחי', georgian: 'גיאורגי',
  chinese: 'סיני', japanese: 'יפני', thai: 'תאילנדי', indian: 'הודי', mexican: 'מקסיקני', american: 'אמריקאי',
  french: 'צרפתי', greek: 'יווני', steak_house: 'סטייקים', grill: 'על האש', barbecue: 'על האש',
  vegan: 'טבעוני', vegetarian: 'צמחוני', dessert: 'קינוחים', breakfast: 'ארוחות בוקר', bagel: 'בייגל',
  noodle: 'נודלס', ramen: 'ראמן', salad: 'סלטים', juice: 'מיצים', coffee_shop: 'בית קפה', ice_cream: 'גלידה',
  cake: 'עוגות', pancake: 'פנקייקים', waffle: 'וופלים', bubble_tea: 'באבל טי', tapas: 'טאפאס', bistro: 'ביסטרו',
  regional: 'ישראלי', israeli: 'ישראלי', kosher: 'כשר', bakery: 'מאפים', donut: 'דונאטס', crepe: 'קרפים',
};
const heCuisine = c => String(c || '').split(';').slice(0, 2)
  .map(v => CUIS[v.trim()] || v.trim().replace(/_/g, ' ')).filter(Boolean).join(' · ');

const raw = await overpass();
const items = [];
const seen = new Set();
let skipped = 0;
for (const el of raw.elements || []) {
  const t = el.tags || {};
  const name = t['name:he'] || t.name;
  if (!name || t['disused:shop'] || t['disused:amenity']) { skipped++; continue; }
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  if (lat == null) { skipped++; continue; }
  const id = el.type[0] + el.id;
  if (seen.has(id)) continue;
  seen.add(id);
  const cat = catOf(t);
  const extra = {};
  const sub = subOf(t);
  if (sub) extra.s = sub;
  if (t.cuisine) { const c = heCuisine(t.cuisine); if (c) extra.c = c; }
  const street = t['addr:street'], num = t['addr:housenumber'];
  if (street) extra.a = street + (num ? ' ' + num : '');
  const phone = (t.phone || t['contact:phone'] || '').split(';')[0].trim();
  if (phone) extra.p = phone;
  let web = t.website || t['contact:website'] || t['contact:instagram'] || t['contact:facebook'] || '';
  if (/^https?:\/\//.test(web)) extra.w = web.slice(0, 160);
  if (t.opening_hours) extra.h = t.opening_hours.slice(0, 160);
  if (t.wheelchair === 'yes') extra.wa = 1;
  const rec = [id, name.slice(0, 60), CI[cat], PX(lon), PY(lat)];
  if (Object.keys(extra).length) rec.push(extra);
  items.push(rec);
}
// stable order (by id) → clean git diffs on refresh
items.sort((a, b) => a[0] < b[0] ? -1 : 1);

const byCat = {};
for (const it of items) byCat[CATS[it[2]].id] = (byCat[CATS[it[2]].id] || 0) + 1;
console.log('businesses:', items.length, 'skipped(unnamed/off):', skipped);
console.log(Object.entries(byCat).map(([k, v]) => k + ':' + v).join('  '));

const out = 'window.BIZ=' + JSON.stringify({ cats: CATS, items }) + ';';
fs.writeFileSync(path.join(ROOT, 'data', 'biz.js'), out);
console.log('data/biz.js:', (out.length / 1024).toFixed(0), 'KB');

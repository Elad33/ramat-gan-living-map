// Build data/biz.js — every business in Ramat Gan, merged from two open sources:
//   • OSM (Overpass): community-mapped, precise positions, opening hours
//   • Overture Places (Meta/Microsoft, CDLA-Permissive-2.0): fresh existence
//     signal (confidence), phones, websites, socials — solves stale/missing OSM
// Run: node scripts/fetch-businesses.mjs
//   OVERTURE_FILE=path/to/places.geojson  reuse a downloaded extract
//   (otherwise tries the `overturemaps` CLI, and degrades to OSM-only)
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'ramat-gan-living-map/1.0 (+https://github.com/Elad33/ramat-gan-living-map; business layer refresh)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BBOX = '34.799,32.036,34.855,32.106';
const MIN_CONFIDENCE = 0.55;  // Overture: likelihood the place still exists
const CLOSED_CONFIDENCE = 0.30; // matched OSM+Overture below this → treat as closed

// ---- projection + city boundary (from the baked city data) ----
const dataJs = fs.readFileSync(path.join(ROOT, 'data', 'data.js'), 'utf8');
const lat0 = +/"lat0":([\d.]+)/.exec(dataJs)[1];
const lon0 = +/"lon0":([\d.]+)/.exec(dataJs)[1];
const kx = Math.cos(lat0 * Math.PI / 180) * 111320, ky = 110540;
const PX = lon => Math.round((lon - lon0) * kx * 10); // dm
const PY = lat => Math.round((lat - lat0) * ky * 10);
const boundRaw = JSON.parse('[' + /"boundary":\[(.*?)\],"bld"/s.exec(dataJs)[1] + ']');
const RINGS = boundRaw.map(r => {
  const pts = [[r[0], r[1]]];
  for (let i = 2; i < r.length; i += 2) pts.push([pts[pts.length - 1][0] + r[i], pts[pts.length - 1][1] + r[i + 1]]);
  return pts;
});
// source strings (FB pages…) sometimes carry U+FFFD / control chars — the artifact host rejects them
const clean = s => String(s || '')
  .replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
  .replace(/\s+/g, ' ').trim();

function inCity(x, y) {
  for (const ring of RINGS) {
    let ins = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
    }
    if (ins) return true;
  }
  return false;
}

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

/* ============================ OSM side ============================ */
const QUERY = fs.readFileSync(path.join(ROOT, 'scripts', 'queries', 'q_biz.txt'), 'utf8');
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
];
async function fetchOSM() {
  for (let attempt = 0; attempt < 8; attempt++) {
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
      console.log('✓ OSM', (data.elements || []).length, 'elements (' + url.split('/')[2] + ')');
      return data;
    } catch (e) {
      console.log('…retry OSM attempt', attempt + 1, String(e.message).slice(0, 80));
      await sleep(12000 + attempt * 8000);
    }
  }
  return null;
}

function catOfOSM(t) {
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
  tobacco: 'טבק', tailor: 'תיקוני בגדים', shoe_repair: 'סנדלר',
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
  carpenter: 'נגר', electrician: 'חשמלאי', plumber: 'אינסטלטור', photographer: 'צלם', shoemaker: 'סנדלר',
  locksmith: 'מנעולן', jeweller: 'צורף', caterer: 'קייטרינג', brewery: 'מבשלה', winery: 'יקב',
  insurance: 'סוכנות ביטוח', lawyer: 'משרד עורכי דין', estate_agent: 'תיווך נדל״ן', travel_agent: 'סוכן נסיעות',
  accountant: 'רואה חשבון', architect: 'אדריכל', it: 'הייטק', coworking: 'חלל עבודה',
  employment_agency: 'השמה', financial: 'פיננסים', notary: 'נוטריון',
};
const subOfOSM = t => SUB[t.shop] || SUB[t.amenity] || SUB[t.leisure] || SUB[t.craft] || SUB[t.office] || SUB[t.healthcare] || '';
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

function processOSM(raw) {
  const items = [];
  const seen = new Set();
  for (const el of raw.elements || []) {
    const t = el.tags || {};
    const name = clean(t['name:he'] || t.name);
    if (!name || t['disused:shop'] || t['disused:amenity']) continue;
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (lat == null) continue;
    const id = el.type[0] + el.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const x = PX(lon), y = PY(lat);
    if (!inCity(x, y)) continue;
    const it = { id, name: name.slice(0, 60), cat: catOfOSM(t), x, y, src: 'osm' };
    it.sub = subOfOSM(t);
    if (t.cuisine) it.cuisine = heCuisine(t.cuisine);
    const street = t['addr:street'], num = t['addr:housenumber'];
    if (street) it.addr = clean(street + (num ? ' ' + num : ''));
    it.phone = (t.phone || t['contact:phone'] || '').split(';')[0].trim();
    let web = t.website || t['contact:website'] || '';
    if (/^https?:\/\//.test(web)) it.web = web.slice(0, 160);
    const ig = /instagram\.com\/([\w.]+)/.exec(t['contact:instagram'] || '');
    if (ig) it.ig = ig[1];
    const fb = /facebook\.com\/([\w.\-]+)/.exec(t['contact:facebook'] || '');
    if (fb) it.fb = fb[1];
    if (t.opening_hours) it.hours = t.opening_hours.slice(0, 160);
    if (t.wheelchair === 'yes') it.wa = 1;
    items.push(it);
  }
  return items;
}

/* ============================ Overture side ============================ */
// leaf category (categories.primary) → [cat, Hebrew sub]; checked against a real extract
const OV_LEAF = {
  restaurant: ['food', 'מסעדה'], pizza_restaurant: ['food', 'פיצה'], sushi_restaurant: ['food', 'סושי'],
  burger_restaurant: ['food', 'המבורגר'], middle_eastern_restaurant: ['food', 'מזרח תיכוני'],
  italian_restaurant: ['food', 'איטלקי'], asian_restaurant: ['food', 'אסייתי'], fast_food_restaurant: ['food', 'אוכל מהיר'],
  seafood_restaurant: ['food', 'דגים'], steakhouse: ['food', 'סטייקים'], falafel_restaurant: ['food', 'פלאפל'],
  hummus_restaurant: ['food', 'חומוס'], vegan_restaurant: ['food', 'טבעוני'], sandwich_shop: ['food', 'כריכים'],
  coffee_shop: ['cafe', 'בית קפה'], cafe: ['cafe', 'בית קפה'], bakery: ['cafe', 'מאפייה'],
  ice_cream_shop: ['cafe', 'גלידרייה'], dessert_shop: ['cafe', 'קינוחים'], patisserie_cake_shop: ['cafe', 'קונדיטוריה'],
  bar: ['bar', 'בר'], pub: ['bar', 'פאב'], night_club: ['bar', 'מועדון'], wine_bar: ['bar', 'בר יין'],
  cocktail_bar: ['bar', 'בר קוקטיילים'], hookah_lounge: ['bar', 'נרגילות'],
  supermarket: ['groc', 'סופרמרקט'], grocery_store: ['groc', 'מכולת'], liquor_store: ['groc', 'חנות משקאות'],
  delicatessen: ['groc', 'מעדנייה'], butcher_shop: ['groc', 'אטליז'], fruits_and_vegetables: ['groc', 'ירקן'],
  health_food_store: ['groc', 'טבע ובריאות'], convenience_store: ['groc', 'מכולת'],
  jewelry_store: ['shop', 'תכשיטים'], b2b_jewelers: ['shop', 'תכשיטנות'], jewelry_and_watches_manufacturer: ['shop', 'תכשיטים'],
  clothing_store: ['shop', 'אופנה'], womens_clothing_store: ['shop', 'אופנת נשים'], mens_clothing_store: ['shop', 'אופנת גברים'],
  shoe_store: ['shop', 'נעליים'], flowers_and_gifts_shop: ['shop', 'פרחים ומתנות'], florist: ['shop', 'חנות פרחים'],
  shopping: ['shop', 'חנות'], shopping_center: ['shop', 'קניון'], toy_store: ['shop', 'צעצועים'],
  furniture_store: ['shop', 'רהיטים'], hardware_store: ['shop', 'חומרי בניין'], electronics: ['shop', 'אלקטרוניקה'],
  computer_store: ['shop', 'מחשבים'], mobile_phone_store: ['shop', 'סלולר'], bicycle_shop: ['shop', 'אופניים'],
  bookstore: ['shop', 'חנות ספרים'], pet_store: ['shop', 'חיות מחמד'], art_gallery: ['shop', 'גלריה'],
  optical_store: ['shop', 'אופטיקה'], sporting_goods_store: ['shop', 'ציוד ספורט'],
  beauty_salon: ['beauty', 'מכון יופי'], hair_salon: ['beauty', 'מספרה'], barber: ['beauty', 'מספרה'],
  nail_salon: ['beauty', 'ציפורניים'], spas: ['beauty', 'ספא'], beauty_and_spa: ['beauty', 'יופי וספא'],
  cosmetic_and_beauty_supplies: ['beauty', 'קוסמטיקה'], tattoo_and_piercing: ['beauty', 'קעקועים'],
  massage: ['beauty', 'עיסוי'], eyelash_service: ['beauty', 'ריסים'], makeup_artist: ['beauty', 'איפור'],
  pharmacy: ['health', 'בית מרקחת'], dentist: ['health', 'מרפאת שיניים'], doctor: ['health', 'מרפאה'],
  medical_center: ['health', 'מרכז רפואי'], veterinarian: ['health', 'וטרינר'], optometrist: ['health', 'אופטיקה'],
  naturopathic_holistic: ['health', 'רפואה משלימה'], health_and_medical: ['health', 'בריאות'],
  physical_therapy: ['health', 'פיזיותרפיה'], psychologist: ['health', 'פסיכולוג'],
  gym: ['sport', 'חדר כושר'], yoga_studio: ['sport', 'יוגה'], pilates_studio: ['sport', 'פילאטיס'],
  dance_school: ['sport', 'בית ספר למחול'], martial_arts_club: ['sport', 'אומנויות לחימה'],
  sports_club_and_league: ['sport', 'מועדון ספורט'], topic_concert_venue: ['sport', 'מועדון הופעות'],
  bowling_alley: ['sport', 'באולינג'], escape_game: ['sport', 'חדר בריחה'], swimming_pool: ['sport', 'בריכה'],
  lawyer: ['services', 'משרד עורכי דין'], legal_services: ['services', 'שירותים משפטיים'],
  divorce_and_family_law: ['services', 'עורך דין'], notary: ['services', 'נוטריון'],
  real_estate: ['services', 'נדל״ן'], real_estate_agent: ['services', 'תיווך נדל״ן'],
  insurance_agency: ['services', 'ביטוח'], financial_service: ['services', 'פיננסים'],
  accountant: ['services', 'רואה חשבון'], bank_credit_union: ['services', 'בנק'],
  professional_services: ['services', 'שירותים מקצועיים'], event_planning: ['services', 'הפקת אירועים'],
  printing_services: ['services', 'הדפסות'], it_service_and_computer_repair: ['services', 'מחשבים ותיקונים'],
  software_development: ['services', 'הייטק'], music_production: ['services', 'הפקת מוזיקה'],
  corporate_office: ['services', 'משרדים'], preschool: ['services', 'גן ילדים'], education: ['services', 'חינוך והדרכה'],
  pet_groomer: ['services', 'טיפוח חיות'], hotel: ['services', 'מלון'], travel_agency: ['services', 'סוכנות נסיעות'],
  car_repair: ['services', 'מוסך'], car_wash: ['services', 'שטיפת רכב'], driving_school: ['services', 'בית ספר לנהיגה'],
  laundry: ['services', 'מכבסה'], locksmith: ['services', 'מנעולן'], photographer: ['services', 'צלם'],
};
// coarse fallback by basic_category
const OV_BASIC = {
  restaurant: 'food', casual_eatery: 'food', food_truck: 'food',
  coffee_shop: 'cafe', cafe: 'cafe', bakery_and_dessert_store: 'cafe',
  bar: 'bar', night_club: 'bar',
  food_and_beverage_store: 'groc',
  fashion_and_apparel_store: 'shop', electronics_store: 'shop', hardware_home_and_garden_store: 'shop',
  flowers_and_gifts_store: 'shop', general_merchandise_store: 'shop', speciality_retail_store: 'shop',
  personal_care_and_beauty_store: 'beauty', personal_or_beauty_service: 'beauty',
  pharmacy_and_drug_store: 'health', dental_clinic: 'health', behavioral_or_mental_health_clinic: 'health',
  complementary_and_alternative_medicine: 'health', medical_clinic_and_practice: 'health',
  sport_or_fitness_facility: 'sport', fitness_studio: 'sport', gym: 'sport',
  attorney_or_law_firm: 'services', financial_service: 'services', real_estate_service: 'services',
  professional_service: 'services', home_service: 'services', event_or_party_service: 'services',
  technical_service: 'services', manufacturer: 'services', preschool: 'services',
  corporate_or_business_office: 'services', automotive_service: 'services', design_service: 'services',
  media_service: 'services', animal_or_pet_service: 'services', specialty_school: 'services',
  place_of_learning: 'services', insurance_service: 'services', lodging: 'services',
};
const OV_EXCLUDE = new Set([
  'hospital', 'park', 'college_university', 'campus_building', 'school', 'elementary_school', 'high_school',
  'community_services_non_profits', 'social_service_organizations', 'public_and_government_association',
  'embassy', 'landmark_and_historical_building', 'synagogue', 'religious_organization', 'place_of_worship',
  'community_center', 'library', 'government_office', 'social_or_community_service', 'active_life',
  'public_service_and_government', 'arts_and_entertainment', 'topic_local_and_community',
]);

function loadOverture() {
  const envFile = process.env.OVERTURE_FILE;
  const cached = path.join(process.cwd(), 'overture-places.geojson');
  let file = envFile && fs.existsSync(envFile) ? envFile : fs.existsSync(cached) ? cached : null;
  if (!file) {
    console.log('downloading Overture places…');
    const r = spawnSync('overturemaps', ['download', '--bbox=' + BBOX, '-f', 'geojson', '--type=place', '-o', cached],
      { shell: process.platform === 'win32', stdio: 'inherit', timeout: 900000 });
    if (r.status === 0 && fs.existsSync(cached)) file = cached;
  }
  if (!file) { console.log('::warning:: Overture unavailable — OSM-only build'); return []; }
  const gj = JSON.parse(fs.readFileSync(file, 'utf8'));
  const items = [];
  for (const f of gj.features || []) {
    const p = f.properties || {};
    const name = clean(p.names && p.names.primary);
    if (name.length < 2) continue;
    const conf = p.confidence || 0;
    const leaf = (p.categories && p.categories.primary) || '';
    const basic = p.basic_category || '';
    if (OV_EXCLUDE.has(leaf) || OV_EXCLUDE.has(basic)) continue;
    let cat = null, sub = '';
    if (OV_LEAF[leaf]) { cat = OV_LEAF[leaf][0]; sub = OV_LEAF[leaf][1]; }
    else if (OV_BASIC[basic]) cat = OV_BASIC[basic];
    if (!cat) continue; // unmapped/unknown → noise, skip
    const [lon, lat] = f.geometry.coordinates;
    const x = PX(lon), y = PY(lat);
    if (!inCity(x, y)) continue;
    const it = { id: 'o' + String(p.id || '').replace(/-/g, '').slice(0, 16), name: name.slice(0, 60), cat, sub, x, y, conf, src: 'ov' };
    const phone = (p.phones || [])[0];
    if (phone) it.phone = String(phone).slice(0, 20);
    const web = (p.websites || [])[0];
    if (web && /^https?:\/\//.test(web)) it.web = web.slice(0, 160);
    for (const s of p.socials || []) {
      const ig = /instagram\.com\/([\w.]+)/.exec(s || '');
      const fb = /facebook\.com\/([\w.\-]+)/.exec(s || '');
      if (ig && !it.ig) it.ig = ig[1].slice(0, 40);
      if (fb && !it.fb) it.fb = fb[1].slice(0, 40);
    }
    const ad = (p.addresses || [])[0];
    if (ad && ad.freeform) it.addr = clean(ad.freeform).slice(0, 60);
    items.push(it);
  }
  console.log('✓ Overture', items.length, 'mapped places in-city (all confidence bands)');
  return items;
}

/* ============================ merge ============================ */
const heb = s => /[א-ת]/.test(s);
const STOP = new Set(['בעמ', 'בע"מ', 'בע״מ', 'סניף', 'רמת', 'גן', 'ramat', 'gan', 'israel', 'ישראל', 'the', 'ltd', 'סטודיו', 'studio', 'מסעדת', 'חנות']);
function tokens(name) {
  return new Set(String(name).toLowerCase()
    .replace(/["'`’׳״().,\-–־&|]/g, ' ').split(/\s+/)
    .filter(w => w.length >= 2 && !STOP.has(w)));
}
function nameMatch(a, b) {
  let inter = 0;
  for (const t of a) if (b.has(t) && t.length >= 2) inter++;
  if (!inter) return false;
  const minSize = Math.min(a.size, b.size);
  return inter >= 2 || minSize <= 2 || inter / minSize >= 0.5;
}

async function main() {
  const [osmRaw, ovAll] = [await fetchOSM(), loadOverture()];
  const osmItems = osmRaw ? processOSM(osmRaw) : [];
  console.log('OSM in-city:', osmItems.length);
  // low-confidence Overture records are negative evidence: "this place likely no longer exists"
  const ovGone = ovAll.filter(it => it.conf < CLOSED_CONFIDENCE);
  const ovItems = ovAll.filter(it => it.conf >= MIN_CONFIDENCE);
  console.log('Overture: alive ≥' + MIN_CONFIDENCE + ':', ovItems.length, '· closure-evidence <' + CLOSED_CONFIDENCE + ':', ovGone.length);
  if (!osmItems.length && !ovItems.length) throw new Error('both sources empty — keeping existing biz.js');

  // Overture-internal dedupe (duplicate FB pages): same tokens within 60m → keep top confidence
  ovItems.sort((a, b) => b.conf - a.conf);
  const kept = [];
  for (const it of ovItems) {
    it.tk = tokens(it.name);
    let dup = false;
    for (const k of kept) {
      if (Math.abs(k.x - it.x) < 600 && Math.abs(k.y - it.y) < 600 && nameMatch(it.tk, k.tk)) { dup = true; break; }
    }
    if (!dup) kept.push(it);
  }
  console.log('Overture after dedupe:', kept.length, '(dropped', ovItems.length - kept.length, 'duplicate pages)');

  // match Overture ↔ OSM (grid index over OSM, 120m radius)
  const grid = new Map();
  const GK = (x, y) => (x >> 10) + ':' + (y >> 10); // ~102m cells (dm)
  osmItems.forEach(it => { it.tk = tokens(it.name); const k = GK(it.x, it.y); (grid.get(k) || grid.set(k, []).get(k)).push(it); });
  let merged = 0, closed = 0;
  const out = [];
  for (const ov of kept) {
    let hit = null;
    outer: for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const os of grid.get(((ov.x >> 10) + dx) + ':' + ((ov.y >> 10) + dy)) || []) {
        if (os.used) continue;
        const d = Math.hypot(os.x - ov.x, os.y - ov.y);
        if (d <= 1200 && nameMatch(ov.tk, os.tk)) { hit = os; break outer; }
      }
    }
    if (hit) {
      hit.used = true;
      merged++;
      out.push({
        id: hit.id, x: hit.x, y: hit.y, // OSM position is surveyed
        name: heb(hit.name) ? hit.name : heb(ov.name) ? ov.name : hit.name,
        cat: hit.cat, sub: hit.sub || ov.sub, cuisine: hit.cuisine,
        addr: hit.addr || ov.addr, phone: hit.phone || ov.phone,
        web: hit.web || ov.web, ig: hit.ig || ov.ig, fb: hit.fb || ov.fb,
        hours: hit.hours, wa: hit.wa,
      });
    } else out.push(ov);
  }
  // community-only entries stay — unless Meta's data says the same place is likely gone
  for (const gone of ovGone) gone.tk = tokens(gone.name);
  for (const os of osmItems) {
    if (os.used) continue;
    const isGone = ovGone.some(g => Math.hypot(g.x - os.x, g.y - os.y) <= 800 && nameMatch(g.tk, os.tk));
    if (isGone) { closed++; continue; }
    out.push(os);
  }
  console.log('merged pairs:', merged, '· OSM dropped as likely-closed:', closed, '· total:', out.length);

  // ---- serialize ----
  const items = out.map(it => {
    const extra = {};
    if (it.sub) extra.s = it.sub;
    if (it.cuisine) extra.c = it.cuisine;
    if (it.addr) extra.a = it.addr;
    if (it.phone) extra.p = it.phone;
    if (it.web) extra.w = it.web;
    if (it.ig) extra.ig = it.ig;
    if (it.fb) extra.fb = it.fb;
    if (it.hours) extra.h = it.hours;
    if (it.wa) extra.wa = 1;
    const rec = [it.id, it.name, CI[it.cat], it.x, it.y];
    if (Object.keys(extra).length) rec.push(extra);
    return rec;
  });
  items.sort((a, b) => a[0] < b[0] ? -1 : 1);
  const byCat = {};
  for (const it of items) byCat[CATS[it[2]].id] = (byCat[CATS[it[2]].id] || 0) + 1;
  console.log(Object.entries(byCat).map(([k, v]) => k + ':' + v).join('  '));
  const outJs = 'window.BIZ=' + JSON.stringify({ cats: CATS, items }) + ';';
  fs.writeFileSync(path.join(ROOT, 'data', 'biz.js'), outJs);
  console.log('data/biz.js:', (outJs.length / 1024).toFixed(0), 'KB ·', items.length, 'businesses');
}
await main();

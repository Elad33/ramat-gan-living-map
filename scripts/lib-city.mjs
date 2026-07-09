// Shared city-config loader: every pipeline script and the builder read the
// same cities/<slug>.json, selected by the CITY env var (default: ramat-gan).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadCity(slugArg) {
  const slug = slugArg || process.env.CITY || 'ramat-gan';
  const file = path.join(ROOT, 'cities', slug + '.json');
  if (!fs.existsSync(file)) throw new Error('unknown city "' + slug + '" — expected ' + file);
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  cfg.slug = slug;
  cfg.configPath = file;
  // ramat-gan keeps the historical layout (data/ + repo root) so the existing
  // GitHub Actions, URLs and Vercel project keep working untouched
  cfg.isDefault = slug === 'ramat-gan';
  cfg.dataDir = cfg.isDefault ? path.join(ROOT, 'data') : path.join(ROOT, 'cities', slug, 'data');
  cfg.outDir = cfg.isDefault ? ROOT : path.join(ROOT, 'cities', slug);
  cfg.ua = 'city-living-map/1.0 (+https://github.com/Elad33/ramat-gan-living-map; ' + slug + ' data refresh)';
  return cfg;
}

export function saveCityBbox(cfg, bbox) {
  const raw = JSON.parse(fs.readFileSync(cfg.configPath, 'utf8'));
  raw.bbox = bbox;
  fs.writeFileSync(cfg.configPath, JSON.stringify(raw, null, 2) + '\n');
  cfg.bbox = bbox;
}

// Render an Overpass query template: {{CITY}} + bbox placeholders
// ({{S}},{{W}},{{N}},{{E}} and midpoints {{LATM}},{{LONM}} for the building quadrants).
export function renderQuery(cfg, queryFile) {
  const q = fs.readFileSync(path.join(ROOT, 'scripts', 'queries', queryFile), 'utf8');
  const b = cfg.bbox;
  if (/\{\{[SWNE]|\{\{L(AT|ON)M/.test(q) && !b) throw new Error(queryFile + ' needs a bbox — run new-city first to derive one');
  return q
    .replaceAll('{{CITY}}', cfg.osmAreaName)
    .replaceAll('{{S}}', b ? b.s : '').replaceAll('{{W}}', b ? b.w : '')
    .replaceAll('{{N}}', b ? b.n : '').replaceAll('{{E}}', b ? b.e : '')
    .replaceAll('{{LATM}}', b ? (b.s + b.n) / 2 : '')
    .replaceAll('{{LONM}}', b ? (b.w + b.e) / 2 : '');
}

export const bboxString = cfg => [cfg.bbox.w, cfg.bbox.s, cfg.bbox.e, cfg.bbox.n].join(','); // lon,lat order (iplan/overture)

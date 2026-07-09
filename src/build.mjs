// Build the deployable single-file site for a city: src + cities/<slug> data -> output.
// Run from src/:  node build.mjs          (ramat-gan, historical repo-root layout)
//                 CITY=givatayim node build.mjs   (self-contained cities/givatayim/)
import fs from 'fs';
import path from 'path';
import { loadCity, ROOT } from '../scripts/lib-city.mjs';

const cfg = loadCity();
const D = cfg.dataDir, OUT = cfg.outDir;

// safe subset of the city config exposed to the client
const clientCfg = {
  slug: cfg.slug,
  nameHe: cfg.nameHe,
  title: cfg.brand.title,
  deployUrl: cfg.deployUrl,
  muni: cfg.muni ? { api: cfg.muni.eventsApi, site: cfg.muni.site } : null,
  contentRawBase: cfg.contentRawBase,
  venueAliases: cfg.venueAliases || {},
  features: cfg.features || {},
};

const brand = s => s
  .split('{{TITLE}}').join(cfg.brand.title)
  .split('{{NAME_HE}}').join(cfg.nameHe)
  .split('{{SUBTITLE}}').join(cfg.brand.subtitle);

const tpl = brand(fs.readFileSync('template.html', 'utf8'));
const fonts = fs.readFileSync(path.join(ROOT, 'data', 'fonts-embedded.css'), 'utf8'); // fonts are shared
// embedded snapshot of the muni events — last-resort fallback when all network paths are blocked
const muniSnapPath = path.join(D, 'muni-events.json');
const muniSnap = fs.existsSync(muniSnapPath)
  ? '\nwindow.MUNI_FALLBACK=' + fs.readFileSync(muniSnapPath, 'utf8').trim() + ';'
  : '';
const biz = fs.existsSync(path.join(D, 'biz.js')) ? '\n' + fs.readFileSync(path.join(D, 'biz.js'), 'utf8') : '';
const data = 'window.CITY_CFG=' + JSON.stringify(clientCfg) + ';\n'
  + fs.readFileSync(path.join(D, 'data.js'), 'utf8') + '\n'
  + fs.readFileSync(path.join(D, 'data2.js'), 'utf8') + biz + muniSnap;
const app = ['app1.js', 'app2.js', 'app3.js', 'app4.js'].map(f => fs.readFileSync(f, 'utf8')).join('\n');

let body = tpl.split('/*__FONTS__*/').join(fonts);
body = body.split('/*__DATA__*/').join(data);
body = body.split('/*__APP__*/').join(app);

// the artifact host wraps the bare fragment itself; for the web we add a full document
const title = (body.match(/<title>([^<]+)<\/title>/) || [])[1] || cfg.brand.title;
body = body.replace(/<title>[^<]+<\/title>\s*/, '');
const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${title}</title>
<meta name="description" content="מפה תלת־ממדית חיה של ${cfg.nameHe} — כל רחוב, בניין וכתובת. חיפוש כתובות, אירועים, עסקים, תכנון ובנייה ותחבורה ציבורית."/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="מפה תלת־ממדית חיה של ${cfg.nameHe} — חיפוש כתובות, אירועים, עסקים, תכנון ובנייה ותחבורה."/>
<meta property="og:type" content="website"/>
<meta name="theme-color" content="${cfg.themeColor}"/>
<link rel="manifest" href="manifest.webmanifest"/>
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png"/>
<link rel="apple-touch-icon" href="icons/icon-192.png"/>
<meta name="mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
</head>
<body>
${body}
</body>
</html>`;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log('built', path.relative(ROOT, path.join(OUT, 'index.html')) + ':', (html.length / 1048576).toFixed(2), 'MB');

if (cfg.isDefault) {
  // bare fragment for the claude.ai artifact (host adds the document shell)
  fs.writeFileSync(path.join(OUT, 'dist-artifact.html'), tpl
    .split('/*__FONTS__*/').join(fonts)
    .split('/*__DATA__*/').join(data)
    .split('/*__APP__*/').join(app));
  console.log('built dist-artifact.html');
} else {
  // self-contained deployable folder: manifest, sw, icons, api, vercel.json
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  manifest.name = cfg.brand.title;
  manifest.short_name = cfg.nameHe;
  manifest.description = 'מפה תלת־ממדית חיה של ' + cfg.nameHe;
  manifest.theme_color = cfg.themeColor;
  fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
  fs.copyFileSync(path.join(ROOT, 'sw.js'), path.join(OUT, 'sw.js'));
  fs.cpSync(path.join(ROOT, 'icons'), path.join(OUT, 'icons'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'api'), path.join(OUT, 'api'), { recursive: true });
  if (fs.existsSync(path.join(ROOT, 'vercel.json')))
    fs.copyFileSync(path.join(ROOT, 'vercel.json'), path.join(OUT, 'vercel.json'));
  console.log('packaged deployable folder:', path.relative(ROOT, OUT));
}

// CMS admin page — only for cities that enable it (GitHub-token flow, staff-internal)
if ((cfg.features || {}).admin) {
  let adminBody = brand(fs.readFileSync('admin-template.html', 'utf8')).split('/*__FONTS__*/').join(fonts);
  const adminTitle = (adminBody.match(/<title>([^<]+)<\/title>/) || [])[1] || 'מערכת ניהול';
  adminBody = adminBody.replace(/<title>[^<]+<\/title>\s*/, '');
  fs.writeFileSync(path.join(OUT, 'admin.html'), `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${adminTitle}</title>
<meta name="robots" content="noindex"/>
</head>
<body>
${adminBody}
</body>
</html>`);
  console.log('built admin.html');
}

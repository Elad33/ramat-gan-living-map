// Build the deployable single-file site: src + data -> ../index.html
// Run from src/:  node build.mjs
import fs from 'fs';

const tpl = fs.readFileSync('template.html', 'utf8');
const fonts = fs.readFileSync('../data/fonts-embedded.css', 'utf8');
const data = fs.readFileSync('../data/data.js', 'utf8') + '\n' + fs.readFileSync('../data/data2.js', 'utf8');
const app = ['app1.js', 'app2.js', 'app3.js'].map(f => fs.readFileSync(f, 'utf8')).join('\n');

let body = tpl.split('/*__FONTS__*/').join(fonts);
body = body.split('/*__DATA__*/').join(data);
body = body.split('/*__APP__*/').join(app);

// the artifact host wraps the bare fragment itself; for the web we add a full document
const title = (body.match(/<title>([^<]+)<\/title>/) || [])[1] || 'רמת גן · המפה החיה';
body = body.replace(/<title>[^<]+<\/title>\s*/, '');
const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${title}</title>
<meta name="description" content="מפה תלת־ממדית חיה של רמת גן — כל רחוב, בניין וכתובת. חיפוש כתובות, אירועים עירוניים, תוכניות בנייה ותחבורה ציבורית."/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="מפה תלת־ממדית חיה של רמת גן — חיפוש כתובות, אירועים, תכנון ובנייה ותחבורה."/>
<meta property="og:type" content="website"/>
<meta name="theme-color" content="#070b16"/>
</head>
<body>
${body}
</body>
</html>`;
fs.writeFileSync('../index.html', html);
console.log('built ../index.html:', (html.length / 1048576).toFixed(2), 'MB');

// bare fragment for the claude.ai artifact (host adds the document shell)
fs.writeFileSync('../dist-artifact.html', fs.readFileSync('template.html', 'utf8')
  .split('/*__FONTS__*/').join(fonts)
  .split('/*__DATA__*/').join(data)
  .split('/*__APP__*/').join(app));
console.log('built ../dist-artifact.html');

// CMS admin page
let adminBody = fs.readFileSync('admin-template.html', 'utf8').split('/*__FONTS__*/').join(fonts);
const adminTitle = (adminBody.match(/<title>([^<]+)<\/title>/) || [])[1] || 'מערכת ניהול';
adminBody = adminBody.replace(/<title>[^<]+<\/title>\s*/, '');
fs.writeFileSync('../admin.html', `<!doctype html>
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
console.log('built ../admin.html');

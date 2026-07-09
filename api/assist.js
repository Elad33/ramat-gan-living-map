// AI assistant: turns a free-text Hebrew request into a structured intent that
// the map executes client-side (over the businesses + events it already holds).
// The LLM does language understanding only — it never invents businesses.
//
// Model: Google Gemini free tier (strong Hebrew, zero cost). GET + CDN caching
// means repeated questions ("פיצה", "מה קורה הערב") don't spend quota at all.
// Without GEMINI_API_KEY the endpoint reports not_configured and the map falls
// back to its built-in Hebrew matcher, so the feature keeps working.

const BIZ_CATS = ['food', 'cafe', 'bar', 'groc', 'shop', 'beauty', 'health', 'sport', 'services'];
const EV_CATS = ['city', 'culture', 'sport', 'community', 'poi'];

const CITY_NAME = process.env.CITY_NAME || 'רמת גן';
const SYSTEM = `אתה מנוע הכוונות של "${CITY_NAME} · המפה החיה" — מפת עיר שמציגה עסקים ואירועים.
המשתמש כותב בחופשיות מה בא לו לעשות או מה הוא מחפש, ואתה מחזיר JSON בלבד שממפה את הבקשה.

קטגוריות עסקים (bizCats): food=מסעדות ואוכל, cafe=בתי קפה וקינוחים, bar=ברים ופאבים וחיי לילה, groc=סופרמרקט ומכולת וקניות מזון, shop=חנויות וקניות (אופנה, מתנות, ספרים...), beauty=מספרות ויופי וטיפוח, health=בתי מרקחת ומרפאות ובריאות, sport=חדרי כושר וספורט ופנאי (גם קולנוע וחדרי בריחה), services=בנקים ודואר ומוסכים ושירותים מקצועיים.
קטגוריות אירועים (evCats): city=אירועים עירוניים ופסטיבלים, culture=תרבות והופעות והצגות, sport=ספורט, community=קהילה ומשפחה וילדים, poi=סיורים ונקודות עניין.

כללים:
- kinds: "biz" אם מחפשים עסק/מקום/שירות, "event" אם מחפשים מה קורה/אירוע/הופעה. אם לא ברור או שניהם מתאימים — כלול את שניהם.
- bizCats/evCats: רק קטגוריות שרלוונטיות באמת. עדיף מעט ומדויק.
- keywords: מילים בעברית שיותאמו לשמות עסקים וסוגי מטבח ותחומים, ביחיד ובלי מילות יחס (למשל "פיצה", "סושי", "כלבים", "מניקור"). אל תכלול מילים כלליות כמו "מקום", "משהו", "טוב".
- when: "today"/"tomorrow"/"weekend"/"week" רק אם צוין זמן, אחרת "any". "הערב"/"עכשיו" = today.
- openNow: true רק אם ביקשו משהו שפתוח עכשיו/כרגע.
- reply: משפט אחד חם וטבעי בעברית שמציג את מה שהמפה עומדת להראות. בלי להמציא שמות עסקים, בלי אימוג'י מוגזם (עד אחד), בלי לחזור על השאלה.

דוגמאות:
"בא לי פיצה" → {"kinds":["biz"],"bizCats":["food"],"keywords":["פיצה"],"when":"any","openNow":false,"reply":"הנה מקומות הפיצה שמצאתי סביבך 🍕"}
"מה קורה הערב בעיר?" → {"kinds":["event"],"evCats":[],"keywords":[],"when":"today","openNow":false,"reply":"אלה האירועים שקורים היום בעיר"}
"איפה אפשר להסתפר ולעשות ציפורניים" → {"kinds":["biz"],"bizCats":["beauty"],"keywords":["מספרה","ציפורניים","מניקור"],"when":"any","openNow":false,"reply":"ריכזתי בשבילך את מקומות היופי והטיפוח באזור"}`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    kinds: { type: 'ARRAY', items: { type: 'STRING', enum: ['biz', 'event'] } },
    bizCats: { type: 'ARRAY', items: { type: 'STRING', enum: BIZ_CATS } },
    evCats: { type: 'ARRAY', items: { type: 'STRING', enum: EV_CATS } },
    keywords: { type: 'ARRAY', items: { type: 'STRING' } },
    when: { type: 'STRING', enum: ['today', 'tomorrow', 'weekend', 'week', 'any'] },
    openNow: { type: 'BOOLEAN' },
    reply: { type: 'STRING' },
  },
  required: ['kinds', 'reply'],
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ ok: false, error: 'method' }); return; }

  const q = String((req.query && req.query.q) || '').trim().slice(0, 140);
  if (q.length < 2) { res.status(400).json({ ok: false, error: 'empty' }); return; }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    res.status(200).json({ ok: false, error: 'not_configured' });
    return;
  }

  // free-tier reality (verified): the 2.0 family has no quota on new keys (429),
  // and flash-lite occasionally 503s under demand spikes — so: lite → flash, with one retry on 503.
  const models = [process.env.GEMINI_MODEL, 'gemini-2.5-flash-lite', 'gemini-2.5-flash'].filter(Boolean);
  const attempts = [];
  for (const model of models) { attempts.push(model, model); } // each model gets one retry
  let lastWas503 = false;
  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    const isRetry = i % 2 === 1;
    if (isRetry && !lastWas503) continue; // retry only makes sense after a demand spike
    try {
      if (isRetry) await new Promise(r => setTimeout(r, 700));
      lastWas503 = false;
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: 'user', parts: [{ text: q }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: SCHEMA,
              temperature: 0.2,
              maxOutputTokens: 1000,
            },
          }),
          signal: AbortSignal.timeout(6500),
        }
      );
      if (!r.ok) { lastWas503 = r.status === 503; throw new Error('gemini ' + r.status); }
      const data = await r.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const intent = JSON.parse(text);
      // clamp everything the client will trust
      const out = {
        kinds: (intent.kinds || []).filter(k => k === 'biz' || k === 'event').slice(0, 2),
        bizCats: (intent.bizCats || []).filter(c => BIZ_CATS.includes(c)).slice(0, 4),
        evCats: (intent.evCats || []).filter(c => EV_CATS.includes(c)).slice(0, 4),
        keywords: (intent.keywords || []).map(s => String(s).slice(0, 30)).slice(0, 6),
        when: ['today', 'tomorrow', 'weekend', 'week'].includes(intent.when) ? intent.when : 'any',
        openNow: !!intent.openNow || /פתוח/.test(q),
        reply: String(intent.reply || '').slice(0, 220),
      };
      if (!out.kinds.length) out.kinds = ['biz', 'event'];
      // identical questions are served from the CDN for 6h — the free quota lasts
      res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
      res.status(200).json({ ok: true, source: 'ai', intent: out });
      return;
    } catch (e) { /* try next attempt/model, then fall through */ }
  }
  res.setHeader('Cache-Control', 'no-store'); // never pin a bad moment to the CDN
  res.status(200).json({ ok: false, error: 'ai_unavailable' });
};

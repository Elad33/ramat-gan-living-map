// Fetch statutory plans from the Israel Planning Administration (iplan) ArcGIS.
// Run inside a work dir: node ../scripts/fetch-plans.mjs
import fs from 'fs';

const BASE = 'https://ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic/Xplan/MapServer/1/query';
const BBOX = '34.7991,32.0361,34.8546,32.1056'; // Ramat Gan municipal bbox
const FIELDS = 'pl_number,pl_name,plan_county_name,jurstiction_area_name,internet_short_status,station_desc,last_update_date,pl_date_8,pl_area_dunam,quantity_delta_120,pq_authorised_quantity_120,entity_subtype_desc,pl_url,pl_objectives';

async function page(offset) {
  const params = new URLSearchParams({
    geometry: BBOX, geometryType: 'esriGeometryEnvelope', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', where: '1=1',
    outFields: FIELDS, returnGeometry: 'true', outSR: '4326', geometryPrecision: '6',
    resultOffset: String(offset), resultRecordCount: '1000', f: 'json',
  });
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'ramat-gan-living-map/1.0 (+https://github.com/Elad33/ramat-gan-living-map)',
        },
        body: params.toString(),
        signal: AbortSignal.timeout(120000),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (data.error) throw new Error(JSON.stringify(data.error).slice(0, 120));
      return data;
    } catch (e) {
      console.log('…retry plans offset', offset, 'attempt', attempt + 1, String(e.message).slice(0, 80));
      await new Promise(res => setTimeout(res, 12000));
    }
  }
  throw new Error('failed plans offset ' + offset);
}

let offset = 0;
while (true) {
  const data = await page(offset);
  fs.writeFileSync('plans_' + offset + '.json', JSON.stringify(data));
  const n = (data.features || []).length;
  console.log('✓ plans offset', offset, '-', n, 'features');
  if (!data.exceededTransferLimit || n === 0) break;
  offset += 1000;
  if (offset > 5000) break; // safety
}
console.log('plans fetch complete');

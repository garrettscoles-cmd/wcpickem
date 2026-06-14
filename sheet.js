export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const SHEET_ID = "1nErqlCbUn6xwbujNim_kSrdAvpJbMUVGRGjTO_dxMRY";
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Data`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Sheet fetch failed: ${response.status}`);
    const csv = await response.text();
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
    res.status(200).send(csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

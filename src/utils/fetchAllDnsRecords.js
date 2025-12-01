export default async function fetchAllDnsRecords(zoneId, apiToken) {
  let page = 1;
  const perPage = 100;
  let all = [];

  while (true) {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?page=${page}&per_page=${perPage}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Error al obtener DNS: ${res.status}`);
    }

    const data = await res.json();
    all = all.concat(data.result || []);

    const info = data.result_info;
    if (!info || page >= info.total_pages) break;

    page++;
  }

  return all;
}

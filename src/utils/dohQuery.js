export default async function dohQuery(name, type) {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    { headers: { Accept: "application/dns-json" } }
  );

  if (!res.ok) {
    throw new Error(`DoH error ${name} type ${type}: HTTP ${res.status}`);
  }

  const data = await res.json();

  return (data.Answer || [])
    .filter((a) => a.type === type)
    .map((a) => a.data)
    .sort();
}
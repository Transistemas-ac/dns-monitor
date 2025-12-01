export default function normalizeRecords(records) {
  const mapped = records.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    ttl: r.ttl,
    proxied: !!r.proxied,
  }));

  mapped.sort((a, b) => {
    const ka = `${a.name}|${a.type}|${a.content}`;
    const kb = `${b.name}|${b.type}|${b.content}`;
    return ka.localeCompare(kb);
  });

  return mapped;
}

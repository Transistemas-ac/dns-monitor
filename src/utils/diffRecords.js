export default function diffRecords(previous, current) {
  const prevMap = new Map(previous.map((r) => [r.id, r]));
  const currMap = new Map(current.map((r) => [r.id, r]));

  const created = [];
  const deleted = [];
  const updated = [];

  for (const r of current) {
    if (!prevMap.has(r.id)) {
      created.push(r);
    } else {
      const p = prevMap.get(r.id);
      if (
        p.type !== r.type ||
        p.name !== r.name ||
        p.content !== r.content ||
        p.ttl !== r.ttl ||
        p.proxied !== r.proxied
      ) {
        updated.push({ before: p, after: r });
      }
    }
  }

  for (const p of previous) {
    if (!currMap.has(p.id)) {
      deleted.push(p);
    }
  }

  return {
    created,
    deleted,
    updated,
    hasChanges: created.length > 0 || deleted.length > 0 || updated.length > 0,
  };
}

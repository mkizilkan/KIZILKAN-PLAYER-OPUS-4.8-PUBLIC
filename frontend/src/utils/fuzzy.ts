/**
 * Lightweight fuzzy search utility for KIZILKAN PLAYER.
 * Turkish-aware: normalizes accented chars and common substitutions.
 * No external dependencies.
 */

const TR_MAP: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g",
  ı: "i", İ: "i", ö: "o", Ö: "o",
  ş: "s", Ş: "s", ü: "u", Ü: "u",
};

export function normalize(input: string): string {
  if (!input) return "";
  let s = "";
  for (const ch of input) {
    s += TR_MAP[ch] ?? ch;
  }
  return s
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Character-order preserving fuzzy match — returns score 0..1.
 * All query characters must appear in order in target; consecutive matches
 * score higher. Also considers substring boost.
 */
export function fuzzyScore(target: string, query: string): number {
  const t = normalize(target);
  const q = normalize(query);
  if (!q) return 0;
  if (!t) return 0;
  if (t === q) return 1;
  if (t.startsWith(q)) return 0.95;
  if (t.includes(q)) return 0.85;

  let ti = 0;
  let qi = 0;
  let streak = 0;
  let maxStreak = 0;
  let matched = 0;
  while (ti < t.length && qi < q.length) {
    if (t[ti] === q[qi]) {
      matched++;
      streak++;
      if (streak > maxStreak) maxStreak = streak;
      qi++;
    } else {
      streak = 0;
    }
    ti++;
  }
  if (qi < q.length) return 0;
  const cover = matched / t.length;
  const density = maxStreak / q.length;
  return 0.35 + 0.35 * density + 0.30 * cover; // 0.35..1
}

export interface FuzzyResult<T> {
  item: T;
  score: number;
}

/**
 * Search items with a query, ordered by relevance.
 * `keys` extractor returns strings to search in (name, group, cast etc).
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  keys: (item: T) => (string | null | undefined)[],
  limit = 300,
  threshold = 0.35,
): FuzzyResult<T>[] {
  const q = normalize(query);
  if (!q) return [];
  const out: FuzzyResult<T>[] = [];
  for (const it of items) {
    const fields = keys(it).filter((x): x is string => !!x);
    let best = 0;
    for (const f of fields) {
      const sc = fuzzyScore(f, q);
      if (sc > best) best = sc;
      if (best >= 0.98) break;
    }
    if (best >= threshold) out.push({ item: it, score: best });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}


/**
 * v9.12.0 — ÖN-NORMALİZE ARAMA İNDEKSİ
 * ------------------------------------------------------------
 * Büyük IPTV listelerinde her tuşta aynı metinleri tekrar normalize etmek
 * pahalıydı. Eski "includes() ön elemesi" ise fuzzy aramayı fiilen öldürüyordu.
 * Bu indeks metinleri LİSTE DEĞİŞTİĞİNDE bir kez normalize eder; sorgu anında
 * gerçek fuzzy skoru bütün adaylarda çalışır. Böylece Türkçe toleransı ve
 * eksik/yanlış yazım desteği korunurken tekrar-normalizasyon maliyeti kalkar.
 */
export interface IndexedSearchEntry<T> {
  item: T;
  fields: string[];
}

export function buildSearchIndex<T>(
  items: T[],
  keys: (item: T) => (string | null | undefined)[],
): IndexedSearchEntry<T>[] {
  return items.map(item => ({
    item,
    fields: keys(item).filter((x): x is string => x !== null && x !== undefined && String(x).length > 0).map(x => normalize(String(x))),
  }));
}

function fuzzyScoreNormalized(target: string, query: string): number {
  if (!query || !target) return 0;
  if (target === query) return 1;
  if (target.startsWith(query)) return 0.95;
  if (target.includes(query)) return 0.85;

  let ti = 0;
  let qi = 0;
  let streak = 0;
  let maxStreak = 0;
  let matched = 0;
  while (ti < target.length && qi < query.length) {
    if (target[ti] === query[qi]) {
      matched++;
      streak++;
      if (streak > maxStreak) maxStreak = streak;
      qi++;
    } else {
      streak = 0;
    }
    ti++;
  }
  if (qi < query.length) return 0;
  const cover = matched / target.length;
  const density = maxStreak / query.length;
  return 0.35 + 0.35 * density + 0.30 * cover;
}

export function searchIndexed<T>(
  index: IndexedSearchEntry<T>[],
  query: string,
  limit = 300,
  threshold = 0.35,
): FuzzyResult<T>[] {
  const q = normalize(query);
  if (!q) return [];
  const out: FuzzyResult<T>[] = [];
  for (const entry of index) {
    let best = 0;
    for (const field of entry.fields) {
      const sc = fuzzyScoreNormalized(field, q);
      if (sc > best) best = sc;
      if (best >= 0.98) break;
    }
    if (best >= threshold) out.push({ item: entry.item, score: best });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

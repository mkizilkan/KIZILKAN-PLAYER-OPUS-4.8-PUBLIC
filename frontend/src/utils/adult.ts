const ADULT_WORDS = [
  "+18", "18+", "xxx", "adult", "adults", "erotik", "erotic",
  "porno", "porn", "playboy", "mature", "sex", "seks",
];

type AdultCandidate = {
  name?: unknown; group?: unknown; category?: unknown; genre?: unknown;
  isAdult?: boolean;
};

function norm(v: unknown): string {
  return String(v ?? "")
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._\-|/\\()[\]{}:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectAdult(item: AdultCandidate): boolean {
  const hay = ` ${norm(item.name)} ${norm(item.group)} ${norm(item.category)} ${norm(item.genre)} `;
  return ADULT_WORDS.some((raw) => {
    const word = norm(raw);
    if (!word) return false;
    if (word === "+18" || word === "18+") return hay.includes(word);
    return hay.includes(` ${word} `);
  });
}

/**
 * Toggle anında 50-100 bin öğeyi tekrar metin/regex ile taramamak için sonuç
 * öğenin üstünde saklanır. Yeni playlist yüklenirken prepareAdultFlags bir kez
 * hesaplar; sonraki filtre O(1) boolean okumasıdır.
 */
export function isAdultContent(item: AdultCandidate): boolean {
  if (typeof item?.isAdult === "boolean") return item.isAdult;
  const value = detectAdult(item || {});
  if (item && typeof item === "object") item.isAdult = value;
  return value;
}

export function prepareAdultFlags<T extends AdultCandidate>(items: T[] | undefined | null): T[] {
  const list = items || [];
  for (let i = 0; i < list.length; i += 1) {
    if (typeof list[i]?.isAdult !== "boolean") list[i].isAdult = detectAdult(list[i]);
  }
  return list;
}

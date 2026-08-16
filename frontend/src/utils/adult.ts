const ADULT_WORDS = [
  "+18", "18+", "xxx", "adult", "adults", "erotik", "erotic",
  "porno", "porn", "playboy", "mature", "sex", "seks",
];

function norm(v: unknown): string {
  return String(v ?? "")
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._\-|/\\()[\]{}:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAdultContent(item: {
  name?: unknown;
  group?: unknown;
  category?: unknown;
  genre?: unknown;
}): boolean {
  const hay = ` ${norm(item.name)} ${norm(item.group)} ${norm(item.category)} ${norm(item.genre)} `;
  return ADULT_WORDS.some((raw) => {
    const word = norm(raw);
    if (!word) return false;
    if (word === "+18" || word === "18+") return hay.includes(word);
    return hay.includes(` ${word} `);
  });
}

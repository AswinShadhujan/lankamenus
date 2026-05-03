import { Prisma } from '@prisma/client';

export function escapeSqlLikeSubstring(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 0 = exact (case-insensitive), 1 = name starts with term, 2 = word starts with term,
 * 3 = substring, 4 = no match / matched only via other fields.
 */
export function rankRestaurantNameMeta(
  name: string | null | undefined,
  qRaw: string,
): { tier: number; nameLen: number } {
  const q = qRaw.trim().toLowerCase();
  const n = (name ?? '').trim();
  const nameLen = n.length;
  if (!q) return { tier: 99, nameLen };
  const nl = n.toLowerCase();
  if (nl === q) return { tier: 0, nameLen };
  if (nl.startsWith(q)) return { tier: 1, nameLen };
  if (new RegExp(`(^|[\\s])${escapeRegex(q)}`, 'i').test(n)) return { tier: 2, nameLen };
  if (nl.includes(q)) return { tier: 3, nameLen };
  return { tier: 4, nameLen };
}

/** Sort helper: tier asc, shorter names first, higher rating first. */
export function compareRestaurantNameRank(
  aName: string | null | undefined,
  bName: string | null | undefined,
  q: string,
  aRating: number | string | null | undefined,
  bRating: number | string | null | undefined,
): number {
  const ar = rankRestaurantNameMeta(aName, q);
  const br = rankRestaurantNameMeta(bName, q);
  if (ar.tier !== br.tier) return ar.tier - br.tier;
  if (ar.nameLen !== br.nameLen) return ar.nameLen - br.nameLen;
  const arat =
    aRating != null && Number.isFinite(Number(aRating)) ? Number(aRating) : -Infinity;
  const brat =
    bRating != null && Number.isFinite(Number(bRating)) ? Number(bRating) : -Infinity;
  if (arat !== brat) return brat - arat;
  return String(aName ?? '').localeCompare(String(bName ?? ''));
}

/**
 * SQL scalar tier for one term on a column (`mi.name` or `r.name_default`).
 */
export function pgNameMatchTierSql(columnIdent: Prisma.Sql, term: string): Prisma.Sql {
  const t = term.trim().toLowerCase();
  if (!t) return Prisma.sql`4::int`;
  const esc = escapeSqlLikeSubstring(t);
  const patPrefix = `${esc}%`;
  const patWord = `% ${esc}%`;
  const patSub = `%${esc}%`;
  return Prisma.sql`
    (CASE
      WHEN LOWER(${columnIdent}) = ${t} THEN 0
      WHEN LOWER(${columnIdent}) LIKE ${patPrefix} ESCAPE '\\' THEN 1
      WHEN LOWER(${columnIdent}) LIKE ${patWord} ESCAPE '\\' THEN 2
      WHEN LOWER(${columnIdent}) LIKE ${patSub} ESCAPE '\\' THEN 3
      ELSE 4
    END)::int`;
}

/** Best (min) tier across terms — used for dish category keyword expansion. */
export function pgNameMatchTierLeastSql(columnIdent: Prisma.Sql, terms: string[]): Prisma.Sql {
  const uniq = [...new Set(terms.map((x) => x.trim().toLowerCase()).filter(Boolean))];
  if (uniq.length === 0) return Prisma.sql`4::int`;
  const parts = uniq.map((term) => pgNameMatchTierSql(columnIdent, term));
  return Prisma.sql`LEAST(${Prisma.join(parts, ', ')})`;
}

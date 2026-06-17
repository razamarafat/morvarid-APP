/**
 * 20260619 — Multi-Field Fuzzy Search Helper
 *
 * Universal instant search: callers define an explicit allowlist of
 * "searchable" accessor functions for a row type, and `matchesMultiField`
 * returns true when ANY accessor yields a value whose lower-cased
 * string representation contains the user's lower-cased query. Works
 * equally well for:
 *
 *   - Persian names: "مهر" matches "مهرآباد"
 *   - Numbers: "122" matches phone "09122..." or quantity 122
 *   - Partial fields: id, voucher number, plate, weight, etc.
 *
 * Designed to be plugged into a React useMemo so the filter is
 * automatically re-run only when the row list, the search query, or
 * the accessor array changes.
 *
 * NB: Per-accessor allowlist is intentional — naive `Object.values(item)`
 * would happily leak PII (creator ids, auth tokens if ever added, etc.)
 * into the search index. The allowlist makes the searchable surface
 * explicit and audit-friendly.
 */

export type SearchAccessor<T> = (
  item: T
) => string | number | null | undefined;

/**
 * Returns true when ANY of the accessors on the item yields a value
 * whose lower-cased string contains the (already trimmed + lower-cased)
 * query. An empty query matches every row (so consumers don't have to
 * special-case "no search active").
 */
export function matchesMultiField<T>(
  item: T,
  accessors: ReadonlyArray<SearchAccessor<T>>,
  query: string
): boolean {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return true;

  for (let i = 0; i < accessors.length; i++) {
    const raw = accessors[i](item);
    if (raw === null || raw === undefined) continue;
    const value = String(raw).toLowerCase();
    if (value && value.includes(q)) return true;
  }
  return false;
}

/**
 * Convenience: filter an array of items in one call.
 *
 *   const filtered = useMemo(
 *     () => searchMultiField(invoices, accessorArr, searchTerm),
 *     [invoices, accessorArr, searchTerm]
 *   );
 */
export function searchMultiField<T>(
  items: ReadonlyArray<T>,
  accessors: ReadonlyArray<SearchAccessor<T>>,
  query: string
): T[] {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return items.slice();
  return items.filter((item) => matchesMultiField(item, accessors, q));
}

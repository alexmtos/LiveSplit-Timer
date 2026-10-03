import type { RunMetadata } from '@/types';

/**
 * The extra details LiveSplit's Title component can add to the category
 * ("additional info"): the variable values, the region and the platform, with
 * "Emulator" when the run uses one. Component 2.x sends the names from the
 * splits file; `fetched` are the region and platform names looked up on
 * speedrun.com for older versions, which only send their IDs.
 */
export function categoryExtras(
  meta: RunMetadata,
  fetched: { region: string | null; platform: string | null },
  emulatorLabel: string,
): string[] {
  const values = Object.keys(meta.variableNames).length > 0 ? meta.variableNames : meta.variables;
  const extras = Object.values(values).filter((value) => value.trim() !== '');
  const region = meta.regionName ?? fetched.region;
  const platform = meta.platformName ?? fetched.platform;
  if (region) extras.push(region);
  if (platform) extras.push(meta.emulator ? `${platform} ${emulatorLabel}` : platform);
  else if (meta.emulator) extras.push(emulatorLabel);
  return extras;
}

/**
 * The category with its extras, the way LiveSplit's `GetExtendedCategoryName`
 * writes it: "Any% (Glitchless, NTSC, N64)". Text already in parentheses in the
 * category name joins the extras, and anything after it stays at the end.
 */
export function extendedCategoryName(categoryName: string, extras: readonly string[]): string {
  let name = categoryName.trim();
  let after = '';
  const parts: string[] = [];
  const open = name.indexOf('(');
  const close = open >= 0 ? name.indexOf(')', open + 1) : -1;
  if (open >= 0 && close >= 0) {
    const inside = name.slice(open + 1, close).trim();
    after = name.slice(close + 1).trim();
    name = name.slice(0, open).trim();
    if (inside) parts.push(inside);
  }
  for (const extra of extras) if (!parts.includes(extra)) parts.push(extra);
  return [name, parts.length > 0 ? `(${parts.join(', ')})` : '', after].filter(Boolean).join(' ');
}

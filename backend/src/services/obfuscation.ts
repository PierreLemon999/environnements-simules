/**
 * Obfuscation service - applies search/replace rules to HTML content.
 * Supports both plain text and regex-based replacements.
 */

export interface ObfuscationRule {
  id: string;
  searchTerm: string;
  replaceTerm: string;
  isRegex: number; // 0 = false, 1 = true (SQLite boolean)
  isActive: number;
}

/**
 * Applies all active obfuscation rules to the given HTML string.
 * Rules are applied sequentially in the order provided.
 */
export function applyObfuscation(html: string, rules: ObfuscationRule[]): string {
  let result = html;

  for (const rule of rules) {
    // Skip inactive rules
    if (!rule.isActive) continue;

    try {
      if (rule.isRegex) {
        const regex = new RegExp(rule.searchTerm, 'g');
        result = result.replace(regex, rule.replaceTerm);
      } else {
        // Plain text replacement - escape special regex chars and use global flag
        const escaped = rule.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'g');
        result = result.replace(regex, rule.replaceTerm);
      }
    } catch (error) {
      // If a regex is invalid, skip it and log the error
      console.error(`Invalid obfuscation rule "${rule.searchTerm}":`, error);
    }
  }

  return result;
}

/**
 * Previews the effect of obfuscation rules on a sample HTML string.
 * Returns both the original and the obfuscated result.
 */
export function previewObfuscation(
  sampleHtml: string,
  rules: ObfuscationRule[]
): { original: string; obfuscated: string; changesCount: number } {
  const obfuscated = applyObfuscation(sampleHtml, rules);

  // Count the number of differences (approximate by counting replacements)
  let changesCount = 0;
  for (const rule of rules) {
    if (!rule.isActive) continue;
    try {
      const regex = rule.isRegex
        ? new RegExp(rule.searchTerm, 'g')
        : new RegExp(rule.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const matches = sampleHtml.match(regex);
      if (matches) changesCount += matches.length;
    } catch {
      // Skip invalid regex
    }
  }

  return { original: sampleHtml, obfuscated, changesCount };
}

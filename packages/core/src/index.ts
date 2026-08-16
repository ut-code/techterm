import termsData from './data/terms.json';
import { Dictionary } from './dictionary';
import type { TermEntry } from './types';

export { Dictionary } from './dictionary';
export { normalize, tighten, tokenize } from './normalize';
export { toMarkdown } from './render';
export type { LookupOptions, Match, TermEntry } from './types';

/** 同梱辞書の生データ。ユーザー辞書とマージするときに使う。 */
export const builtinTerms: readonly TermEntry[] = termsData as TermEntry[];

/** 同梱辞書だけで作った既定の Dictionary。 */
export const builtinDictionary = new Dictionary(builtinTerms);

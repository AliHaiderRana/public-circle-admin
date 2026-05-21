import mongoose from 'mongoose';
import {
  DEFAULT_UI_TERMS,
  UI_TERM_KEYS,
  UI_LOCALES,
} from '@/lib/ui-term-constants';

export { DEFAULT_UI_TERMS, UI_TERM_KEYS, UI_LOCALES };

const LEGACY_COLLECTION = 'ui-term-translations';

async function migrateLegacyTermsIfNeeded() {
  const legacyCol = mongoose.connection.collection(LEGACY_COLLECTION);
  const legacyCount = await legacyCol.countDocuments({ locale: { $exists: true } });
  if (legacyCount === 0) return;

  const UiTerm = (await import('@/lib/models/UiTerm')).default;
  const legacyDocs = await legacyCol.find({ locale: { $exists: true } }).toArray();
  const grouped: Record<string, { label: string; descriptions: Record<string, string> }> =
    {};

  for (const doc of legacyDocs) {
    if (!UI_TERM_KEYS.includes(doc.key as (typeof UI_TERM_KEYS)[number])) continue;
    if (!grouped[doc.key]) {
      grouped[doc.key] = { label: doc.label, descriptions: {} };
    }
    grouped[doc.key].descriptions[doc.locale] = doc.description;
    if (doc.locale === 'en-US') {
      grouped[doc.key].label = doc.label;
    }
  }

  for (const key of Object.keys(grouped)) {
    const descriptions = Object.fromEntries(
      UI_LOCALES.map((locale) => [locale, grouped[key].descriptions[locale] ?? ''])
    );
    await UiTerm.findOneAndUpdate(
      { key },
      { key, label: grouped[key].label, descriptions },
      { upsert: true, runValidators: true }
    );
  }

  await legacyCol.deleteMany({});
}

/** Server-only: seeds MongoDB (4 documents, one per term) */
export async function seedUiTermsIfEmpty() {
  const UiTerm = (await import('@/lib/models/UiTerm')).default;

  await migrateLegacyTermsIfNeeded();

  const count = await UiTerm.countDocuments();
  if (count >= UI_TERM_KEYS.length) return;

  for (const key of UI_TERM_KEYS) {
    const existing = await UiTerm.findOne({ key });
    if (existing) continue;

    const defaults = DEFAULT_UI_TERMS[key];
    if (!defaults) continue;

    await UiTerm.create({
      key,
      label: defaults.label,
      descriptions: defaults.descriptions,
    });
  }
}

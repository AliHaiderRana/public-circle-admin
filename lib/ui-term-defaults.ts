import mongoose from 'mongoose';
import {
  DEFAULT_UI_TERMS,
  UI_TERM_KEYS,
} from '@/lib/ui-term-constants';

export { DEFAULT_UI_TERMS, UI_TERM_KEYS };

const LEGACY_COLLECTION = 'ui-term-translations';

function mapDescriptionsToObject(
  descriptions: Map<string, string> | Record<string, string> | undefined
): Record<string, string> {
  if (!descriptions) return {};
  if (descriptions instanceof Map) return Object.fromEntries(descriptions);
  return { ...descriptions };
}

async function getLocaleCodes(): Promise<string[]> {
  const SupportedLocale = (await import('@/lib/models/SupportedLocale')).default;
  const locales = await SupportedLocale.find({ enabled: true })
    .sort({ isDefault: -1, sortOrder: 1, createdAt: 1 })
    .select('code')
    .lean();
  if (locales.length) return locales.map((l) => l.code);
  return ['en-US', 'en-GB', 'en-CA', 'fr'];
}

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
    await UiTerm.findOneAndUpdate(
      { key },
      { key, label: grouped[key].label, descriptions: grouped[key].descriptions },
      { upsert: true, runValidators: true }
    );
  }

  await legacyCol.deleteMany({});
}

/** Upsert all default context-help rows into MongoDB (admin + public-circle). */
export async function seedUiTermsDefaults() {
  const UiTerm = (await import('@/lib/models/UiTerm')).default;

  await migrateLegacyTermsIfNeeded();

  const localeCodes = await getLocaleCodes();
  const defaultLocale = localeCodes[0] || 'en-US';

  for (const key of UI_TERM_KEYS) {
    const defaults = DEFAULT_UI_TERMS[key];
    if (!defaults) continue;

    const descriptions: Record<string, string> = {};
    for (const code of localeCodes) {
      descriptions[code] =
        defaults.descriptions[code as keyof typeof defaults.descriptions] ||
        defaults.descriptions['en-US'] ||
        '';
    }

    await UiTerm.findOneAndUpdate(
      { key },
      {
        key,
        label: defaults.label,
        descriptions,
      },
      { upsert: true, runValidators: true }
    );
  }

  return readAllUiTerms();
}

export async function readAllUiTerms() {
  const UiTerm = (await import('@/lib/models/UiTerm')).default;
  const docs = await UiTerm.find().select('key label descriptions').sort({ key: 1 }).lean();

  return docs.map((doc) => ({
    key: doc.key,
    label: doc.label,
    descriptions: mapDescriptionsToObject(
      doc.descriptions as Map<string, string> | Record<string, string>
    ),
  }));
}

export async function upsertUiTermDoc(payload: {
  key: string;
  label: string;
  descriptions: Record<string, string>;
}) {
  const UiTerm = (await import('@/lib/models/UiTerm')).default;
  const localeCodes = await getLocaleCodes();

  const normalized: Record<string, string> = {};
  for (const code of localeCodes) {
    const value = (payload.descriptions[code] ?? '').trim();
    if (!value) {
      throw new Error(`Tooltip description is required for locale "${code}"`);
    }
    normalized[code] = value;
  }

  const doc = await UiTerm.findOneAndUpdate(
    { key: payload.key },
    {
      key: payload.key,
      label: payload.label.trim(),
      descriptions: normalized,
    },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  return {
    key: doc!.key,
    label: doc!.label,
    descriptions: mapDescriptionsToObject(
      doc!.descriptions as Map<string, string> | Record<string, string>
    ),
  };
}

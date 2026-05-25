import mongoose from 'mongoose';
import {
  DEFAULT_UI_TERMS,
  KNOWN_UI_TERM_KEYS,
  LEGACY_UI_TERM_KEY_MAP,
  TERM_META,
  defaultFeConstantForKey,
  validateFeConstant,
  validateUiTermKey,
} from '@/lib/ui-term-constants';

export { DEFAULT_UI_TERMS, KNOWN_UI_TERM_KEYS };

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
    const mappedKey =
      LEGACY_UI_TERM_KEY_MAP[doc.key as string] || (doc.key as string);
    if (!grouped[mappedKey]) {
      grouped[mappedKey] = { label: doc.label, descriptions: {} };
    }
    grouped[mappedKey].descriptions[doc.locale as string] = doc.description as string;
    if (doc.locale === 'en-US') {
      grouped[mappedKey].label = doc.label as string;
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

async function migrateLegacyKeyNames() {
  const UiTerm = (await import('@/lib/models/UiTerm')).default;
  for (const [oldKey, newKey] of Object.entries(LEGACY_UI_TERM_KEY_MAP)) {
    const oldDoc = await UiTerm.findOne({ key: oldKey });
    if (!oldDoc) continue;
    const feConstant =
      (oldDoc.feConstant as string)?.trim() || defaultFeConstantForKey(newKey);
    const newDoc = await UiTerm.findOne({ key: newKey });
    if (newDoc) {
      await UiTerm.deleteOne({ key: oldKey });
    } else {
      await UiTerm.updateOne({ key: oldKey }, { $set: { key: newKey, feConstant } });
    }
  }
}

async function syncFeConstantsInDb() {
  const UiTerm = (await import('@/lib/models/UiTerm')).default;
  const docs = await UiTerm.find().select('key feConstant').lean();
  for (const doc of docs) {
    const expected = defaultFeConstantForKey(doc.key);
    if (!expected) continue;
    if (!(doc.feConstant as string)?.trim()) {
      await UiTerm.updateOne({ key: doc.key }, { $set: { feConstant: expected } });
    }
  }
}

export async function readAllUiTerms() {
  const UiTerm = (await import('@/lib/models/UiTerm')).default;
  await migrateLegacyTermsIfNeeded();
  await migrateLegacyKeyNames();
  try {
    await ensureKnownUiTermsForAllLocales();
    await syncFeConstantsInDb();
  } catch (err) {
    console.error('[ui-terms] Failed to sync built-in keys:', err);
  }

  const docs = await UiTerm.find()
    .select('key label feConstant descriptions')
    .sort({ key: 1 })
    .lean();

  return docs.map((doc) => ({
    key: doc.key,
    label: doc.label,
    feConstant:
      (doc.feConstant as string)?.trim() || defaultFeConstantForKey(doc.key),
    descriptions: mapDescriptionsToObject(
      doc.descriptions as Map<string, string> | Record<string, string>
    ),
  }));
}

export async function upsertUiTermDoc(payload: {
  key: string;
  label: string;
  feConstant?: string;
  descriptions: Record<string, string>;
}) {
  const UiTerm = (await import('@/lib/models/UiTerm')).default;
  const normalizedKey = validateUiTermKey(payload.key);
  const normalizedFeConstant =
    validateFeConstant(payload.feConstant) || defaultFeConstantForKey(normalizedKey);
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
    { key: normalizedKey },
    {
      key: normalizedKey,
      label: payload.label.trim(),
      feConstant: normalizedFeConstant,
      descriptions: normalized,
    },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  return {
    key: doc!.key,
    label: doc!.label,
    feConstant: (doc!.feConstant as string)?.trim() || '',
    descriptions: mapDescriptionsToObject(
      doc!.descriptions as Map<string, string> | Record<string, string>
    ),
  };
}

export async function deleteUiTermDoc(key: string) {
  const UiTerm = (await import('@/lib/models/UiTerm')).default;
  const normalizedKey = validateUiTermKey(key);
  const result = await UiTerm.deleteOne({ key: normalizedKey });
  if (result.deletedCount === 0) {
    throw new Error(`UI term not found: ${normalizedKey}`);
  }
  return { key: normalizedKey };
}

async function getDefaultLocaleCode(): Promise<string> {
  const SupportedLocale = (await import('@/lib/models/SupportedLocale')).default;
  const doc = await SupportedLocale.findOne({ isDefault: true, enabled: true })
    .select('code')
    .lean();
  return doc?.code ?? 'en-US';
}

/** Copy default-locale tooltip into a new language for every context-help key (same as translations). */
async function ensureKnownUiTermsForAllLocales() {
  const UiTerm = (await import('@/lib/models/UiTerm')).default;
  const localeCodes = await getLocaleCodes();
  const defaultLocale = await getDefaultLocaleCode();

  for (const key of KNOWN_UI_TERM_KEYS) {
    const defaults = DEFAULT_UI_TERMS[key];
    if (!defaults) continue;

    const existing = await UiTerm.findOne({ key }).lean();
    const descObj = existing
      ? mapDescriptionsToObject(
          existing.descriptions as Map<string, string> | Record<string, string>
        )
      : {};

    let changed = !existing;
    for (const code of localeCodes) {
      if (!descObj[code]?.trim()) {
        descObj[code] =
          descObj[defaultLocale]?.trim() ||
          defaults.descriptions[code as keyof typeof defaults.descriptions] ||
          defaults.descriptions['en-US'] ||
          '';
        changed = true;
      }
    }

    const feConstant =
      (existing?.feConstant as string)?.trim() ||
      TERM_META[key]?.feConstant ||
      defaultFeConstantForKey(key);

    if (changed || !existing?.feConstant) {
      await UiTerm.findOneAndUpdate(
        { key },
        {
          key,
          label: existing?.label ?? defaults.label,
          feConstant,
          descriptions: descObj,
        },
        { upsert: true, runValidators: true }
      );
    }
  }
}

export async function syncDescriptionsForNewLocale({
  code,
  fallbackCode,
}: {
  code: string;
  fallbackCode?: string;
}) {
  const UiTerm = (await import('@/lib/models/UiTerm')).default;
  await migrateLegacyKeyNames();
  await ensureKnownUiTermsForAllLocales();

  const fb = fallbackCode || (await getDefaultLocaleCode());
  const terms = await UiTerm.find().select('key descriptions').lean();

  for (const doc of terms) {
    const descObj = mapDescriptionsToObject(
      doc.descriptions as Map<string, string> | Record<string, string>
    );
    if (!descObj[code]?.trim()) {
      descObj[code] =
        descObj[fb]?.trim() ||
        descObj['en-US']?.trim() ||
        Object.values(descObj).find((v) => v?.trim()) ||
        '';
      await UiTerm.updateOne({ key: doc.key }, { $set: { descriptions: descObj } });
    }
  }
}

export async function stripLocaleFromAllTerms({ code }: { code: string }) {
  const UiTerm = (await import('@/lib/models/UiTerm')).default;
  const terms = await UiTerm.find().select('key descriptions').lean();

  for (const doc of terms) {
    const descObj = mapDescriptionsToObject(
      doc.descriptions as Map<string, string> | Record<string, string>
    );
    if (descObj[code] !== undefined) {
      delete descObj[code];
      await UiTerm.updateOne({ key: doc.key }, { $set: { descriptions: descObj } });
    }
  }
}

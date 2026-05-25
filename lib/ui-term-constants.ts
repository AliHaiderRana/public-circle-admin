/** Client-safe constants — do not import Mongoose here */

export const UI_TERM_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;
export const FE_CONSTANT_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

export const UI_TERM_KEY_EXAMPLES = [
  'audience.fields',
  'audience.segment',
  'campaign.entity',
];

/** Keys used in public-circle — import UI_HINT_KEYS from @/config/ui-hint-keys (mirrored there) */
export const UI_HINT_KEYS = {
  audienceFields: 'audience.fields',
  audienceSegment: 'audience.segment',
  audienceContacts: 'audience.contacts',
  audienceFieldInputType: 'audience.inputtype',
  audienceFieldDataKey: 'audience.datakey',
  audienceSegmentFilters: 'audience.segmentfilters',
  campaignEntity: 'campaign.entity',
  campaignGroup: 'campaign.group',
  campaignCampaignId: 'campaign.id',
  campaignFromEmail: 'campaign.fromemail',
  campaignSubject: 'campaign.subject',
  campaignTemplate: 'campaign.template',
  campaignSegments: 'campaign.segments',
  campaignFrequency: 'campaign.frequency',
  companyOrganization: 'company.organization',
  companyProfile: 'company.profile',
  templateGroup: 'template.group',
} as const;

export type UiHintKey = (typeof UI_HINT_KEYS)[keyof typeof UI_HINT_KEYS];

export const KNOWN_UI_TERM_KEYS = Object.values(UI_HINT_KEYS);

export const LEGACY_UI_TERM_KEY_MAP: Record<string, string> = {
  fields: UI_HINT_KEYS.audienceFields,
  segment: UI_HINT_KEYS.audienceSegment,
  campaign: UI_HINT_KEYS.campaignEntity,
  campaign_group: UI_HINT_KEYS.campaignGroup,
};

export type UiTermDescriptions = Record<string, string>;

export type UiTermDefaults = {
  label: string;
  descriptions: UiTermDescriptions;
};

export const DEFAULT_UI_TERMS: Record<string, UiTermDefaults> = {
  [UI_HINT_KEYS.audienceFields]: {
    label: 'Fields',
    descriptions: {
      'en-US':
        'Fields are contact attributes (e.g. email, city, subscription status). Use them to build filters and power segment rules.',
      'en-GB':
        'Fields are contact attributes (e.g. email, city, subscription status). Use them to build filters and power segment rules.',
      'en-CA':
        'Fields are contact attributes (e.g. email, city, subscription status). Use them to build filters and power segment rules.',
      fr: "Les champs sont des attributs de contact (ex. e-mail, ville, statut d'abonnement). Utilisez-les pour créer des filtres et des règles de segment.",
    },
  },
  [UI_HINT_KEYS.audienceContacts]: {
    label: 'Contacts',
    descriptions: {
      'en-US':
        'Contacts are people in your audience. Import, update keys, and manage subscription status before you send campaigns.',
      'en-GB':
        'Contacts are people in your audience. Import, update keys, and manage subscription status before you send campaigns.',
      'en-CA':
        'Contacts are people in your audience. Import, update keys, and manage subscription status before you send campaigns.',
      fr: 'Les contacts sont les personnes de votre audience. Importez-les, mettez à jour les clés et gérez les abonnements avant d’envoyer des campagnes.',
    },
  },
  [UI_HINT_KEYS.audienceSegment]: {
    label: 'Segment',
    descriptions: {
      'en-US':
        'A segment is a saved group of contacts that match your field rules. Campaigns target one or more segments.',
      'en-GB':
        'A segment is a saved group of contacts that match your field rules. Campaigns target one or more segments.',
      'en-CA':
        'A segment is a saved group of contacts that match your field rules. Campaigns target one or more segments.',
      fr: 'Un segment est un groupe enregistré de contacts qui correspondent à vos règles de champs. Les campagnes ciblent un ou plusieurs segments.',
    },
  },
  [UI_HINT_KEYS.campaignEntity]: {
    label: 'Campaign',
    descriptions: {
      'en-US':
        'An email send configuration: template, audience, schedule, and tracking.',
      'en-GB':
        'An email send configuration: template, audience, schedule, and tracking.',
      'en-CA':
        'An email send configuration: template, audience, schedule, and tracking.',
      fr: "Configuration d'envoi d'e-mails : modèle, audience, planification et suivi.",
    },
  },
  [UI_HINT_KEYS.campaignGroup]: {
    label: 'Group in campaign',
    descriptions: {
      'en-US':
        'Organizes campaigns under a company grouping for reporting and filtering.',
      'en-GB':
        'Organises campaigns under a company grouping for reporting and filtering.',
      'en-CA':
        'Organizes campaigns under a company grouping for reporting and filtering.',
      fr: "Organise les campagnes sous un regroupement d'entreprise pour le reporting et le filtrage.",
    },
  },
  [UI_HINT_KEYS.audienceFieldInputType]: {
    label: 'Field input type',
    descriptions: {
      'en-US':
        'How contacts enter data for this field (text, number, date, dropdown, etc.). Choose a type before mapping a data key.',
      fr: "Comment les contacts saisissent cette donnée (texte, nombre, date, liste, etc.). Choisissez un type avant d'associer une clé.",
    },
  },
  [UI_HINT_KEYS.audienceFieldDataKey]: {
    label: 'Field data key',
    descriptions: {
      'en-US':
        'The property name stored on each contact (e.g. email, city). Must match your import file and API payloads.',
      fr: "Nom de propriété enregistré sur chaque contact (ex. e-mail, ville). Doit correspondre à vos imports et à l'API.",
    },
  },
  [UI_HINT_KEYS.audienceSegmentFilters]: {
    label: 'Segment filters',
    descriptions: {
      'en-US':
        'Rules built from your fields that define who belongs in this segment. Contacts must match all selected filters.',
      fr: 'Règles basées sur vos champs qui définissent qui appartient au segment. Les contacts doivent respecter tous les filtres.',
    },
  },
  [UI_HINT_KEYS.campaignCampaignId]: {
    label: 'Campaign ID',
    descriptions: {
      'en-US':
        "Your company's unique identifier for this campaign. Used in reporting, webhooks, and integrations—generate or enter a stable ID.",
      fr: 'Identifiant unique de votre entreprise pour cette campagne. Utilisé dans les rapports, webhooks et intégrations.',
    },
  },
  [UI_HINT_KEYS.campaignFromEmail]: {
    label: 'From email',
    descriptions: {
      'en-US':
        'Verified sender address recipients see. Must be from a domain you authenticated in Email Configuration.',
      fr: "Adresse d'expéditeur vérifiée affichée aux destinataires. Doit provenir d'un domaine authentifié.",
    },
  },
  [UI_HINT_KEYS.campaignSubject]: {
    label: 'Email subject',
    descriptions: {
      'en-US':
        'Subject line shown in the inbox. Keep it clear; you can personalize with merge fields from your template.',
      fr: "Objet affiché dans la boîte de réception. Restez clair ; personnalisez avec les champs de fusion du modèle.",
    },
  },
  [UI_HINT_KEYS.campaignTemplate]: {
    label: 'Email template',
    descriptions: {
      'en-US':
        'HTML design sent to the selected segments. Preview before launch; changes here apply to this campaign only.',
      fr: "Modèle HTML envoyé aux segments sélectionnés. Prévisualisez avant l'envoi ; les changements s'appliquent à cette campagne.",
    },
  },
  [UI_HINT_KEYS.campaignSegments]: {
    label: 'Campaign segments',
    descriptions: {
      'en-US':
        'Audience for this send. Only contacts in the selected segments receive the email.',
      fr: "Audience de cet envoi. Seuls les contacts des segments sélectionnés reçoivent l'e-mail.",
    },
  },
  [UI_HINT_KEYS.campaignFrequency]: {
    label: 'Campaign frequency',
    descriptions: {
      'en-US':
        'One time sends once when launched. Every re-match sends again when contacts newly match the segment rules.',
      fr: 'Une fois envoie au lancement. À chaque re-correspondance renvoie quand de nouveaux contacts entrent dans le segment.',
    },
  },
  [UI_HINT_KEYS.companyOrganization]: {
    label: 'Organization settings',
    descriptions: {
      'en-US':
        'Company profile used across your workspace: name, size, address, logo, and account status.',
      fr: 'Profil entreprise de votre espace : nom, taille, adresse, logo et statut du compte.',
    },
  },
  [UI_HINT_KEYS.companyProfile]: {
    label: 'Company profile',
    descriptions: {
      'en-US':
        'Legal and operational details for your company. Used for compliance, billing context, and team identification.',
      fr: "Informations légales et opérationnelles de votre entreprise pour la conformité et l'identification.",
    },
  },
  [UI_HINT_KEYS.templateGroup]: {
    label: 'Template group',
    descriptions: {
      'en-US':
        'Organizes templates under a company grouping—same concept as campaign groups, but for template libraries.',
      fr: 'Organise les modèles sous un regroupement d’entreprise, comme pour les campagnes.',
    },
  },
};

export const LOCALE_DISPLAY_NAMES: Record<string, string> = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'en-CA': 'English (CA)',
  fr: 'French',
};

export type UiTermRow = {
  key: string;
  label: string;
  /** camelCase name stored in DB — maps to UI_HINT_KEYS.{feConstant} in code */
  feConstant: string;
  descriptions: Record<string, string>;
};

export type UiTermMeta = {
  title: string;
  where: string;
  feConstant: keyof typeof UI_HINT_KEYS;
};

export const TERM_META: Record<string, UiTermMeta> = {
  [UI_HINT_KEYS.audienceFields]: {
    title: 'Fields',
    where: 'Audience → Fields (page title)',
    feConstant: 'audienceFields',
  },
  [UI_HINT_KEYS.audienceSegment]: {
    title: 'Segment',
    where: 'Audience → Segments (page title)',
    feConstant: 'audienceSegment',
  },
  [UI_HINT_KEYS.audienceContacts]: {
    title: 'Contacts',
    where: 'Contacts → All contacts (page title)',
    feConstant: 'audienceContacts',
  },
  [UI_HINT_KEYS.campaignEntity]: {
    title: 'Campaign',
    where: 'Campaigns → list (page title)',
    feConstant: 'campaignEntity',
  },
  [UI_HINT_KEYS.campaignGroup]: {
    title: 'Group in campaign',
    where: 'Campaigns → create/edit → Group field',
    feConstant: 'campaignGroup',
  },
  [UI_HINT_KEYS.audienceFieldInputType]: {
    title: 'Field input type',
    where: 'Audience → create/edit field → Input Type',
    feConstant: 'audienceFieldInputType',
  },
  [UI_HINT_KEYS.audienceFieldDataKey]: {
    title: 'Field data key',
    where: 'Audience → create/edit field → Data Key',
    feConstant: 'audienceFieldDataKey',
  },
  [UI_HINT_KEYS.audienceSegmentFilters]: {
    title: 'Segment filters',
    where: 'Audience → create/edit segment → Add Filters',
    feConstant: 'audienceSegmentFilters',
  },
  [UI_HINT_KEYS.campaignCampaignId]: {
    title: 'Campaign ID',
    where: 'Campaigns → create/edit → Campaign ID',
    feConstant: 'campaignCampaignId',
  },
  [UI_HINT_KEYS.campaignFromEmail]: {
    title: 'From email',
    where: 'Campaigns → create/edit → From Email',
    feConstant: 'campaignFromEmail',
  },
  [UI_HINT_KEYS.campaignSubject]: {
    title: 'Email subject',
    where: 'Campaigns → create/edit → Subject',
    feConstant: 'campaignSubject',
  },
  [UI_HINT_KEYS.campaignTemplate]: {
    title: 'Email template',
    where: 'Campaigns → create/edit → Template',
    feConstant: 'campaignTemplate',
  },
  [UI_HINT_KEYS.campaignSegments]: {
    title: 'Campaign segments',
    where: 'Campaigns → create/edit → Segments',
    feConstant: 'campaignSegments',
  },
  [UI_HINT_KEYS.campaignFrequency]: {
    title: 'Campaign frequency',
    where: 'Campaigns → create/edit → Frequency',
    feConstant: 'campaignFrequency',
  },
  [UI_HINT_KEYS.companyOrganization]: {
    title: 'Organization settings',
    where: 'Settings → Organization (page title)',
    feConstant: 'companyOrganization',
  },
  [UI_HINT_KEYS.companyProfile]: {
    title: 'Company profile',
    where: 'Settings → Organization → Basic Information',
    feConstant: 'companyProfile',
  },
  [UI_HINT_KEYS.templateGroup]: {
    title: 'Template group',
    where: 'Templates → create/edit → Groups',
    feConstant: 'templateGroup',
  },
};

export function validateUiTermKey(key: string): string {
  const trimmed = key.trim();
  if (!UI_TERM_KEY_PATTERN.test(trimmed)) {
    throw new Error(
      'Invalid key. Use dot notation like "audience.fields" (lowercase segments).'
    );
  }
  return trimmed;
}

export function validateFeConstant(value: string | undefined): string {
  if (!value?.trim()) return '';
  const trimmed = value.trim();
  if (!FE_CONSTANT_PATTERN.test(trimmed)) {
    throw new Error('Invalid FE constant. Use camelCase like "audienceFields".');
  }
  return trimmed;
}

export function defaultFeConstantForKey(key: string): string {
  return TERM_META[key]?.feConstant ?? '';
}

/** How to reference this key in public-circle (prefers DB feConstant) */
export function feHintUsage(term: Pick<UiTermRow, 'key' | 'feConstant'> | string): string {
  if (typeof term === 'string') {
    const meta = TERM_META[term];
    if (meta) return `UI_HINT_KEYS.${meta.feConstant}`;
    return `"${term}"`;
  }
  if (term.feConstant?.trim()) {
    return `UI_HINT_KEYS.${term.feConstant.trim()}`;
  }
  return feHintUsage(term.key);
}

export function getDefaultTermRow(key: string): UiTermRow | null {
  const defaults = DEFAULT_UI_TERMS[key];
  if (!defaults) return null;
  return {
    key,
    label: defaults.label,
    feConstant: TERM_META[key]?.feConstant ?? '',
    descriptions: { ...defaults.descriptions },
  };
}

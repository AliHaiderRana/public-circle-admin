/** Client-safe constants only — do not import Mongoose here */

export type UiTermDescriptions = {
  'en-US': string;
  'en-GB': string;
  'en-CA': string;
  fr: string;
};

export type UiTermDefaults = {
  label: string;
  descriptions: UiTermDescriptions;
};

export const DEFAULT_UI_TERMS: Record<string, UiTermDefaults> = {
  fields: {
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
  segment: {
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
  campaign: {
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
  campaign_group: {
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
};

export const UI_TERM_KEYS = ['fields', 'segment', 'campaign', 'campaign_group'] as const;
export const UI_LOCALES = ['en-US', 'en-GB', 'en-CA', 'fr'] as const;

export const TERM_DISPLAY_NAMES: Record<string, string> = {
  fields: 'Fields',
  segment: 'Segment',
  campaign: 'Campaign',
  campaign_group: 'Group in campaign',
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
  descriptions: Record<string, string>;
};

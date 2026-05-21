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
        'Contact attributes used to filter, segment, and personalize your campaigns.',
      'en-GB':
        'Contact attributes used to filter, segment, and personalise your campaigns.',
      'en-CA':
        'Contact attributes used to filter, segment, and personalize your campaigns.',
      fr: 'Attributs de contact utilisés pour filtrer, segmenter et personnaliser vos campagnes.',
    },
  },
  segment: {
    label: 'Segment',
    descriptions: {
      'en-US':
        'A saved audience defined by field rules; campaigns send to one or more segments.',
      'en-GB':
        'A saved audience defined by field rules; campaigns send to one or more segments.',
      'en-CA':
        'A saved audience defined by field rules; campaigns send to one or more segments.',
      fr: "Une audience enregistrée définie par des règles de champs ; les campagnes s'envoient à un ou plusieurs segments.",
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

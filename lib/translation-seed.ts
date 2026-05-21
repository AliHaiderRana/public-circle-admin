/** Server-only dashboard defaults — keep in sync with server/utils/translation.constants.js */

export const DASHBOARD_DEFAULTS: Record<string, Record<string, string>> = {
  'dashboard.welcome.title': {
    'en-US': 'Hi, Welcome back {name} 👋',
    'en-GB': 'Hi, Welcome back {name} 👋',
    'en-CA': 'Hi, Welcome back {name} 👋',
    fr: 'Bonjour, bon retour {name} 👋',
  },
  'dashboard.welcome.subtitle': {
    'en-US': 'Track your email performance and usage metrics',
    'en-GB': 'Track your email performance and usage metrics',
    'en-CA': 'Track your email performance and usage metrics',
    fr: 'Suivez les performances de vos e-mails et vos indicateurs d\'utilisation',
  },
  'dashboard.actions.refresh': {
    'en-US': 'Refresh analytics data',
    'en-GB': 'Refresh analytics data',
    'en-CA': 'Refresh analytics data',
    fr: 'Actualiser les données analytiques',
  },
  'dashboard.cards.campaigns_breakdown.title': {
    'en-US': 'Campaigns Breakdown',
    'en-GB': 'Campaigns Breakdown',
    'en-CA': 'Campaigns Breakdown',
    fr: 'Répartition des campagnes',
  },
  'dashboard.cards.campaigns_breakdown.active': {
    'en-US': 'Active Campaigns',
    'en-GB': 'Active Campaigns',
    'en-CA': 'Active Campaigns',
    fr: 'Campagnes actives',
  },
  'dashboard.cards.campaigns_breakdown.inactive': {
    'en-US': 'Inactive Campaigns',
    'en-GB': 'Inactive Campaigns',
    'en-CA': 'Inactive Campaigns',
    fr: 'Campagnes inactives',
  },
  'dashboard.cards.campaigns_breakdown.draft': {
    'en-US': 'In Draft',
    'en-GB': 'In Draft',
    'en-CA': 'In Draft',
    fr: 'En brouillon',
  },
  'dashboard.cards.email_success_rate.title': {
    'en-US': 'Email Success Rate',
    'en-GB': 'Email Success Rate',
    'en-CA': 'Email Success Rate',
    fr: 'Taux de succès des e-mails',
  },
  'dashboard.cards.email_success_rate.delivery_rate': {
    'en-US': 'Delivery rate',
    'en-GB': 'Delivery rate',
    'en-CA': 'Delivery rate',
    fr: 'Taux de livraison',
  },
  'dashboard.cards.email_success_rate.dtor': {
    'en-US': 'Delivery-to-open rate (DTOR)',
    'en-GB': 'Delivery-to-open rate (DTOR)',
    'en-CA': 'Delivery-to-open rate (DTOR)',
    fr: "Taux d'ouverture après livraison (DTOR)",
  },
  'dashboard.cards.email_success_rate.ctr': {
    'en-US': 'Click-through rate (CTR)',
    'en-GB': 'Click-through rate (CTR)',
    'en-CA': 'Click-through rate (CTR)',
    fr: 'Taux de clics (CTR)',
  },
  'dashboard.cards.company_contacts.title': {
    'en-US': 'Company Contacts',
    'en-GB': 'Company Contacts',
    'en-CA': 'Company Contacts',
    fr: "Contacts de l'entreprise",
  },
  'dashboard.cards.emails_sent.title': {
    'en-US': 'Emails Sent',
    'en-GB': 'Emails Sent',
    'en-CA': 'Emails Sent',
    fr: 'E-mails envoyés',
  },
  'dashboard.cards.emails_sent.total': {
    'en-US': 'Total sent',
    'en-GB': 'Total sent',
    'en-CA': 'Total sent',
    fr: 'Total envoyés',
  },
  'dashboard.cards.emails_sent.this_month': {
    'en-US': 'This month',
    'en-GB': 'This month',
    'en-CA': 'This month',
    fr: 'Ce mois-ci',
  },
  'dashboard.cards.emails_sent.avg_per_month': {
    'en-US': 'Avg. per month',
    'en-GB': 'Avg. per month',
    'en-CA': 'Avg. per month',
    fr: 'Moy. par mois',
  },
  'dashboard.cards.emails_sent.growth': {
    'en-US': 'Growth',
    'en-GB': 'Growth',
    'en-CA': 'Growth',
    fr: 'Croissance',
  },
  'dashboard.cards.bounced_emails.title': {
    'en-US': 'Bounced Emails',
    'en-GB': 'Bounced Emails',
    'en-CA': 'Bounced Emails',
    fr: 'E-mails rejetés',
  },
  'dashboard.cards.bounced_emails.total': {
    'en-US': 'Total bounced',
    'en-GB': 'Total bounced',
    'en-CA': 'Total bounced',
    fr: 'Total rejetés',
  },
  'dashboard.cards.bounced_emails.rate': {
    'en-US': 'Bounce rate',
    'en-GB': 'Bounce rate',
    'en-CA': 'Bounce rate',
    fr: 'Taux de rebond',
  },
  'dashboard.cards.bounced_emails.hard': {
    'en-US': 'Hard bounces',
    'en-GB': 'Hard bounces',
    'en-CA': 'Hard bounces',
    fr: 'Rebonds durs',
  },
  'dashboard.quota.bandwidth.title': {
    'en-US': 'Bandwidth Usage',
    'en-GB': 'Bandwidth Usage',
    'en-CA': 'Bandwidth Usage',
    fr: 'Utilisation de la bande passante',
  },
  'dashboard.quota.bandwidth.subtitle': {
    'en-US': 'Current month consumption',
    'en-GB': 'Current month consumption',
    'en-CA': 'Current month consumption',
    fr: 'Consommation du mois en cours',
  },
  'dashboard.quota.emails.title': {
    'en-US': 'Monthly Emails',
    'en-GB': 'Monthly Emails',
    'en-CA': 'Monthly Emails',
    fr: 'E-mails mensuels',
  },
  'dashboard.quota.emails.subtitle': {
    'en-US': 'Current month consumption',
    'en-GB': 'Current month consumption',
    'en-CA': 'Current month consumption',
    fr: 'Consommation du mois en cours',
  },
  'dashboard.quota.usage': {
    'en-US': 'Usage',
    'en-GB': 'Usage',
    'en-CA': 'Usage',
    fr: 'Utilisation',
  },
  'dashboard.quota.total_in_plan': {
    'en-US': 'Total in Plan',
    'en-GB': 'Total in Plan',
    'en-CA': 'Total in Plan',
    fr: 'Total du forfait',
  },
  'dashboard.quota.consumed': {
    'en-US': 'Consumed',
    'en-GB': 'Consumed',
    'en-CA': 'Consumed',
    fr: 'Consommé',
  },
  'dashboard.quota.total_used': {
    'en-US': 'Total Used',
    'en-GB': 'Total Used',
    'en-CA': 'Total Used',
    fr: 'Total utilisé',
  },
  'dashboard.quota.overage': {
    'en-US': 'Overage',
    'en-GB': 'Overage',
    'en-CA': 'Overage',
    fr: 'Dépassement',
  },
  'dashboard.charts.email_analytics.title': {
    'en-US': 'Email Analytics',
    'en-GB': 'Email Analytics',
    'en-CA': 'Email Analytics',
    fr: 'Analytique des e-mails',
  },
  'dashboard.charts.email_analytics.subheader': {
    'en-US': '{period} email distribution and trends',
    'en-GB': '{period} email distribution and trends',
    'en-CA': '{period} email distribution and trends',
    fr: 'Distribution et tendances des e-mails — {period}',
  },
  'dashboard.charts.period.daily': {
    'en-US': 'Daily',
    'en-GB': 'Daily',
    'en-CA': 'Daily',
    fr: 'Quotidien',
  },
  'dashboard.charts.period.monthly': {
    'en-US': 'Monthly',
    'en-GB': 'Monthly',
    'en-CA': 'Monthly',
    fr: 'Mensuel',
  },
  'dashboard.charts.period.yearly': {
    'en-US': 'Yearly',
    'en-GB': 'Yearly',
    'en-CA': 'Yearly',
    fr: 'Annuel',
  },
  'dashboard.charts.series.emails_sent': {
    'en-US': 'Emails Sent',
    'en-GB': 'Emails Sent',
    'en-CA': 'Emails Sent',
    fr: 'E-mails envoyés',
  },
};

export async function seedDashboardTranslationsIfEmpty() {
  const Translation = (await import('@/lib/models/Translation')).default;

  for (const [key, values] of Object.entries(DASHBOARD_DEFAULTS)) {
    const existing = await Translation.findOne({ key }).lean();
    if (existing) continue;

    await Translation.create({ key, values });
  }
}

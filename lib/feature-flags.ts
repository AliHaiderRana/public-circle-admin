/**
 * Feature flags for gradual prod rollout.
 * Set NEXT_PUBLIC_ADMIN_INTEGRATIONS_ENABLED=true locally to test Integrations UI.
 */
export function isAdminIntegrationsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ADMIN_INTEGRATIONS_ENABLED === 'true';
}

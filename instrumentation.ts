export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerAdminCrons } = await import('./lib/admin-cron-scheduler.server');
    registerAdminCrons();
  }
}

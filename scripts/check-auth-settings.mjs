import { loadEnv } from 'vite';
const env = loadEnv('development', process.cwd(), 'VITE_');
const response = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/settings`, {
  headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY }
});
if (!response.ok) throw new Error(`Could not read Auth settings: HTTP ${response.status}`);
const settings = await response.json();
console.log(JSON.stringify({ emailSignupEnabled: settings.external?.email, emailConfirmationRequired: settings.mailer_autoconfirm === undefined ? 'unknown' : !settings.mailer_autoconfirm }, null, 2));

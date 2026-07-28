// Runtime configuration — overridden by Terraform ConfigMap in deployed environments.
// Values here are defaults for local development.
window.APP_CONFIG = {
  FF_BUSINESS: true,
  BUSINESS_URL: 'https://business.staging.postguard.eu',
  // Set to true to simulate the staging/dev environment locally: instead
  // of relying on cryptify to send a real notification email, the website
  // pops up a preview of what the email would have looked like.
  STAGING: false,
  // GlitchTip DSN for the local dev stack. The public_key is pinned by
  // `glitchtip-init` in docker-compose.yml so this stays valid across
  // `docker compose down -v`. Leave blank in deployed environments —
  // the Terraform ConfigMap overrides this file.
  GLITCHTIP_DSN: 'http://1d8ea2a49c904f079b116550780c0ece@localhost:8001/1',
};

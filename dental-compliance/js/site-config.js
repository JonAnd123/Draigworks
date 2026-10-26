/* ==========================================================================
   Cymru Compliance — site & portal configuration
   Leave both values empty to run the portal in DEMO MODE (sample data,
   stored in your own browser only — nothing is sent anywhere).
   To go live: create a free Supabase project (London region), run the SQL in
   /supabase, then paste the Project URL and the *anon public* key below.
   The anon key is designed to be public; security is enforced by the
   row-level-security rules in 01_schema.sql. NEVER paste the service_role key.
   ========================================================================== */
/* Optional: add  FEATURE_PM_AND_VISITS: true  below to bring back "Book a
   pre-inspection visit" and "Practice Manager training" in the portal.
   On the marketing pages, remove the class "later" from the hidden items
   (search for class="later" in index.html, services.html, pricing.html),
   then run: python3 scripts/build-dw.py */
window.CC_CONFIG = {
  SUPABASE_URL: "https://tpeumhwzzoiqmgrjpsyu.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_rQJ0zNxAQA2REp7J5SflJw_ai6cv17B"
};

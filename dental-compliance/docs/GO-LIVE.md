# Going live: step by step

## Quick path: testing on www.draigworks.uk in a sub-folder

All links in the site are relative, so the whole `website` folder works from any sub-folder with no code changes. Example: `https://www.draigworks.uk/dental-compliance/` (pick any folder name).

1. **Supabase:** create a free project (London), run the SQL files and paste the URL and anon key into `js/site-config.js` (Part 1 below, steps 1 to 5). The free plan is fine for testing with made-up data only; do not load real staff or patient data.
2. **Supabase, Authentication, URL Configuration:**
   - Site URL: `https://www.draigworks.uk/dental-compliance/`
   - Redirect URLs: `https://www.draigworks.uk/dental-compliance/**` (the `**` covers every portal and theme page, including password-reset links)
3. **Upload** the contents of the `website` folder into a new `dental-compliance` folder on the draigworks.uk hosting (FTP, the host's file manager, or, if the main site is deployed from a Git repo, add the folder to that repo's public/root directory and deploy). Keep the folder structure exactly as it is. Do not upload `supabase/tests`, `portal/tests` or `.github` if you prefer; they are not needed to run the site.
4. **Open and test:**
   - Cymru theme: `/dental-compliance/` and `/dental-compliance/portal/app.html`
   - Draigworks theme: `/dental-compliance/dw/` and `/dental-compliance/portal/draigworks.html`
   - Practice Plan theme: `/dental-compliance/portal/practiceplan.html`
5. **Create your admin account** with the e-mail set in `01_schema.sql`, then invite test users (Part 3 below). For testing, Supabase's built-in e-mail sender allows only a few e-mails per hour; either add your SMTP (Part 1, step 8) or temporarily turn "Confirm email" off under Authentication, Providers, Email, and turn it back on before real use.
6. **Keep search engines out while testing:** the `robots.txt` and `sitemap.xml` in this folder only work at the site root, so they do nothing in a sub-folder. Either password-protect the folder in your hosting panel, or ask me to add a `noindex` tag to every page.

### Uploading with GitHub (step 3 in detail)

The folder is 124 files (about 37 MB), which is too many for the GitHub web uploader (100 files at a time), so use Git or GitHub Desktop.

1. Find the repository that serves www.draigworks.uk (its Settings, Pages page shows the custom domain).
2. Clone it to your computer (GitHub Desktop: File, Clone repository; or `git clone https://github.com/<you>/<repo>.git`).
3. Inside the clone, create a folder named `dental-compliance` and copy the **contents** of the `website` folder into it, so `dental-compliance/index.html` and `dental-compliance/portal/app.html` exist.
   - If the main site is built by a tool (Vite, Astro, Next, etc.) rather than plain HTML, put the folder in that project's `public/` folder so it is copied to the live site unchanged.
   - Do **not** copy `website/.github`. GitHub only reads workflows from the repository root, so it would do nothing in a sub-folder (see "Reminder e-mails" below when you need it).
4. Commit and push:
   ```
   git add dental-compliance
   git commit -m "Add dental compliance portal (testing)"
   git push
   ```
5. Wait a minute or two for the Pages build (Actions tab shows progress), then open `https://www.draigworks.uk/dental-compliance/`.
6. To update later, change the files, commit and push again. After editing a main marketing page re-run `python3 scripts/build-dw.py` first so the `/dw/` copies stay in sync.

Reminder e-mails from a sub-folder: copy `.github/workflows/alert-digest.yml` to the repository root's `.github/workflows/` and change the step to `node dental-compliance/scripts/send-alert-digests.mjs`. Add the five secrets in the repo's Settings, Secrets and variables, Actions.

Things that behave differently in a sub-folder: only `robots.txt`, `sitemap.xml` and the favicon at the site root belong to the main draigworks.uk site, so leave those alone.

---

The site is static files (GitHub Pages). The portal's logins, data and file storage run on Supabase. Nothing else to host.
Time needed: about 1 to 2 hours, plus waiting for DNS.

## Before you start: decisions that matter

1. **Real data needs a paid plan.** The Supabase free plan pauses inactive projects and has no data-processing terms you can rely on. Staff records include sickness, DBS and ID documents (special-category data under UK GDPR). Use the **Pro plan** (about $25/month) before any real practice uses it. Free is fine for your own testing.
2. **Privacy policy and terms are placeholders** (the footer links point to `#`). Publish real ones before inviting customers, and give staff a privacy notice. For the HR module also record your lawful basis, retention periods and a short DPIA.
3. **Welsh text is unproofread** and the HIW question set is derived from the HIW workbook. Have a native Welsh speaker and a dental compliance expert review before launch.
4. **Demo mode:** if `js/site-config.js` is empty the portal runs on sample data. Once it is filled in, the portal uses the live database. Test in a private window to be sure which one you are seeing.

## Part 1: Supabase (logins, database, files)

1. Go to supabase.com, create an account, then **New project**. Region: **London (eu-west-2)**. Choose a strong database password and store it in a password manager.
2. Before running any SQL, open `supabase/01_schema.sql`, go to the **last lines** and set the admin e-mail to the address you will sign in with (it currently says jonathan.milton.anderson@gmail.com). That address becomes platform admin.
3. **SQL Editor**: run these files in this order, each one in a new query, checking for errors after each:
   `01_schema.sql`, `02_seed.sql`, `03_hr.sql`, `04_hiw_questions.sql` (if you want the 74-question HIW set; check the file header), `05_alerts_grouptraining.sql`, `06_compliance_tools.sql`.
4. **Project Settings, API**: copy the **Project URL** and the **anon public** key. Never use or publish the `service_role` key in the site.
5. Open `js/site-config.js` and paste both values:
   ```js
   window.CC_CONFIG = { SUPABASE_URL: "https://xxxx.supabase.co", SUPABASE_ANON_KEY: "eyJ..." };
   ```
   The anon key is meant to be public; the row-level-security rules in the SQL are what protect the data.
6. **Authentication, URL Configuration**:
   - Site URL: your live address, e.g. `https://www.yourdomain.co.uk`
   - Redirect URLs: add `https://www.yourdomain.co.uk/portal/app.html`, `/portal/practiceplan.html` and `/portal/draigworks.html` (and the `/dw/` equivalents if needed).
7. **Authentication, Providers, Email**: keep **Confirm email** on; set minimum password length to 10 or more.
8. **Authentication, SMTP**: add your own SMTP (Resend, Brevo, Postmark, etc.) so sign-up and password-reset e-mails are reliable. Supabase's built-in sender is heavily rate-limited. Send from your own domain and set up SPF and DKIM with your mail provider.
9. **Pro plan extras** (Settings, Billing and Database): turn on daily backups (and Point-in-time recovery if you can), and sign the data-processing agreement from Supabase's legal documents page.
10. Optional but recommended: **Authentication, Attack protection** (CAPTCHA) and rate limits.

## Part 2: Put the site online (GitHub Pages)

1. Create a **private** GitHub repository (Pages works from private repos on paid GitHub plans; otherwise use a public repo, which is fine because no secrets live in the site).
2. Upload the contents of the `website` folder to the repository root (so `index.html` is at the top level). Do not upload anything containing the `service_role` key.
3. Repository **Settings, Pages**: Source = **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
4. **Custom domain**: in Settings, Pages, enter your domain (e.g. `www.yourdomain.co.uk`). At your DNS provider add a `CNAME` record pointing `www` to `<your-github-username>.github.io`. For the bare domain add the four GitHub `A` records listed in GitHub's Pages documentation. Wait for DNS (minutes to a few hours), then tick **Enforce HTTPS**.
5. Go back to Supabase (Part 1, step 6) and make sure the Site URL and redirect URLs use the final live address.

Separate URLs per theme (all on the same site and database):
- Cymru: `/` and `/portal/app.html`
- Practice Plan: `/portal/practiceplan.html`
- Draigworks (Draig Dental Compliance): `/dw/` and `/portal/draigworks.html`

To serve a theme on its own domain, put a copy of the site in a second repository (or use a subdomain pointing at the same Pages site) and set that domain's redirect URLs in Supabase too.

## Part 3: First sign-in and secure set-up

1. Open the live `/portal/app.html`, choose **Create account** with the admin e-mail from Part 1, step 2, and confirm via the e-mail. You are platform admin.
2. Settings: **turn on two-factor** (authenticator app) for your account. Do the same for every Principal and Group Admin. (It is offered but not enforced by the system, so make it a rule.)
3. **Users and invites**: create groups and practices, then invite each person's e-mail. Sign-up is invitation-only: the database rejects any e-mail you have not invited. The app does not send the invite; tell the person to go to the portal and **Create account** with that e-mail.
4. Test with real roles before customers do: sign in as a Principal, a Staff member, a Group Admin and an Inspector (use test e-mails). Upload a file, add a staff record, request and approve leave, run a self-assessment, log a fridge temperature, and check that each role sees only what it should.
5. Confirm the demo-role box does not appear on the live portal.

## Part 4: Reminder e-mails (optional)

1. Create a Resend account, verify your sending domain, and create an API key.
2. In the GitHub repo: **Settings, Secrets and variables, Actions** add: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (the service_role key; keep it only here), `RESEND_API_KEY`, `MAIL_FROM` (e.g. `Draig Dental Compliance <alerts@yourdomain.co.uk>`), `PORTAL_URL`.
3. **Actions, Expiry reminder e-mails, Run workflow** with *dry run = 1* first and read the log. Then it runs weekdays at 07:30 UTC.

## Part 5: Website housekeeping

1. `sitemap.xml` and `robots.txt` currently use relative paths. Replace them with full URLs (`https://www.yourdomain.co.uk/index.html`, etc.).
2. The `/dw/` pages are set to `noindex`. Remove that tag in `scripts/build-dw.py` (then re-run `python3 scripts/build-dw.py`) if you want them in search.
3. Replace the footer **Privacy policy** and **Terms of service** `#` links with real pages.
4. Check the contact form: submissions are saved to the Supabase `enquiries` table (read them in the portal under Enquiries) and the contact address is solutions@draigworks.uk.
5. Add analytics only if you also add a cookie notice that matches what you use.

## Part 6: Launch checklist

- [ ] Pro plan, backups on, DPA signed
- [ ] Privacy policy, terms and staff privacy notice published
- [ ] SMTP working (test a password reset)
- [ ] HTTPS enforced on the custom domain
- [ ] Redirect URLs match the live domain
- [ ] Two-factor on for admin, Principals and Group Admins
- [ ] Every role tested with a real login
- [ ] `service_role` key appears nowhere in the repository or site files
- [ ] Welsh proofread; HIW questions reviewed
- [ ] Re-run and read `supabase/tests/rls_test.py` against a copy of the database if you change any SQL

## Known limits to tell customers

- Payments and billing are not built; billing is a recorded preference only.
- Scores are calculated in the browser (fine for a first release; move scoring into the database later if you need tamper-proof scores).
- Deleting evidence is deliberately not possible from the app (audit trail).
- The live Supabase connection, e-mail sending and file uploads have only been tested in a simulated environment. Do a full first-run pass yourself.

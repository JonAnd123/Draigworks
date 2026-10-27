# Cymru Compliance — website

Static, mobile-responsive marketing site plus a "coming soon" client portal
landing page, built from `Cymru-Compliance-PRDv2.docx`. No backend, no build
step, no paid services required — every file here can be uploaded as-is.

## What's in here

| File | Purpose |
|---|---|
| `index.html` | Home / value proposition |
| `services.html` | All 7 portal features (dashboard, evidence upload, induction training, compliance check, additional training, practice manager training, pre-inspection visit) plus group accounts |
| `pricing.html` | Solo / Practice Plus / Group packages + add-ons |
| `hiw-guide.html` | Plain-English HIW inspection explainer, trust/SEO content |
| `contact.html` | Demo booking + expression of interest, independent vs. group paths |
| `portal.html` | "Coming soon" client portal shell with waitlist signup |
| `css/style.css` | Shared design system (colours, layout, components) |
| `js/main.js` | Mobile nav, language switcher, form handling |
| `js/translations.js` | Welsh (Cymraeg) text, keyed to match the English in each page |
| `img/` | Logo exports (header size, favicons, transparent version) |

## 1. Publish it for free — GitHub Pages

1. Create a free GitHub account if you don't have one, and a new **public**
   repository (e.g. `cymru-compliance-website`).
2. Upload every file in this folder to the repository, keeping the folder
   structure (`css/`, `js/`, `img/` must stay alongside the `.html` files).
   Easiest way: on the repo page, **Add file → Upload files**, drag the
   whole folder contents in, commit.
3. Go to **Settings → Pages** in the repository.
4. Under **Build and deployment**, set **Source** to `Deploy from a branch`,
   branch `main`, folder `/ (root)`. Save.
5. GitHub gives you a live URL within a minute or two, in the form
   `https://<your-username>.github.io/cymru-compliance-website/`.
6. Optional — a proper domain: buy `cymrucompliance.co.uk` (or similar) from
   any UK registrar (~£10/year — the only cost in this whole setup), then in
   the same **Settings → Pages** screen add it as a **Custom domain**. GitHub
   gives you the DNS records to add at your registrar; GitHub Pages itself
   stays free either way.

Cloudflare Pages and Netlify are equally good free alternatives if you'd
rather not use GitHub — both work by connecting a repo or dragging the same
folder in, and both have a free tier that comfortably covers a site this
size.

## 2. How the enquiry forms work right now

`contact.html` and `portal.html` both submit via a `mailto:` link (built in
`js/main.js`) rather than to a server — because there is no backend, this is
the only zero-cost option that needs no third-party account. When someone
submits, their own email client opens with the enquiry pre-filled, addressed
to `jonathan.milton.anderson@gmail.com`.

**Trade-off to know about:** this only works if the visitor has an email
client configured on their device, and it relies on them actually hitting
"send" in that client — so some enquiries will be lost from people on
locked-down work machines or unfamiliar with mailto links.

**Upgrade path, still free:** sign up for a free [Formspree](https://formspree.io)
or [Netlify Forms](https://docs.netlify.com/forms/setup/) account (both have
a no-cost tier), then swap the `mailto:` logic in `initMailtoForm()` for a
plain `fetch()` POST to your form endpoint. Straightforward change, isolated
to `js/main.js`, and doesn't require moving off GitHub Pages.

## 3. Welsh (Cymraeg) translation — please review before going live

All Welsh text in `js/translations.js` was drafted to a professional
standard, but **has not been checked by a native Welsh speaker or
proofreader**. Given "genuinely bilingual" is a stated brand differentiator
in the PRD, and this is a compliance product credibility matters for, it's
worth getting a native speaker (or a service like the Welsh Government's
translation unit / a freelance cyfieithydd) to check `js/translations.js`
before this goes live publicly. The English in the HTML files is the source
of truth; Welsh only needs sign-off on that one file.

## 4. The portal and backend

The logged-in portal (dashboard, evidence, training, self-assessment, groups, inspector access, admin) is built and runs in demo mode out of the box. See **BACKEND.md** for connecting it to Supabase and for known limitations.

## 5. Editing content later

Everything is plain HTML/CSS/JS — no build tools, no `npm install`, no
compilation step. To change text: edit the English directly in the relevant
`.html` file, then update the matching key in `js/translations.js` if it has
a `data-i18n="..."` attribute. To change colours or spacing: edit the CSS
variables at the top of `css/style.css`. Open any `.html` file directly in a
browser to preview changes before uploading.

## Themes
- `portal/app.html` — Cymru Compliance (blue)
- `portal/practiceplan.html` — Practice Plan white-label (black and gold)
- `portal/draigworks.html` — Draigworks theme, branded "Draig Dental Compliance" with the Draigworks logo (near-black, red/coral accents; `portal/css/theme-draigworks.css`)
- `/dw/` — Draigworks-themed copies of the marketing pages (`dw/index.html` etc., `css/theme-draigworks.css`). Generated: after editing a root page run `python3 scripts/build-dw.py`. They are marked noindex so they don't compete with the main pages in search.

All themes and the marketing site footer show a "Powered by Draigworks" badge linking to https://www.draigworks.uk (transparent logos in `img/draigworks-white.png` / `-dark.png`, injected by `portal/js/app.js` and `js/main.js`).

## Theme choice and hidden features

- **Draig portal** (`portal/draigworks.html`) opens in the dark theme. Under Settings, Appearance, each user can switch to Light (the Cymru colours). The choice is stored per login (Supabase `user_metadata.theme`; in demo mode, browser storage) and applied after sign-in. `portal/js/theme.js` does the switching; no database change is needed.
- **Pre-inspection visits and Practice Manager training** are hidden for now. Portal: set `FEATURE_PM_AND_VISITS: true` in `js/site-config.js` to bring them back. Marketing pages: remove the class `later` from the hidden items in `index.html`, `services.html` and `pricing.html`, then run `python3 scripts/build-dw.py`.

## Policies (templates linked to Evidence)

- There are 23 master policy templates (`scripts/policies_src1-3.py`). Run `python3 scripts/build-policies.py` after editing them: it rewrites `supabase/08_policy_templates.sql` and `portal/js/policies-content.js`.
- Every practice automatically gets its own copy of every policy (database trigger). A copy is an Evidence record in the Policies category, so it shows in both Policies and Evidence. `{{practice}}` in the master is replaced with the practice name; `[square brackets]` are details for the practice to complete.
- Platform admin edits the masters (Policies, Master templates). Editing a master raises its version; existing copies are not overwritten, practices see "Newer template" and can reset to it.
- Principal, Practice Manager and Group Admin (for practices in their group) edit a practice's copy, or replace it with an uploaded PDF, PNG or JPG. Saving adopts the policy, sets the next review date and asks staff to read it again.
- Staff read policies in the browser (an uploaded file opens in an inline viewer with no download button; PDFs open with the toolbar hidden). Other roles can also download. This stops casual downloading but cannot technically stop a determined person saving what is on their screen.
- A policy copy only counts towards the compliance score once adopted.
- Database migration: run `supabase/08_policy_templates.sql` once (safe to re-run). Tests: `python3 supabase/tests/setup_db.py && python3 supabase/tests/rls_test.py`.

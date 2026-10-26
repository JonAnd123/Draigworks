# E-mail notifications (enquiries and invites)

Out of the box the portal does **not** send these e-mails:

- **Website enquiries** (Book a demo, Register interest, Request access) are saved in the Supabase `enquiries` table. You read them in the portal under **Enquiries** (platform admin). Nothing is e-mailed to you.
- **Portal invites** (Users & invites, Practices, Team) only add the address to the allow-list. The invitee is not e-mailed; they must go to the portal and choose **Create account** with that address.

(Sign-up confirmation and password-reset e-mails are separate: those come from Supabase Auth and use the SMTP settings under Authentication.)

The Edge Function in `supabase/functions/notify/index.ts` adds both e-mails, sent through your own SMTP account (Zoho Mail by default).

## Set-up (about 15 minutes, no command line needed)

1. **Supabase, Edge Functions, Deploy a new function, Via Editor.** Name it `notify`. Paste the contents of `supabase/functions/notify/index.ts`, then Deploy.
2. **Edge Functions, Secrets** (or the function's Secrets tab): add
   | Name | Example value |
   |---|---|
   | `SMTP_HOST` | `smtp.zoho.eu` (or `smtp.zoho.com`) |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | `solutions@draigworks.uk` |
   | `SMTP_PASS` | the Zoho password, or an app password if two-factor is on |
   | `MAIL_FROM` | `Draig Dental Compliance <solutions@draigworks.uk>` (must be your Zoho address or alias) |
   | `NOTIFY_TO` | `solutions@draigworks.uk` |
   | `PORTAL_URL` | `https://draigworks.uk/dental-compliance/portal/draigworks.html` |
   | `BRAND_NAME` | `Draig Dental Compliance` |
3. **Database, Webhooks, Create a new hook** (do this twice):
   - Hook 1: name `enquiry-email`, table `enquiries`, event **Insert**, type **Supabase Edge Functions**, function `notify`.
   - Hook 2: name `invite-email`, table `invites`, event **Insert**, type **Supabase Edge Functions**, function `notify`.
   (If you can't see Webhooks, enable it under Database, Extensions: `pg_net`.)
4. **Test:** submit the Book a demo form on the site; an e-mail should arrive at `NOTIFY_TO`. Then invite a test address in the portal; that address should receive the invite e-mail. If nothing arrives, open Edge Functions, `notify`, **Logs** to see the error (wrong SMTP password and a blocked port are the usual causes).

## Notes

- Use a different branded copy of the function (or set `BRAND_NAME` / `PORTAL_URL`) if you run the Cymru and Draigworks versions from the same database; they share one function, so the invite link goes to whichever `PORTAL_URL` you set.
- Zoho limits how many e-mails you can send per day; fine for enquiries and invites.
- The function never receives or stores passwords; the SMTP password lives only in Supabase secrets.

## If Zoho keeps saying "535 Authentication Failed"

1. Redeploy the updated function (it now logs the SMTP host, port, user and password *length*, never the password) and trigger it again. In Logs, check:
   - `user=` is exactly your full Zoho address (no spaces, right domain).
   - `passLength` matches your app password (Zoho app passwords are 12 characters), and `passHasSpace=false`.
   - `host=` matches your Zoho account: `smtppro.zoho.eu` for a custom-domain mailbox on zoho.eu (`smtppro.zoho.com` for .com); `smtp.zoho.eu` only for free personal accounts.
2. Prove the login works outside Supabase: add the mailbox to Outlook or Thunderbird (outgoing server, port 465 SSL, same user and app password). If that fails too, the problem is in Zoho (SMTP/IMAP access disabled, plan without SMTP, wrong app password), not in the function.
3. Simplest alternative: use **Resend** instead of SMTP. Create a free Resend account, add and verify `draigworks.uk` (it gives you DNS records to add), create an API key, then add secrets `RESEND_API_KEY` and set `MAIL_FROM` to an address on that domain (e.g. `Draig Dental Compliance <solutions@draigworks.uk>`). When `RESEND_API_KEY` is present the function uses it and ignores the SMTP secrets.

## E-mail signature

Invite e-mails end with a signature (name, contact line and the Draigworks logo). Edit the defaults in `signature()` in `supabase/functions/notify/index.ts`, or override them without changing code using Supabase secrets: `SIG_NAME`, `SIG_CONTACT`, `SIG_LOGO` (a full https image address, or `none` for no logo). The enquiry notification you receive also carries it. Redeploy the function after editing.

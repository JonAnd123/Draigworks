// Supabase Edge Function: e-mail notifications for new website enquiries and new portal invites.
// Called by two Database Webhooks (see docs/EMAIL-NOTIFICATIONS.md):
//   enquiries INSERT -> e-mail to NOTIFY_TO (your inbox)
//   invites   INSERT -> e-mail to the invited person with a link to the portal
// Sends through any SMTP account (e.g. Zoho Mail). Secrets are set in the Supabase dashboard, never in the site.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const env = (k: string, d = "") => (Deno.env.get(k) ?? d).trim().replace(/^["']|["']$/g, "");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// E-mail signature added to e-mails sent to other people (invites). Change the text here, or override with secrets:
// SIG_NAME, SIG_CONTACT, SIG_LOGO (full https URL of an image; leave unset for the default Draigworks logo, SIG_LOGO=none for no logo).
function signature() {
  const name = env("SIG_NAME", "The Draig Dental Compliance team");
  const contact = env("SIG_CONTACT", "solutions@draigworks.uk  |  www.draigworks.uk");
  const logo = env("SIG_LOGO", "https://draigworks.uk/dental-compliance/img/draigworks-dark.png");
  const text = `\n\n--\n${name}\n${contact}\n`;
  const html = `<table cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid #dde2ea;padding-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#445">` +
    `<tr><td>` + (logo !== "none" ? `<img src="${esc(logo)}" alt="Draigworks" height="26" style="display:block;margin-bottom:8px;height:26px;width:auto">` : "") +
    `<b style="color:#111">${esc(name)}</b><br>${esc(contact)}</td></tr></table>`;
  return { text, html };
}

async function send(to: string, subject: string, text: string, html: string, replyTo?: string) {
  // Option A: Resend (HTTPS API, no SMTP login). Used when the RESEND_API_KEY secret is set.
  if (env("RESEND_API_KEY")) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + env("RESEND_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({ from: env("MAIL_FROM"), to: [to], subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!r.ok) throw new Error("Resend " + r.status + ": " + (await r.text()));
    return;
  }
  // Option B: SMTP (e.g. Zoho Mail)
  const host = env("SMTP_HOST", "smtp.zoho.eu"), port = Number(env("SMTP_PORT", "465")), user = env("SMTP_USER"), pass = env("SMTP_PASS");
  // safe diagnostics (never logs the password itself)
  console.log(`SMTP try host=${host} port=${port} user="${user}" passLength=${pass.length} passHasSpace=${/\s/.test(pass)} from="${env("MAIL_FROM")}"`);
  if (!user || !pass) throw new Error("SMTP_USER or SMTP_PASS secret is empty or missing");
  // Zoho only lets an account send as itself (or a registered alias). Always send FROM the login address;
  // keep the display name from MAIL_FROM, and put any other configured address in Reply-To.
  const m = env("MAIL_FROM").match(/^\s*(?:"?([^"<]*?)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?\s*$/);
  const display = (m && m[1] ? m[1].trim() : env("BRAND_NAME", "Draig Dental Compliance"));
  const wanted = m ? m[2] : user;
  const isEmail = (v: string) => /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v);
  const fromAddr = isEmail(user) ? user : wanted;   // login may be a plain username; the From must be a real address
  if (!isEmail(fromAddr)) throw new Error(`No valid sender address. SMTP_USER="${user}" MAIL_FROM="${env("MAIL_FROM")}" - set SMTP_USER to the full mailbox address`);
  if (wanted.toLowerCase() !== user.toLowerCase()) console.log(`MAIL_FROM address ${wanted} differs from SMTP_USER ${user}: sending from ${user} (alias not assumed)`);
  const client = new SMTPClient({ connection: { hostname: host, port, tls: true, auth: { username: user, password: pass } } });
  try {
    await client.send({ from: `${display} <${fromAddr}>`, to, subject, content: text, html, ...(replyTo ? { replyTo } : wanted.toLowerCase() !== user.toLowerCase() ? { replyTo: wanted } : {}) });
  } finally {
    try { await client.close(); } catch (_) { /* ignore */ }
  }
}

Deno.serve(async (req) => {
  try {
    const p = await req.json();
    if (p.type !== "INSERT" || !p.record) return new Response("ignored", { status: 200 });
    const r = p.record;
    const brand = env("BRAND_NAME", "Draig Dental Compliance");
    const portal = env("PORTAL_URL");

    if (p.table === "enquiries") {
      const rows: [string, unknown][] = [["Type", r.kind], ["Practice type", r.practice_type], ["Name", r.name], ["Email", r.email],
        ["Practice / group", r.practice_name], ["Number of practices", r.sites], ["Role", r.role], ["Message", r.message], ["Language", r.language]];
      const lines = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
      const text = lines.map(([k, v]) => `${k}: ${v}`).join("\n") + signature().text;
      const html = "<table cellpadding=6>" + lines.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join("") + "</table>" + signature().html;
      await send(env("NOTIFY_TO", "solutions@draigworks.uk"), `${brand} enquiry (${r.kind}) from ${r.name}`, text, html, r.email);
    } else if (p.table === "invites") {
      const text = `Hello${r.full_name ? " " + r.full_name : ""},\n\nYou have been invited to ${brand}.\n\n` +
        `1. Open ${portal}\n2. Choose "Create account" and use this e-mail address: ${r.email}\n3. Confirm your e-mail address when asked.\n\n` +
        `If you were not expecting this invitation you can ignore this message.` + signature().text;
      const html = `<p>Hello${r.full_name ? " " + esc(r.full_name) : ""},</p><p>You have been invited to <b>${esc(brand)}</b>.</p>` +
        `<ol><li>Open <a href="${esc(portal)}">${esc(portal)}</a></li><li>Choose <b>Create account</b> and use this e-mail address: <b>${esc(r.email)}</b></li><li>Confirm your e-mail address when asked.</li></ol>` +
        `<p>If you were not expecting this invitation you can ignore this message.</p>` + signature().html;
      await send(r.email, `You're invited to ${brand}`, text, html);
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
});

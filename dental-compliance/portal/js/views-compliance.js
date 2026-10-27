/* Views: policy library + sign-off, staff compliance (overview, training matrix, recruitment checklist), other audits */
(function () {
  "use strict";
  var CC = window.CC, S = CC.state, SC = window.CCScoring, T = CC.TOOLS, esc = function (s) { return CC.esc(s); }, t = function (s, v) { return CC.t(s, v); };

  function today() { return CC.isoDate(0); }
  function cy() { return CC.lang === "cy"; }
  function canManage() { var r = CC.role(); return r === "principal" || r === "practice_manager" || r === "platform_admin"; }
  function noPractice(el) { el.innerHTML = '<div class="empty">' + esc(t("No practice selected.")) + "</div>"; }
  function seg(items, active) {
    return '<div class="seg" role="tablist">' + items.map(function (i) { return '<button type="button" role="tab" data-seg="' + i[0] + '" class="' + (i[0] === active ? "active" : "") + '">' + esc(i[1]) + "</button>"; }).join("") + "</div>";
  }
  function rag(p) { return p === null || p === undefined ? "none" : (p >= 85 ? "green" : (p >= 60 ? "amber" : "red")); }
  function pctBar(p) {
    if (p === null || p === undefined) return '<span class="muted">—</span>';
    return '<div style="display:flex;align-items:center;gap:8px"><div class="progress" style="flex:1;min-width:60px"><span style="width:' + p + '%"></span></div><span class="small">' + p + "%</span></div>";
  }
  function addMonths(iso, months) {
    var p = String(iso).slice(0, 10).split("-").map(Number), tm = p[1] - 1 + months, ny = p[0] + Math.floor(tm / 12), nm = ((tm % 12) + 12) % 12;
    var last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
    return new Date(Date.UTC(ny, nm, Math.min(p[2], last))).toISOString().slice(0, 10);
  }
  function peopleOf(pid) {
    return CC.api.profiles.list({ practice_id: pid }).then(function (p) { return p.filter(function (u) { return u.practice_id === pid && u.active && ["principal", "practice_manager", "staff"].indexOf(u.role) >= 0; }); }).catch(function () { return []; });
  }

  /* ---------- shared maths: per-person training / recruitment / policy completeness ---------- */
  function trainingState(row, course) {
    if (!row) return { s: "missing" };
    if (row.status === "na") return { s: "na" };
    if (!row.done_on) return { s: "ok", date: null };
    var exp = addMonths(row.done_on, course[2]);
    return exp >= today() ? { s: "ok", date: row.done_on, exp: exp } : { s: "expired", date: row.done_on, exp: exp };
  }
  function recruitState(row, item, hr) {
    if (row && row.status === "na") return { s: "na" };
    if (row && row.status === "done") return { s: "ok", date: row.done_on };
    if (item[3] && hr[item[3]]) return { s: "ok", derived: true, date: null };
    return { s: "missing" };
  }
  CC.staffScores = function (hrStaff, checklist, policies, reviews, profiles) {
    return hrStaff.filter(function (h) { return h.active !== false; }).map(function (h) {
      var rows = checklist.filter(function (c) { return c.staff_id === h.id; });
      var tr = { ok: 0, na: 0, expired: 0 };
      T.COURSES.forEach(function (c) { var s = trainingState(rows.filter(function (x) { return x.kind === "training" && x.item === c[0]; })[0], c); if (s.s !== "missing") tr[s.s]++; });
      var tApplicable = T.COURSES.length - tr.na, training = tApplicable ? Math.round(100 * tr.ok / tApplicable) : null;
      var rc = { ok: 0, na: 0 };
      T.RECRUIT.forEach(function (c) { var s = recruitState(rows.filter(function (x) { return x.kind === "recruitment" && x.item === c[0]; })[0], c, h); if (s.s !== "missing") rc[s.s]++; });
      var rApplicable = T.RECRUIT.length - rc.na, recruitment = rApplicable ? Math.round(100 * rc.ok / rApplicable) : null;
      var prof = h.email ? profiles.filter(function (p) { return p.email && p.email.toLowerCase() === h.email.toLowerCase(); })[0] : null;
      var policy = null;
      if (prof && policies.length) {
        var done = policies.filter(function (p) { return reviews.some(function (v) { return v.profile_id === prof.id && v.policy_id === p.id && v.version === p.version; }); }).length;
        policy = Math.round(100 * done / policies.length);
      }
      var parts = [training, recruitment, policy].filter(function (x) { return x !== null; });
      return { staff: h, training: training, recruitment: recruitment, policy: policy, expired: tr.expired, overall: parts.length ? Math.round(parts.reduce(function (a, b) { return a + b; }, 0) / parts.length) : null };
    });
  };

  /* ============================== Policies ==============================
     Each practice has its own copy of every policy. A copy is an Evidence record (category "policies"), so it appears
     in both places. It starts as a template; a Principal / Practice Manager (or a Group Admin) edits the text or
     replaces it with an uploaded file. Staff read it in the browser (no download); everyone else can also download. */
  var polState = { filter: "all", tab: "practice" };
  var POL_FILE_MAX = 10 * 1024 * 1024;
  function canEditPolicies() { var r = CC.role(); return r === "principal" || r === "practice_manager" || r === "platform_admin" || r === "group_admin"; }
  function polFields(body) { return CC.rte.fieldCount(body); }
  function polHtml(body) { return CC.rte.render(body); }
  function isImg(name) { return /\.(png|jpe?g)$/i.test(name || ""); }
  function checkPolicyFile(f) {
    if (!f) return;
    if (f.size > POL_FILE_MAX) throw new Error(t("File is larger than 10 MB."));
    if (!/\.(pdf|png|jpe?g)$/i.test(f.name)) throw new Error(t("Please upload a PDF, PNG or JPG file so everyone can read it in the browser."));
  }

  CC.views.policies = function (el) {
    var role = CC.role(), pid = S.practiceId || (S.profile && S.profile.practice_id);
    var isPlatform = role === "platform_admin", editor = canEditPolicies();
    if (!isPlatform) polState.tab = "practice";
    if (polState.tab === "master" && isPlatform) return CC.api.policies.list().then(function (m) { return drawMaster(el, m); });
    if (!pid) return noPractice(el);
    return Promise.all([CC.api.policies.list(pid), CC.api.policies.reviews(pid), peopleOf(pid)]).then(function (r) {
      var pols = r[0], revs = r[1], people = r[2], me = S.profile, manage = canManage() || role === "group_admin";
      function mineDone(p) { return revs.some(function (v) { return v.profile_id === me.id && v.policy_id === p.id && v.version === p.version; }); }
      function teamCount(p) { return people.filter(function (u) { return revs.some(function (v) { return v.profile_id === u.id && v.policy_id === p.id && v.version === p.version; }); }).length; }
      var canSign = ["principal", "practice_manager", "staff"].indexOf(role) >= 0 && !!me.practice_id;
      var todo = canSign ? pols.filter(function (p) { return !mineDone(p); }).length : 0;
      var toAdopt = pols.filter(function (p) { return !p.adopted_at; }).length;
      function title(p) { return cy() && p.title_cy ? p.title_cy : p.title_en; }
      function statusCell(p) {
        var bits = [p.adopted_at ? CC.chip("green", t("Adopted")) : CC.chip("amber", t("Template — to adopt"))];
        if (p.file_name) bits.push('<span class="chip chip-none">' + esc(t("Uploaded file")) + "</span>");
        if (editor && p.master_version > p.template_version) bits.push('<span class="chip chip-none" title="' + esc(t("The master template has been updated since this copy was made.")) + '">' + esc(t("Newer template")) + "</span>");
        var n = p.file_name ? 0 : polFields(p.body_en);
        if (editor && !p.file_name && n) bits.push('<span class="small muted">' + esc(t("{n} fields to complete", { n: n })) + "</span>");
        return bits.join(" ");
      }
      function reviewCell(p) {
        if (!p.adopted_at || !p.expiry_date) return '<span class="muted">—</span>';
        var d = Math.round((new Date(p.expiry_date + "T00:00:00Z") - new Date(today() + "T00:00:00Z")) / 86400000);
        return esc(CC.fmtDate(p.expiry_date)) + (d < 0 ? " " + CC.chip("red", t("Overdue")) : (d <= 30 ? " " + CC.chip("amber", t("Due soon")) : ""));
      }
      function draw() {
        var rows = pols.filter(function (p) { return polState.filter === "all" || (polState.filter === "todo" ? !mineDone(p) : mineDone(p)); });
        el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Policies")) + "</h1><p class=\"muted\">" + esc(t("Your practice's policies. Each one starts as a template: complete the highlighted details, or replace it with your own document. Read each one and confirm you have understood it.")) + "</p></div>" +
          (isPlatform ? '<div class="actions">' + seg([["practice", t("Practice copies")], ["master", t("Master templates")]], polState.tab) + "</div>" : "") + "</div>" +
          '<div class="banner info"><span>' + esc(t("These are starting templates, not legal advice. Add your own names and details, and have a dental compliance adviser check them against HIW's current requirements.")) + "</span></div>" +
          (!isPlatform || canSign ? "" : "") +
          '<div class="grid-kpi">' +
          (canSign ? '<div class="kpi ' + (todo ? "amber" : "green") + '"><div class="label">' + esc(t("Policies to review")) + '</div><div class="value">' + todo + '</div><div class="sub">' + esc(t("{a} of {b} reviewed by you", { a: pols.length - todo, b: pols.length })) + "</div></div>" : "") +
          '<div class="kpi ' + (toAdopt ? "amber" : "green") + '"><div class="label">' + esc(t("Adopted by the practice")) + '</div><div class="value">' + (pols.length - toAdopt) + ' / ' + pols.length + '</div><div class="sub">' + esc(t("Adopted policies count towards the compliance score and appear under Evidence.")) + "</div></div></div>" +
          '<div class="panel">' + seg([["all", t("All policies")], ["todo", t("To review")], ["done", t("Reviewed")]], polState.filter) +
          '<div class="table-wrap" style="margin-top:14px"><table class="data"><thead><tr><th>' + esc(t("Policy")) + "</th><th>" + esc(t("Status")) + "</th><th>" + esc(t("Review due")) + "</th>" + (canSign ? "<th>" + esc(t("You")) + "</th>" : "") + (manage ? "<th>" + esc(t("Team reviewed")) + "</th>" : "") + "<th></th></tr></thead><tbody>" +
          (rows.length ? rows.map(function (p) {
            return "<tr><td><strong>" + esc(title(p)) + '</strong><div class="sub">' + esc(p.ref) + " · " + esc(t(p.folder || "")) + " · v" + p.version + "</div></td><td>" + statusCell(p) + "</td><td>" + reviewCell(p) + "</td>" +
              (canSign ? "<td>" + (mineDone(p) ? CC.chip("green", t("Reviewed")) : CC.chip("amber", t("To review"))) + "</td>" : "") +
              (manage ? "<td>" + esc(teamCount(p) + " / " + people.length) + "</td>" : "") +
              '<td class="actions-cell"><button type="button" class="btn btn-secondary btn-sm" data-act="read" data-id="' + p.id + '">' + esc(t("Read")) + "</button>" +
              (editor ? ' <button type="button" class="btn btn-secondary btn-sm" data-act="edit" data-id="' + p.id + '">' + esc(t("Edit")) + "</button>" : "") +
              (editor && p.master_version > p.template_version ? ' <button type="button" class="btn btn-secondary btn-sm" data-act="preview" data-id="' + p.id + '">' + esc(t("Preview new template")) + "</button>" : "") + "</td></tr>";
          }).join("") : '<tr><td colspan="6"><div class="empty">' + esc(t("No policies match.")) + "</div></td></tr>") +
          "</tbody></table></div></div>";
      }
      draw();
      function reload() { CC.render(); }

      function openRead(p) {
        var done = canSign && mineDone(p), staffOnly = role === "staff";
        var m = CC.modal({ title: title(p), wide: true, hideSubmit: !canSign || done, submitLabel: "I have read and understood",
          body: '<p class="muted small">' + esc(p.ref) + " · " + esc(t(p.folder || "")) + " · v" + p.version + (p.adopted_at ? "" : " · " + esc(t("Template, not yet adopted by the practice"))) + (cy() ? " · " + esc(t("Policy text is in English")) : "") + "</p>" +
            (p.file_path ? '<div class="pol-viewer" id="pol-viewer"><div class="muted small">' + esc(t("Loading document…")) + "</div></div>" + (staffOnly ? "" : '<p style="margin-top:10px"><button type="button" class="btn btn-secondary btn-sm" id="pol-dl">' + esc(t("Download")) + "</button> <span class=\"small muted\">" + esc(p.file_name || "") + "</span></p>")
              : '<div class="policy-body">' + polHtml(p.body_en) + "</div>"),
          onSubmit: function () { return CC.api.policies.review(p.id).then(function () { CC.toast(t("Saved.")); reload(); }); } });
        if (p.file_path) {
          CC.api.evidence.url(p.file_path).then(function (url) {
            var box = m.el.querySelector("#pol-viewer"); if (!box) return;
            box.innerHTML = isImg(p.file_name) ? '<img alt="" src="' + esc(url) + '" style="max-width:100%;height:auto">'
              : '<iframe title="' + esc(title(p)) + '" src="' + esc(url) + (staffOnly ? "#toolbar=0&navpanes=0&scrollbar=1" : "") + '" referrerpolicy="no-referrer" style="width:100%;height:60vh;border:0;background:#fff"></iframe>';
          }).catch(function (e) { var box = m.el.querySelector("#pol-viewer"); if (box) box.textContent = e.message; });
          var dl = m.el.querySelector("#pol-dl");
          if (dl) dl.onclick = function () {
            CC.api.evidence.url(p.file_path, { download: p.file_name || true }).then(function (url) {
              var a = document.createElement("a"); a.href = url; a.download = p.file_name || "policy"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
            }).catch(CC.fail);
          };
        }
      }
      /* compare the practice's copy with the latest master template, and optionally switch to it */
      function openPreview(p) {
        var prac = (S.practices || []).filter(function (x) { return x.id === pid; })[0], pname = prac ? prac.name : "";
        var fresh = String(p.master_body || "").replace(/\{\{practice\}\}/g, pname), view = "new";
        var m = CC.modal({ title: t("Newer template") + ": " + title(p), wide: true, hideSubmit: true,
          body: '<p class="muted small">' + esc(p.ref) + " · " + esc(t("Master template v{n}, your copy was made from v{m}.", { n: p.master_version, m: p.template_version })) + "</p>" +
            '<div class="seg" id="pv-seg"><button type="button" data-v="new" class="active">' + esc(t("New template")) + '</button><button type="button" data-v="mine">' + esc(t("Your current copy")) + "</button></div>" +
            '<div class="policy-body" id="pv-body" style="margin-top:12px"></div>' +
            '<p style="margin-top:12px"><button type="button" class="btn btn-secondary btn-sm" id="pv-use">' + esc(t("Use this template")) + '</button> <span class="small muted">' + esc(t("Replaces your copy and any uploaded file; the policy must then be adopted again.")) + "</span></p>" });
        function show() {
          m.el.querySelector("#pv-body").innerHTML = view === "new" ? polHtml(fresh) : (p.file_name ? '<p class="muted">' + esc(t("Your copy is an uploaded file: {name}", { name: p.file_name })) + "</p>" : polHtml(p.body_en));
          [].forEach.call(m.el.querySelectorAll("#pv-seg button"), function (b) { b.classList.toggle("active", b.getAttribute("data-v") === view); });
        }
        show();
        m.el.querySelector("#pv-seg").onclick = function (e) { var b = e.target.closest("[data-v]"); if (b) { view = b.getAttribute("data-v"); show(); } };
        m.el.querySelector("#pv-use").onclick = function () {
          CC.confirm(t("Replace this policy with the latest master template? Your changes and any uploaded file will be removed and the policy will need adopting again."), t("Reset")).then(function (yes) {
            if (!yes) return;
            CC.api.policies.reset(p).then(function () { CC.api.audit.log("reset_policy", "evidence", p.evidence_id, pid, { title: p.title_en }); m.close(); CC.toast(t("Saved.")); reload(); }).catch(CC.fail);
          });
        };
      }
      function openEdit(p) {
        var exp = p.expiry_date || addMonths(today(), 12), newer = p.master_version > p.template_version;
        var m = CC.modal({ title: t("Edit policy") + ": " + title(p), wide: true, submitLabel: "Save and adopt",
          body: '<p class="muted small">' + esc(p.ref) + " · v" + p.version + " · " + esc(t("Saving adopts this policy for the practice and asks the team to read it again.")) + "</p>" +
            (newer ? '<div class="banner info"><span>' + esc(t("The master template has been updated since this copy was made. You can keep your version or reset to the latest template.")) + '</span> <button type="button" class="btn btn-secondary btn-sm" id="pol-prev">' + esc(t("Preview new template")) + "</button></div>" : "") +
            (p.file_name ? '<div class="banner info"><span>' + esc(t("An uploaded file is currently shown to the team: {name}. Upload another file to replace it, or tick the box below to use the text instead.", { name: p.file_name })) + "</span></div>" : "") +
            '<div class="field"><label>' + esc(t("Policy text")) + '</label>' + CC.rte.editorHtml("body", p.body_en) + '<div class="small muted">' + esc(t("Details in [square brackets] are placeholders for you to complete.")) + "</div></div>" +
            '<div class="field"><label>' + esc(t("Or replace the text with your own document (PDF, PNG or JPG, up to 10 MB)")) + '</label><input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg"><div class="small muted">' + esc(t("Staff read uploaded files in the browser and cannot download them. Other roles can download.")) + "</div></div>" +
            (p.file_name ? '<div class="field checkbox-field"><input type="checkbox" name="removeFile" value="1" id="pol-rm"><label for="pol-rm" style="margin:0;font-weight:500">' + esc(t("Remove the uploaded file and use the text above")) + "</label></div>" : "") +
            '<div class="field"><label>' + esc(t("Next review due")) + '</label><input type="date" name="expiry_date" value="' + esc(exp) + '" required></div>' +
            '<p><button type="button" class="btn btn-secondary btn-sm" id="pol-reset">' + esc(t("Reset to the latest template")) + "</button></p>",
          onSubmit: function (d) {
            checkPolicyFile(d.file);
            if (!d.file && !p.file_name && CC.rte.isEmpty(d.body)) throw new Error(t("Please enter the policy text or upload a file."));
            return CC.api.policies.save(p, { body: d.body || "", expiry_date: d.expiry_date, file: d.file, removeFile: !!d.removeFile }).then(function () {
              CC.api.audit.log("edit_policy", "evidence", p.evidence_id, pid, { title: p.title_en }); CC.toast(t("Saved.")); reload();
            });
          } });
        CC.rte.attach(m.el);
        var pv = m.el.querySelector("#pol-prev"); if (pv) pv.onclick = function () { openPreview(p); };
        m.el.querySelector("#pol-reset").onclick = function () {
          CC.confirm(t("Replace this policy with the latest master template? Your changes and any uploaded file will be removed and the policy will need adopting again."), t("Reset")).then(function (yes) {
            if (!yes) return;
            CC.api.policies.reset(p).then(function () { CC.api.audit.log("reset_policy", "evidence", p.evidence_id, pid, { title: p.title_en }); m.close(); CC.toast(t("Saved.")); reload(); }).catch(CC.fail);
          });
        };
      }
      el.onclick = function (e) {
        var sg = e.target.closest("[data-seg]");
        if (sg) { var v = sg.getAttribute("data-seg"); if (v === "practice" || v === "master") { polState.tab = v; CC.render(); } else { polState.filter = v; draw(); } return; }
        var b = e.target.closest("[data-act]"); if (!b) return;
        var p = pols.filter(function (x) { return String(x.id) === b.getAttribute("data-id"); })[0]; if (!p) return;
        var act = b.getAttribute("data-act"); if (act === "edit") openEdit(p); else if (act === "preview") openPreview(p); else openRead(p);
      };
    });
  };

  /* platform admin: the master library that new practices copy from */
  function drawMaster(el, masters) {
    function title(p) { return cy() && p.title_cy ? p.title_cy : p.title_en; }
    el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Policies")) + "</h1><p class=\"muted\">" + esc(t("Master templates. Every practice has its own copy; editing a master does not change copies that already exist, but practices are told a newer template is available.")) + "</p></div>" +
      '<div class="actions">' + seg([["practice", t("Practice copies")], ["master", t("Master templates")]], polState.tab) + ' <button type="button" class="btn btn-primary" data-act="new">+ ' + esc(t("New policy")) + "</button></div></div>" +
      '<div class="panel"><div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Policy")) + "</th><th>" + esc(t("Folder")) + "</th><th>" + esc(t("Updated")) + "</th><th></th></tr></thead><tbody>" +
      masters.map(function (p) { return "<tr><td><strong>" + esc(title(p)) + '</strong><div class="sub">' + esc(p.ref) + " · v" + p.version + "</div></td><td>" + esc(t(p.folder || "")) + "</td><td>" + esc(CC.fmtDate(p.updated_on)) + '</td><td class="actions-cell"><button type="button" class="btn btn-secondary btn-sm" data-act="edit" data-id="' + p.id + '">' + esc(t("Edit")) + "</button></td></tr>"; }).join("") +
      "</tbody></table></div></div>";
    function form(p) {
      p = p || {};
      return '<div class="cols-2"><div class="field"><label>' + esc(t("Title")) + '</label><input name="title_en" value="' + esc(p.title_en || "") + '" required></div>' +
        '<div class="field"><label>' + esc(t("Title in Welsh")) + '</label><input name="title_cy" value="' + esc(p.title_cy || "") + '"></div></div>' +
        '<div class="field"><label>' + esc(t("Folder")) + '</label><input name="folder" value="' + esc(p.folder || "") + '" placeholder="Governance"></div>' +
        '<div class="field"><label>' + esc(t("Policy text")) + '</label>' + CC.rte.editorHtml("body_en", p.body_en) + '<div class="small muted">' + esc(t("{{practice}} becomes the practice name. Details in [square brackets] are for each practice to complete.")) + "</div></div>";
    }
    el.onclick = function (e) {
      var sg = e.target.closest("[data-seg]"); if (sg) { polState.tab = sg.getAttribute("data-seg"); CC.render(); return; }
      var b = e.target.closest("[data-act]"); if (!b) return;
      if (b.getAttribute("data-act") === "new") {
        var nextRef = "POL" + String(masters.reduce(function (n, x) { return Math.max(n, parseInt(String(x.ref).replace(/\D/g, ""), 10) || 0); }, 0) + 1).padStart(2, "0");
        var mn = CC.modal({ title: t("New policy") + " (" + nextRef + ")", wide: true, submitLabel: "Create and copy to every practice", body: form(),
          onSubmit: function (d) { if (CC.rte.isEmpty(d.body_en)) throw new Error(t("Please enter the policy text or upload a file.")); return CC.api.policies.addMaster({ ref: nextRef, folder: d.folder || null, title_en: d.title_en.trim(), title_cy: d.title_cy || null, body_en: d.body_en }).then(function () { CC.toast(t("Saved.")); CC.render(); }); } });
        CC.rte.attach(mn.el);
      } else {
        var p = masters.filter(function (x) { return String(x.id) === b.getAttribute("data-id"); })[0]; if (!p) return;
        var mm = CC.modal({ title: t("Edit master template") + ": " + p.ref, wide: true, submitLabel: "Save new version", body: form(p),
          onSubmit: function (d) { if (CC.rte.isEmpty(d.body_en)) throw new Error(t("Please enter the policy text or upload a file.")); return CC.api.policies.saveMaster(p.id, { folder: d.folder || null, title_en: d.title_en.trim(), title_cy: d.title_cy || null, body_en: d.body_en }).then(function () { CC.toast(t("Saved.")); CC.render(); }); } });
        CC.rte.attach(mm.el);
      }
    };
  }

  /* ============================== Staff compliance ============================== */
  var scState = { tab: "overview" };
  CC.views.staffcompliance = function (el) {
    var pid = S.practiceId; if (!pid) return noPractice(el);
    return Promise.all([CC.api.hr.staff.list({ practice_id: pid }), CC.api.checklist.list(pid), CC.api.policies.list(pid), CC.api.policies.reviews(pid), peopleOf(pid)]).then(function (r) {
      var hrStaff = r[0].filter(function (h) { return h.active !== false; }), rows = r[1], pols = r[2], revs = r[3], profiles = r[4];
      var editor = canManage(), scores = CC.staffScores(hrStaff, rows, pols, revs, profiles);
      var avg = scores.length ? Math.round(scores.reduce(function (s, x) { return s + (x.overall || 0); }, 0) / scores.length) : null;
      var expired = scores.reduce(function (s, x) { return s + x.expired; }, 0);
      function cellRow(staffId, kind, item) { return rows.filter(function (c) { return c.staff_id === staffId && c.kind === kind && c.item === item; })[0]; }

      function overview() {
        return '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Staff member")) + "</th><th>" + esc(t("Training")) + "</th><th>" + esc(t("Recruitment")) + "</th><th>" + esc(t("Policies")) + "</th><th>" + esc(t("Overall")) + "</th></tr></thead><tbody>" +
          scores.sort(function (a, b) { return (a.overall === null ? -1 : a.overall) - (b.overall === null ? -1 : b.overall); }).map(function (x) {
            return "<tr><td><strong>" + esc(x.staff.full_name) + '</strong><div class="sub">' + esc(x.staff.job_title || "") + "</div></td><td>" + pctBar(x.training) + (x.expired ? '<div class="sub" style="color:#b02f2f">' + esc(t("{n} out of date", { n: x.expired })) + "</div>" : "") + "</td><td>" + pctBar(x.recruitment) + "</td><td>" + pctBar(x.policy) + "</td><td>" + CC.chip(rag(x.overall), x.overall === null ? "—" : x.overall + "%") + "</td></tr>";
          }).join("") + "</tbody></table></div>";
      }
      function trainingGrid() {
        return '<p class="muted small">' + esc(t("Dates show when each course was completed. Courses go out of date after their usual interval. Select a cell to record a date or mark it not applicable.")) + '</p><div class="matrix-scroll"><table class="data matrix mx-wide"><thead><tr><th class="sticky">' + esc(t("Staff member")) + "</th>" +
          T.COURSES.map(function (c) { return '<th class="mx-h" title="' + esc(c[1]) + '">' + esc(cy() ? c[3] : c[1]) + "</th>"; }).join("") + "</tr></thead><tbody>" +
          hrStaff.map(function (h) {
            return '<tr><td class="sticky"><strong>' + esc(h.full_name) + '</strong><div class="sub">' + esc(h.job_title || "") + "</div></td>" + T.COURSES.map(function (c) {
              var s = trainingState(cellRow(h.id, "training", c[0]), c), cls, txt;
              if (s.s === "ok") { cls = "mx-green"; txt = s.date ? CC.fmtDate(s.date) : "✓"; } else if (s.s === "expired") { cls = "mx-red"; txt = CC.fmtDate(s.date); } else if (s.s === "na") { cls = "mx-none"; txt = "N/A"; } else { cls = "mx-amber"; txt = t("Due"); }
              return '<td class="mx ' + cls + '"' + (editor ? ' data-cell="training|' + h.id + "|" + c[0] + '" style="cursor:pointer"' : "") + ' title="' + esc(s.exp ? t("Valid until {d}", { d: CC.fmtDate(s.exp) }) : "") + '">' + esc(txt) + "</td>";
            }).join("") + "</tr>";
          }).join("") + "</tbody></table></div>";
      }
      function recruitGrid() {
        return '<p class="muted small">' + esc(t("A tick means the document is on file. GDC, DBS, indemnity and emergency contact also tick automatically when entered on the HR record.")) + '</p><div class="matrix-scroll"><table class="data matrix mx-wide"><thead><tr><th class="sticky">' + esc(t("Staff member")) + "</th>" +
          T.RECRUIT.map(function (c) { return '<th class="mx-h">' + esc(cy() ? c[2] : c[1]) + "</th>"; }).join("") + "</tr></thead><tbody>" +
          hrStaff.map(function (h) {
            return '<tr><td class="sticky"><strong>' + esc(h.full_name) + '</strong><div class="sub">' + esc(h.job_title || "") + "</div></td>" + T.RECRUIT.map(function (c) {
              var s = recruitState(cellRow(h.id, "recruitment", c[0]), c, h), cls = s.s === "ok" ? "mx-green" : (s.s === "na" ? "mx-none" : "mx-amber"), txt = s.s === "ok" ? (s.date ? CC.fmtDate(s.date) : "✓") : (s.s === "na" ? "N/A" : t("Missing"));
              return '<td class="mx ' + cls + '"' + (editor ? ' data-cell="recruitment|' + h.id + "|" + c[0] + '" style="cursor:pointer"' : "") + (s.derived ? ' title="' + esc(t("From the HR record")) + '"' : "") + ">" + esc(txt) + "</td>";
            }).join("") + "</tr>";
          }).join("") + "</tbody></table></div>";
      }
      function draw() {
        el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Staff compliance")) + "</h1><p class=\"muted\">" + esc(t("Training, recruitment paperwork and policy sign-off for each person.")) + "</p></div></div>" +
          '<div class="grid-kpi"><div class="kpi ' + rag(avg) + '"><div class="label">' + esc(t("Staff compliance")) + '</div><div class="value">' + (avg === null ? "—" : avg + "%") + '</div><div class="sub">' + esc(t("{n} staff", { n: scores.length })) + "</div></div>" +
          '<div class="kpi ' + (expired ? "red" : "green") + '"><div class="label">' + esc(t("Training out of date")) + '</div><div class="value">' + expired + "</div></div></div>" +
          '<div class="panel">' + seg([["overview", t("Overview")], ["training", t("Training matrix")], ["recruitment", t("Recruitment checklist")]], scState.tab) + '<div style="margin-top:14px">' + (hrStaff.length ? (scState.tab === "overview" ? overview() : (scState.tab === "training" ? trainingGrid() : recruitGrid())) : '<div class="empty">' + esc(t("No staff records yet. Add people in HR first.")) + "</div>") + "</div></div>";
      }
      draw();
      el.onclick = function (e) {
        var sg = e.target.closest("[data-seg]"); if (sg) { scState.tab = sg.getAttribute("data-seg"); draw(); return; }
        var c = e.target.closest("[data-cell]"); if (!c || !editor) return;
        var parts = c.getAttribute("data-cell").split("|"), kind = parts[0], sid = parts[1], item = parts[2];
        var h = hrStaff.filter(function (x) { return x.id === sid; })[0], row = cellRow(sid, kind, item);
        var def = kind === "training" ? T.course(item) : T.RECRUIT.filter(function (x) { return x[0] === item; })[0];
        var label = kind === "training" ? (cy() ? def[3] : def[1]) : (cy() ? def[2] : def[1]);
        CC.modal({ title: h.full_name + " — " + label, submitLabel: "Save",
          body: '<div class="field"><label>' + esc(kind === "training" ? t("Completed on") : t("Date on file (optional)")) + '</label><input type="date" name="done_on" value="' + esc(row && row.done_on || "") + '"></div>' +
            '<label class="check-row" style="margin:8px 0"><input type="checkbox" name="na"' + (row && row.status === "na" ? " checked" : "") + "> " + esc(t("Not applicable to this person")) + "</label>" +
            (row ? '<label class="check-row"><input type="checkbox" name="clear"> ' + esc(t("Clear this record")) + "</label>" : ""),
          onSubmit: function (d) {
            if (d.clear) return CC.api.checklist.clear(sid, kind, item).then(function () { CC.render(); });
            if (!d.na && kind === "training" && !d.done_on) throw new Error(t("Enter the date it was completed, or mark it not applicable."));
            return CC.api.checklist.set({ practice_id: S.practiceId, staff_id: sid, kind: kind, item: item, status: d.na ? "na" : "done", done_on: d.na ? null : (d.done_on || null) }).then(function () { CC.toast(t("Saved.")); CC.render(); });
          } });
      };
    });
  };

  /* ============================== Other audits ============================== */
  var auState = { kind: "ipc" };
  var ANS = [["yes", "Yes"], ["partial", "Partly"], ["no", "No"], ["na", "N/A"]];
  function scoreOf(answers) {
    var v = { yes: 1, partial: 0.5, no: 0 }, a = answers.filter(function (x) { return x.answer !== "na"; });
    return a.length ? Math.round(100 * a.reduce(function (s, x) { return s + v[x.answer]; }, 0) / a.length) : null;
  }
  function qText(q) { return cy() && q.text_cy ? q.text_cy : q.text_en; }
  function kindTitle(k) { var d = CC.AUDITS.KINDS.filter(function (x) { return x.key === k; })[0]; return d ? (cy() ? d.cy : d.title) : k; }

  CC.views.audits = function (el) {
    var pid = S.practiceId; if (!pid) return noPractice(el);
    var kinds = CC.AUDITS.KINDS.filter(function (k) { return k.key !== "hiw"; });
    var kind = auState.kind;
    return Promise.all([CC.api.assessment.list(pid, kind), CC.api.assessment.questions(kind)]).then(function (r) {
      var list = r[0], questions = r[1], done = list.filter(function (a) { return a.status === "completed"; }), open = list.filter(function (a) { return a.status === "in_progress"; })[0];
      var tabsHtml = seg(kinds.map(function (k) { return [k.key, cy() ? k.cy : k.title]; }), kind);
      if (open) return runForm(el, pid, open, questions, tabsHtml, done);
      var last = done[0];
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Audits")) + "</h1><p class=\"muted\">" + esc(t("Routine audits inspectors expect to see. The HIW self-assessment is under Compliance check.")) + "</p></div>" +
        '<div class="actions"><button class="btn btn-primary" data-act="start">' + esc(done.length ? t("Start a new audit") : t("Start your first audit")) + "</button></div></div>" +
        '<div class="panel">' + tabsHtml + '<h3 style="margin-top:14px">' + esc(kindTitle(kind)) + '</h3><p class="muted small">' + esc(t("{n} questions", { n: questions.length })) + (last ? " · " + esc(t("Last score {s}% on {d}", { s: last.score === null ? "—" : last.score, d: CC.fmtDate(last.completed_at) })) : "") + "</p>" +
        (done.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Completed")) + "</th><th>" + esc(t("Score")) + "</th><th></th></tr></thead><tbody>" +
          done.map(function (a) { return "<tr><td>" + esc(CC.fmtDateTime(a.completed_at)) + "</td><td>" + (a.score === null ? "—" : CC.chip(rag(a.score), a.score + "%")) + '</td><td class="actions-cell"><button class="btn btn-secondary btn-sm" data-act="report" data-id="' + a.id + '">' + esc(t("Gap report")) + "</button></td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">' + esc(t("No audits completed yet.")) + "</div>") + "</div>";
      el.onclick = function (e) {
        var sg = e.target.closest("[data-seg]"); if (sg) { auState.kind = sg.getAttribute("data-seg"); CC.render(); return; }
        var b = e.target.closest("[data-act]"); if (!b) return;
        if (b.getAttribute("data-act") === "start") CC.api.assessment.start(pid, last && last.id, kind).then(function () { CC.api.audit.log("start_audit", "assessment", kind, pid); CC.render(); }).catch(CC.fail);
        else gapReport(b.getAttribute("data-id"), questions, done);
      };
    });
  };

  function runForm(el, pid, a, questions, tabsHtml, done) {
    return CC.api.assessment.answers(a.id).then(function (saved) {
      var ans = {}; saved.forEach(function (x) { ans[x.question_id] = { answer: x.answer, note: x.note || "" }; });
      var sections = []; questions.forEach(function (q) { var s = q.section || q.category; if (sections.indexOf(s) < 0) sections.push(s); });
      function progress() { return Object.keys(ans).length + " / " + questions.length; }
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(kindTitle(a.kind || auState.kind)) + "</h1><p class=\"muted\">" + esc(t("Answers save automatically. Complete the audit to generate your gap report.")) + "</p></div>" +
        '<div class="actions"><span class="chip chip-blue" id="prog">' + esc(t("Answered")) + " " + progress() + '</span><button class="btn btn-primary" data-act="complete">' + esc(t("Complete audit")) + "</button></div></div>" +
        sections.map(function (s) {
          return '<div class="panel"><h3>' + esc(t(s)) + "</h3>" + questions.filter(function (q) { return (q.section || q.category) === s; }).map(function (q) {
            var cur = ans[q.id] || {};
            return '<div class="q-card" data-q="' + q.id + '"><div class="q-text"><span class="q-ref">' + esc(q.ref) + "</span>" + esc(qText(q)) + '</div><div class="answers">' +
              ANS.map(function (o) { return '<label><input type="radio" name="q' + q.id + '" value="' + o[0] + '"' + (cur.answer === o[0] ? " checked" : "") + '><span class="a-' + o[0] + '">' + esc(t(o[1])) + "</span></label>"; }).join("") + '</div><textarea placeholder="' + esc(t("Notes or action required (optional)")) + '" rows="1">' + esc(cur.note || "") + "</textarea></div>";
          }).join("") + "</div>";
        }).join("");
      function save(qid) { var c = ans[qid]; if (!c || !c.answer) return; CC.api.assessment.save(a.id, [{ question_id: +qid, answer: c.answer, note: c.note }]).catch(CC.fail); document.getElementById("prog").textContent = t("Answered") + " " + progress(); }
      el.onchange = function (e) { if (e.target.type !== "radio") return; var qid = e.target.closest("[data-q]").getAttribute("data-q"); ans[qid] = { answer: e.target.value, note: (ans[qid] && ans[qid].note) || "" }; save(qid); };
      el.addEventListener("focusout", function (e) { if (e.target.tagName !== "TEXTAREA") return; var qid = e.target.closest("[data-q]").getAttribute("data-q"); if (ans[qid]) { ans[qid].note = e.target.value; save(qid); } });
      el.onclick = function (e) {
        var b = e.target.closest("[data-act]"); if (!b || b.getAttribute("data-act") !== "complete") return;
        var missing = questions.filter(function (q) { return !ans[q.id]; }).length;
        if (missing) { CC.toast(t("{n} questions still need an answer.", { n: missing }), "err"); return; }
        var score = scoreOf(Object.keys(ans).map(function (k) { return ans[k]; }));
        CC.api.assessment.complete(a.id, score).then(function () { CC.api.audit.log("complete_audit", "assessment", a.id, pid, { kind: a.kind || auState.kind, score: score }); CC.toast(t("Audit completed.")); return CC.api.assessment.list(pid, a.kind || auState.kind); }).then(function (list) {
          var d2 = list.filter(function (x) { return x.status === "completed"; });
          return CC.render().then(function () { gapReport(a.id, questions, d2); });
        }).catch(CC.fail);
      };
    });
  }

  function gapReport(aid, questions, done) {
    var a = done.filter(function (x) { return x.id === aid; })[0] || {};
    CC.api.assessment.answers(aid).then(function (ans) {
      var order = { no: 0, partial: 1 };
      var gaps = ans.filter(function (x) { return x.answer === "no" || x.answer === "partial"; }).sort(function (x, y) { return order[x.answer] - order[y.answer]; });
      var body = '<p class="muted">' + esc(t("Completed {d}", { d: CC.fmtDateTime(a.completed_at) })) + " · " + esc(t("Score")) + ": <strong>" + (a.score === null || a.score === undefined ? "—" : a.score + "%") + "</strong></p>" +
        (gaps.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Ref")) + "</th><th>" + esc(t("Requirement")) + "</th><th>" + esc(t("Result")) + "</th><th>" + esc(t("Action / notes")) + "</th></tr></thead><tbody>" +
          gaps.map(function (g) { var q = questions.filter(function (x) { return x.id === g.question_id; })[0] || {}; return "<tr><td><strong>" + esc(q.ref) + "</strong></td><td>" + esc(qText(q)) + "</td><td>" + CC.chip(g.answer === "no" ? "red" : "amber", t(g.answer === "no" ? "No" : "Partly")) + "</td><td>" + esc(g.note || "") + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">' + esc(t("No gaps identified. Well done.")) + "</div>") +
        '<p><button type="button" class="btn btn-secondary btn-sm" onclick="window.print()">' + esc(t("Print / save as PDF")) + "</button></p>";
      CC.modal({ title: t("Gap report"), body: body, hideSubmit: true, wide: true });
    }).catch(CC.fail);
  }
})();

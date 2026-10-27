/* DEMO data + API for tasks, maintenance register, digital logs, policy library, staff checklists.
   Mirrors supabase/06_compliance_tools.sql (real enforcement is in the database). */
(function () {
  "use strict";
  var CC = window.CC, T = CC.TOOLS;

  function today() { return new Date().toISOString().slice(0, 10); }
  function addD(off) { var d = new Date(); d.setUTCDate(d.getUTCDate() + off); return d.toISOString().slice(0, 10); }
  function ts(offDays, hour) { var d = new Date(); d.setUTCDate(d.getUTCDate() + offDays); d.setUTCHours(hour || 9, 0, 0, 0); return d.toISOString(); }
  function rng(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  var n = 0; function nid(p) { n++; return p + "_" + n + "_" + Math.random().toString(36).slice(2, 6); }

  /* policy master library + one editable copy per practice (an evidence row with policy_id), mirrors supabase/08 */
  CC.demoPoliciesSeed = function (db) {
    db.policies = T.POLICIES.map(function (p, i) { return { id: i + 1, ref: p[0], folder: p[1], title_en: p[2], title_cy: p[3], body_en: p[4], version: 1, updated_on: addD(-60 - i * 9) }; });
    db.evidence = (db.evidence || []).filter(function (e) { return !e.policy_id; });
    var adoptN = { p1: 20, p2: 14, p3: 8, p4: 18 };
    db.practices.forEach(function (pr) {
      db.policies.forEach(function (m, i) {
        var adopted = i < (adoptN[pr.id] === undefined ? 6 : adoptN[pr.id]);
        db.evidence.push({ id: "pol_" + pr.id + "_" + m.id, practice_id: pr.id, category: "policies", title: m.title_en, policy_id: m.id,
          body: m.body_en.replace(/\{\{practice\}\}/g, pr.name), template_version: 1, current_version: 1,
          adopted_at: adopted ? ts(-40 - i * 3) : null, status: adopted ? "verified" : "pending", expiry_date: adopted ? addD(330 - i * 9) : null,
          staff_member: null, file_path: null, file_name: null, uploaded_by: null, verified_by: null, verified_at: null, created_at: ts(-70), updated_at: ts(-40 - i * 3) });
      });
    });
    db.policy_copies_v2 = true;
  };

  /* ---------- seed ---------- */
  CC.demoToolsSeed = function (db) {
    db.tasks = []; db.task_completions = []; db.maintenance = []; db.logs = []; db.policy_reviews = []; db.checklist = [];
    CC.demoPoliciesSeed(db);

    // extra audit question sets (HIW questions already present)
    db.questions = db.questions.map(function (q) { return Object.assign({}, q); });
    db.questions.forEach(function (q) { q.kind = q.kind || "hiw"; });
    if (!db.questions.some(function (q) { return q.kind !== "hiw"; })) {
      var maxId = db.questions.reduce(function (m, q) { return Math.max(m, q.id); }, 0);
      CC.AUDITS.Q.forEach(function (q, i) { db.questions.push({ id: maxId + 1 + i, kind: q[0], category: q[1], section: q[1], ref: q[2], text_en: q[3], text_cy: q[4], hint_en: null, sort: 1000 + i }); });
    }
    (db.assessments || []).forEach(function (a) { a.kind = a.kind || "hiw"; });

    // tasks: [library index, offset, assignee]
    var plan = {
      p1: { off: [-2, 3, 1, 12, 9, 18, 25, 40, 70, 95, 130, 200, 60, 20, 45, 150, 80], assign: { 0: "u_st1", 1: "u_st2", 2: "u_pm1", 3: "u_st1" } },
      p2: { off: [-5, -1, 4, 10, 6, -12, 30, 50, 90, 110, 140, 210, 70, 30, 55, 160, 85], assign: { 0: "u_st3" }, only: [0, 1, 2, 3, 4, 5, 6, 7, 10, 13, 15] },
      p3: { off: [-9, -6, -3, -20, -2, -30, -8, -15, 20, 40, 60, 80, 15, -5, 35, 90, 25], assign: { 0: "u_st4" }, only: [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 13, 15] },
      p4: { off: [2, 4, 5, 22, 8, 10, 40, 70, 100, 120, 180, 250, 90, 40, 75, 200, 110], assign: {}, only: [0, 1, 2, 4, 7, 11, 13, 15] }
    };
    Object.keys(plan).forEach(function (pid) {
      var pl = plan[pid];
      T.TASK_LIBRARY.forEach(function (lib, i) {
        if (pl.only && pl.only.indexOf(i) < 0) return;
        var t = { id: nid("tk"), practice_id: pid, title: lib[0], title_cy: lib[3], category: lib[1], frequency: lib[2], assignee_id: pl.assign[i] || null, next_due: addD(pl.off[i]), last_done: null, active: true, notes: null, created_by: "u_pr" + pid.slice(1), created_at: ts(-90) };
        db.tasks.push(t);
        if (pid === "p1" && pl.off[i] > -3) {   // history of recent completions
          var back = T.FREQ.filter(function (f) { return f[0] === lib[2]; })[0];
          var gap = back[3] || (back[2] * 30), cnt = Math.min(3, Math.floor(90 / gap));
          for (var k = 1; k <= cnt; k++) db.task_completions.push({ id: nid("tc"), task_id: t.id, practice_id: pid, due_date: addD(-k * gap), done_on: addD(-k * gap + 1), done_by: t.assignee_id || "u_pm1", note: null, created_at: ts(-k * gap) });
          if (cnt) t.last_done = addD(-gap + 1);
        }
      });
    });

    // maintenance register
    var done = {
      p1: [-60, -330, -330, -300, -700, -350, -100, -100, -380, -400, -120, -90, -180, -200, -210, -150, -400, -500, -120, -140, -90],
      p2: [-250, -90, -90, -500, -900, -400, -380, -380, -300, -400, null, null, null, -300, null, -100, -250, -600, -350, null, null],
      p3: [-420, -380, -380, -900, null, -800, -500, -500, -500, null, null, null, null, null, null, null, -1000, null, null, null, null],
      p4: [-100, -50, -50, -200, -600, -100, -60, -60, -60, -60, -70, -80, -90, -100, null, -40, -300, -300, -50, -60, -70]
    };
    Object.keys(done).forEach(function (pid) {
      T.MAINT_LIBRARY.forEach(function (m, i) {
        var last = done[pid][i] == null ? null : addD(done[pid][i]);
        db.maintenance.push({ id: nid("mt"), practice_id: pid, grp: m[0], name: m[1], name_cy: m[3], frequency: m[2], last_done: last, next_due: last ? T.nextDue(m[2], last) : null, notes: null, active: true, updated_at: ts(-10) });
      });
    });

    // digital logs for practice 1 (and a couple for others)
    var r = rng(4242), users = ["u_st1", "u_st2", "u_pm1"];
    function addLog(pid, key, off, data, who) {
      var def = T.logDef(key);
      db.logs.push({ id: nid("lg"), practice_id: pid, log_type: key, entry_date: addD(off), data: data, pass: T.logPass(def, data), note: null, done_by: who || users[Math.floor(r() * users.length)], created_at: ts(off, 8 + Math.floor(r() * 9)) });
    }
    for (var d = -13; d <= 0; d++) {
      var dow = new Date(addD(d) + "T12:00:00Z").getUTCDay(); if (dow === 0 || dow === 6) continue;
      addLog("p1", "fridge", d, { temp: d === -5 ? 9.5 : 3 + Math.round(r() * 30) / 10, reset: true });
      addLog("p1", "autoclave", d, { start: true, end: d !== -3, printout: true, cycles: 4 + Math.floor(r() * 6) });
      if (d > -8) addLog("p1", "washer", d, { daily: true, chamber: true, cycle: true, cycles: 3 + Math.floor(r() * 4) });
      addLog("p1", "xray", d, { unit: "Intra-oral", taken: 3 + Math.floor(r() * 8), rejected: Math.floor(r() * 2), justified: true });
    }
    [-21, -14, -7, 0].forEach(function (o) { addLog("p1", "emergency", o, { drugs: true, oxygen: true, aed: o !== -14, suction: true, kit: true }); });
    addLog("p1", "legionella", -12, { hot: 54, cold: 17, flush: true });
    [-3, -2, -1, 0].forEach(function (o) { addLog("p2", "fridge", o, { temp: 4.1, reset: true }, "u_st3"); addLog("p2", "autoclave", o, { start: true, end: true, printout: true, cycles: 5 }, "u_pr2"); });
    addLog("p3", "fridge", -9, { temp: 4.4, reset: true }, "u_st4");

    // policy sign-off
    var sign = { p1: { u_pr1: 12, u_pm1: 14, u_st1: 12, u_st2: 9 }, p2: { u_pr2: 10, u_st3: 6 }, p3: { u_pr3: 5, u_st4: 2 }, p4: { u_pr4: 13 } };
    Object.keys(sign).forEach(function (pid) {
      Object.keys(sign[pid]).forEach(function (u) {
        db.policies.slice(0, sign[pid][u]).forEach(function (p) { db.policy_reviews.push({ policy_id: p.id, profile_id: u, practice_id: pid, version: 1, reviewed_at: ts(-30 - p.id) }); });
      });
    });

    // staff training + recruitment checklists
    var quality = { p1: 0.85, p2: 0.55, p3: 0.25, p4: 0.7 }, rr = rng(777);
    db.hr_staff.forEach(function (s) {
      var q = quality[s.practice_id];
      T.COURSES.forEach(function (c) {
        var x = rr(); if (x > q) return;
        var months = c[2], age = Math.round(rr() * months * 30 * (x < q * 0.2 ? 1.5 : 0.9));
        db.checklist.push({ id: nid("ck"), practice_id: s.practice_id, staff_id: s.id, kind: "training", item: c[0], status: "done", done_on: addD(-age), note: null, updated_at: ts(-5) });
      });
      T.RECRUIT.forEach(function (c) {
        if (rr() > q) return;
        db.checklist.push({ id: nid("ck"), practice_id: s.practice_id, staff_id: s.id, kind: "recruitment", item: c[0], status: "done", done_on: addD(-Math.round(rr() * 600)), note: null, updated_at: ts(-5) });
      });
    });
    return db;
  };

  /* ---------- API ---------- */
  CC.makeDemoTools = function (X) {
    var ok = X.ok, deny = X.deny;
    function D() { return X.db(); }
    function flat(e) {
      var m = D().policies.filter(function (x) { return x.id === e.policy_id; })[0] || {};
      return { id: e.policy_id, evidence_id: e.id, practice_id: e.practice_id, ref: m.ref, folder: m.folder, title_en: m.title_en, title_cy: m.title_cy, body_en: e.body || "",
        version: e.current_version, template_version: e.template_version, master_version: m.version, master_body: m.body_en, updated_on: String(e.updated_at || "").slice(0, 10),
        adopted_at: e.adopted_at, file_path: e.file_path, file_name: e.file_name, expiry_date: e.expiry_date, status: e.status };
    }
    function inPractice(pid) { var m = X.me(); return !!m && m.practice_id === pid && ["principal", "practice_manager", "staff"].indexOf(m.role) >= 0; }
    function myHr() { var m = X.me(); if (!m) return null; return D().hr_staff.filter(function (h) { return h.practice_id === m.practice_id && h.active && h.email && h.email.toLowerCase() === m.email.toLowerCase(); })[0] || null; }

    function advance(t) {
      if (t.frequency === "once") { t.active = false; return null; }
      var nxt = T.nextDue(t.frequency, t.next_due), g = 0;
      while (nxt && nxt <= today() && g < 400) { nxt = T.nextDue(t.frequency, nxt); g++; }
      return nxt;
    }
    function recalc(m) {
      if (m.last_done && m.frequency !== "once") m.next_due = T.nextDue(m.frequency, m.last_done);
      else if (m.last_done && m.frequency === "once") m.next_due = null;
      m.updated_at = new Date().toISOString();
    }
    function validFreq(f) { return T.FREQ.some(function (x) { return x[0] === f; }); }

    return {
      tasks: {
        list: function (pid) {
          var me = X.me(); if (!me) return ok([]);
          var rows = D().tasks.filter(function (t) { return t.practice_id === pid; });
          if (!(X.canManage(pid) || X.isGA(pid))) rows = rows.filter(function (t) { return t.assignee_id === me.id; });
          return ok(rows);
        },
        add: function (rows) {
          for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            if (!X.canBook(r.practice_id)) return deny();
            if (!validFreq(r.frequency)) return deny("Invalid frequency");
            if (r.assignee_id) { var u = X.byId(D().profiles, r.assignee_id); if (!u || u.practice_id !== r.practice_id) return deny("Assignee must belong to the practice"); }
          }
          rows.forEach(function (r) { D().tasks.push(Object.assign({ id: nid("tk"), title_cy: null, category: null, assignee_id: null, last_done: null, active: true, notes: null, created_by: X.uid(), created_at: new Date().toISOString() }, r)); });
          X.save(); return ok();
        },
        update: function (id, patch) {
          var t = X.byId(D().tasks, id); if (!t || !X.canBook(t.practice_id)) return deny();
          if (patch.assignee_id) { var u = X.byId(D().profiles, patch.assignee_id); if (!u || u.practice_id !== t.practice_id) return deny("Assignee must belong to the practice"); }
          if (patch.frequency && !validFreq(patch.frequency)) return deny("Invalid frequency");
          Object.assign(t, patch); X.save(); return ok(t);
        },
        remove: function (id) { var t = X.byId(D().tasks, id); if (!t || !X.canBook(t.practice_id)) return deny(); D().tasks = D().tasks.filter(function (x) { return x.id !== id; }); X.save(); return ok(); },
        complete: function (id, note) {
          var t = X.byId(D().tasks, id), me = X.me();
          if (!t || !t.active) return deny("Task not found");
          if (!(X.canManage(t.practice_id) || (t.assignee_id && me && t.assignee_id === me.id))) return deny();
          D().task_completions.push({ id: nid("tc"), task_id: t.id, practice_id: t.practice_id, due_date: t.next_due, done_on: today(), done_by: me.id, note: note || null, created_at: new Date().toISOString() });
          var nxt = advance(t); t.last_done = today(); if (nxt) t.next_due = nxt;
          X.logAudit("complete_task", "task", t.id, t.practice_id, { title: t.title }); X.save(); return ok(nxt);
        },
        completions: function (pid) {
          var me = X.me(); if (!me) return ok([]);
          var rows = D().task_completions.filter(function (c) { return c.practice_id === pid; });
          if (!(X.canManage(pid) || X.isGA(pid))) rows = rows.filter(function (c) { return c.done_by === me.id; });
          return ok(rows);
        }
      },

      maintenance: {
        list: function (pid) { if (!(X.canManage(pid) || X.isGA(pid) || X.grantOk(pid))) return ok([]); return ok(D().maintenance.filter(function (m) { return m.practice_id === pid; })); },
        add: function (rows) {
          for (var i = 0; i < rows.length; i++) { if (!X.canManage(rows[i].practice_id)) return deny(); if (!validFreq(rows[i].frequency)) return deny("Invalid frequency"); }
          rows.forEach(function (r) { var m = Object.assign({ id: nid("mt"), grp: null, name_cy: null, last_done: null, next_due: null, notes: null, active: true }, r); recalc(m); D().maintenance.push(m); });
          X.save(); return ok();
        },
        update: function (id, patch) {
          var m = X.byId(D().maintenance, id); if (!m || !X.canManage(m.practice_id)) return deny();
          Object.assign(m, patch); recalc(m); X.save(); return ok(m);
        },
        remove: function (id) { var m = X.byId(D().maintenance, id); if (!m || !X.canManage(m.practice_id)) return deny(); D().maintenance = D().maintenance.filter(function (x) { return x.id !== id; }); X.save(); return ok(); }
      },

      logs: {
        list: function (pid, f) {
          if (!X.canRead(pid)) return ok([]);
          var rows = D().logs.filter(function (l) { return l.practice_id === pid && (!f || !f.type || l.log_type === f.type); });
          rows.sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
          return ok(rows.slice(0, (f && f.limit) || 400));
        },
        add: function (row) {
          var me = X.me(); if (!me || !inPractice(row.practice_id)) return deny();
          if (!T.logDef(row.log_type)) return deny("Unknown log type");
          var l = { id: nid("lg"), practice_id: row.practice_id, log_type: row.log_type, entry_date: row.entry_date || today(), data: row.data || {}, pass: row.pass !== false, note: row.note || null, done_by: me.id, created_at: new Date().toISOString() };
          D().logs.push(l); X.save(); return ok(l);
        }
      },

      policies: {
        /* no practice: the master library. With a practice: that practice's copies, shaped like master rows */
        list: function (pid) {
          if (!X.me()) return ok([]);
          if (!pid) return ok(D().policies);
          if (!(X.canRead(pid) || X.isGA(pid))) return ok([]);
          return ok(D().evidence.filter(function (e) { return e.practice_id === pid && e.policy_id; }).map(flat).sort(function (a, b) { return a.ref.localeCompare(b.ref); }));
        },
        reviews: function (pid) {
          var me = X.me(); if (!me) return ok([]);
          var rows = D().policy_reviews.filter(function (r) { return r.practice_id === pid; });
          if (!(X.canManage(pid) || X.isGA(pid))) rows = rows.filter(function (r) { return r.profile_id === me.id; });
          return ok(rows);
        },
        review: function (policyId) {
          var me = X.me();
          if (!me || !me.practice_id || ["principal", "practice_manager", "staff"].indexOf(me.role) < 0) return deny();
          var c = D().evidence.filter(function (e) { return e.policy_id === policyId && e.practice_id === me.practice_id; })[0];
          if (!c) return deny();
          if (D().policy_reviews.some(function (r) { return r.policy_id === policyId && r.profile_id === me.id && r.version === c.current_version; })) return ok();
          D().policy_reviews.push({ policy_id: policyId, profile_id: me.id, practice_id: me.practice_id, version: c.current_version, reviewed_at: new Date().toISOString() });
          X.save(); return ok();
        },
        /* edit this practice's copy: new text and/or an uploaded file; counts as adopting it */
        save: function (p, patch) {
          var c = X.byId(D().evidence, p.evidence_id), me = X.me();
          if (!c || !(X.canManage(c.practice_id) || X.isGA(c.practice_id))) return deny();
          c.body = patch.body; c.current_version++; c.adopted_at = new Date().toISOString(); c.status = "verified"; c.verified_by = me.id; c.verified_at = c.adopted_at;
          c.expiry_date = patch.expiry_date || null; c.uploaded_by = me.id; c.updated_at = c.adopted_at;
          if (patch.file) { c.file_name = patch.file.name; c.file_path = c.practice_id + "/demo-policy-" + c.policy_id + "-v" + c.current_version; }
          else if (patch.removeFile) { c.file_name = null; c.file_path = null; }
          D().versions.push({ id: nid("v"), evidence_id: c.id, version: c.current_version, file_path: c.file_path, file_name: c.file_name, expiry_date: c.expiry_date, body: c.body, uploaded_by: me.id, created_at: c.updated_at });
          X.logAudit("edit_policy", "evidence", c.id, c.practice_id, { title: c.title }); X.save(); return ok(flat(c));
        },
        reset: function (p) {
          var c = X.byId(D().evidence, p.evidence_id), m = c && D().policies.filter(function (x) { return x.id === c.policy_id; })[0];
          if (!c || !m || !(X.canManage(c.practice_id) || X.isGA(c.practice_id))) return deny();
          var pr = X.byId(D().practices, c.practice_id);
          c.body = m.body_en.replace(/\{\{practice\}\}/g, pr.name); c.template_version = m.version; c.current_version++; c.adopted_at = null; c.status = "pending"; c.expiry_date = null;
          c.file_name = null; c.file_path = null; c.updated_at = new Date().toISOString();
          X.logAudit("reset_policy", "evidence", c.id, c.practice_id, { title: c.title }); X.save(); return ok(flat(c));
        },
        saveMaster: function (id, patch) {
          var m = D().policies.filter(function (x) { return x.id === id; })[0], me = X.me();
          if (!m || !me || me.role !== "platform_admin") return deny();
          Object.assign(m, patch); m.version++; m.updated_on = today(); X.save(); return ok(m);
        },
        addMaster: function (row) {
          var me = X.me(); if (!me || me.role !== "platform_admin") return deny();
          var id = D().policies.reduce(function (n, x) { return Math.max(n, x.id); }, 0) + 1;
          var m = Object.assign({ id: id, version: 1, updated_on: today(), title_cy: null }, row); D().policies.push(m);
          D().practices.forEach(function (pr) {
            D().evidence.push({ id: "pol_" + pr.id + "_" + id, practice_id: pr.id, category: "policies", title: m.title_en, policy_id: id, body: (m.body_en || "").replace(/\{\{practice\}\}/g, pr.name), template_version: 1, current_version: 1,
              adopted_at: null, status: "pending", expiry_date: null, staff_member: null, file_path: null, file_name: null, uploaded_by: null, verified_by: null, verified_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          });
          X.save(); return ok(m);
        }
      },

      checklist: {
        list: function (pid) {
          var me = X.me(); if (!me) return ok([]);
          var rows = D().checklist.filter(function (c) { return c.practice_id === pid; });
          if (!(X.canManage(pid) || X.isGA(pid))) { var h = myHr(); rows = rows.filter(function (c) { return h && c.staff_id === h.id; }); }
          return ok(rows);
        },
        set: function (row) {
          if (!X.canManage(row.practice_id)) return deny();
          var s = X.byId(D().hr_staff, row.staff_id); if (!s || s.practice_id !== row.practice_id) return deny("Staff member does not belong to this practice");
          var ex = D().checklist.filter(function (c) { return c.staff_id === row.staff_id && c.kind === row.kind && c.item === row.item; })[0];
          if (ex) Object.assign(ex, { status: row.status || "done", done_on: row.done_on || null, note: row.note || null, updated_at: new Date().toISOString() });
          else D().checklist.push({ id: nid("ck"), practice_id: row.practice_id, staff_id: row.staff_id, kind: row.kind, item: row.item, status: row.status || "done", done_on: row.done_on || null, note: row.note || null, updated_at: new Date().toISOString() });
          X.save(); return ok();
        },
        clear: function (staffId, kind, item) {
          var s = X.byId(D().hr_staff, staffId); if (!s || !X.canManage(s.practice_id)) return deny();
          D().checklist = D().checklist.filter(function (c) { return !(c.staff_id === staffId && c.kind === kind && c.item === item); });
          X.save(); return ok();
        }
      }
    };
  };
})();

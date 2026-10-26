/* Theme choice: "dark" (Draig, default) or "light" (Cymru colours). Remembered per login. */
(function () {
  var CC = window.CC = window.CC || {};
  var DEF = window.CC_DEFAULT_THEME || "light";
  function link() { return document.getElementById("cc-theme-css"); }
  function apply(th) {
    th = th === "light" ? "light" : "dark";
    if (!link()) th = "light";            /* pages without a dark stylesheet stay light */
    document.documentElement.setAttribute("data-theme", th);
    var l = link(); if (l) l.media = th === "dark" ? "all" : "not all";
    if (link()) { try { localStorage.setItem("cc_theme_pref", th); } catch (e) {} }
    return th;
  }
  CC.theme = {
    available: function () { return !!link(); },
    current: function () { return document.documentElement.getAttribute("data-theme") || DEF; },
    apply: apply,
    /* after sign-in: use the saved choice for this user, else the default */
    load: function () {
      return CC.api.getTheme().then(function (t) { apply(t || DEF); }, function () { apply(DEF); });
    },
    set: function (th) { apply(th); return CC.api.setTheme(th); },
    reset: function () { apply(DEF); }
  };
  var last = null; try { if (link()) last = localStorage.getItem("cc_theme_pref"); } catch (e) {}
  apply(last || DEF);
})();

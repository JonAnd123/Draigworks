/* Small Word-style editor for policy text: toolbar + editable area, stored as simple, sanitised HTML.
   Old policies are plain text with "## heading" and "- bullet" lines; they are converted when first opened. */
(function () {
  "use strict";
  var CC = window.CC = window.CC || {};
  function esc(s) { return CC.esc ? CC.esc(s) : String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function t(s) { return CC.t ? CC.t(s) : s; }

  /* ---------- plain text (## / -) to HTML ---------- */
  function fromText(body) {
    var out = [], list = false;
    function end() { if (list) { out.push("</ul>"); list = false; } }
    String(body || "").split("\n").forEach(function (line) {
      var l = esc(line);
      if (/^## /.test(line)) { end(); out.push("<h3>" + l.slice(3) + "</h3>"); }
      else if (/^- /.test(line)) { if (!list) { out.push("<ul>"); list = true; } out.push("<li>" + l.slice(2) + "</li>"); }
      else if (!line.trim()) { end(); }
      else { end(); out.push("<p>" + l + "</p>"); }
    });
    end(); return out.join("");
  }
  function looksLikeHtml(s) { return /^\s*<(p|h[1-6]|ul|ol|div)\b/i.test(String(s || "")); }

  /* ---------- sanitiser: whitelist of tags, no attributes ---------- */
  var KEEP = { P: "p", H2: "h2", H3: "h3", H4: "h4", UL: "ul", OL: "ol", LI: "li", STRONG: "strong", B: "strong", EM: "em", I: "em", U: "u", BR: "br", BLOCKQUOTE: "blockquote" };
  var DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, LINK: 1, META: 1, TEMPLATE: 1, NOSCRIPT: 1, SVG: 1, MATH: 1 };
  var TOBLOCK = { DIV: "p", H1: "h2", H5: "h4", H6: "h4" };
  function sanitize(html) {
    var doc = new DOMParser().parseFromString("<body>" + String(html || "") + "</body>", "text/html");
    function walk(node) {
      var out = "";
      node.childNodes.forEach(function (n) {
        if (n.nodeType === 3) { out += esc(n.nodeValue); return; }
        if (n.nodeType !== 1) return;
        var tag = n.tagName;
        if (DROP[tag]) return;
        var inner = walk(n), name = KEEP[tag] || TOBLOCK[tag];
        if (tag === "SPAN" && n.style) {
          var st = n.getAttribute("style") || "";
          if (/font-weight:\s*(bold|[6-9]00)/i.test(st)) inner = "<strong>" + inner + "</strong>";
          if (/font-style:\s*italic/i.test(st)) inner = "<em>" + inner + "</em>";
          if (/text-decoration[^;]*underline/i.test(st)) inner = "<u>" + inner + "</u>";
        }
        if (!name) { out += inner; return; }
        out += name === "br" ? "<br>" : "<" + name + ">" + inner + "</" + name + ">";
      });
      return out;
    }
    return walk(doc.body).replace(/<p>(\s|<br>)*<\/p>/g, "");
  }
  function toHtml(body) { return sanitize(looksLikeHtml(body) ? body : fromText(body)); }

  /* highlight [placeholders] in text nodes only */
  function mark(html) {
    var doc = new DOMParser().parseFromString("<body>" + html + "</body>", "text/html");
    var walker = doc.createTreeWalker(doc.body, 4), nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (tn) {
      if (!/\[[^\]\n]{2,80}\]/.test(tn.nodeValue)) return;
      var span = doc.createElement("span");
      span.innerHTML = esc(tn.nodeValue).replace(/\[([^\]\n]{2,80})\]/g, '<mark class="pol-field">[$1]</mark>');
      tn.parentNode.replaceChild(span, tn);
    });
    return doc.body.innerHTML.replace(/<\/?span>/g, "");
  }
  function plain(body) { return toHtml(body).replace(/<[^>]+>/g, " "); }
  function fieldCount(body) { return (plain(body).match(/\[[^\]\n]{2,80}\]/g) || []).length; }
  function render(body) { return mark(toHtml(body)); }
  function isEmpty(html) { return !String(html || "").replace(/<[^>]+>/g, "").trim(); }

  /* ---------- editor ---------- */
  var BTN = [
    ["bold", "<b>B</b>", "Bold"], ["italic", "<i>I</i>", "Italic"], ["underline", "<u>U</u>", "Underline"], "|",
    ["insertUnorderedList", "&bull;&nbsp;List", "Bullet list"], ["insertOrderedList", "1.&nbsp;List", "Numbered list"], "|",
    ["outdent", "&larr;", "Decrease indent"], ["indent", "&rarr;", "Increase indent"], "|",
    ["undo", "&#8630;", "Undo"], ["redo", "&#8631;", "Redo"], ["removeFormat", "T<sub>x</sub>", "Clear formatting"]
  ];
  function editorHtml(name, body) {
    return '<div class="rte" data-rte="' + esc(name) + '"><div class="rte-bar" role="toolbar" aria-label="' + esc(t("Formatting")) + '">' +
      '<select class="rte-block" aria-label="' + esc(t("Style")) + '"><option value="p">' + esc(t("Normal text")) + '</option><option value="h2">' + esc(t("Title")) + '</option><option value="h3">' + esc(t("Heading")) + '</option><option value="h4">' + esc(t("Subheading")) + "</option></select>" +
      BTN.map(function (b) { return b === "|" ? '<span class="rte-sep"></span>' : '<button type="button" class="rte-btn" data-cmd="' + b[0] + '" title="' + esc(t(b[2])) + '" aria-label="' + esc(t(b[2])) + '">' + b[1] + "</button>"; }).join("") +
      '</div><div class="rte-area policy-body" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true">' + toHtml(body) + '</div><input type="hidden" name="' + esc(name) + '"></div>';
  }
  function attach(root) {
    var box = root.querySelector(".rte"); if (!box) return;
    var area = box.querySelector(".rte-area"), hidden = box.querySelector('input[type="hidden"]'), sel = box.querySelector(".rte-block");
    function sync() { hidden.value = isEmpty(area.innerHTML) ? "" : sanitize(area.innerHTML); }
    function exec(cmd, val) { area.focus(); try { document.execCommand(cmd, false, val || null); } catch (e) {} sync(); }
    box.querySelector(".rte-bar").addEventListener("mousedown", function (e) { if (!e.target.closest("select")) e.preventDefault(); });
    box.querySelector(".rte-bar").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cmd]"); if (b) exec(b.getAttribute("data-cmd"));
    });
    sel.addEventListener("change", function () { exec("formatBlock", "<" + sel.value + ">"); });
    area.addEventListener("input", sync);
    area.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) { var k = e.key.toLowerCase(); if (k === "b" || k === "i" || k === "u") { e.preventDefault(); exec({ b: "bold", i: "italic", u: "underline" }[k]); } }
    });
    area.addEventListener("paste", function (e) {
      var cd = e.clipboardData; if (!cd) return;
      e.preventDefault();
      var h = cd.getData("text/html"), txt = cd.getData("text/plain");
      exec("insertHTML", h ? sanitize(h) : fromText(txt).replace(/<\/?(h3|ul|li)>/g, ""));
    });
    area.addEventListener("keyup", function () {
      var b = ""; try { b = String(document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>]/g, ""); } catch (e) {}
      sel.value = /^(h2|h3|h4)$/.test(b) ? b : "p";
    });
    sync();
  }
  CC.rte = { sanitize: sanitize, toHtml: toHtml, fromText: fromText, render: render, fieldCount: fieldCount, isEmpty: isEmpty, editorHtml: editorHtml, attach: attach };
})();

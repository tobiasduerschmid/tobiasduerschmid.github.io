/**
 * Safe inline Markdown rendering for tutorial chrome.
 *
 * The tutorial body is rendered server-side, but UI chrome such as step titles
 * and raw-HTML <summary> labels needs a tiny client-side inline pass. Keep this
 * intentionally narrow: allow common inline tags, strip attributes by default,
 * and fall back to code-span rendering when marked.js is not present.
 */
(function () {
  'use strict';

  function escapeHtml(value) {
    var d = document.createElement('div');
    d.textContent = value == null ? '' : String(value);
    return d.innerHTML;
  }

  function fallbackText(text) {
    return escapeHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }

  function fallbackRender(text) {
    var raw = text == null ? '' : String(text);
    var out = '';
    var last = 0;
    var re = /`([^`\n]+)`/g;
    var match;
    while ((match = re.exec(raw))) {
      out += fallbackText(raw.slice(last, match.index));
      out += '<code>' + escapeHtml(match[1]) + '</code>';
      last = match.index + match[0].length;
    }
    out += fallbackText(raw.slice(last));
    return out;
  }

  function safeUrl(value) {
    var url = String(value || '').trim();
    var compact = url.replace(/[\u0000-\u001f\u007f\s]+/g, '').toLowerCase();
    if (/^(?:javascript|data|vbscript):/.test(compact)) return null;
    return url;
  }

  function sanitizeInlineHtml(html) {
    var template = document.createElement('template');
    template.innerHTML = html || '';
    var allowed = {
      a: true,
      abbr: true,
      br: true,
      code: true,
      del: true,
      em: true,
      kbd: true,
      s: true,
      samp: true,
      small: true,
      span: true,
      strong: true,
      sub: true,
      sup: true,
    };

    function scrub(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType !== 1) return;
        var tag = child.tagName.toLowerCase();
        if (!allowed[tag]) {
          child.parentNode.replaceChild(document.createTextNode(child.textContent || ''), child);
          return;
        }
        Array.prototype.slice.call(child.attributes).forEach(function (attr) {
          var name = attr.name.toLowerCase();
          if (tag === 'a' && name === 'href') {
            var href = safeUrl(attr.value);
            if (href) child.setAttribute('href', href);
            else child.removeAttribute(attr.name);
            return;
          }
          if (tag === 'a' && name === 'title') {
            child.setAttribute('data-original-title', attr.value);
            return;
          }
          if (tag === 'abbr' && name === 'title') {
            child.setAttribute('title', attr.value);
            child.setAttribute('data-no-tooltip', 'true');
            return;
          }
          child.removeAttribute(attr.name);
        });
        scrub(child);
      });
    }

    scrub(template.content);
    return template.innerHTML;
  }

  function render(text) {
    var raw = text == null ? '' : String(text);
    if (!raw) return '';
    if (window.marked && typeof window.marked.parseInline === 'function') {
      return sanitizeInlineHtml(window.marked.parseInline(raw));
    }
    return fallbackRender(raw);
  }

  function renderTextOnly(rootEl, selector) {
    if (!rootEl || !rootEl.querySelectorAll) return;
    Array.prototype.forEach.call(rootEl.querySelectorAll(selector), function (el) {
      if (el.getAttribute('data-sebook-inline-markdown') === 'done') return;
      if (el.children && el.children.length > 0) return;
      var text = el.textContent || '';
      if (!/[`*_~\[]/.test(text)) return;
      el.innerHTML = render(text);
      el.setAttribute('data-sebook-inline-markdown', 'done');
    });
  }

  function renderSummaries(rootEl) {
    renderTextOnly(rootEl, 'summary');
  }

  function renderStepTitles(rootEl) {
    renderTextOnly(rootEl, '.step-title');
  }

  window.SebookInlineMarkdown = {
    render: render,
    renderSummaries: renderSummaries,
    renderStepTitles: renderStepTitles,
    _sanitizeInlineHtml: sanitizeInlineHtml,
  };
})();

(function (global) {
  'use strict';

  var debounceTimers = {};

  function toHtml(markdown) {
    var text = String(markdown || '');
    if (!text.trim()) return '';
    if (typeof marked === 'undefined') return text;
    var raw = marked.parse(text, { breaks: true, gfm: true });
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    }
    return raw;
  }

  function updatePreview(el, markdown) {
    if (!el) return;
    el.innerHTML = toHtml(markdown);
    el.classList.toggle('gm-markdown--empty', !String(markdown || '').trim());
  }

  function debouncedPreview(previewEl, markdown, delay) {
    if (!previewEl) return;
    var key = previewEl.id || previewEl.className;
    if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
    debounceTimers[key] = setTimeout(function () {
      updatePreview(previewEl, markdown);
    }, delay || 150);
  }

  global.MarkdownRender = {
    toHtml: toHtml,
    updatePreview: updatePreview,
    debouncedPreview: debouncedPreview
  };
})(typeof window !== 'undefined' ? window : this);

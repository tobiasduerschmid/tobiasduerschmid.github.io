/* Keep optional citations from leaving gaps before punctuation or joining words. */
(function () {
  function prepareCitationSpacing() {
    const content = document.querySelector('.blog-post-content');
    if (!content) return;

    const text = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.data && !node.parentElement.closest('.citation, .blog-citation-spacing')
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    content.querySelectorAll('.citation').forEach(function (citation) {
      text.currentNode = citation;
      const previous = text.previousNode();
      const spacing = previous && previous.data.match(/\s+$/);
      if (!spacing) return;

      text.currentNode = citation;
      const next = text.nextNode();
      // Preserve the separator before a word or opening delimiter. Otherwise,
      // the following whitespace already separates words, or punctuation closes
      // the phrase. Hide optional spacing separately so it is never underlined
      // or included in the citation's clickable area.
      if (next && !/^[\s.,;:!?…%\)\]\}”’»]/u.test(next.data)) return;
      previous.data = previous.data.slice(0, -spacing[0].length);
      const separator = document.createElement('span');
      separator.className = 'blog-citation-spacing';
      separator.textContent = spacing[0];
      citation.before(separator);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', prepareCitationSpacing);
  } else {
    prepareCitationSpacing();
  }
})();

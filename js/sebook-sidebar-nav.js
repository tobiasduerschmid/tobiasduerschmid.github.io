(function () {
  'use strict';

  function setSectionExpanded(section, toggle, expanded) {
    section.classList.toggle('open', expanded);
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function sectionToggle(section) {
    return section.querySelector(
      ':scope > .sebook-nav-row > .sebook-nav-toggle, ' +
      ':scope > .sebook-nav-subrow > .sebook-nav-toggle'
    );
  }

  function initSidebarNav(nav) {
    nav.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var toggle = target.closest('.sebook-nav-toggle');
      if (!toggle || !nav.contains(toggle)) return;

      var section = toggle.closest('.sebook-nav-item.has-subtopics, .sebook-nav-subitem.has-subitems');
      if (!section) return;

      event.stopPropagation();
      setSectionExpanded(section, toggle, !section.classList.contains('open'));
    });

    nav.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;

      var focused = document.activeElement;
      if (!focused || !nav.contains(focused)) return;

      var section = focused.closest('.sebook-nav-subitem.open, .sebook-nav-item.open');
      if (!section) return;

      var toggle = sectionToggle(section);
      if (!toggle) return;

      event.preventDefault();
      setSectionExpanded(section, toggle, false);
      toggle.focus();
    });
  }

  function initAllSidebarNavs() {
    var navs = document.querySelectorAll('.sebook-sidebar-nav');
    for (var i = 0; i < navs.length; i++) {
      initSidebarNav(navs[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSidebarNavs);
  } else {
    initAllSidebarNavs();
  }
})();

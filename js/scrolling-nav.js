
// page scrolling feature (requires easing plugin)
$(function () {
  // Prevent browser from jumping to hash before we can calculate the correct offset
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  function getOffset() {
    const navbar = $('#navnav');
    return 10 + (navbar.length ? navbar.outerHeight() : 50);
  }

  function smoothScroll(target) {
    if (target.length) {
      $('html, body').stop().animate(
        { scrollTop: target.offset().top - getOffset() }, 1000, 'easeInOutExpo');
    }
  }

  function collectSectionLinks() {
    return $('#navnav .navbar-nav a[href^="#"]').map(function () {
      var href = $(this).attr('href');
      if (!href || href === '#') return null;
      var target = $(href);
      if (!target.length) return null;
      return {
        href: href,
        link: this,
        item: $(this).closest('li'),
        target: target
      };
    }).get();
  }

  function setActiveLink(activeHref) {
    var links = $('#navnav .navbar-nav a[href^="#"]');
    links.closest('li').removeClass('active');
    links.removeAttr('aria-current');
    if (!activeHref) return;
    var matched = links.filter('[href="' + activeHref + '"]');
    matched.closest('li').addClass('active');
    matched.attr('aria-current', 'location');
  }

  function syncActiveSection() {
    var sections = collectSectionLinks();
    if (!sections.length) return;

    var scrollTop = $(window).scrollTop();
    var viewportBottom = scrollTop + $(window).height();
    var docHeight = $(document).height();
    var probe = scrollTop + getOffset() + 8;
    var activeHref = sections[0].href;

    if (viewportBottom >= docHeight - 2) {
      activeHref = sections[sections.length - 1].href;
    } else {
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].target.offset().top <= probe) {
          activeHref = sections[i].href;
        } else {
          break;
        }
      }
    }

    setActiveLink(activeHref);
  }

  // Handle same-page internal links
  $('a[href*="#"]').not('[href="#"]').not('[href^="http"]').not('[data-toggle="collapse"]').bind('click', function (event) {
    if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
      var target = $(this.hash);
      target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
      if (target.length) {
        smoothScroll(target);
        setActiveLink(this.hash);
        // Update hash without jumping, enabling :target styling
        history.pushState(null, null, this.hash);
        event.preventDefault();
        setTimeout(syncActiveSection, 50);
        setTimeout(syncActiveSection, 250);
        setTimeout(syncActiveSection, 1000);
      }
    }
  });

  // Handle initial hash on page load (for links from other pages)
  function performInitialScroll() {
    if (window.location.hash) {
      var target = $(window.location.hash);
      target = target.length ? target : $('[name=' + window.location.hash.slice(1) + ']');
      if (target.length) {
        // Use browser's instant scroll
        window.scrollTo(0, target.offset().top - getOffset());
      }
    }
  }

  if (window.location.hash) {
    // Run multiple times to catch late-loading elements (like images or quizzes)
    performInitialScroll();
    setTimeout(performInitialScroll, 50);
    setTimeout(performInitialScroll, 250);
    setTimeout(performInitialScroll, 500);
  }

  $(window).on('scroll', syncActiveSection);
  $(window).on('load resize hashchange', syncActiveSection);
  syncActiveSection();
  setTimeout(syncActiveSection, 50);
  setTimeout(syncActiveSection, 250);
  setTimeout(syncActiveSection, 1000);
});

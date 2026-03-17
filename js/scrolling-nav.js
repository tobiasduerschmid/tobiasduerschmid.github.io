
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

  // Handle same-page internal links
  $('a[href*="#"]').not('[href="#"]').not('[href^="http"]').not('[data-toggle="collapse"]').bind('click', function (event) {
    if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
      var target = $(this.hash);
      target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
      if (target.length) {
        smoothScroll(target);
        // Update hash without jumping, enabling :target styling
        history.pushState(null, null, this.hash);
        event.preventDefault();
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
});

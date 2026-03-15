
// page scrolling feature (requires easing plugin)
$(function () {
  const OFFSET = 50; // Match user's preference

  function smoothScroll(target) {
    if (target.length) {
      $('html, body').stop().animate(
        { scrollTop: target.offset().top - OFFSET }, 1000, 'easeInOutExpo');
    }
  }

  // Handle same-page internal links
  $('a[href*="#"]').not('[href="#"]').not('[href^="http"]').bind('click', function (event) {
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
  if (window.location.hash) {
    setTimeout(function () {
      var target = $(window.location.hash);
      if (target.length) {
        $(window).scrollTop(target.offset().top - OFFSET);
      }
    }, 50); // Minimal delay helps with some browser layout races
  }
});

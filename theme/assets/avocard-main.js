(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  var selector = [
    '.avocard-category-card',
    '.avocard-card',
    '.avocard-flow__item',
    '.avocard-fee-card',
    '.avocard-benefit-card',
    '.avocard-faq details',
    '.avocard-final__box'
  ].join(',');

  var targets = document.querySelectorAll(selector);
  if (!targets.length || !('IntersectionObserver' in window)) {
    return;
  }

  targets.forEach(function (target, index) {
    target.classList.add('avocard-animate');
    target.style.setProperty('--avo-delay', Math.min(index % 8, 7) * 70 + 'ms');
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.12
  });

  targets.forEach(function (target) {
    observer.observe(target);
  });
})();

(function () {
  var groups = document.querySelectorAll('.avocard-topbar__group');
  if (!groups.length) {
    return;
  }

  var mobileQuery = window.matchMedia('(max-width: 989px)');

  function closeAll(except) {
    groups.forEach(function (group) {
      if (group !== except) {
        group.classList.remove('is-open');
        var trigger = group.querySelector('.avocard-topbar__trigger');
        if (trigger) {
          trigger.setAttribute('aria-expanded', 'false');
        }
      }
    });
  }

  groups.forEach(function (group) {
    var trigger = group.querySelector('.avocard-topbar__trigger');
    if (!trigger) {
      return;
    }

    trigger.addEventListener('click', function (event) {
      if (!mobileQuery.matches) {
        return;
      }
      event.preventDefault();
      var isOpen = group.classList.contains('is-open');
      closeAll(isOpen ? null : group);
      group.classList.toggle('is-open', !isOpen);
      trigger.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  document.addEventListener('click', function (event) {
    if (!mobileQuery.matches) {
      return;
    }
    if (!event.target.closest('.avocard-topbar__group')) {
      closeAll();
    }
  });

  mobileQuery.addEventListener('change', function () {
    closeAll();
  });
})();

(function () {
  var hamburger = document.querySelector('.avocard-topbar__hamburger');
  var menu = document.getElementById(hamburger ? hamburger.getAttribute('aria-controls') : '');
  if (!hamburger || !menu) {
    return;
  }

  function closeMenu() {
    hamburger.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
  }

  hamburger.addEventListener('click', function () {
    var isOpen = hamburger.getAttribute('aria-expanded') === 'true';
    hamburger.setAttribute('aria-expanded', String(!isOpen));
    menu.hidden = isOpen;
  });

  var closeBtn = menu.querySelector('.avocard-mobile-menu__close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeMenu);
  }

  var groups = menu.querySelectorAll('.avocard-mobile-menu__group:not(.avocard-mobile-menu__group--direct)');
  groups.forEach(function (group) {
    var trigger = group.querySelector('.avocard-mobile-menu__trigger');
    if (!trigger) {
      return;
    }
    trigger.addEventListener('click', function () {
      var isOpen = group.classList.contains('is-open');
      groups.forEach(function (otherGroup) {
        if (otherGroup !== group) {
          otherGroup.classList.remove('is-open');
          var otherTrigger = otherGroup.querySelector('.avocard-mobile-menu__trigger');
          if (otherTrigger) {
            otherTrigger.setAttribute('aria-expanded', 'false');
          }
        }
      });
      group.classList.toggle('is-open', !isOpen);
      trigger.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  var directLinks = menu.querySelectorAll('.avocard-mobile-menu__trigger--link');
  directLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      closeMenu();
    });
  });

  var mobileQuery = window.matchMedia('(max-width: 989px)');
  mobileQuery.addEventListener('change', function (event) {
    if (!event.matches) {
      hamburger.setAttribute('aria-expanded', 'false');
      menu.hidden = true;
    }
  });
})();

(function () {
  var topbar = document.querySelector('.avocard-topbar--transparent');
  if (!topbar) {
    return;
  }

  function updateScrolled() {
    var isScrolled = window.scrollY > 20;
    topbar.classList.toggle('avocard-topbar--scrolled', isScrolled);
    document.body.style.paddingTop = isScrolled ? topbar.offsetHeight + 'px' : '';
  }

  updateScrolled();
  window.addEventListener('scroll', updateScrolled, { passive: true });
  window.addEventListener('resize', updateScrolled);
})();

(function () {
  var counters = document.querySelectorAll('[data-count-to]');
  if (!counters.length) {
    return;
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function getNumberEl(el) {
    return el.querySelector('.avocard-trust__value-number') || el;
  }

  function setFinalValue(el) {
    var target = parseFloat(el.getAttribute('data-count-to'));
    var numberEl = getNumberEl(el);
    numberEl.textContent = target;
  }

  if (!('IntersectionObserver' in window)) {
    counters.forEach(setFinalValue);
    return;
  }

  if (reduceMotion) {
    counters.forEach(setFinalValue);
    return;
  }

  function easeOutQuint(progress) {
    return 1 - Math.pow(1 - progress, 5);
  }

  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count-to'));
    var isSmallCount = target <= 20;
    var duration = isSmallCount ? 1800 : 2700;
    var numberEl = getNumberEl(el);
    var start = null;

    function step(timestamp) {
      if (start === null) {
        start = timestamp;
      }
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = easeOutQuint(progress);
      var current = isSmallCount ? Math.floor(target * eased) : Math.round(target * eased);
      current = Math.min(current, target);
      numberEl.textContent = current;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        numberEl.textContent = target;
        el.classList.add('avocard-trust__value--pop');
        window.setTimeout(function () {
          el.classList.remove('avocard-trust__value--pop');
        }, 500);
      }
    }

    window.requestAnimationFrame(step);
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.4
  });

  counters.forEach(function (el) {
    observer.observe(el);
  });
})();

(function () {
  var section = document.querySelector('.avocard-auto-discount');
  if (!section) {
    return;
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || typeof window.IntersectionObserver !== 'function') {
    return;
  }

  section.classList.add('avocard-motion-ready');

  var observer = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) {
      section.classList.add('is-visible');
      observer.disconnect();
    }
  }, {
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.2
  });

  observer.observe(section);
})();

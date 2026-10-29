(function () {
  var FLAG_KEY = 'avocardSignupSuccess';
  var VISIBLE_MS = 4500;

  var signupSuccess;
  try {
    signupSuccess = sessionStorage.getItem(FLAG_KEY);
  } catch (e) {
    return; // sessionStorage unavailable (e.g. privacy mode) — skip toast silently
  }

  if (signupSuccess !== '1') return;

  sessionStorage.removeItem(FLAG_KEY);

  var toast = document.getElementById('av-signup-toast');
  if (!toast) return;

  var closeButton = document.getElementById('av-signup-toast-close');
  var hideTimer;

  function hideToast() {
    toast.classList.remove('is-visible');
    toast.classList.add('is-hiding');
    window.clearTimeout(hideTimer);
    toast.addEventListener('transitionend', function onEnd() {
      toast.removeEventListener('transitionend', onEnd);
      toast.hidden = true;
    }, { once: true });
  }

  toast.hidden = false;
  // Force layout before adding the visible class so the CSS transition runs.
  void toast.offsetWidth;
  toast.classList.add('is-visible');

  hideTimer = window.setTimeout(hideToast, VISIBLE_MS);

  if (closeButton) {
    closeButton.addEventListener('click', hideToast);
  }
})();

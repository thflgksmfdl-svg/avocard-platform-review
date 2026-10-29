// UI-only: toggles submit button enabled state and validates email format.
// Does not touch form submission, validation, or API logic in register-poc.js.
(function () {
  var form = document.getElementById('register-poc-form');
  var submitButton = document.getElementById('register-poc-submit');
  var emailInput = document.getElementById('register-poc-email');
  var emailError = document.querySelector('.register-poc-error[data-error-for="email"]');

  if (!form || !submitButton) return;

  var requiredFields = Array.prototype.slice.call(
    form.querySelectorAll('input[required], .av-field input')
  ).filter(function (el) {
    return el.name && el.name !== 'company_website';
  });

  // Email format validation (basic check)
  function isValidEmail(email) {
    var trimmed = email.trim();
    var parts = trimmed.split('@');
    // Must have exactly 2 parts separated by @, both non-empty
    return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
  }

  function showEmailError() {
    if (emailError) {
      emailError.textContent = '이메일 형식을 확인해주세요.';
      emailError.hidden = false;
    }
  }

  function clearEmailError() {
    if (emailError) {
      emailError.textContent = '';
      emailError.hidden = true;
    }
  }

  function refreshButtonState() {
    if (submitButton.dataset.submitting === 'true') return;

    // Check all required fields are filled
    var allFilled = requiredFields.every(function (el) {
      return el.value.trim() !== '';
    });

    // Check email format if filled
    var emailValid = true;
    if (emailInput && emailInput.value.trim() !== '') {
      emailValid = isValidEmail(emailInput.value);
      if (!emailValid) {
        showEmailError();
      } else {
        clearEmailError();
      }
    } else {
      clearEmailError();
    }

    submitButton.disabled = !(allFilled && emailValid);
  }

  requiredFields.forEach(function (el) {
    el.addEventListener('input', refreshButtonState);
  });

  // Special handling for email input
  if (emailInput) {
    emailInput.addEventListener('input', refreshButtonState);
    emailInput.addEventListener('blur', function () {
      if (emailInput.value.trim() !== '' && !isValidEmail(emailInput.value)) {
        showEmailError();
      }
    });
  }

  refreshButtonState();
})();

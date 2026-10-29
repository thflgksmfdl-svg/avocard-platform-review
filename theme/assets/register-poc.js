const SHOP_DOMAIN = 'avocard.myshopify.com';
const PUBLIC_TOKEN = '94a9d339541c7750a0d69af3f71986b6'; // TODO: Set Storefront API public access token
const API_VERSION = '2026-07';

const form = document.getElementById('register-poc-form');
const submitButton = document.getElementById('register-poc-submit');
const globalError = document.getElementById('register-poc-global-error');
const honeypotField = document.getElementById('register-poc-company');
const loadedAtField = document.getElementById('register-poc-loaded-at');

// Set form load timestamp for timing observation
loadedAtField.value = Date.now();

// Helper: Normalize Korean phone number to E.164 format
function normalizeKoreanPhone(input) {
  if (!input) return '';

  // Remove all non-digits
  const digits = input.replace(/\D/g, '');

  // Check if already +82 prefixed (shouldn't happen from input, but be safe)
  if (input.startsWith('+')) {
    return input;
  }

  // Validate: must start with 0, be 10-11 digits, and match Korean mobile prefixes
  if (!digits.startsWith('0')) {
    return null; // Invalid
  }

  if (digits.length < 10 || digits.length > 11) {
    return null; // Invalid length
  }

  // Validate Korean mobile prefix (01[016789])
  const prefix = digits.substring(0, 3);
  if (!['010', '011', '016', '017', '018', '019'].includes(prefix)) {
    return null; // Invalid prefix
  }

  // Convert: remove leading 0, add +82
  return '+82' + digits.substring(1);
}

// Helper: Clear all field errors
function clearFieldErrors() {
  document.querySelectorAll('.register-poc-error').forEach(el => {
    el.textContent = '';
    el.hidden = false;
  });
}

// Helper: Translate Shopify error to Korean
function translateError(code, field, originalMessage) {
  const errorMap = {
    // Email errors
    'email_TAKEN': '이미 가입된 이메일입니다. 로그인하거나 다른 이메일을 사용해주세요.',
    'email_INVALID': '올바른 이메일 형식이 아닙니다.',
    'email_BLANK': '이메일을 입력해주세요.',

    // Phone errors
    'phone_TAKEN': '이미 가입된 휴대폰번호입니다.',
    'phone_INVALID': '휴대폰번호 형식을 확인해주세요. (예: 010-1234-5678)',
    'phone_BLANK': '휴대폰번호를 입력해주세요.',

    // Password errors
    'password_TOO_SHORT': '비밀번호는 최소 5자 이상이어야 합니다.',
    'password_BLANK': '비밀번호를 입력해주세요.',

    // Name errors
    'firstName_BLANK': '이름을 입력해주세요.',
    'lastName_BLANK': '성을 입력해주세요.',
  };

  const key = `${field}_${code}`;
  return errorMap[key] || originalMessage;
}

// Helper: Show field error
function showFieldError(fieldName, code, message) {
  const errorEl = document.querySelector(`.register-poc-error[data-error-for="${fieldName}"]`);
  if (errorEl) {
    const translatedMsg = translateError(code, fieldName, message);
    errorEl.textContent = translatedMsg;
  }
}

// Helper: Show global error
function showGlobalError(message) {
  globalError.textContent = message;
}

// Helper: Clear global error
function clearGlobalError() {
  globalError.textContent = '';
}


// Helper: Log only safe information (no password, token, variables)
function logSafe(message, metadata = {}) {
  const safeMetadata = {};
  if (metadata.status) safeMetadata.status = metadata.status;
  if (metadata.graphqlErrors) safeMetadata.graphqlErrors = metadata.graphqlErrors;
  if (metadata.customerUserErrors) safeMetadata.customerUserErrors = metadata.customerUserErrors;
  if (metadata.field) safeMetadata.field = metadata.field;
  if (metadata.code) safeMetadata.code = metadata.code;
  if (metadata.duration) safeMetadata.duration = metadata.duration;

  if (Object.keys(safeMetadata).length > 0) {
    console.log(`[RegisterPOC] ${message}`, safeMetadata);
  } else {
    console.log(`[RegisterPOC] ${message}`);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  // Record submission start
  const submittedAt = Date.now();
  const loadTime = submittedAt - parseInt(loadedAtField.value, 10);
  logSafe('Form submitted', { duration: `${loadTime}ms` });

  // Honeypot check
  if (honeypotField.value.trim() !== '') {
    logSafe('Honeypot triggered, silently redirecting');
    window.location.href = '/account/login';
    return;
  }

  // Disable submit button to prevent double submission
  const originalButtonText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = '처리 중입니다...';

  // Get form values
  const lastName = document.getElementById('register-poc-last-name').value.trim();
  const firstName = document.getElementById('register-poc-first-name').value.trim();
  const email = document.getElementById('register-poc-email').value.trim();
  const phone = document.getElementById('register-poc-phone').value.trim();
  const password = document.getElementById('register-poc-password').value;
  const passwordConfirmation = document.getElementById('register-poc-password-confirmation').value;

  // Clear previous errors
  clearFieldErrors();
  clearGlobalError();

  // Validate required fields
  if (!lastName) {
    showFieldError('lastName', 'BLANK', '성을 입력해주세요.');
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
    return;
  }
  if (!firstName) {
    showFieldError('firstName', 'BLANK', '이름을 입력해주세요.');
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
    return;
  }
  if (!email) {
    showFieldError('email', 'BLANK', '이메일을 입력해주세요.');
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
    return;
  }
  if (!phone) {
    showFieldError('phone', 'BLANK', '휴대폰번호를 입력해주세요.');
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
    return;
  }
  if (!password) {
    showFieldError('password', 'BLANK', '비밀번호를 입력해주세요.');
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
    return;
  }
  if (!passwordConfirmation) {
    showFieldError('passwordConfirmation', 'BLANK', '비밀번호 확인을 입력해주세요.');
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
    return;
  }

  // Validate password confirmation
  if (password !== passwordConfirmation) {
    showFieldError('passwordConfirmation', 'MISMATCH', '비밀번호가 일치하지 않습니다.');
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
    return;
  }

  // Normalize phone number
  const normalizedPhone = normalizeKoreanPhone(phone);
  if (!normalizedPhone) {
    showFieldError('phone', 'INVALID', '휴대폰번호 형식을 확인해주세요. (예: 010-1234-5678)');
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
    return;
  }

  // Prepare GraphQL mutation
  const query = `
    mutation customerCreate($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        customer { id email phone firstName lastName }
        customerUserErrors { code field message }
      }
    }
  `;

  const variables = {
    input: {
      firstName,
      lastName,
      email,
      phone: normalizedPhone,
      password
    }
  };

  try {
    logSafe('Sending GraphQL request');

    const response = await fetch(
      `https://${SHOP_DOMAIN}/api/${API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': PUBLIC_TOKEN
        },
        body: JSON.stringify({ query, variables })
      }
    );

    logSafe('Response received', { status: response.status });

    if (!response.ok) {
      showGlobalError(`네트워크 오류가 발생했습니다. (${response.status})`);
      logSafe('HTTP error', { status: response.status });
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
      return;
    }

    const data = await response.json();

    // Check for top-level GraphQL errors
    if (data.errors && data.errors.length > 0) {
      showGlobalError('요청 처리 중 오류가 발생했습니다.');
      logSafe('GraphQL errors received', { graphqlErrors: data.errors.length });
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
      return;
    }

    // Check for customer-level errors
    const result = data.data?.customerCreate;
    if (!result) {
      showGlobalError('예상하지 못한 응답이 발생했습니다.');
      logSafe('Unexpected response format');
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
      return;
    }

    if (result.customerUserErrors && result.customerUserErrors.length > 0) {
      logSafe('Customer user errors received', { customerUserErrors: result.customerUserErrors.length });

      result.customerUserErrors.forEach(err => {
        // Handle both string field names and array paths like ["input", "email"]
        let fieldName = err.field;
        if (Array.isArray(err.field)) {
          fieldName = err.field[err.field.length - 1]; // Get last element from path
        }

        const fieldMapping = {
          'email': 'email',
          'phone': 'phone',
          'password': 'password',
          'firstName': 'firstName',
          'lastName': 'lastName'
        };

        if (fieldMapping[fieldName]) {
          const translatedMsg = translateError(err.code, fieldName, err.message);
          showFieldError(fieldMapping[fieldName], err.code, translatedMsg);
        } else {
          showGlobalError(err.message);
        }

        logSafe('Customer error', { field: fieldName, code: err.code });
      });

      submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
      return;
    }

    // Success
    if (result.customer && result.customer.id) {
      logSafe('Customer created successfully', { id: result.customer.id });
      sessionStorage.setItem('avocardSignupSuccess', '1');
      window.location.href = '/account/login';
      return;
    }

    showGlobalError('Unexpected response');
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;

  } catch (error) {
    logSafe('Network or parsing error');
    showGlobalError('Network error occurred');
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
  }
});

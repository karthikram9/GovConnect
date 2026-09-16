// GovConnect Revenue Department — Admin Console Script

let currentCitizenToIssue = null;
let activePublicKeyBase64 = null;

// DOM Elements
const statusDot = document.getElementById('statusDot');
const serviceStatusText = document.getElementById('serviceStatusText');
const alertContainer = document.getElementById('alertContainer');

const metricTotalCitizens = document.getElementById('metricTotalCitizens');
const metricIssuedCount = document.getElementById('metricIssuedCount');
const metricKeyStatus = document.getElementById('metricKeyStatus');

const citizensTableBody = document.getElementById('citizensTableBody');
const issuedTableBody = document.getElementById('issuedTableBody');
const publicKeySnippet = document.getElementById('publicKeySnippet');

const btnRefreshCitizens = document.getElementById('btnRefreshCitizens');
const btnRefreshIssued = document.getElementById('btnRefreshIssued');
const btnCopyPublicKey = document.getElementById('btnCopyPublicKey');

// Review Modal Elements
const reviewModal = document.getElementById('reviewModal');
const closeReviewModal = document.getElementById('closeReviewModal');
const btnCancelIssue = document.getElementById('btnCancelIssue');
const btnConfirmIssue = document.getElementById('btnConfirmIssue');
const issueBtnText = document.getElementById('issueBtnText');
const modalReviewContent = document.getElementById('modalReviewContent');

// Detail Modal Elements
const detailModal = document.getElementById('detailModal');
const closeDetailModal = document.getElementById('closeDetailModal');
const btnCloseDetail = document.getElementById('btnCloseDetail');
const modalDetailContent = document.getElementById('modalDetailContent');

// Officer Profile Elements
const officerProfile = document.getElementById('officerProfile');
const officerUsername = document.getElementById('officerUsername');
const officerRoleBadge = document.getElementById('officerRoleBadge');
const btnLogout = document.getElementById('btnLogout');

// Login Modal Elements
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const loginAlert = document.getElementById('loginAlert');
const btnLoginSubmit = document.getElementById('btnLoginSubmit');

const AUTH_TOKEN_KEY = 'govconnect_revenue_token';
const AUTH_USER_KEY = 'govconnect_revenue_user';

function getStoredToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

function getStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem(AUTH_USER_KEY));
  } catch {
    return null;
  }
}

function setAuthSession(token, user) {
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearAuthSession() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
}

function updateOfficerHeader() {
  const user = getStoredUser();
  if (user && officerProfile) {
    officerUsername.textContent = user.username || 'Officer';
    officerRoleBadge.textContent = user.role || 'OFFICER';
    officerProfile.style.display = 'flex';
  } else if (officerProfile) {
    officerProfile.style.display = 'none';
  }
}

function showLoginModal(errorMsg = null) {
  if (loginModal) {
    loginModal.style.display = 'flex';
    if (errorMsg && loginAlert) {
      loginAlert.textContent = errorMsg;
      loginAlert.style.display = 'block';
    } else if (loginAlert) {
      loginAlert.style.display = 'none';
    }
  }
}

function hideLoginModal() {
  if (loginModal) {
    loginModal.style.display = 'none';
  }
}

/**
 * Authenticated fetch wrapper injecting Bearer token
 */
async function authFetch(url, options = {}) {
  const token = getStoredToken();
  if (!token) {
    showLoginModal('Authentication required. Please sign in.');
    throw new Error('Authentication required');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearAuthSession();
    updateOfficerHeader();
    showLoginModal('Session expired or invalid. Please sign in again.');
    throw new Error('Session expired');
  }

  if (res.status === 403) {
    showAlert('Access Denied (HTTP 403 Forbidden): Your account does not have permission for this resource.', 'danger');
    throw new Error('Access denied');
  }

  return res;
}

/**
 * Shows an alert message
 */
function showAlert(message, type = 'danger') {
  alertContainer.innerHTML = `
    <div class="alert-banner alert-${type}">
      <span>${escapeHtml(message)}</span>
      <button type="button" class="btn btn-sm btn-secondary" onclick="this.parentElement.remove()" style="margin-left: 1rem;">Dismiss</button>
    </div>
  `;
}

function clearAlert() {
  alertContainer.innerHTML = '';
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Check backend health
 */
async function checkHealth() {
  try {
    const res = await fetch('/health');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status === 'ok') {
      statusDot.className = 'status-dot online';
      serviceStatusText.textContent = 'Service: Online (Issuer Ready)';
      return true;
    }
  } catch (err) {
    statusDot.className = 'status-dot offline';
    serviceStatusText.textContent = 'Service: Offline / Disconnected';
    showAlert('Unable to reach Revenue Department API. Ensure server is running.', 'danger');
    return false;
  }
}

/**
 * Fetch and display public key
 */
async function loadPublicKey() {
  try {
    const res = await fetch('/public-key');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    activePublicKeyBase64 = data.publicKey;
    publicKeySnippet.textContent = data.publicKey;
    metricKeyStatus.textContent = 'Ed25519 Active';
  } catch (err) {
    publicKeySnippet.textContent = 'Error loading public key';
    metricKeyStatus.textContent = 'Key Error';
    console.error('Failed to load public key:', err);
  }
}

/**
 * Fetch and populate citizens table
 */
async function loadCitizens() {
  citizensTableBody.innerHTML = `
    <tr><td colspan="4" class="text-center text-muted">Loading citizen records...</td></tr>
  `;
  try {
    const res = await authFetch('/citizens');
    if (!res.ok) throw new Error(`Failed to load citizens (HTTP ${res.status})`);
    const citizens = await res.json();

    metricTotalCitizens.textContent = citizens.length;

    if (citizens.length === 0) {
      citizensTableBody.innerHTML = `
        <tr><td colspan="4" class="text-center text-muted">No citizen records found in database.</td></tr>
      `;
      return;
    }

    citizensTableBody.innerHTML = citizens.map(c => `
      <tr>
        <td><strong>#${c.id}</strong></td>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td>${escapeHtml(c.dateOfBirth)}</td>
        <td style="text-align: right;">
          <button class="btn btn-primary btn-sm" onclick="openIssueModal(${c.id})">
            Issue Income Certificate
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    citizensTableBody.innerHTML = `
      <tr><td colspan="4" class="text-center" style="color: var(--gov-danger);">Failed to load citizens: ${escapeHtml(err.message)}</td></tr>
    `;
    showAlert('Failed to query citizens. Ensure PostgreSQL is connected and initialized.', 'danger');
  }
}

/**
 * Fetch and populate issued credentials table
 */
async function loadIssuedCredentials() {
  issuedTableBody.innerHTML = `
    <tr><td colspan="6" class="text-center text-muted">Loading issued credentials...</td></tr>
  `;
  try {
    const res = await authFetch('/issued-credentials');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();

    metricIssuedCount.textContent = list.length;

    if (list.length === 0) {
      issuedTableBody.innerHTML = `
        <tr><td colspan="6" class="text-center text-muted">No credentials have been issued yet.</td></tr>
      `;
      return;
    }

    issuedTableBody.innerHTML = list.map(item => `
      <tr>
        <td><strong>#${item.id}</strong></td>
        <td>${escapeHtml(item.citizen_name || `Citizen #${item.citizen_id}`)}</td>
        <td><code>${escapeHtml(item.credential_type || 'IncomeCertificate')}</code></td>
        <td>${new Date(item.issued_at).toLocaleString()}</td>
        <td><span class="badge badge-success">Signed ✓</span></td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="viewCredentialDetail(${item.id})">
            Inspect
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    issuedTableBody.innerHTML = `
      <tr><td colspan="6" class="text-center" style="color: var(--gov-danger);">Failed to load issued credentials: ${escapeHtml(err.message)}</td></tr>
    `;
  }
}

/**
 * Open confirmation / review modal for citizen
 */
window.openIssueModal = async function(citizenId) {
  clearAlert();
  reviewModal.style.display = 'flex';
  btnConfirmIssue.disabled = true;
  issueBtnText.textContent = 'Issue and Sign Credential';
  modalReviewContent.innerHTML = `<div class="text-center text-muted">Loading details for citizen #${citizenId}...</div>`;

  try {
    const res = await authFetch(`/citizens/${citizenId}`);
    if (!res.ok) throw new Error(`Failed to load citizen details (HTTP ${res.status})`);
    const citizen = await res.json();
    currentCitizenToIssue = citizen;

    modalReviewContent.innerHTML = `
      <div class="info-callout">
        Please verify the applicant's income and demographic records before signing the official Income Certificate.
      </div>
      <div class="review-grid">
        <div class="review-key">Citizen ID:</div>
        <div class="review-val">#${citizen.id}</div>

        <div class="review-key">Applicant Name:</div>
        <div class="review-val review-highlight">${escapeHtml(citizen.name)}</div>

        <div class="review-key">Date of Birth:</div>
        <div class="review-val">${escapeHtml(citizen.dateOfBirth)}</div>

        <div class="review-key">PAN Number:</div>
        <div class="review-val"><code>${escapeHtml(citizen.panNumber)}</code></div>

        <div class="review-key">Annual Income:</div>
        <div class="review-val review-highlight">${formatCurrency(citizen.annualIncome)}</div>

        <div class="review-key">Residential Address:</div>
        <div class="review-val">${escapeHtml(citizen.address)}</div>

        <div class="review-key">Issuing Authority:</div>
        <div class="review-val"><code>revenue-dept-maharashtra</code></div>

        <div class="review-key">Cryptographic Standard:</div>
        <div class="review-val">Ed25519 (RFC 8032) / Canonical JSON</div>
      </div>
    `;

    btnConfirmIssue.disabled = false;
  } catch (err) {
    modalReviewContent.innerHTML = `
      <div class="alert-banner alert-danger">Error: ${escapeHtml(err.message)}</div>
    `;
  }
};

/**
 * Issue and sign credential action
 */
btnConfirmIssue.addEventListener('click', async () => {
  if (!currentCitizenToIssue) return;

  btnConfirmIssue.disabled = true;
  btnCancelIssue.disabled = true;
  issueBtnText.textContent = 'Signing credential…';

  try {
    const res = await authFetch(`/issue-credential/${currentCitizenToIssue.id}`, {
      method: 'POST'
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Issuance failed with HTTP ${res.status}`);
    }

    // Success State
    modalReviewContent.innerHTML = `
      <div class="verification-badge">
        <span>✓</span>
        <span>Credential issued and digitally signed successfully!</span>
      </div>
      <div class="review-grid">
        <div class="review-key">Credential Type:</div>
        <div class="review-val"><code>${escapeHtml(data.credential.credentialType)}</code></div>

        <div class="review-key">Subject:</div>
        <div class="review-val"><strong>${escapeHtml(data.credential.subject.name)}</strong></div>

        <div class="review-key">Issuer:</div>
        <div class="review-val"><code>${escapeHtml(data.issuer)}</code></div>

        <div class="review-key">Issued At:</div>
        <div class="review-val">${escapeHtml(data.credential.issuedAt)}</div>

        <div class="review-key">Verified Annual Income:</div>
        <div class="review-val"><strong>${formatCurrency(data.credential.claims.annualIncome)}</strong></div>
      </div>

      <div class="key-field" style="margin-top: 1rem;">
        <span class="key-title">Ed25519 Digital Signature (Base64):</span>
        <pre class="code-snippet">${escapeHtml(data.signature)}</pre>
      </div>
    `;

    issueBtnText.textContent = 'Completed';
    btnCancelIssue.disabled = false;
    btnCancelIssue.textContent = 'Close';

    // Refresh tables and metrics
    loadIssuedCredentials();
  } catch (err) {
    showAlert(`Issuance failed: ${err.message}`, 'danger');
    issueBtnText.textContent = 'Retry Issue & Sign';
    btnConfirmIssue.disabled = false;
    btnCancelIssue.disabled = false;
  }
});

/**
 * View detail of an issued credential
 */
window.viewCredentialDetail = async function(credentialId) {
  detailModal.style.display = 'flex';
  modalDetailContent.innerHTML = `<div class="text-center text-muted">Loading credential #${credentialId}...</div>`;

  try {
    const res = await authFetch('/issued-credentials');
    const list = await res.json();
    const item = list.find(c => c.id === credentialId);

    if (!item) throw new Error('Credential not found');

    modalDetailContent.innerHTML = `
      <div class="verification-badge">
        <span>✓</span>
        <span>Cryptographically Signed Record &bull; Status: Valid</span>
      </div>
      <div class="review-grid" style="margin-bottom: 1.25rem;">
        <div class="review-key">Credential ID:</div>
        <div class="review-val">#${item.id}</div>

        <div class="review-key">Citizen Name:</div>
        <div class="review-val"><strong>${escapeHtml(item.citizen_name)}</strong> (ID: #${item.citizen_id})</div>

        <div class="review-key">Issuer ID:</div>
        <div class="review-val"><code>${escapeHtml(item.issuer)}</code></div>

        <div class="review-key">Issued Timestamp:</div>
        <div class="review-val">${escapeHtml(item.issued_at)}</div>
      </div>

      <div class="key-field" style="margin-bottom: 1rem;">
        <span class="key-title">Ed25519 Digital Signature (Base64):</span>
        <pre class="code-snippet">${escapeHtml(item.signature)}</pre>
      </div>

      <div class="key-field">
        <span class="key-title">Canonical Credential Payload (JSON):</span>
        <pre class="code-snippet">${escapeHtml(JSON.stringify(item.credential, null, 2))}</pre>
      </div>
    `;
  } catch (err) {
    modalDetailContent.innerHTML = `
      <div class="alert-banner alert-danger">Failed to load credential: ${escapeHtml(err.message)}</div>
    `;
  }
};

// Close modals handlers
function closeAllModals() {
  reviewModal.style.display = 'none';
  detailModal.style.display = 'none';
  currentCitizenToIssue = null;
  btnCancelIssue.textContent = 'Cancel';
}

closeReviewModal.addEventListener('click', closeAllModals);
btnCancelIssue.addEventListener('click', closeAllModals);
closeDetailModal.addEventListener('click', closeAllModals);
btnCloseDetail.addEventListener('click', closeAllModals);

// Copy Public Key button
btnCopyPublicKey.addEventListener('click', () => {
  if (!activePublicKeyBase64) return;
  navigator.clipboard.writeText(activePublicKeyBase64).then(() => {
    const originalText = btnCopyPublicKey.textContent;
    btnCopyPublicKey.textContent = 'Copied! ✓';
    setTimeout(() => { btnCopyPublicKey.textContent = originalText; }, 2000);
  }).catch(() => {
    showAlert('Could not copy to clipboard automatically.', 'warning');
  });
});

// Refresh buttons
btnRefreshCitizens.addEventListener('click', loadCitizens);
btnRefreshIssued.addEventListener('click', loadIssuedCredentials);

// Login form submit
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (loginAlert) loginAlert.style.display = 'none';
    btnLoginSubmit.disabled = true;
    btnLoginSubmit.textContent = 'Authenticating…';

    try {
      const username = loginUsername.value.trim();
      const password = loginPassword.value;

      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Authentication failed');
      }

      setAuthSession(data.token, data.user);
      hideLoginModal();
      updateOfficerHeader();
      loginPassword.value = '';

      await loadCitizens();
      await loadIssuedCredentials();
    } catch (err) {
      if (loginAlert) {
        loginAlert.textContent = err.message;
        loginAlert.style.display = 'block';
      }
    } finally {
      btnLoginSubmit.disabled = false;
      btnLoginSubmit.textContent = 'Sign In to Console';
    }
  });
}

// Sign Out button
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    try {
      await authFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      clearAuthSession();
      updateOfficerHeader();
      citizensTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Please sign in to view citizen records.</td></tr>';
      issuedTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Please sign in to view issued credentials.</td></tr>';
      metricTotalCitizens.textContent = '—';
      metricIssuedCount.textContent = '—';
      showLoginModal();
    }
  });
}

// Initial boot
(async function init() {
  await checkHealth();
  await loadPublicKey();

  if (getStoredToken()) {
    updateOfficerHeader();
    await loadCitizens();
    await loadIssuedCredentials();
  } else {
    showLoginModal();
  }
})();

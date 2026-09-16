/**
 * GovConnect Social Welfare Department — Issuer Console Client
 * Smart India Hackathon Prototype (SIH26129)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const statusDot = document.getElementById('statusDot');
  const serviceStatusText = document.getElementById('serviceStatusText');
  const metricTotalCitizens = document.getElementById('metricTotalCitizens');
  const metricIssuedCount = document.getElementById('metricIssuedCount');
  const citizensTableBody = document.getElementById('citizensTableBody');
  const issuedTableBody = document.getElementById('issuedTableBody');
  const publicKeySnippet = document.getElementById('publicKeySnippet');
  const btnRefreshCitizens = document.getElementById('btnRefreshCitizens');
  const btnRefreshIssued = document.getElementById('btnRefreshIssued');
  const btnCopyPublicKey = document.getElementById('btnCopyPublicKey');
  const alertContainer = document.getElementById('alertContainer');

  // Modals
  const reviewModal = document.getElementById('reviewModal');
  const closeReviewModal = document.getElementById('closeReviewModal');
  const btnCancelIssue = document.getElementById('btnCancelIssue');
  const btnConfirmIssue = document.getElementById('btnConfirmIssue');
  const modalReviewContent = document.getElementById('modalReviewContent');

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

  const AUTH_TOKEN_KEY = 'govconnect_swd_token';
  const AUTH_USER_KEY = 'govconnect_swd_user';

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
      showAlert('Access Denied (HTTP 403 Forbidden): Your account does not have permission for this resource.', 'error');
      throw new Error('Access denied');
    }

    return res;
  }

  let activeCitizenIdToIssue = null;
  let cachedPublicKey = '';

  // Utility: Show alert banner
  function showAlert(message, type = 'success') {
    const alertEl = document.createElement('div');
    alertEl.className = `alert alert-${type}`;
    alertEl.innerHTML = `
      <span>${message}</span>
      <button style="background:none;border:none;cursor:pointer;font-weight:bold;color:inherit;" aria-label="Dismiss alert">&times;</button>
    `;
    alertEl.querySelector('button').addEventListener('click', () => alertEl.remove());
    alertContainer.appendChild(alertEl);

    setTimeout(() => {
      if (alertEl.parentNode) {
        alertEl.remove();
      }
    }, 6000);
  }

  // 1. Fetch Health Status
  async function fetchHealth() {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        statusDot.className = 'status-dot online';
        serviceStatusText.textContent = 'Service: Active (Online)';
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      statusDot.className = 'status-dot offline';
      serviceStatusText.textContent = 'Service: Offline / Disconnected';
      console.error('Health check failed:', err);
    }
  }

  // 2. Fetch Public Key
  async function fetchPublicKey() {
    try {
      const res = await fetch('/public-key');
      if (res.ok) {
        const data = await res.json();
        cachedPublicKey = data.publicKey || '';
        publicKeySnippet.textContent = cachedPublicKey || 'No public key available';
      } else {
        publicKeySnippet.textContent = 'Failed to load public key from server';
      }
    } catch (err) {
      publicKeySnippet.textContent = 'Error connecting to public key endpoint';
      console.error('Failed to fetch public key:', err);
    }
  }

  // 3. Fetch Citizens
  async function fetchCitizens() {
    citizensTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Loading citizen records...</td></tr>';
    try {
      const res = await authFetch('/citizens');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const citizens = await res.json();

      metricTotalCitizens.textContent = citizens.length;

      if (citizens.length === 0) {
        citizensTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No citizen records found in Social Welfare database.</td></tr>';
        return;
      }

      citizensTableBody.innerHTML = citizens.map((citizen) => {
        const citizenName = citizen.applicant_name || citizen.name;
        const dob = citizen.date_of_birth || citizen.dateOfBirth;
        return `
          <tr>
            <td><strong>#${citizen.id}</strong></td>
            <td><strong>${escapeHtml(citizenName)}</strong></td>
            <td>${escapeHtml(dob)}</td>
            <td style="text-align: right;">
              <button class="btn btn-primary btn-sm" onclick="window.openReviewModal(${citizen.id})">
                Issue Caste Certificate
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      citizensTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="color: var(--gov-error);">Failed to load citizens. Ensure database is running.</td></tr>';
      console.error('Failed to load citizens:', err);
    }
  }

  // 4. Fetch Issued Credentials
  async function fetchIssuedCredentials() {
    issuedTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading issued credentials...</td></tr>';
    try {
      const res = await authFetch('/issued-credentials');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const credentials = await res.json();

      metricIssuedCount.textContent = credentials.length;

      if (credentials.length === 0) {
        issuedTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No credentials have been issued yet.</td></tr>';
        return;
      }

      issuedTableBody.innerHTML = credentials.map((item) => {
        const citizenName = item.citizen_name || `Citizen #${item.citizen_id}`;
        const credType = item.credential_type || 'CasteCertificate';
        const issuedDate = item.issued_at ? new Date(item.issued_at).toLocaleString('en-IN') : '—';

        return `
          <tr>
            <td>#${item.id}</td>
            <td><strong>${escapeHtml(citizenName)}</strong></td>
            <td><span class="badge badge-info">${escapeHtml(credType)}</span></td>
            <td>${escapeHtml(issuedDate)}</td>
            <td><span class="badge badge-success">Signed ✓</span></td>
            <td style="text-align: right;">
              <button class="btn btn-secondary btn-sm" onclick="window.openDetailModal(${item.id})">
                Inspect
              </button>
            </td>
          </tr>
        `;
      }).join('');

      // Cache credentials on window for inspection
      window._cachedIssued = credentials;
    } catch (err) {
      issuedTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="color: var(--gov-error);">Failed to load issued credentials.</td></tr>';
      console.error('Failed to load issued credentials:', err);
    }
  }

  // Open Citizen Review Modal prior to Issuing
  window.openReviewModal = async function(citizenId) {
    activeCitizenIdToIssue = citizenId;
    modalReviewContent.innerHTML = '<div class="text-center text-muted">Fetching department record...</div>';
    reviewModal.style.display = 'flex';
    btnConfirmIssue.disabled = true;

    try {
      const res = await authFetch(`/citizens/${citizenId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const c = await res.json();

      const citizenName = c.applicant_name || c.name;
      const dob = c.date_of_birth || c.dateOfBirth;
      const category = c.caste_category || c.casteCategory;
      const caste = c.caste_name || c.casteName;
      const certNo = c.certificate_number || c.certificateNumber;

      modalReviewContent.innerHTML = `
        <div class="review-grid">
          <div class="review-item">
            <div class="review-item-label">Citizen Record ID</div>
            <div class="review-item-value">#${c.id}</div>
          </div>
          <div class="review-item">
            <div class="review-item-label">Date of Birth</div>
            <div class="review-item-value">${escapeHtml(dob)}</div>
          </div>
          <div class="review-item full-width">
            <div class="review-item-label">Applicant Full Name</div>
            <div class="review-item-value">${escapeHtml(citizenName)}</div>
          </div>
          <div class="review-item">
            <div class="review-item-label">Caste Category</div>
            <div class="review-item-value"><span class="badge badge-category">${escapeHtml(category)}</span></div>
          </div>
          <div class="review-item">
            <div class="review-item-label">Caste Name</div>
            <div class="review-item-value">${escapeHtml(caste)}</div>
          </div>
          <div class="review-item full-width">
            <div class="review-item-label">Certificate Number</div>
            <div class="review-item-value"><code style="font-family:var(--gov-mono);">${escapeHtml(certNo)}</code></div>
          </div>
          <div class="review-item full-width">
            <div class="review-item-label">Registered Address</div>
            <div class="review-item-value" style="font-weight:400;">${escapeHtml(c.address)}</div>
          </div>
        </div>
        <div class="info-callout" style="margin-bottom:0;">
          <strong>Cryptographic Issuance:</strong> Clicking confirm will assemble a <code>CasteCertificate</code> credential, canonically serialize it, and append an Ed25519 digital signature verifiable by any third party.
        </div>
      `;

      btnConfirmIssue.disabled = false;
    } catch (err) {
      modalReviewContent.innerHTML = `<div style="color:var(--gov-error);">Failed to load citizen record: ${escapeHtml(err.message)}</div>`;
      console.error(err);
    }
  };

  // Confirm and Execute Credential Issuance
  btnConfirmIssue.addEventListener('click', async () => {
    if (!activeCitizenIdToIssue) return;

    btnConfirmIssue.disabled = true;
    btnConfirmIssue.textContent = 'Signing Credential...';

    try {
      const res = await authFetch(`/issue-credential/${activeCitizenIdToIssue}`, {
        method: 'POST'
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      closeModal(reviewModal);
      showAlert(`✅ Successfully issued Caste Certificate for ${data.credential.subject.name}!`, 'success');

      // Refresh list & metrics
      await fetchIssuedCredentials();

      // Show the newly issued credential inspect window
      showCredentialDetail(data.credential, data.signature);
    } catch (err) {
      showAlert(`❌ Error issuing credential: ${err.message}`, 'error');
    } finally {
      btnConfirmIssue.disabled = false;
      btnConfirmIssue.textContent = 'Issue and Sign Credential';
    }
  });

  // Open Detail Modal for Inspecting Credential
  window.openDetailModal = function(id) {
    if (!window._cachedIssued) return;
    const item = window._cachedIssued.find(c => c.id === id);
    if (!item) return;

    showCredentialDetail(item.credential, item.signature);
  };

  function showCredentialDetail(credential, signature) {
    modalDetailContent.innerHTML = `
      <div class="key-field">
        <span class="key-title">Credential Type:</span>
        <code class="key-value">${escapeHtml(credential.credentialType || 'CasteCertificate')}</code>
      </div>
      <div class="key-field">
        <span class="key-title">Issuer Authority:</span>
        <code class="key-value">${escapeHtml(credential.issuer || 'social-welfare-dept-maharashtra')}</code>
      </div>
      <div class="key-field">
        <span class="key-title">Subject Name:</span>
        <strong style="color:var(--gov-dark);">${escapeHtml(credential.subject?.name || '—')}</strong>
      </div>
      <div class="key-field">
        <span class="key-title">Caste Category & Name:</span>
        <span class="badge badge-category">${escapeHtml(credential.claims?.casteCategory || '—')}</span>
        <strong>${escapeHtml(credential.claims?.casteName || '—')}</strong>
      </div>
      <div class="key-field">
        <span class="key-title">Canonical Credential Payload (JSON):</span>
        <pre class="code-snippet">${escapeHtml(JSON.stringify(credential, null, 2))}</pre>
      </div>
      <div class="key-field">
        <span class="key-title">Ed25519 Digital Signature (Base64):</span>
        <pre class="code-snippet" style="max-height: 80px;">${escapeHtml(signature)}</pre>
      </div>
    `;

    detailModal.style.display = 'flex';
  }

  // Copy Public Key Helper
  btnCopyPublicKey.addEventListener('click', () => {
    if (!cachedPublicKey) return;
    navigator.clipboard.writeText(cachedPublicKey).then(() => {
      const originalText = btnCopyPublicKey.textContent;
      btnCopyPublicKey.textContent = 'Copied!';
      setTimeout(() => {
        btnCopyPublicKey.textContent = originalText;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy public key:', err);
    });
  });

  // Modal Closers
  function closeModal(modal) {
    modal.style.display = 'none';
  }

  closeReviewModal.addEventListener('click', () => closeModal(reviewModal));
  btnCancelIssue.addEventListener('click', () => closeModal(reviewModal));
  closeDetailModal.addEventListener('click', () => closeModal(detailModal));
  btnCloseDetail.addEventListener('click', () => closeModal(detailModal));

  window.addEventListener('click', (e) => {
    if (e.target === reviewModal) closeModal(reviewModal);
    if (e.target === detailModal) closeModal(detailModal);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(reviewModal);
      closeModal(detailModal);
    }
  });

  btnRefreshCitizens.addEventListener('click', fetchCitizens);
  btnRefreshIssued.addEventListener('click', fetchIssuedCredentials);

  // Helper: Escape HTML to prevent XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

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

        await fetchCitizens();
        await fetchIssuedCredentials();
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

  // Initial Load
  fetchHealth();
  fetchPublicKey();

  if (getStoredToken()) {
    updateOfficerHeader();
    fetchCitizens();
    fetchIssuedCredentials();
  } else {
    showLoginModal();
  }
});

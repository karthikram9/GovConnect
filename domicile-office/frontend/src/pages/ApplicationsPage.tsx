import React, { useState, useEffect } from 'react';
import { DomicileApplication, PrototypeDomicileCertificate } from '../types/domicile';
import { fetchApplications, fetchCertificate } from '../services/api';
import { CertificateModal } from '../components/CertificateModal';

interface ApplicationsPageProps {
  onSelectApplicationForVerification: (applicationId: string) => void;
}

export const ApplicationsPage: React.FC<ApplicationsPageProps> = ({
  onSelectApplicationForVerification
}) => {
  const [applications, setApplications] = useState<DomicileApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingCertificate, setViewingCertificate] = useState<PrototypeDomicileCertificate | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const apps = await fetchApplications();
        setApplications(apps);
      } catch (err) {
        console.error('Failed to load applications:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleViewCertificate = async (certificateId: string) => {
    try {
      const cert = await fetchCertificate(certificateId);
      setViewingCertificate(cert);
    } catch (err) {
      console.error('Failed to fetch certificate:', err);
    }
  };

  return (
    <div className="applications-page">
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Domicile Certificate Applications</h2>
            <p className="card-subtitle">
              Citizen applications awaiting or completed through verifiable credential presentations.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: '#5B6B7A' }}>
            Loading applications…
          </p>
        ) : (
          <table className="data-table" aria-label="Applications Table">
            <thead>
              <tr>
                <th>App ID</th>
                <th>Applicant Name</th>
                <th>Date of Birth</th>
                <th>District / Address</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.applicationId}>
                  <td>
                    <code>{app.applicationId}</code>
                  </td>
                  <td>
                    <strong>{app.applicantName}</strong>
                    {app.applicantName.includes('K.') && (
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#B45309' }}>
                        * Canonical Ambiguity Case
                      </span>
                    )}
                  </td>
                  <td>{app.dateOfBirth}</td>
                  <td>{app.address}</td>
                  <td>
                    <span className={`status-pill ${
                      app.status === 'VERIFIED' || app.status === 'APPROVED' ? 'verified' :
                      app.status === 'NEEDS_MANUAL_REVIEW' ? 'review' :
                      app.status === 'REJECTED' ? 'rejected' : 'pending'
                    }`}>
                      {app.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                        onClick={() => onSelectApplicationForVerification(app.applicationId)}
                      >
                        Verify
                      </button>

                      {app.certificateId && (
                        <button
                          type="button"
                          className="btn btn-success"
                          style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                          onClick={() => handleViewCertificate(app.certificateId!)}
                        >
                          Certificate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <CertificateModal
        certificate={viewingCertificate}
        onClose={() => setViewingCertificate(null)}
      />
    </div>
  );
};

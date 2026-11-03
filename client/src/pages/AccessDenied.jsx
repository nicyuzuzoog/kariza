import { Link } from 'react-router-dom';
import { CrumbBar } from '../components/ui.jsx';

export default function AccessDenied() {
  return (
    <div className="fade-up">
      <CrumbBar items={[{ label: 'Workspace' }, { label: 'Access denied' }]} />
      <div className="state-page">
        <div className="state-card">
          <div className="state-art">
            <i className="bi bi-shield-lock" />
          </div>
          <span className="state-code">403</span>
          <h1>Access denied</h1>
          <p>
            Your account does not have permission to view this page. If you believe this is a mistake,
            speak to the Super Admin about adjusting your role.
          </p>
          <div className="hstack wrap" style={{ gap: 10, justifyContent: 'center' }}>
            <Link to="/" className="btn btn-brand">
              <i className="bi bi-grid-1x2" />
              Back to dashboard
            </Link>
            <Link to="/profile" className="btn btn-outline-soft">
              <i className="bi bi-person-circle" />
              View my profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

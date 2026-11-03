import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="fade-up">
      <div className="state-page">
        <div className="state-card">
          <div className="state-art">
            <i className="bi bi-compass" />
          </div>
          <span className="state-code">404</span>
          <h1>Page not found</h1>
          <p>
            The page you are looking for may have moved, or the link is incomplete. Head back to the
            dashboard and continue from there.
          </p>
          <div className="hstack wrap" style={{ gap: 10, justifyContent: 'center' }}>
            <Link to="/" className="btn btn-brand">
              <i className="bi bi-grid-1x2" />
              Back to dashboard
            </Link>
            <Link to="/products" className="btn btn-outline-soft">
              <i className="bi bi-box-seam" />
              Browse inventory
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

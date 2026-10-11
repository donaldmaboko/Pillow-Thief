import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}>
      <div className="card" style={{ width: 380, maxWidth: '92vw' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--rose)' }}>Pillow Thief</div>
          <div className="muted small">Administrative sign in</div>
        </div>
        <LoginForm />
        <p className="muted small" style={{ marginTop: 16 }}>
          Access is restricted to authorised administrators. All admin actions are audit-logged.
        </p>
      </div>
    </div>
  )
}

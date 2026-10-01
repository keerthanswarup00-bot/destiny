import { LoginForm } from "./login-form";
// Plain anchor, not next/link: `/` is owned by the public site's Next.js build, which is
// proxied through this origin. A client-side transition would fetch that build's RSC payload
// and then misresolve its chunk URLs against this app's `/_next/` prefix. See site-header.tsx.
export default function LoginPage() {
  return (
    <main className="login-page">
      <section>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="login-brand">DESTINY<span>EVENTS + PHOTOGRAPHY</span></a>
        <p className="eyebrow">STUDIO ADMIN</p>
        <h1>Sign in</h1>
        <p>Use your photographer administrator account.</p>
        <LoginForm />
      </section>
    </main>
  );
}

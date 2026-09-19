import Link from "next/link";
import { LoginForm } from "./login-form";
export default function LoginPage() { return <main className="login-page"><section><Link href="/" className="login-brand">DESTINY<span>EVENTS + PHOTOGRAPHY</span></Link><p className="eyebrow">STUDIO ADMIN</p><h1>Sign in</h1><p>Use your photographer administrator account.</p><LoginForm /></section></main>; }

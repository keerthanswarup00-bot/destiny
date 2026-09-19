import Link from "next/link";

export function SiteHeader() {
  return <header className="site-header"><Link href="/" className="brand" aria-label="Destiny home">DESTINY<span>EVENTS + PHOTOGRAPHY</span></Link><nav aria-label="Primary navigation"><Link href="/">Home</Link><Link href="/gallery">Gallery</Link><Link href="/contact">Contact</Link></nav></header>;
}

import "../client-gallery.css";
import "./shared-photo.css";

export const dynamic = "force-dynamic";

export default function SharedPhotoLayout({ children }: { children: React.ReactNode }) {
  return <div className="client-gallery">{children}</div>;
}
import "../../client-gallery.css";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";

export const dynamic = "force-dynamic";

export default function ClientGalleryLayout({ children }: { children: React.ReactNode }) {
  return <div className="client-gallery">{children}</div>;
}

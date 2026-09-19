import { GalleryPasswordForm } from "@/components/client-gallery/password-form";

export function GalleryGate({ slug }: { slug: string }) {
  return (
    <main className="client-gate">
      <section>
        <p className="client-gallery-brand">DESTINY<span>PRIVATE GALLERY</span></p>
        <h1>This gallery is private.</h1>
        <p>Enter the password to continue.</p>
        <GalleryPasswordForm slug={slug} />
      </section>
    </main>
  );
}

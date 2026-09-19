import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Destiny Events and Photography", template: "%s | Destiny" },
  description: "Intentional photography for celebrations, events, and the moments between.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

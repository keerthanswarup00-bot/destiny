import { PhotoGrid } from "@/components/public/photo-grid";
export const metadata = { title: "Gallery", description: "Selected work from Destiny Events and Photography." };
export default function Gallery() { return <section className="section gallery-page"><p className="eyebrow">PORTFOLIO</p><h1>Moments, held<br />in their truest light.</h1><p className="intro">A collection of celebrations, connections, and quiet in-between moments.</p><PhotoGrid expanded /></section>; }

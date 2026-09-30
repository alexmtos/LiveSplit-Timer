import type { Metadata } from 'next';
import { Overlay } from '@/components/Overlay';
import { OVERLAY_SECTIONS, type OverlaySection } from '@/types';

/** One page per overlay section (`/timer`, `/splits`, ...), for separate OBS browser sources. */
export function generateStaticParams() {
  return OVERLAY_SECTIONS.map((view) => ({ view }));
}

// Anything else is a 404.
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ view: string }> }): Promise<Metadata> {
  const { view } = await params;
  return { title: `LiveSplit Timer · ${view}` };
}

export default async function SectionPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  return <Overlay only={view as OverlaySection} />;
}

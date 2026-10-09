import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrackerView } from "@/components/tracker/tracker-view";
import { site } from "@/config/site";
import { getTracker } from "@/lib/server/household";

// Generic title so a shared or bookmarked link never leaks player names in previews.
export const metadata: Metadata = { title: site.name, robots: { index: false, follow: false } };

export default async function TrackerPage({ params, searchParams }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const { new: isNew } = await searchParams;
  const tracker = await getTracker(token);
  if (!tracker) notFound();

  return <TrackerView tracker={tracker} justCreated={isNew === "1"} />;
}

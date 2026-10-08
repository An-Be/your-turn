import { notFound } from "next/navigation";
import { getTracker } from "@/lib/household";
import { TrackerView } from "./tracker-view";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  // Generic title so a shared/bookmarked link doesn't leak player names in previews.
  return { title: "TagYourTurn", robots: { index: false, follow: false } };
}

export default async function TrackerPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { token } = await params;
  const { new: isNew } = await searchParams;
  const tracker = await getTracker(token);
  if (!tracker) notFound();

  return <TrackerView tracker={tracker} justCreated={isNew === "1"} />;
}

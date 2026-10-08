import { CreateForm } from "./create-form";
import { Shell, SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function Home() {
  return (
    <Shell>
      <SiteHeader right="No login" />
      <main className="flex flex-col gap-10 py-10">
        <div className="flex flex-col gap-4">
          <h1 className="display text-[56px]">Whose turn is it tonight?</h1>
          <p className="max-w-[34ch] text-[13px] leading-relaxed text-mute">
            One shared link for two people. It shows who starts tonight, flips when you&apos;re done,
            and keeps the receipts.
          </p>
        </div>
        <CreateForm />
      </main>
      <SiteFooter />
    </Shell>
  );
}

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/today" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-base flex flex-col">
      <header className="px-6 lg:px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-sage" />
          <span className="font-display text-lg font-semibold text-charcoal">Family Ops Board</span>
        </div>
        <Link
          to="/auth"
          className="text-sm font-medium text-charcoal hover:text-sage transition-colors"
        >
          Sign in
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <p className="text-xs uppercase tracking-widest text-clay font-semibold mb-6">
            For families who share a home
          </p>
          <h1 className="font-display italic text-5xl lg:text-7xl font-semibold text-sage leading-[1.05] mb-6">
            One calm home for family life.
          </h1>
          <p className="text-lg text-charcoal/70 max-w-xl mx-auto mb-10 leading-relaxed">
            A shared household command centre for two adults. Today's schedule, tasks,
            routines, and lists — glanceable from the kitchen, editable from anywhere,
            open to Claude and ChatGPT.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-xl bg-sage px-6 py-3.5 text-sm font-medium text-sage-foreground transition-colors hover:bg-sage/90 min-w-40"
            >
              Get started
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center rounded-xl border border-border-subtle bg-base px-6 py-3.5 text-sm font-medium text-charcoal transition-colors hover:bg-surface min-w-40"
            >
              How it works
            </a>
          </div>
        </div>
      </main>

      <section id="features" className="px-6 lg:px-10 pb-16 pt-8">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Today, at a glance",
              body: "Merged calendar, tasks, and routines in one warm dashboard — designed for a mounted iPad.",
            },
            {
              title: "Two adults, one board",
              body: "Sign in as adults, share everything. Kids surfaces coming later.",
            },
            {
              title: "AI-ready",
              body: "Claude and ChatGPT can read and update the board through a signed-in MCP connection.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-3xl bg-surface border border-border-subtle"
            >
              <h3 className="font-display text-xl font-semibold text-charcoal mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-charcoal/70 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-6 lg:px-10 py-6 text-xs text-charcoal/40 text-center">
        Family Ops Board · Made for calm homes
      </footer>
    </div>
  );
}

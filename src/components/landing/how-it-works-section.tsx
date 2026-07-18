import { HOW_IT_WORKS_STEPS } from "@/features/landing";

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-10rem] top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute right-[-10rem] top-1/3 h-80 w-80 rounded-full bg-violet-500/5 blur-[100px]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
            How it works
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            From sign-up to signed offer
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Four simple steps to take control of your job search and never lose
            track of an opportunity again.
          </p>
        </div>

        <ol className="relative mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* Connecting line (desktop) */}
          <div
            aria-hidden
            className="absolute left-[12.5%] right-[12.5%] top-6 hidden border-t-2 border-dashed border-border lg:block"
          />

          {HOW_IT_WORKS_STEPS.map((item) => (
            <li
              key={item.step}
              className="relative flex flex-col items-start lg:items-center lg:text-center"
            >
              <span className="relative z-10 mb-5 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-600 text-base font-bold text-white shadow-lg shadow-primary/30 ring-4 ring-background">
                {item.step}
              </span>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

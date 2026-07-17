import { cn } from "@/lib/utils";

interface PageHeroProps {
  title: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}

export function PageHero({ title, subtitle, className, children }: PageHeroProps) {
  return (
    <section className={cn("gradient-warm px-4 pb-12 pt-28 sm:px-6", className)}>
      <div className="mx-auto max-w-6xl">
        <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-muted-foreground">{subtitle}</p>
        )}
        {children}
      </div>
    </section>
  );
}

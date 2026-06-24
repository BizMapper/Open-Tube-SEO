import { Download, ShieldCheck, WifiOff, Cpu } from "lucide-react"
import { Button } from "@/components/ui/button"

const pills = [
  { icon: WifiOff, label: "Runs offline" },
  { icon: ShieldCheck, label: "No account, no tracking" },
  { icon: Cpu, label: "Local WebGPU AI" },
]

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            Free &amp; open source · built for Brave
          </span>

          <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight md:text-6xl">
            A vidIQ alternative that runs entirely on{" "}
            <span className="text-primary">your machine</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            OpenTube SEO scores your YouTube videos, extracts keywords, and
            generates optimized titles, tags, and descriptions using a local
            open-source AI model. No API keys, no servers, no subscriptions.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href="/downloads/opentube-seo-extension.zip" download>
                <Download className="size-4" />
                Download extension
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#install">Read install guide</a>
            </Button>
          </div>

          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            {pills.map((p) => (
              <li key={p.label} className="flex items-center gap-2">
                <p.icon className="size-4 text-primary" />
                {p.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

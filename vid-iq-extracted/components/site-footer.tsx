import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="rounded-2xl border border-border bg-card p-10 text-center md:p-16">
          <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
            Optimize your next upload — privately
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty leading-relaxed text-muted-foreground">
            Free, open source, and running entirely on your own machine. Download
            it and load it into Brave in a couple of minutes.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <a href="/downloads/opentube-seo-extension.zip" download>
                <Download className="size-4" />
                Download OpenTube SEO
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <span className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
              OT
            </span>
            OpenTube SEO — MIT licensed
          </span>
          <span>
            Not affiliated with YouTube, vidIQ, or TubeBuddy.
          </span>
        </div>
      </div>
    </footer>
  )
}

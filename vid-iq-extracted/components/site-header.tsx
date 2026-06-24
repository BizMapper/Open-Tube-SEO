import { Download, Code } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            OT
          </span>
          <span className="font-mono text-sm font-semibold tracking-tight">
            OpenTube SEO
          </span>
        </a>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#install" className="transition-colors hover:text-foreground">
            Install
          </a>
          <a href="#alternatives" className="transition-colors hover:text-foreground">
            Alternatives
          </a>
          <a href="#faq" className="transition-colors hover:text-foreground">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
            <a href="#install">
              <Code className="size-4" />
              Source
            </a>
          </Button>
          <Button asChild size="sm">
            <a href="/downloads/opentube-seo-extension.zip" download>
              <Download className="size-4" />
              Download
            </a>
          </Button>
        </div>
      </div>
    </header>
  )
}

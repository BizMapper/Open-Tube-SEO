import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

const steps = [
  {
    n: 1,
    title: "Download & extract the ZIP",
    body: "Download the ZIP file, then extract/unzip it to a permanent folder on your computer. Keep this folder — Brave will load the extension from this location every time you launch the browser.",
    code: "Download ZIP → Extract → Keep the folder permanently",
  },
  {
    n: 2,
    title: "Open the Extensions page",
    body: "In Brave, go to the extensions manager.",
    code: "brave://extensions",
  },
  {
    n: 3,
    title: "Enable Developer mode",
    body: "Toggle “Developer mode” on (top-right of the extensions page).",
    code: null,
  },
  {
    n: 4,
    title: "Load unpacked extension",
    body: "Click the "Load unpacked" button and choose the extracted extension folder (the one with manifest.json inside it). Do not select the ZIP file — Brave only loads unpacked folders.",
    code: "Load unpacked → Select extracted folder (not ZIP)",
  },
  {
    n: 5,
    title: "Enable WebGPU (if needed)",
    body: "The local AI needs WebGPU. If generation says it's unavailable, enable the flag and relaunch.",
    code: "brave://flags/#enable-unsafe-webgpu → Enabled → Relaunch",
  },
  {
    n: 6,
    title: "Use it on any video",
    body: "Open a YouTube video, click the OpenTube SEO icon, and review the score. The first AI run downloads the model (~300MB–2GB depending on choice); after that it works offline.",
    code: null,
  },
]

export function InstallSteps() {
  return (
    <section id="install" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
              Install in under two minutes
            </h2>
            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              {"It's an unpacked Manifest V3 extension — no Web Store needed. The same steps work in any Chromium browser (Chrome, Edge, Vivaldi)."}
            </p>
          </div>
          <Button asChild>
            <a href="/downloads/opentube-seo-extension.zip" download>
              <Download className="size-4" />
              Download .zip
            </a>
          </Button>
        </div>

        <ol className="mt-12 grid gap-4 md:grid-cols-2">
          {steps.map((s) => (
            <li
              key={s.n}
              className="flex gap-4 rounded-xl border border-border bg-card p-6"
            >
              <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {s.n}
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
                {s.code && (
                  <code className="mt-3 block overflow-x-auto rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
                    {s.code}
                  </code>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

import { Gauge, Sparkles, Tags, Lock, Zap, GitFork } from "lucide-react"

const features = [
  {
    icon: Gauge,
    title: "SEO score & checklist",
    body: "A vidIQ-style 0–100 score for the video you're watching, with an actionable checklist covering title length, description depth, tag coverage, and more — computed instantly and offline.",
  },
  {
    icon: Sparkles,
    title: "Local AI suggestions",
    body: "Generate click-worthy titles, an optimized description, and a full tag set using an open-source LLM (Llama 3.2 / Qwen2.5) running in your browser via WebGPU.",
  },
  {
    icon: Tags,
    title: "Keyword extraction",
    body: "Ranks the most relevant single keywords and long-tail phrases from the video's title, description, and existing tags. Click any keyword to copy it.",
  },
  {
    icon: Lock,
    title: "Private by design",
    body: "Page data never leaves your device. There's no backend, no telemetry, and no sign-in. The model weights download once, then everything works offline.",
  },
  {
    icon: Zap,
    title: "Zero config",
    body: "Load it unpacked and it works. Pick a model size to match your hardware — from a 0.5B model for low-end GPUs to 3B for the best quality.",
  },
  {
    icon: GitFork,
    title: "Open source",
    body: "Every line is readable, auditable, and modifiable. No obfuscation, no minified blobs you can't inspect. Fork it and make it yours.",
  },
]

export function Features() {
  return (
    <section id="features" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="max-w-2xl">
          <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
            Everything you need, nothing you don&apos;t
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            The core of what makes a YouTube SEO tool useful — rebuilt to run
            locally and respect your privacy.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card p-6"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

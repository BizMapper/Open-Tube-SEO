const faqs = [
  {
    q: "Is it really offline?",
    a: "Yes — with one caveat. The SEO score and keyword extraction are 100% offline always. The AI feature downloads the open-source model weights once from a public CDN on first use (a few hundred MB to ~2GB depending on the model you pick). After that download is cached, AI generation works with no network connection.",
  },
  {
    q: "Which AI model does it use?",
    a: "It uses WebLLM to run open models locally via WebGPU: Qwen2.5 0.5B (smallest/fastest), Llama 3.2 1B (balanced), or Llama 3.2 3B (best quality). You choose in the popup based on your hardware.",
  },
  {
    q: "Why Brave specifically?",
    a: "Brave is Chromium-based and supports WebGPU, so the local AI runs well. The extension also works in Chrome, Edge, and other Chromium browsers. If WebGPU is disabled, enable it at brave://flags/#enable-unsafe-webgpu.",
  },
  {
    q: "Does it send my data anywhere?",
    a: "No. There is no backend and no analytics. The page data it reads (title, description, tags, public stats) stays on your device and is only used locally to compute the score and feed the local model.",
  },
  {
    q: "Is this affiliated with vidIQ?",
    a: "No. OpenTube SEO is an independent, open-source project and is not affiliated with vidIQ, TubeBuddy, or YouTube. It's a privacy-first alternative for the core SEO workflow.",
  },
  {
    q: "Will it slow down my browser?",
    a: "The AI only runs when you click “Generate”. Scoring and keyword extraction are lightweight. Model inference uses your GPU; larger models need more VRAM, which is why a small model is the default.",
  },
]

export function Faq() {
  return (
    <section id="faq" className="border-b border-border">
      <div className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-balance text-center text-3xl font-bold tracking-tight md:text-4xl">
          Frequently asked questions
        </h2>
        <div className="mt-10 divide-y divide-border rounded-xl border border-border bg-card">
          {faqs.map((f) => (
            <details key={f.q} className="group p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {f.q}
                <span className="ml-4 text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

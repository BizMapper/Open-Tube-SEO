import { Check, X } from "lucide-react"

type Row = {
  name: string
  note: string
  openSource: boolean
  offline: boolean
  free: boolean
  ai: boolean
  highlight?: boolean
}

const rows: Row[] = [
  {
    name: "OpenTube SEO",
    note: "This extension — local AI, fully private",
    openSource: true,
    offline: true,
    free: true,
    ai: true,
    highlight: true,
  },
  {
    name: "vidIQ",
    note: "Industry standard, cloud-based, freemium with paid tiers",
    openSource: false,
    offline: false,
    free: false,
    ai: true,
  },
  {
    name: "TubeBuddy",
    note: "Popular vidIQ competitor, cloud-based, freemium",
    openSource: false,
    offline: false,
    free: false,
    ai: true,
  },
  {
    name: "DeArrow",
    note: "Open source, crowdsourced better titles/thumbnails (not SEO scoring)",
    openSource: true,
    offline: false,
    free: true,
    ai: false,
  },
  {
    name: "Tag extractors",
    note: "Various free single-purpose tag/keyword scrapers",
    openSource: false,
    offline: true,
    free: true,
    ai: false,
  },
]

const columns: { key: keyof Row; label: string }[] = [
  { key: "openSource", label: "Open source" },
  { key: "offline", label: "Offline" },
  { key: "free", label: "Free" },
  { key: "ai", label: "AI" },
]

function Cell({ on }: { on: boolean }) {
  return on ? (
    <Check className="mx-auto size-4 text-primary" aria-label="Yes" />
  ) : (
    <X className="mx-auto size-4 text-muted-foreground" aria-label="No" />
  )
}

export function Alternatives() {
  return (
    <section id="alternatives" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="max-w-2xl">
          <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
            How it compares to the alternatives
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Fully open-source, offline YouTube SEO tools are rare — most are
            cloud services with subscriptions. Here&apos;s an honest look at the
            landscape so you can pick what fits.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-left">
                <th className="px-4 py-3 font-semibold">Tool</th>
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-3 text-center font-semibold">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.name}
                  className={`border-b border-border last:border-0 ${
                    r.highlight ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-4 py-4">
                    <div
                      className={`font-medium ${
                        r.highlight ? "text-primary" : ""
                      }`}
                    >
                      {r.name}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {r.note}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Cell on={r.openSource} />
                  </td>
                  <td className="px-4 py-4">
                    <Cell on={r.offline} />
                  </td>
                  <td className="px-4 py-4">
                    <Cell on={r.free} />
                  </td>
                  <td className="px-4 py-4">
                    <Cell on={r.ai} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Comparison reflects typical default offerings and may change as each
          product evolves. vidIQ and TubeBuddy do offer limited free tiers.
        </p>
      </div>
    </section>
  )
}

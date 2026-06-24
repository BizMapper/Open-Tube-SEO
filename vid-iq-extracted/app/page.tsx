import { SiteHeader } from "@/components/site-header"
import { Hero } from "@/components/hero"
import { Features } from "@/components/features"
import { InstallSteps } from "@/components/install-steps"
import { Alternatives } from "@/components/alternatives"
import { Faq } from "@/components/faq"
import { SiteFooter } from "@/components/site-footer"

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <Features />
      <InstallSteps />
      <Alternatives />
      <Faq />
      <SiteFooter />
    </main>
  )
}

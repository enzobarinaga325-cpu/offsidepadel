import { Link } from "react-router-dom";
import { ArrowRight, Trophy, Users, Calendar, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OffsideLogo } from "@/components/OffsideLogo";
import { Seo } from "@/components/Seo";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Seo
        title="Off-Side — Torneos y ranking de pádel"
        description="Organizá e inscribite a torneos de pádel, seguí el ranking de tu categoría y tu historial de partidos en Off-Side."
        path="/"
        jsonLd={[
          { "@context": "https://schema.org", "@type": "Organization", name: "Off-Side", url: "https://offsidepdel.lovable.app" },
          { "@context": "https://schema.org", "@type": "WebSite", name: "Off-Side", url: "https://offsidepdel.lovable.app" },
        ]}
      />
      {/* Nav */}
      <nav className="sticky top-0 z-50 w-full bg-background/85 backdrop-blur border-b border-border">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center bg-black rounded-md px-2.5 py-1.5">
            <OffsideLogo height={22} className="[filter:none] dark:[filter:none]" />
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/tournaments">Torneos</Link></Button>
            <Button asChild size="sm"><Link to="/auth">Ingresar</Link></Button>
          </div>
        </div>
      </nav>

      <main>
      {/* Hero */}
      <section className="relative px-4 sm:px-6 pt-12 sm:pt-16 pb-16 sm:pb-20">
        <div className="mx-auto max-w-[1200px] grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-xs text-muted-foreground mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Inscripciones abiertas
            </div>
            <h1 className="text-[clamp(2rem,7vw,3.6rem)] font-bold leading-[1.05] tracking-tight">
              Tu club de pádel,<br />
              <span className="text-primary">organizado.</span>
            </h1>
            <p className="mt-5 text-[15px] sm:text-base text-muted-foreground max-w-[460px] leading-relaxed">
              Inscribite a torneos con tu compañero en segundos. Seguí tu ranking, tu historial y tus próximos partidos. Todo en un mismo lugar.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="h-12 text-[15px]">
                <Link to="/tournaments">
                  Ver torneos <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 text-[15px]">
                <Link to="/auth">Crear cuenta</Link>
              </Button>
            </div>
          </div>

          <div className="relative hidden lg:flex items-center justify-center">
            <div className="aspect-square w-full max-w-[420px] bg-black rounded-3xl border border-border p-12 flex items-center justify-center">
              <OffsideLogo height={140} className="[filter:none] dark:[filter:none]" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 sm:px-6 py-14 sm:py-20 bg-muted/30 border-y border-border">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Todo lo que tu club necesita</h2>
          <p className="text-sm text-muted-foreground mb-10">
            Sin papeles, sin grupos de WhatsApp infinitos, sin trabajo manual.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {[
              { icon: Calendar, title: "Torneos en vivo", desc: "Categorías, cupos y precios actualizados al instante. Los jugadores se inscriben con un click." },
              { icon: Users, title: "Parejas y aprobaciones", desc: "Elegí compañero, el admin aprueba. Lista de espera automática cuando se llenan los cupos." },
              { icon: Award, title: "Ranking y estadísticas", desc: "Cada categoría con su ranking, historial completo por jugador y puntajes configurables." },
            ].map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-5 sm:p-6">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Off-Side
      </footer>
      </main>
    </div>
  );
};

export default Landing;

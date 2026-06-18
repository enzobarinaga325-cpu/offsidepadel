import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { Trophy } from "lucide-react";

const categorias = [
  {
    nivel: "1ra",
    titulo: "Primera categoría",
    descripcion:
      "Jugadores de nivel profesional o semi-profesional. Dominan todos los golpes (bandeja, víbora, remates por 3 y por 4), juegan tácticamente cada punto y entrenan varias veces por semana. Si competís en circuitos federados o ganás torneos abiertos con regularidad, esta es tu categoría.",
  },
  {
    nivel: "2da",
    titulo: "Segunda categoría",
    descripcion:
      "Nivel avanzado. Tenés todos los golpes resueltos, salida de pared sólida por ambos lados, buen smash y lectura del juego. Solés ganar partidos en torneos amateurs de nivel medio-alto y entrenás de forma regular.",
  },
  {
    nivel: "3ra",
    titulo: "Tercera categoría",
    descripcion:
      "Nivel intermedio-avanzado. Resolvés la mayoría de las salidas de pared, hacés bandeja con consistencia y empezás a meter víboras y remates por 3. Ideal si jugás varias veces por semana y tenés algún torneo ganado en 4ta o 5ta.",
  },
  {
    nivel: "4ta",
    titulo: "Cuarta categoría",
    descripcion:
      "Nivel intermedio. Tenés buen control de drive y revés, salís de pared con menos errores y dominás la red en puntos largos. Es la categoría más numerosa en torneos amateurs y donde compite la mayoría de jugadores semanales.",
  },
  {
    nivel: "5ta",
    titulo: "Quinta categoría",
    descripcion:
      "Nivel inicial-intermedio. Sostenés peloteos, tenés saque y resto consolidados y empezás a usar la pared. Si jugás hace 1 o 2 años y querés tu primer torneo, este es el lugar ideal para arrancar a competir.",
  },
  {
    nivel: "6ta",
    titulo: "Sexta categoría",
    descripcion:
      "Nivel principiante. Estás aprendiendo los golpes básicos y querés tu primer torneo. La 6ta es para que conozcas la dinámica de competencia sin presión y sumes experiencia partido a partido.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: categorias.map((c) => ({
    "@type": "Question",
    name: `¿Qué es la ${c.nivel} categoría en pádel?`,
    acceptedAnswer: { "@type": "Answer", text: c.descripcion },
  })),
};

export default function CategoriasGuide() {
  return (
    <AppLayout>
      <Seo
        title="Categorías de pádel: en qué categoría inscribirte"
        description="Guía clara de las categorías de pádel (1ra a 6ta): cómo identificar tu nivel y elegir la categoría correcta para tu primer torneo."
        path="/guias/categorias"
        jsonLd={jsonLd}
      />
      <main className="max-w-[860px] mx-auto p-4 md:p-8">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Guía</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Categorías de pádel: ¿en qué categoría inscribirte?
          </h1>
          <p className="text-base text-muted-foreground mt-3">
            Si vas a jugar tu primer torneo, elegir la categoría correcta es lo más importante. Te
            explicamos cómo se dividen los niveles (1ra a 6ta) y cómo identificar el tuyo en menos
            de un minuto.
          </p>
        </header>

        <section className="space-y-4 mb-10">
          {categorias.map((c) => (
            <Card key={c.nivel} className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-semibold">
                  {c.nivel}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{c.titulo}</h2>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    {c.descripcion}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold tracking-tight mb-3">
            Cómo elegir tu categoría en 3 pasos
          </h2>
          <ol className="space-y-3 text-sm text-muted-foreground list-decimal pl-5">
            <li>
              <span className="text-foreground font-medium">Sé honesto con tu nivel.</span>{" "}
              Anotarte en una categoría superior a la real suele terminar en partidos sin chances;
              en una inferior, en sanciones del torneo.
            </li>
            <li>
              <span className="text-foreground font-medium">Mirá tu historial.</span> Si ganaste un
              torneo en una categoría, lo habitual es subir a la inmediata superior la próxima vez.
            </li>
            <li>
              <span className="text-foreground font-medium">Consultá a tu profe o al organizador.</span>{" "}
              En Off-Side el administrador puede asignarte una categoría según tus resultados
              previos.
            </li>
          </ol>
        </section>

        <Card className="p-6 bg-primary/5 border-primary/30 text-center">
          <Trophy className="h-8 w-8 mx-auto text-primary mb-2" />
          <h2 className="text-lg font-semibold">¿Listo para tu primer torneo?</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Mirá los torneos abiertos en Off-Side e inscribite con tu compañero.
          </p>
          <Button asChild>
            <Link to="/tournaments">Ver torneos disponibles</Link>
          </Button>
        </Card>
      </main>
    </AppLayout>
  );
}

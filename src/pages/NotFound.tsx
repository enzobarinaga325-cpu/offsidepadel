import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Seo } from "@/components/Seo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <>
      <Seo
        title="Página no encontrada — Off-Side"
        description="La página que buscás no existe. Volvé al inicio para seguir explorando torneos y rankings de pádel."
        path={location.pathname}
      />
      <main className="flex min-h-screen items-center justify-center bg-muted">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">La página que buscás no existe</p>
          <a href="/" className="text-primary underline hover:text-primary/90">
            Volver al inicio
          </a>
        </div>
      </main>
    </>
  );
};

export default NotFound;

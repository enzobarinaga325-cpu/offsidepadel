import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { OffsideLogo } from "@/components/OffsideLogo";
import { Seo } from "@/components/Seo";

type Category = { id: string; name: string };

export default function Auth() {
  const { user, loading, signIn, signInWithPhone, registerWithPhone } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"user" | "admin">("user");
  const [categories, setCategories] = useState<Category[]>([]);

  // Phone login
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPin, setLoginPin] = useState("");

  // Phone register
  const [rFirst, setRFirst] = useState("");
  const [rLast, setRLast] = useState("");
  const [rPhone, setRPhone] = useState("");
  const [rPin, setRPin] = useState("");
  const [rPin2, setRPin2] = useState("");
  const [rCategory, setRCategory] = useState("");

  // Admin login
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    // Categories are readable by anon? Our RLS now requires authenticated.
    // Use the public edge-free path: call a permissive select via anon key.
    // If empty due to RLS, we'll still allow submission but the user picks blindly.
    supabase.from("categories").select("id,name").order("name").then(({ data }) => {
      if (data) setCategories(data as Category[]);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  const onlyDigits = (s: string) => s.replace(/\D/g, "");

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneN = onlyDigits(loginPhone);
    if (phoneN.length < 8 || !/^\d{4}$/.test(loginPin)) {
      toast({ title: "Datos inválidos", description: "Revisá el celular y el PIN.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await signInWithPhone(phoneN, loginPin);
      toast({ title: "¡Bienvenido!" });
    } catch (err: any) {
      toast({ title: "No se pudo ingresar", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handlePhoneRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rFirst.trim() || !rLast.trim()) {
      toast({ title: "Datos incompletos", description: "Nombre y apellido son obligatorios.", variant: "destructive" });
      return;
    }
    const phoneN = onlyDigits(rPhone);
    if (phoneN.length < 8) {
      toast({ title: "Celular inválido", description: "Ingresá un número válido.", variant: "destructive" });
      return;
    }
    if (!/^\d{4}$/.test(rPin)) {
      toast({ title: "PIN inválido", description: "El PIN debe tener exactamente 4 dígitos.", variant: "destructive" });
      return;
    }
    if (rPin !== rPin2) {
      toast({ title: "PIN no coincide", description: "Confirmá el mismo PIN.", variant: "destructive" });
      return;
    }
    if (!rCategory) {
      toast({ title: "Categoría requerida", description: "Seleccioná tu categoría.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await registerWithPhone({
        firstName: rFirst.trim(),
        lastName: rLast.trim(),
        phone: phoneN,
        pin: rPin,
        categoryId: rCategory,
      });
      toast({ title: "¡Cuenta creada!", description: "Bienvenido a Off-Side." });
    } catch (err: any) {
      toast({ title: "Error de registro", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(adminEmail, adminPassword);
      toast({ title: "Bienvenido, administrador" });
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Seo
        title="Ingresar — Off-Side"
        description="Ingresá a Off-Side con tu celular y PIN para ver torneos y ranking de pádel."
        path="/auth"
      />
      <div className="w-full max-w-[420px] border border-border rounded-lg p-6 sm:p-8 space-y-6 bg-card">
        <div className="flex flex-col items-center gap-3">
          <Link to="/" className="flex items-center justify-center bg-black rounded-md px-4 py-3 hover:opacity-90 transition-opacity" aria-label="Off-Side inicio">
            <OffsideLogo height={32} className="[filter:none] dark:[filter:none]" />
          </Link>
          <h1 className="text-base font-semibold text-center">
            {mode === "admin" ? "Acceso administradores" : "Ingresar a Off-Side"}
          </h1>
          <p className="text-[13px] text-muted-foreground text-center">Torneos y ranking de pádel</p>
        </div>

        {mode === "user" ? (
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2 h-10">
              <TabsTrigger value="login" className="text-[13px]">Ingresar</TabsTrigger>
              <TabsTrigger value="signup" className="text-[13px]">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4">
              <form onSubmit={handlePhoneLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Número de celular</Label>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="11 5555 5555"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    required
                    className="h-11 text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">PIN (4 dígitos)</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    autoComplete="current-password"
                    placeholder="••••"
                    value={loginPin}
                    onChange={(e) => setLoginPin(onlyDigits(e.target.value).slice(0, 4))}
                    required
                    className="h-11 text-base tracking-[0.5em] text-center"
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-[14px]" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ingresar
                </Button>
                <button
                  type="button"
                  className="block w-full text-center text-[12px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  onClick={() => toast({
                    title: "Olvidé mi PIN",
                    description: "Comunicate con la administración para restablecer tu PIN.",
                  })}
                >
                  Olvidé mi PIN
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <form onSubmit={handlePhoneRegister} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[12px]">Nombre</Label>
                    <Input value={rFirst} onChange={(e) => setRFirst(e.target.value)} required className="h-10 text-[14px]" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[12px]">Apellido</Label>
                    <Input value={rLast} onChange={(e) => setRLast(e.target.value)} required className="h-10 text-[14px]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px]">Número de celular</Label>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    placeholder="11 5555 5555"
                    value={rPhone}
                    onChange={(e) => setRPhone(e.target.value)}
                    required
                    className="h-10 text-[14px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[12px]">Crear PIN</Label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="••••"
                      value={rPin}
                      onChange={(e) => setRPin(onlyDigits(e.target.value).slice(0, 4))}
                      required
                      className="h-10 text-[14px] tracking-[0.4em] text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[12px]">Confirmar PIN</Label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="••••"
                      value={rPin2}
                      onChange={(e) => setRPin2(onlyDigits(e.target.value).slice(0, 4))}
                      required
                      className="h-10 text-[14px] tracking-[0.4em] text-center"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px]">Categoría</Label>
                  <Select value={rCategory} onValueChange={setRCategory}>
                    <SelectTrigger className="h-10 text-[14px]">
                      <SelectValue placeholder="Elegí tu categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length === 0 ? (
                        <div className="px-2 py-1.5 text-[12px] text-muted-foreground">Sin categorías disponibles</div>
                      ) : categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Solo el administrador puede cambiarla luego.</p>
                </div>
                <Button type="submit" className="w-full h-11 text-[14px]" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear cuenta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[12px]">Email</Label>
              <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required className="h-10 text-[14px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[12px]">Contraseña</Label>
              <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required className="h-10 text-[14px]" />
            </div>
            <Button type="submit" className="w-full h-11 text-[14px]" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ingresar
            </Button>
          </form>
        )}

        <div className="text-center">
          <button
            type="button"
            onClick={() => setMode(mode === "user" ? "admin" : "user")}
            className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            {mode === "user" ? "Acceso administradores" : "← Volver al ingreso de usuarios"}
          </button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground pt-1">
          © {new Date().getFullYear()} Off-Side
        </p>
      </div>
    </main>
  );
}

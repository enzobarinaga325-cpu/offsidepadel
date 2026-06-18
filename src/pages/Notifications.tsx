import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check, Trash2 } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Seo } from "@/components/Seo";

export default function Notifications() {
  const { items, unread, loading, markRead, markAllRead, remove } = useNotifications();

  return (
    <AppLayout>
      <Seo
        title="Notificaciones — Off-Side"
        description="Revisá las novedades de tus inscripciones, partidos y resultados en tus torneos de pádel."
        path="/notifications"
      />
      <div className="max-w-[800px] mx-auto p-4 md:p-8">
        <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Notificaciones</h1>
            <p className="text-sm text-muted-foreground">
              {unread > 0 ? `${unread} sin leer` : "Todo al día"}
            </p>
          </div>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <Check className="h-4 w-4 mr-1" /> Marcar todas como leídas
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center">
            <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No tenés notificaciones todavía.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <Card key={n.id} className={`p-4 ${!n.read_at ? "border-primary/50" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!n.read_at && <span className="h-2 w-2 rounded-full bg-primary" />}
                      <span className="font-medium text-sm">{n.title}</span>
                    </div>
                    {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-3">
                      <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}</span>
                      {n.link && (
                        <Link to={n.link} onClick={() => !n.read_at && void markRead(n.id)} className="text-primary hover:underline">
                          Abrir
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!n.read_at && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markRead(n.id)} title="Marcar como leída" aria-label="Marcar notificación como leída">
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(n.id)} title="Eliminar" aria-label="Eliminar notificación">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

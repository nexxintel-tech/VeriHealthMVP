import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bell, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import PatientLayout from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPatientAlerts, PatientAlert } from "@/lib/api";

const severityConfig: Record<string, { color: string; dotColor: string; badgeVariant: string; icon: typeof AlertCircle }> = {
  high: { color: "text-red-600", dotColor: "bg-red-500", badgeVariant: "destructive", icon: AlertCircle },
  medium: { color: "text-amber-600", dotColor: "bg-amber-500", badgeVariant: "outline", icon: AlertTriangle },
  low: { color: "text-blue-600", dotColor: "bg-blue-500", badgeVariant: "secondary", icon: CheckCircle },
};

export default function PatientAlerts() {
  const { data: alerts, isLoading, error } = useQuery<PatientAlert[]>({
    queryKey: ["patient-alerts"],
    queryFn: fetchPatientAlerts,
  });

  const sortedAlerts = alerts
    ? [...alerts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    : [];

  return (
    <PatientLayout>
      <div className="space-y-6" data-testid="patient-alerts-page">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-alerts-title">
            Health Alerts
          </h1>
          {sortedAlerts.length > 0 && (
            <Badge variant="secondary" data-testid="badge-alert-count">
              {sortedAlerts.length}
            </Badge>
          )}
        </div>

        {isLoading && (
          <div className="space-y-4" data-testid="alerts-loading">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-3 w-3 rounded-full mt-1.5" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <Card data-testid="alerts-error">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Failed to load alerts. Please try again later.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && sortedAlerts.length === 0 && (
          <Card data-testid="alerts-empty">
            <CardContent className="p-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">No health alerts</h3>
              <p className="text-sm text-muted-foreground">
                Your health metrics look good!
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && sortedAlerts.length > 0 && (
          <div className="space-y-3" data-testid="alerts-list">
            {sortedAlerts.map((alert) => {
              const config = severityConfig[alert.severity] || severityConfig.low;
              const Icon = config.icon;

              return (
                <Card
                  key={alert.id}
                  className={!alert.isRead ? "border-l-4 border-l-primary bg-accent/30" : ""}
                  data-testid={`card-alert-${alert.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`h-3 w-3 rounded-full mt-1.5 shrink-0 ${config.dotColor}`} data-testid={`dot-severity-${alert.id}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
                          <span
                            className={`text-sm ${!alert.isRead ? "font-bold" : "font-medium"}`}
                            data-testid={`text-alert-type-${alert.id}`}
                          >
                            {alert.type}
                          </span>
                          <Badge
                            variant={config.badgeVariant as any}
                            className={`text-xs ${
                              alert.severity === "high"
                                ? ""
                                : alert.severity === "medium"
                                ? "border-amber-500 text-amber-700"
                                : "border-blue-500 text-blue-700"
                            }`}
                            data-testid={`badge-severity-${alert.id}`}
                          >
                            {alert.severity}
                          </Badge>
                          {!alert.isRead && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" data-testid={`dot-unread-${alert.id}`} />
                          )}
                        </div>
                        <p
                          className={`text-sm ${!alert.isRead ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                          data-testid={`text-alert-message-${alert.id}`}
                        >
                          {alert.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1" data-testid={`text-alert-time-${alert.id}`}>
                          {format(new Date(alert.timestamp), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PatientLayout>
  );
}

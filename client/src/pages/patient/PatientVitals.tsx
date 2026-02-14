import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  HeartPulse,
  Activity,
  Droplets,
  Moon,
  Footprints,
  Filter,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import PatientLayout from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPatientVitalsOwn, PatientVital } from "@/lib/api";

const VITAL_TYPES = [
  { value: "all", label: "All", icon: Activity },
  { value: "Heart Rate", label: "Heart Rate", icon: HeartPulse },
  { value: "HRV", label: "HRV", icon: Activity },
  { value: "Blood Pressure", label: "Blood Pressure", icon: Droplets },
  { value: "SpO2", label: "SpO2", icon: Droplets },
  { value: "Sleep", label: "Sleep", icon: Moon },
  { value: "Steps", label: "Steps", icon: Footprints },
];

const TIME_PERIODS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

const CHART_COLORS: Record<string, string> = {
  "Heart Rate": "#ef4444",
  HRV: "#8b5cf6",
  "Blood Pressure": "#3b82f6",
  SpO2: "#06b6d4",
  Sleep: "#6366f1",
  Steps: "#22c55e",
};

function getVitalIcon(type: string) {
  switch (type) {
    case "Heart Rate": return HeartPulse;
    case "HRV": return Activity;
    case "Blood Pressure": return Droplets;
    case "SpO2": return Droplets;
    case "Sleep": return Moon;
    case "Steps": return Footprints;
    default: return Activity;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "normal":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200" data-testid="badge-status-normal">Normal</Badge>;
    case "warning":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200" data-testid="badge-status-warning">Warning</Badge>;
    case "critical":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200" data-testid="badge-status-critical">Critical</Badge>;
    default:
      return <Badge variant="secondary" data-testid="badge-status-unknown">Unknown</Badge>;
  }
}

function VitalChart({ vitals, type }: { vitals: PatientVital[]; type: string }) {
  const chartData = vitals
    .filter((v) => v.type === type)
    .map((v) => ({
      time: format(new Date(v.timestamp), "MMM dd HH:mm"),
      value: parseFloat(v.value.toString()),
    }))
    .reverse();

  if (chartData.length === 0) return null;

  const Icon = getVitalIcon(type);
  const color = CHART_COLORS[type] || "#6366f1";

  return (
    <Card className="border-none shadow-sm" data-testid={`chart-card-${type.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color }} />
          {type}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={chartData.length <= 30}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PatientVitals() {
  const [selectedType, setSelectedType] = useState("all");
  const [selectedDays, setSelectedDays] = useState("30");

  const typeParam = selectedType === "all" ? undefined : selectedType;
  const days = parseInt(selectedDays);

  const { data: vitals = [], isLoading, error } = useQuery({
    queryKey: ["patient-vitals", typeParam, days],
    queryFn: () => fetchPatientVitalsOwn(typeParam, days),
  });

  const chartTypes = useMemo(() => {
    if (selectedType !== "all") return [selectedType];
    const types = new Set(vitals.map((v) => v.type));
    return Array.from(types);
  }, [vitals, selectedType]);

  const sortedVitals = useMemo(() => {
    return [...vitals].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [vitals]);

  return (
    <PatientLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
              Vitals History
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track and review your vital sign readings over time
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[160px]" data-testid="select-vital-type">
                <SelectValue placeholder="Vital Type" />
              </SelectTrigger>
              <SelectContent>
                {VITAL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} data-testid={`option-type-${t.value.toLowerCase().replace(/\s+/g, "-")}`}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedDays} onValueChange={setSelectedDays}>
              <SelectTrigger className="w-[120px]" data-testid="select-time-period">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {TIME_PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value} data-testid={`option-period-${p.value}`}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-[280px] w-full" />
            <Skeleton className="h-[280px] w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {error && (
          <Card className="border-none shadow-sm">
            <CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">Unable to load vitals</h3>
              <p className="text-muted-foreground mt-2">
                {error instanceof Error ? error.message : "Please try again later."}
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && vitals.length === 0 && (
          <Card className="border-none shadow-sm">
            <CardContent className="py-12 text-center">
              <HeartPulse className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg" data-testid="text-no-vitals">No vital readings found</h3>
              <p className="text-muted-foreground mt-2">
                Connect your health device to start tracking your vitals.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && vitals.length > 0 && (
          <>
            <div className={`grid gap-4 ${chartTypes.length > 1 ? "lg:grid-cols-2" : "grid-cols-1"}`}>
              {chartTypes.map((type) => (
                <VitalChart key={type} vitals={vitals} type={type} />
              ))}
            </div>

            <Card className="border-none shadow-sm" data-testid="card-readings-table">
              <CardHeader>
                <CardTitle className="text-lg">Individual Readings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium text-muted-foreground">Type</th>
                        <th className="pb-3 font-medium text-muted-foreground">Value</th>
                        <th className="pb-3 font-medium text-muted-foreground">Unit</th>
                        <th className="pb-3 font-medium text-muted-foreground">Timestamp</th>
                        <th className="pb-3 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedVitals.map((vital, idx) => {
                        const Icon = getVitalIcon(vital.type);
                        return (
                          <tr
                            key={vital.id || idx}
                            className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                            data-testid={`row-vital-${vital.id || idx}`}
                          >
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{vital.type}</span>
                              </div>
                            </td>
                            <td className="py-3 font-semibold" data-testid={`text-value-${vital.id || idx}`}>
                              {vital.value}
                            </td>
                            <td className="py-3 text-muted-foreground">{vital.unit}</td>
                            <td className="py-3 text-muted-foreground" data-testid={`text-timestamp-${vital.id || idx}`}>
                              {format(new Date(vital.timestamp), "MMM dd, yyyy HH:mm")}
                            </td>
                            <td className="py-3">{getStatusBadge(vital.status)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PatientLayout>
  );
}

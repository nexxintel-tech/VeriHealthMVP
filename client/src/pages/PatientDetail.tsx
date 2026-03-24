import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import { fetchPatient, fetchPatientVitals, fetchPatientMedications, addPatientMedication } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { 
  Activity, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Phone,
  MessageSquare,
  HeartPulse,
  Pill,
  Plus,
  Footprints,
  Moon,
  TrendingDown,
  TrendingUp,
  CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

function getRiskInsight(riskScore: number, riskLevel: string): { title: string; description: string; colorClass: string } {
  const score = Number(riskScore);
  if (riskLevel === "high" || score >= 70) {
    return {
      title: "Elevated Risk Detected",
      description: `Risk score of ${score}/100 indicates elevated concern. Recent HRV decline and vital trend deviations suggest close monitoring is warranted.`,
      colorClass: "text-destructive",
    };
  }
  if (riskLevel === "medium" || score >= 40) {
    return {
      title: "Moderate Risk Observed",
      description: `Risk score of ${score}/100 reflects moderate risk. Vital trends are showing some variability; continued monitoring is recommended.`,
      colorClass: "text-warning",
    };
  }
  return {
    title: "Low Risk — Stable",
    description: `Risk score of ${score}/100 suggests the patient is currently stable. Vital trends are within normal ranges based on recent data.`,
    colorClass: "text-green-400",
  };
}

export default function PatientDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddMed, setShowAddMed] = useState(false);
  const [medForm, setMedForm] = useState({
    name: "",
    dosage: "",
    frequency: "",
    prescribedBy: "",
    startDate: "",
  });
  
  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: () => fetchPatient(id!),
    enabled: !!id,
  });

  const { data: vitals = [], isLoading: vitalsLoading } = useQuery({
    queryKey: ["patient-vitals", id],
    queryFn: () => fetchPatientVitals(id!, undefined, 7),
    enabled: !!id,
  });

  const { data: medications = [], isLoading: medicationsLoading } = useQuery({
    queryKey: ["patient-medications", id],
    queryFn: () => fetchPatientMedications(id!),
    enabled: !!id,
  });

  const addMedicationMutation = useMutation({
    mutationFn: (data: Parameters<typeof addPatientMedication>[1]) => addPatientMedication(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-medications", id] });
      setShowAddMed(false);
      setMedForm({ name: "", dosage: "", frequency: "", prescribedBy: "", startDate: "" });
      toast({ title: "Medication added", description: "The medication has been added to the patient's record." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add medication", description: err.message, variant: "destructive" });
    },
  });

  // Process data for charts
  const hrData = vitals
    .filter(v => v.type === "Heart Rate" && v.value != null)
    .map(v => ({
      time: format(new Date(v.recorded_at), "MMM dd HH:mm"),
      value: parseFloat(v.value!.toString())
    }))
    .reverse();

  const hrvData = vitals
    .filter(v => v.type === "HRV" && v.value != null)
    .map(v => ({
      time: format(new Date(v.recorded_at), "MMM dd HH:mm"),
      value: parseFloat(v.value!.toString())
    }))
    .reverse();

  const stepsData = vitals
    .filter(v => v.type === "Steps" && v.value != null)
    .map(v => ({
      time: format(new Date(v.recorded_at), "MMM dd"),
      value: parseFloat(v.value!.toString())
    }))
    .reverse();

  const sleepData = vitals
    .filter(v => v.type === "Sleep" && v.value != null)
    .map(v => ({
      time: format(new Date(v.recorded_at), "MMM dd"),
      value: parseFloat(v.value!.toString())
    }))
    .reverse();

  if (patientLoading) {
    return (
      <Layout>
        <div className="space-y-8">
          <Skeleton className="h-24 w-full" />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-[300px] w-full" />
              <Skeleton className="h-[300px] w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-[200px] w-full" />
              <Skeleton className="h-[200px] w-full" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!patient) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Patient Not Found</h2>
            <p className="text-muted-foreground">The patient you're looking for doesn't exist.</p>
          </div>
        </div>
      </Layout>
    );
  }

  const riskInsight = getRiskInsight(patient.riskScore, patient.riskLevel);

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-6">
            <div className="h-24 w-24 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold border-2 border-primary/20">
              {patient.name.charAt(0)}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-heading font-bold text-foreground">{patient.name}</h1>
                <RiskBadge level={patient.riskLevel} className="h-7 px-3 text-sm" />
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Age: {patient.age} yrs
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Last Sync: {new Date(patient.lastSync).toLocaleString()}
                </div>
                <div className="flex items-center gap-1">
                  <Activity className="h-4 w-4" />
                  ID: #{patient.id.substring(0, 8).toUpperCase()}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {patient.conditions.map(c => (
                  <Badge key={c} variant="secondary" className="font-normal">{c}</Badge>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="gap-2"
              data-testid="button-message-patient"
              onClick={() => toast({ title: "Messaging not available", description: "The messaging feature is not yet available in this version." })}
            >
              <MessageSquare className="h-4 w-4" />
              Message
            </Button>
            <Button
              className="gap-2 bg-primary hover:bg-primary/90"
              data-testid="button-call-patient"
              onClick={() => toast({ title: "Calling not available", description: "The call patient feature is not yet available in this version." })}
            >
              <Phone className="h-4 w-4" />
              Call Patient
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column: Charts */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="vitals" className="w-full">
              <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0 gap-6">
                <TabsTrigger 
                  value="vitals" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2"
                  data-testid="tab-vitals"
                >
                  Vital Trends
                </TabsTrigger>
                <TabsTrigger 
                  value="activity"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2"
                  data-testid="tab-activity"
                >
                  Activity & Sleep
                </TabsTrigger>
                <TabsTrigger 
                  value="medications"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2"
                  data-testid="tab-medications"
                >
                  Medications
                </TabsTrigger>
              </TabsList>

              <TabsContent value="vitals" className="space-y-6 mt-6">
                {vitalsLoading ? (
                  <>
                    <Skeleton className="h-[300px] w-full" />
                    <Skeleton className="h-[300px] w-full" />
                  </>
                ) : hrData.length === 0 ? (
                  <Card className="border-none shadow-sm">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <HeartPulse className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No vital data available</p>
                      <p className="text-sm mt-1">Data will appear once the patient syncs their device.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Heart Rate Chart */}
                    <Card className="border-none shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                          <HeartPulse className="h-4 w-4 text-primary" />
                          Heart Rate (Avg {Math.round(hrData.reduce((sum, d) => sum + d.value, 0) / hrData.length)} bpm)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[250px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={hrData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                              <XAxis 
                                dataKey="time" 
                                stroke="hsl(var(--muted-foreground))" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false}
                                minTickGap={30}
                              />
                              <YAxis 
                                stroke="hsl(var(--muted-foreground))" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false}
                                domain={['dataMin - 5', 'dataMax + 5']}
                              />
                              <Tooltip 
                                contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                                itemStyle={{ color: "hsl(var(--foreground))" }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="value" 
                                stroke="hsl(var(--primary))" 
                                strokeWidth={2} 
                                dot={false} 
                                activeDot={{ r: 6 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* HRV Chart */}
                    {hrvData.length > 0 && (
                      <Card className="border-none shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Activity className="h-4 w-4 text-purple-500" />
                            HRV Variability ({Math.round(hrvData.reduce((sum, d) => sum + d.value, 0) / hrvData.length)}ms)
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={hrvData}>
                                <defs>
                                  <linearGradient id="colorHrv" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis 
                                  dataKey="time" 
                                  stroke="hsl(var(--muted-foreground))" 
                                  fontSize={12} 
                                  tickLine={false} 
                                  axisLine={false}
                                  minTickGap={30}
                                />
                                <YAxis 
                                  stroke="hsl(var(--muted-foreground))" 
                                  fontSize={12} 
                                  tickLine={false} 
                                  axisLine={false}
                                />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                                  itemStyle={{ color: "hsl(var(--foreground))" }}
                                />
                                <Area 
                                  type="monotone" 
                                  dataKey="value" 
                                  stroke="#8b5cf6" 
                                  fillOpacity={1} 
                                  fill="url(#colorHrv)" 
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="activity" className="space-y-6 mt-6">
                {vitalsLoading ? (
                  <>
                    <Skeleton className="h-[300px] w-full" />
                    <Skeleton className="h-[300px] w-full" />
                  </>
                ) : stepsData.length === 0 && sleepData.length === 0 ? (
                  <Card className="border-none shadow-sm">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No activity or sleep data available</p>
                      <p className="text-sm mt-1">Data will appear once the patient syncs their device.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Steps Chart */}
                    {stepsData.length > 0 && (
                      <Card className="border-none shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Footprints className="h-4 w-4 text-blue-500" />
                            Daily Steps (Avg {Math.round(stepsData.reduce((sum, d) => sum + d.value, 0) / stepsData.length).toLocaleString()} steps)
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={stepsData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis 
                                  dataKey="time" 
                                  stroke="hsl(var(--muted-foreground))" 
                                  fontSize={12} 
                                  tickLine={false} 
                                  axisLine={false}
                                  minTickGap={20}
                                />
                                <YAxis 
                                  stroke="hsl(var(--muted-foreground))" 
                                  fontSize={12} 
                                  tickLine={false} 
                                  axisLine={false}
                                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                                />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                                  itemStyle={{ color: "hsl(var(--foreground))" }}
                                  formatter={(v: number) => [v.toLocaleString(), "Steps"]}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Sleep Chart */}
                    {sleepData.length > 0 && (
                      <Card className="border-none shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Moon className="h-4 w-4 text-indigo-400" />
                            Sleep Duration (Avg {(sleepData.reduce((sum, d) => sum + d.value, 0) / sleepData.length).toFixed(1)} hrs)
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={sleepData}>
                                <defs>
                                  <linearGradient id="colorSleep" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis 
                                  dataKey="time" 
                                  stroke="hsl(var(--muted-foreground))" 
                                  fontSize={12} 
                                  tickLine={false} 
                                  axisLine={false}
                                  minTickGap={20}
                                />
                                <YAxis 
                                  stroke="hsl(var(--muted-foreground))" 
                                  fontSize={12} 
                                  tickLine={false} 
                                  axisLine={false}
                                  tickFormatter={(v) => `${v}h`}
                                />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                                  itemStyle={{ color: "hsl(var(--foreground))" }}
                                  formatter={(v: number) => [`${v.toFixed(1)} hrs`, "Sleep"]}
                                />
                                <Area 
                                  type="monotone" 
                                  dataKey="value" 
                                  stroke="#6366f1" 
                                  fillOpacity={1} 
                                  fill="url(#colorSleep)" 
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="medications" className="space-y-4 mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">Current Medications</h3>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => setShowAddMed(!showAddMed)}
                    data-testid="button-add-medication"
                  >
                    <Plus className="h-4 w-4" />
                    Add Medication
                  </Button>
                </div>

                {showAddMed && (
                  <Card className="border-none shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">Add Medication</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="med-name">Name *</Label>
                          <Input
                            id="med-name"
                            data-testid="input-medication-name"
                            placeholder="e.g. Metformin"
                            value={medForm.name}
                            onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="med-dosage">Dosage</Label>
                          <Input
                            id="med-dosage"
                            data-testid="input-medication-dosage"
                            placeholder="e.g. 500mg"
                            value={medForm.dosage}
                            onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="med-frequency">Frequency</Label>
                          <Input
                            id="med-frequency"
                            data-testid="input-medication-frequency"
                            placeholder="e.g. Twice daily"
                            value={medForm.frequency}
                            onChange={(e) => setMedForm({ ...medForm, frequency: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="med-prescribed">Prescribed By</Label>
                          <Input
                            id="med-prescribed"
                            data-testid="input-medication-prescribed-by"
                            placeholder="e.g. Dr. Smith"
                            value={medForm.prescribedBy}
                            onChange={(e) => setMedForm({ ...medForm, prescribedBy: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="med-start">Start Date</Label>
                          <Input
                            id="med-start"
                            type="date"
                            data-testid="input-medication-start-date"
                            value={medForm.startDate}
                            onChange={(e) => setMedForm({ ...medForm, startDate: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => setShowAddMed(false)} data-testid="button-cancel-medication">
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={!medForm.name.trim() || addMedicationMutation.isPending}
                          data-testid="button-save-medication"
                          onClick={() => addMedicationMutation.mutate({
                            name: medForm.name,
                            dosage: medForm.dosage || undefined,
                            frequency: medForm.frequency || undefined,
                            prescribedBy: medForm.prescribedBy || undefined,
                            startDate: medForm.startDate || undefined,
                          })}
                        >
                          {addMedicationMutation.isPending ? "Saving..." : "Save Medication"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {medicationsLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : medications.length === 0 ? (
                  <Card className="border-none shadow-sm">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Pill className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No medications recorded</p>
                      <p className="text-sm mt-1">Use the button above to add a medication to this patient's record.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {medications.map((med) => (
                      <Card key={med.id} className="border-none shadow-sm" data-testid={`card-medication-${med.id}`}>
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Pill className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-foreground" data-testid={`text-medication-name-${med.id}`}>{med.name}</p>
                                  {med.isActive && (
                                    <Badge variant="secondary" className="text-xs font-normal text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400">
                                      Active
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                                  {med.dosage && <span data-testid={`text-medication-dosage-${med.id}`}>{med.dosage}</span>}
                                  {med.frequency && <span>· {med.frequency}</span>}
                                  {med.prescribedBy && <span>· by {med.prescribedBy}</span>}
                                  {med.startDate && <span>· started {format(new Date(med.startDate), "MMM d, yyyy")}</span>}
                                </div>
                              </div>
                            </div>
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-1" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column: Stats & Info */}
          <div className="space-y-6">
            <Card className="border-none shadow-md bg-sidebar text-sidebar-foreground">
              <CardHeader>
                <CardTitle className="text-lg">AI Risk Analysis</CardTitle>
                <CardDescription className="text-sidebar-foreground/70">Based on current vitals and risk trends</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Risk Score</span>
                  <span className="text-2xl font-bold text-primary" data-testid="text-risk-score">{patient.riskScore}/100</span>
                </div>
                <div className="w-full bg-sidebar-accent rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-1000" 
                    style={{ width: `${patient.riskScore}%` }}
                  />
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex gap-3 items-start bg-sidebar-accent/50 p-3 rounded-lg">
                    {patient.riskLevel === "high" ? (
                      <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                    ) : patient.riskLevel === "medium" ? (
                      <TrendingDown className="h-5 w-5 text-warning flex-shrink-0" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-green-400 flex-shrink-0" />
                    )}
                    <div className="text-sm">
                      <p className={`font-medium ${riskInsight.colorClass}`} data-testid="text-risk-insight-title">{riskInsight.title}</p>
                      <p className="text-sidebar-foreground/80 mt-1" data-testid="text-risk-insight-description">{riskInsight.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start bg-sidebar-accent/50 p-3 rounded-lg">
                    <Activity className="h-5 w-5 text-blue-400 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-400">Continuous Monitoring</p>
                      <p className="text-sidebar-foreground/80 mt-1">Data synced from HealthKit/Health Connect in real-time.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Patient Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gender</span>
                  <span className="font-medium">{patient.gender}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Conditions</span>
                  <span className="font-medium">{patient.conditions.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

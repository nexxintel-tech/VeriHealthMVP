import { useParams } from "wouter";
import Layout from "@/components/layout/Layout";
import { MOCK_PATIENTS, generateVitals } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { 
  LineChart, 
  Line, 
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
  FileText,
  Phone,
  MessageSquare,
  HeartPulse
} from "lucide-react";
import { format } from "date-fns";

export default function PatientDetail() {
  const { id } = useParams();
  const patient = MOCK_PATIENTS.find(p => p.id === id) || MOCK_PATIENTS[0];
  const vitals = generateVitals(patient.id);

  // Process data for charts
  const hrData = vitals.filter(v => v.type === "Heart Rate").map(v => ({
    time: format(new Date(v.timestamp), "MMM dd HH:mm"),
    value: v.value
  })).reverse();

  const hrvData = vitals.filter(v => v.type === "HRV").map(v => ({
    time: format(new Date(v.timestamp), "MMM dd HH:mm"),
    value: v.value
  })).reverse();

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
                  DOB: 1952 (72 yrs)
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Last Sync: 15 mins ago
                </div>
                <div className="flex items-center gap-1">
                  <Activity className="h-4 w-4" />
                  ID: #{patient.id.toUpperCase()}
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
            <Button variant="outline" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Message
            </Button>
            <Button className="gap-2 bg-primary hover:bg-primary/90">
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
                >
                  Vital Trends
                </TabsTrigger>
                <TabsTrigger 
                  value="activity"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2"
                >
                  Activity & Sleep
                </TabsTrigger>
                <TabsTrigger 
                  value="medications"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2"
                >
                  Medications
                </TabsTrigger>
              </TabsList>

              <TabsContent value="vitals" className="space-y-6 mt-6">
                {/* Heart Rate Chart */}
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <HeartPulse className="h-4 w-4 text-primary" />
                      Heart Rate (Avg 72 bpm)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={hrData}>
                          <defs>
                            <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
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
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-500" />
                      HRV Variability (42ms)
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
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column: Stats & Info */}
          <div className="space-y-6">
            <Card className="border-none shadow-md bg-sidebar text-sidebar-foreground">
              <CardHeader>
                <CardTitle className="text-lg">AI Risk Analysis</CardTitle>
                <CardDescription className="text-sidebar-foreground/70">Generated via Supabase Edge Functions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Risk Score</span>
                  <span className="text-2xl font-bold text-primary">{patient.riskScore}/100</span>
                </div>
                <div className="w-full bg-sidebar-accent rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-1000" 
                    style={{ width: `${patient.riskScore}%` }}
                  />
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex gap-3 items-start bg-sidebar-accent/50 p-3 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-warning">Irregular Rhythm Detected</p>
                      <p className="text-sidebar-foreground/80 mt-1">HRV spikes observed during sleep hours (2am-4am). Potential early sign of Arrhythmia.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start bg-sidebar-accent/50 p-3 rounded-lg">
                    <Activity className="h-5 w-5 text-blue-400 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-400">Trend Improving</p>
                      <p className="text-sidebar-foreground/80 mt-1">Blood pressure stability has improved by 15% over the last 7 days.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Recent Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3 items-start pb-4 border-b last:border-0 last:pb-0 border-border">
                      <div className="h-2 w-2 rounded-full bg-destructive mt-2" />
                      <div>
                        <p className="text-sm font-medium">SpO2 Warning</p>
                        <p className="text-xs text-muted-foreground">Yesterday, 10:42 PM</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

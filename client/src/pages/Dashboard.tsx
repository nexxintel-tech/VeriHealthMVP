import { 
  Users, 
  Activity, 
  AlertTriangle, 
  HeartPulse, 
  ArrowUpRight 
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_PATIENTS, MOCK_ALERTS } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Dashboard() {
  const highRiskCount = MOCK_PATIENTS.filter(p => p.riskLevel === "high").length;
  const activeAlerts = MOCK_ALERTS.filter(a => !a.isRead).length;

  return (
    <Layout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Dashboard Overview</h1>
          <p className="text-muted-foreground">Here's what's happening with your patients today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Total Patients" 
            value={MOCK_PATIENTS.length} 
            icon={Users} 
            trend="+12% from last month" 
            trendDirection="up"
          />
          <StatCard 
            title="High Risk Patients" 
            value={highRiskCount} 
            icon={Activity} 
            trend="+2 new this week" 
            trendDirection="down"
            className="border-l-4 border-l-risk-high"
          />
          <StatCard 
            title="Active Alerts" 
            value={activeAlerts} 
            icon={AlertTriangle} 
            trend="Requires attention" 
            trendDirection="down"
            className="border-l-4 border-l-warning"
          />
          <StatCard 
            title="Avg. Risk Score" 
            value="42" 
            icon={HeartPulse} 
            trend="Stable" 
            trendDirection="neutral"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          {/* High Risk Patients List */}
          <Card className="col-span-4 border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>High Priority Attention Needed</CardTitle>
              <Button variant="ghost" size="sm" className="text-primary" asChild>
                <Link href="/patients">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {MOCK_PATIENTS.filter(p => p.riskLevel === "high" || p.riskLevel === "medium").slice(0, 5).map((patient) => (
                  <div key={patient.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group cursor-pointer border border-transparent hover:border-border">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {patient.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium group-hover:text-primary transition-colors">{patient.name}</p>
                        <p className="text-sm text-muted-foreground">{patient.conditions[0]}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">Score: {patient.riskScore}</p>
                        <p className="text-xs text-muted-foreground">Last sync: 2h ago</p>
                      </div>
                      <RiskBadge level={patient.riskLevel} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Alerts */}
          <Card className="col-span-3 border-none shadow-md">
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {MOCK_ALERTS.slice(0, 4).map((alert) => (
                  <div key={alert.id} className="flex gap-3 items-start pb-4 border-b last:border-0 last:pb-0 border-border">
                    <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${alert.severity === 'high' ? 'bg-destructive' : 'bg-warning'}`} />
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{alert.type}</p>
                      <p className="text-xs text-muted-foreground">{alert.patientName} • 2h ago</p>
                      <p className="text-sm text-foreground/80">{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

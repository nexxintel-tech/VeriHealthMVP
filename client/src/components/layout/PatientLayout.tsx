import React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  HeartPulse,
  Bell,
  FileText,
  Users,
  UserCircle,
  Activity,
  LogOut,
  Menu,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { logout, getUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { fetchDependents, DependentInfo } from "@/lib/api";

interface PatientLayoutProps {
  children: React.ReactNode;
  selectedDependentId?: string | null;
  onDependentSelect?: (patientId: string | null) => void;
}

const navItems = [
  { href: "/patient", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/patient/vitals", icon: HeartPulse, label: "Vitals History" },
  { href: "/patient/alerts", icon: Bell, label: "Alerts" },
  { href: "/patient/files", icon: FileText, label: "Files" },
  { href: "/patient/dependents", icon: Users, label: "Dependents" },
  { href: "/patient/profile", icon: UserCircle, label: "Profile" },
];

export default function PatientLayout({
  children,
  selectedDependentId,
  onDependentSelect,
}: PatientLayoutProps) {
  const [location, setLocation] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const { toast } = useToast();
  const user = getUser();

  const { data: dependents = [] } = useQuery<DependentInfo[]>({
    queryKey: ["dependents"],
    queryFn: fetchDependents,
  });

  const approvedDependents = dependents.filter((d) => d.status === "approved");

  const selectedDependent = approvedDependents.find(
    (d) => d.dependentPatientId === selectedDependentId
  );

  const handleSignOut = async () => {
    await logout();
    toast({
      title: "Signed out",
      description: "You have been successfully logged out",
    });
    setLocation("/login");
  };

  const DependentSwitcher = () => {
    if (approvedDependents.length === 0) {
      return (
        <div className="px-4 py-2 mb-2">
          <div className="bg-sidebar-accent/50 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/70">
            Viewing: <span className="font-semibold text-sidebar-foreground">My Health</span>
          </div>
        </div>
      );
    }

    return (
      <div className="px-4 py-2 mb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between text-xs bg-sidebar-accent/50 border-sidebar-border hover:bg-sidebar-accent"
              data-testid="select-dependent-switcher"
            >
              <span className="truncate">
                Viewing:{" "}
                <span className="font-semibold">
                  {selectedDependent?.patient?.name || "My Health"}
                </span>
              </span>
              <ChevronDown className="ml-2 h-3 w-3 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuLabel className="text-xs">Switch View</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDependentSelect?.(null)}
              className={cn(!selectedDependentId && "bg-accent")}
              data-testid="select-dependent-self"
            >
              My Health
            </DropdownMenuItem>
            {approvedDependents.map((dep) => (
              <DropdownMenuItem
                key={dep.id}
                onClick={() => onDependentSelect?.(dep.dependentPatientId)}
                className={cn(
                  selectedDependentId === dep.dependentPatientId && "bg-accent"
                )}
                data-testid={`select-dependent-${dep.dependentPatientId}`}
              >
                {dep.patient?.name || "Dependent"}
                {dep.relationship && (
                  <span className="ml-1 text-muted-foreground">({dep.relationship})</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="p-6 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
          <Activity className="h-5 w-5" />
        </div>
        <span className="font-heading font-bold text-xl tracking-tight">VeriHealth</span>
      </div>

      <DependentSwitcher />

      <div className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                location === item.href ||
                  (item.href !== "/patient" && location.startsWith(item.href))
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </div>
          </Link>
        ))}
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="bg-sidebar-accent/50 rounded-lg p-4 mb-4">
          <h4 className="text-xs font-semibold text-sidebar-foreground/80 uppercase tracking-wider mb-2">
            System Status
          </h4>
          <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span>System Operational</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60 mt-1">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span>Sync Active</span>
          </div>
        </div>

        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
          onClick={handleSignOut}
          data-testid="button-sign-out"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex w-full">
      <aside className="hidden md:block w-64 flex-shrink-0 fixed inset-y-0 left-0 z-50">
        <SidebarContent />
      </aside>

      <main className="flex-1 md:ml-64 min-w-0 flex flex-col">
        <header className="h-16 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4 md:hidden">
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 border-r-0">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <span className="font-heading font-bold text-lg">VeriHealth</span>
          </div>

          <div className="hidden md:block" />

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground"
              data-testid="button-notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-destructive rounded-full border-2 border-card" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full"
                  data-testid="button-avatar-menu"
                >
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage src="https://github.com/shadcn.png" alt="@patient" />
                    <AvatarFallback>
                      {user?.email?.slice(0, 2).toUpperCase() || "PT"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.email || "User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground capitalize">
                      {user?.role || "Role"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/patient/profile" data-testid="link-profile-menu">
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleSignOut}
                  data-testid="button-logout-menu"
                >
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}

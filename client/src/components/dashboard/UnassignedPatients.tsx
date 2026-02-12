import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Users, Clock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { fetchUnassignedPatients, claimPatient } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

export function UnassignedPatients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: patients = [], isLoading, error } = useQuery({
    queryKey: ["unassigned-patients"],
    queryFn: fetchUnassignedPatients,
    refetchInterval: 30000,
  });

  const claimMutation = useMutation({
    mutationFn: claimPatient,
    onSuccess: (data) => {
      toast({
        title: "Patient claimed",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["unassigned-patients"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to claim patient",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (error) {
    return null;
  }

  return (
    <Card className="border-none shadow-md" data-testid="card-unassigned-patients">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle>Patients Awaiting Clinician</CardTitle>
        </div>
        {patients.length > 0 && (
          <span className="text-sm font-medium bg-primary/10 text-primary px-2.5 py-0.5 rounded-full" data-testid="text-unassigned-count">
            {patients.length} waiting
          </span>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No patients waiting for assignment</p>
            <p className="text-sm mt-1">New patients will appear here when they join.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {patients.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/50"
                data-testid={`row-unassigned-patient-${patient.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {patient.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{patient.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{patient.age}y, {patient.gender}</span>
                      <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/50" />
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(patient.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => claimMutation.mutate(patient.id)}
                  disabled={claimMutation.isPending}
                  data-testid={`button-claim-patient-${patient.id}`}
                >
                  {claimMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-1" />
                  )}
                  Claim
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

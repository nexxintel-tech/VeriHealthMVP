import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import PatientLayout from "@/components/layout/PatientLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Eye,
  Mail,
  Shield,
  Clock,
} from "lucide-react";
import {
  fetchDependents,
  requestDependentAccess,
  fetchSponsorRequests,
  respondToSponsorRequest,
  DependentInfo,
  SponsorRequest,
} from "@/lib/api";

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <Badge
      variant="outline"
      className={variants[status] || ""}
      data-testid={`badge-status-${status}`}
    >
      {status === "pending" && <Clock className="h-3 w-3 mr-1" />}
      {status === "approved" && <UserCheck className="h-3 w-3 mr-1" />}
      {status === "rejected" && <UserX className="h-3 w-3 mr-1" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function PatientDependents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");

  const {
    data: dependents = [],
    isLoading: dependentsLoading,
  } = useQuery<DependentInfo[]>({
    queryKey: ["dependents"],
    queryFn: fetchDependents,
  });

  const {
    data: sponsorRequests = [],
    isLoading: requestsLoading,
  } = useQuery<SponsorRequest[]>({
    queryKey: ["sponsor-requests"],
    queryFn: fetchSponsorRequests,
  });

  const requestMutation = useMutation({
    mutationFn: () => requestDependentAccess(email, relationship),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dependents"] });
      toast({
        title: "Request sent",
        description: "Access request has been sent to the dependent.",
      });
      setEmail("");
      setRelationship("");
    },
    onError: (error: Error) => {
      toast({
        title: "Request failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      respondToSponsorRequest(id, action),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sponsor-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dependents"] });
      toast({
        title: variables.action === "approve" ? "Request approved" : "Request rejected",
        description:
          variables.action === "approve"
            ? "The sponsor can now view your health data."
            : "The sponsor request has been rejected.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Action failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pendingRequests = sponsorRequests.filter((r) => r.status === "pending");

  return (
    <PatientLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" data-testid="text-page-title">
            <Users className="h-8 w-8 text-primary" />
            Dependents
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-page-description">
            Manage your dependents and respond to access requests
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Your Dependents
                </CardTitle>
                <CardDescription>
                  People whose health data you can view
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dependentsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" data-testid={`skeleton-dependent-${i}`} />
                    ))}
                  </div>
                ) : dependents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-dependents">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>You haven't linked any dependents yet</p>
                    <p className="text-sm mt-1">Use the form to request access to a dependent's health data</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dependents.map((dep) => (
                      <div
                        key={dep.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card"
                        data-testid={`card-dependent-${dep.id}`}
                      >
                        <div className="space-y-1">
                          <p className="font-medium" data-testid={`text-dependent-name-${dep.id}`}>
                            {dep.patient?.name || "Unknown"}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {dep.patient && (
                              <>
                                <span data-testid={`text-dependent-age-${dep.id}`}>
                                  {dep.patient.age} yrs
                                </span>
                                <span>·</span>
                                <span data-testid={`text-dependent-gender-${dep.id}`}>
                                  {dep.patient.gender}
                                </span>
                              </>
                            )}
                            {dep.relationship && (
                              <>
                                <span>·</span>
                                <span data-testid={`text-dependent-relationship-${dep.id}`}>
                                  {dep.relationship}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={dep.status} />
                          {dep.status === "approved" && (
                            <Link href={`/patient?dependent=${dep.dependentPatientId}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`button-view-dashboard-${dep.id}`}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View Dashboard
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Request Access
                </CardTitle>
                <CardDescription>
                  Request access to view a dependent's health data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (email && relationship) {
                      requestMutation.mutate();
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="dependent-email">
                      <Mail className="h-4 w-4 inline mr-1" />
                      Dependent's Email
                    </Label>
                    <Input
                      id="dependent-email"
                      type="email"
                      placeholder="Enter dependent's email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      data-testid="input-dependent-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="relationship">
                      <Users className="h-4 w-4 inline mr-1" />
                      Relationship
                    </Label>
                    <Input
                      id="relationship"
                      type="text"
                      placeholder="e.g., Parent, Spouse, Guardian, Child"
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      required
                      data-testid="input-relationship"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={requestMutation.isPending || !email || !relationship}
                    data-testid="button-request-access"
                  >
                    {requestMutation.isPending ? (
                      "Sending Request..."
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Request Access
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Pending Access Requests
                </CardTitle>
                <CardDescription>
                  Others requesting to view your health data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {requestsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" data-testid={`skeleton-request-${i}`} />
                    ))}
                  </div>
                ) : pendingRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-requests">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No pending access requests</p>
                    <p className="text-sm mt-1">When someone requests access to your data, it will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-lg border bg-card space-y-3"
                        data-testid={`card-sponsor-request-${req.id}`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium" data-testid={`text-sponsor-email-${req.id}`}>
                              {req.sponsor?.email || "Unknown"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {req.relationship && (
                              <span data-testid={`text-sponsor-relationship-${req.id}`}>
                                {req.relationship}
                              </span>
                            )}
                            <span className="flex items-center gap-1" data-testid={`text-sponsor-date-${req.id}`}>
                              <Clock className="h-3 w-3" />
                              {new Date(req.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              respondMutation.mutate({ id: req.id, action: "approve" })
                            }
                            disabled={respondMutation.isPending}
                            data-testid={`button-approve-${req.id}`}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              respondMutation.mutate({ id: req.id, action: "reject" })
                            }
                            disabled={respondMutation.isPending}
                            data-testid={`button-reject-${req.id}`}
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PatientLayout>
  );
}
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PatientLayout from "@/components/layout/PatientLayout";
import {
  fetchPatientProfile,
  updatePatientProfile,
  fetchSponsorRequests,
  respondToSponsorRequest,
  PatientProfile as PatientProfileType,
  SponsorRequest,
} from "@/lib/api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Building2,
  Mail,
  Phone,
  Edit,
  Save,
  X,
  UserCheck,
  UserX,
  Shield,
} from "lucide-react";

export default function PatientProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", age: 0, gender: "" });

  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery<PatientProfileType>({
    queryKey: ["patient-profile"],
    queryFn: fetchPatientProfile,
  });

  const {
    data: sponsorRequests = [],
    isLoading: requestsLoading,
  } = useQuery<SponsorRequest[]>({
    queryKey: ["sponsor-requests"],
    queryFn: fetchSponsorRequests,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; age?: number; gender?: string }) =>
      updatePatientProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-profile"] });
      setIsEditing(false);
      toast({ title: "Profile updated", description: "Your profile has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      respondToSponsorRequest(id, action),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sponsor-requests"] });
      toast({
        title: variables.action === "approve" ? "Request approved" : "Request rejected",
        description: `Sponsor request has been ${variables.action === "approve" ? "approved" : "rejected"}.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
    },
  });

  const startEditing = () => {
    if (profile?.patient) {
      setEditForm({
        name: profile.patient.name,
        age: profile.patient.age,
        gender: profile.patient.gender,
      });
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    updateMutation.mutate({
      name: editForm.name,
      age: editForm.age,
      gender: editForm.gender,
    });
  };

  const pendingRequests = sponsorRequests.filter((r) => r.status === "pending");

  if (profileLoading) {
    return (
      <PatientLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" data-testid="skeleton-title" />
          <Skeleton className="h-64 w-full" data-testid="skeleton-profile" />
          <Skeleton className="h-48 w-full" data-testid="skeleton-clinician" />
        </div>
      </PatientLayout>
    );
  }

  if (profileError) {
    return (
      <PatientLayout>
        <Card data-testid="card-error">
          <CardContent className="p-6">
            <p className="text-destructive" data-testid="text-error">
              Failed to load profile: {(profileError as Error).message}
            </p>
          </CardContent>
        </Card>
      </PatientLayout>
    );
  }

  const patient = profile?.patient;
  const clinician = profile?.clinician;
  const institution = profile?.institution;

  return (
    <PatientLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
              My Profile
            </h1>
            <p className="text-muted-foreground" data-testid="text-page-description">
              View and manage your profile information
            </p>
          </div>
        </div>

        <Card data-testid="card-profile">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>Your basic profile details</CardDescription>
            </div>
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={startEditing}
                data-testid="button-edit-profile"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  data-testid="button-save-profile"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelEditing}
                  data-testid="button-cancel-edit"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="grid gap-4 sm:grid-cols-2" data-testid="form-edit-profile">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={editForm.age}
                    onChange={(e) => setEditForm({ ...editForm, age: parseInt(e.target.value) || 0 })}
                    data-testid="input-age"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={editForm.gender}
                    onValueChange={(value) => setEditForm({ ...editForm, gender: value })}
                  >
                    <SelectTrigger data-testid="select-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="view-profile">
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium" data-testid="text-patient-name">{patient?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Age</p>
                  <p className="font-medium" data-testid="text-patient-age">{patient?.age}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <p className="font-medium" data-testid="text-patient-gender">{patient?.gender}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    variant={patient?.status === "Active" ? "default" : "secondary"}
                    data-testid="badge-patient-status"
                  >
                    {patient?.status}
                  </Badge>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">Conditions</p>
                  <div className="flex flex-wrap gap-2 mt-1" data-testid="list-conditions">
                    {patient?.conditions && patient.conditions.length > 0 ? (
                      patient.conditions.map((condition, idx) => (
                        <Badge key={idx} variant="outline" data-testid={`badge-condition-${idx}`}>
                          {condition}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No conditions listed</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {clinician && (
          <Card data-testid="card-clinician">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Assigned Clinician
              </CardTitle>
              <CardDescription>Your healthcare provider information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2" data-testid="view-clinician">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium" data-testid="text-clinician-name">{clinician.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Specialty</p>
                  <p className="font-medium" data-testid="text-clinician-specialty">{clinician.specialty}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium" data-testid="text-clinician-email">{clinician.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium" data-testid="text-clinician-phone">
                      {clinician.phone || "Not available"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {institution && (
          <Card data-testid="card-institution">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Institution
              </CardTitle>
              <CardDescription>Your healthcare institution details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2" data-testid="view-institution">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium" data-testid="text-institution-name">{institution.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium" data-testid="text-institution-address">
                    {institution.address || "Not available"}
                  </p>
                </div>
                {institution.contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Contact Email</p>
                      <p className="font-medium" data-testid="text-institution-email">
                        {institution.contactEmail}
                      </p>
                    </div>
                  </div>
                )}
                {institution.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Contact Phone</p>
                      <p className="font-medium" data-testid="text-institution-phone">
                        {institution.contactPhone}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card data-testid="card-sponsor-requests">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Sponsor Requests
            </CardTitle>
            <CardDescription>
              Manage access requests from sponsors who want to view your health data
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" data-testid="skeleton-requests" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-requests">
                No pending sponsor requests
              </p>
            ) : (
              <div className="space-y-3" data-testid="list-sponsor-requests">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`card-sponsor-request-${request.id}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium" data-testid={`text-sponsor-email-${request.id}`}>
                        {request.sponsor?.email || "Unknown"}
                      </p>
                      {request.relationship && (
                        <p className="text-sm text-muted-foreground" data-testid={`text-sponsor-relationship-${request.id}`}>
                          Relationship: {request.relationship}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => respondMutation.mutate({ id: request.id, action: "approve" })}
                        disabled={respondMutation.isPending}
                        data-testid={`button-approve-${request.id}`}
                      >
                        <UserCheck className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => respondMutation.mutate({ id: request.id, action: "reject" })}
                        disabled={respondMutation.isPending}
                        data-testid={`button-reject-${request.id}`}
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
    </PatientLayout>
  );
}
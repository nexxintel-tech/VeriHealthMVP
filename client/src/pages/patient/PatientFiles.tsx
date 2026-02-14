import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Plus,
  File,
  Image,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import PatientLayout from "@/components/layout/PatientLayout";
import { getUser } from "@/lib/auth";
import {
  fetchPatientFiles,
  uploadPatientFile,
  downloadPatientFile,
  deletePatientFile,
  fetchPatientDashboard,
  FileAttachmentMeta,
} from "@/lib/api";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const categoryColors: Record<string, string> = {
  lab_result: "bg-blue-100 text-blue-800 border-blue-200",
  prescription: "bg-green-100 text-green-800 border-green-200",
  referral: "bg-purple-100 text-purple-800 border-purple-200",
  imaging: "bg-amber-100 text-amber-800 border-amber-200",
  general: "bg-gray-100 text-gray-800 border-gray-200",
};

const categoryLabels: Record<string, string> = {
  lab_result: "Lab Result",
  prescription: "Prescription",
  referral: "Referral",
  imaging: "Imaging",
  general: "General",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return Image;
  if (fileType.includes("spreadsheet") || fileType.includes("excel")) return FileSpreadsheet;
  if (fileType.includes("pdf") || fileType.includes("document") || fileType.includes("word")) return FileText;
  return File;
}

export default function PatientFiles() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = getUser();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: dashboardData } = useQuery({
    queryKey: ["patient-dashboard"],
    queryFn: fetchPatientDashboard,
  });

  const { data: files = [], isLoading } = useQuery<FileAttachmentMeta[]>({
    queryKey: ["patient-files"],
    queryFn: () => fetchPatientFiles(),
  });

  const uploadMutation = useMutation({
    mutationFn: uploadPatientFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-files"] });
      toast({ title: "File uploaded", description: "Your file has been uploaded successfully." });
      resetUploadForm();
      setUploadOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePatientFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-files"] });
      toast({ title: "File deleted", description: "The file has been removed." });
      setDeleteConfirmId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  function resetUploadForm() {
    setSelectedFile(null);
    setCategory("");
    setDescription("");
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Maximum file size is 10MB.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
  }

  function handleUpload() {
    if (!selectedFile || !category) return;
    const patientId = dashboardData?.patient?.id;
    if (!patientId) {
      toast({ title: "Error", description: "Patient profile not found.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        patientId,
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
        category,
        description: description || undefined,
        fileData: base64,
      });
    };
    reader.readAsDataURL(selectedFile);
  }

  async function handleDownload(fileId: string) {
    try {
      const { fileData, fileName, fileType } = await downloadPatientFile(fileId);
      const byteCharacters = atob(fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: fileType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", description: "Could not download the file.", variant: "destructive" });
    }
  }

  return (
    <PatientLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">My Files</h1>
            <p className="text-muted-foreground" data-testid="text-page-description">
              Upload and manage your medical documents
            </p>
          </div>
          <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) resetUploadForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-file">
                <Plus className="mr-2 h-4 w-4" />
                Upload File
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="file-input">File</Label>
                  <Input
                    id="file-input"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={handleFileSelect}
                    data-testid="input-file"
                  />
                  <p className="text-xs text-muted-foreground">Max 10MB. PDF, JPG, PNG, DOC, DOCX</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category-select">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lab_result" data-testid="select-item-lab-result">Lab Result</SelectItem>
                      <SelectItem value="prescription" data-testid="select-item-prescription">Prescription</SelectItem>
                      <SelectItem value="referral" data-testid="select-item-referral">Referral</SelectItem>
                      <SelectItem value="imaging" data-testid="select-item-imaging">Imaging</SelectItem>
                      <SelectItem value="general" data-testid="select-item-general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description-input">Description (optional)</Label>
                  <Textarea
                    id="description-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a description..."
                    data-testid="input-description"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleUpload}
                  disabled={!selectedFile || !category || uploadMutation.isPending}
                  data-testid="button-submit-upload"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Upload className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : files.length === 0 ? (
          <Card className="py-16" data-testid="card-empty-state">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold" data-testid="text-empty-title">No files uploaded yet</h3>
              <p className="text-muted-foreground mt-1 mb-4" data-testid="text-empty-description">
                Upload your medical documents to keep them organized and accessible.
              </p>
              <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-empty">
                <Plus className="mr-2 h-4 w-4" />
                Upload Your First File
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {files.map((file) => {
              const IconComponent = getFileIcon(file.fileType);
              const isOwner = user?.id === file.uploadedByUserId;
              return (
                <Card key={file.id} data-testid={`card-file-${file.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <IconComponent className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-medium truncate" data-testid={`text-filename-${file.id}`}>
                            {file.fileName}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-filesize-${file.id}`}>
                            {formatFileSize(file.fileSize)} · {file.fileType.split("/").pop()?.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs flex-shrink-0 ${categoryColors[file.category] || categoryColors.general}`}
                        data-testid={`badge-category-${file.id}`}
                      >
                        {categoryLabels[file.category] || file.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {file.description && (
                      <p className="text-sm text-muted-foreground mb-3" data-testid={`text-description-${file.id}`}>
                        {file.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mb-3" data-testid={`text-date-${file.id}`}>
                      Uploaded {format(new Date(file.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(file.id)}
                        data-testid={`button-download-${file.id}`}
                      >
                        <Download className="mr-1 h-3 w-3" />
                        Download
                      </Button>
                      {isOwner && (
                        <>
                          {deleteConfirmId === file.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteMutation.mutate(file.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-confirm-delete-${file.id}`}
                              >
                                Confirm
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteConfirmId(null)}
                                data-testid={`button-cancel-delete-${file.id}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteConfirmId(file.id)}
                              data-testid={`button-delete-${file.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </>
                      )}
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

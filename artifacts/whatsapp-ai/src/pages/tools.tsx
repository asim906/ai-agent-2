import { useState, useRef } from "react";
import { 
  useListCsvFiles,
  useUploadCsvFile,
  useDeleteCsvFile,
  getListCsvFilesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, UploadCloud, Trash2, Database } from "lucide-react";
import { format } from "date-fns";

export default function Tools() {
  const { data: files } = useListCsvFiles();
  const uploadFile = useUploadCsvFile();
  const deleteFile = useDeleteCsvFile();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = (event.target?.result as string).split(',')[1];
        
        uploadFile.mutate({ 
          data: {
            filename: file.name,
            data: base64Data,
            description: description || undefined
          }
        }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCsvFilesQueryKey() });
            toast({ title: "Dataset ingested successfully." });
            setDescription("");
            if (fileInputRef.current) fileInputRef.current.value = "";
          },
          onError: () => {
            toast({ title: "Failed to ingest dataset.", variant: "destructive" });
          },
          onSettled: () => {
            setIsUploading(false);
          }
        });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
      toast({ title: "Failed to read file.", variant: "destructive" });
    }
  };

  const handleDelete = (id: string) => {
    deleteFile.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCsvFilesQueryKey() });
        toast({ title: "Dataset purged." });
      }
    });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Knowledge Datasets</h1>
        <p className="text-muted-foreground mt-1">Upload tabular data to enhance AI contextual awareness</p>
      </div>

      <div className="grid md:grid-cols-[300px_1fr] gap-8">
        <Card className="bg-card border-border h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Ingest New Data</CardTitle>
            <CardDescription>Supported format: CSV</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Dataset Description</label>
              <Input 
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Product catalog 2024"
                className="bg-background border-border"
              />
            </div>
            
            <div className="pt-2">
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
                data-testid="input-file-upload"
              />
              <Button 
                className="w-full" 
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-csv"
              >
                {isUploading ? (
                  "Processing..."
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4 mr-2" />
                    Select CSV File
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              File content will be vectorized and added to the semantic search index.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-foreground">Filename</TableHead>
                <TableHead className="text-foreground">Records</TableHead>
                <TableHead className="text-foreground">Description</TableHead>
                <TableHead className="text-foreground">Ingested On</TableHead>
                <TableHead className="text-right text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files?.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Database className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    No datasets available.
                  </TableCell>
                </TableRow>
              ) : (
                files?.map((file) => (
                  <TableRow key={file.id} className="border-border hover:bg-muted/50">
                    <TableCell className="font-medium flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-primary" />
                      {file.filename}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{file.rowCount}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{file.description || "-"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{format(new Date(file.uploadedAt), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(file.id)} 
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        data-testid={`button-delete-csv-${file.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

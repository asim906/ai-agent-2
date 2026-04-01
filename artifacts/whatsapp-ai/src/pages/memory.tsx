import { useState } from "react";
import { 
  useGetMemoryChats, 
  useListCustomMemory,
  useCreateCustomMemory,
  useUpdateCustomMemory,
  useDeleteCustomMemory,
  getListCustomMemoryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Database, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function Memory() {
  const { data: memorySummary } = useGetMemoryChats();
  const { data: customMemories } = useListCustomMemory();
  const createMemory = useCreateCustomMemory();
  const deleteMemory = useDeleteCustomMemory();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ question: "", answer: "", category: "" });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMemory.mutate({ data: formData }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomMemoryQueryKey() });
        setIsDialogOpen(false);
        setFormData({ question: "", answer: "", category: "" });
        toast({ title: "Memory record injected." });
      }
    });
  };

  const handleDelete = (id: string) => {
    deleteMemory.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomMemoryQueryKey() });
        toast({ title: "Memory record purged." });
      }
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Vector Memory</h1>
        <p className="text-muted-foreground mt-1">Manage semantic knowledge and conversation history</p>
      </div>

      <Tabs defaultValue="training" className="space-y-6">
        <TabsList className="bg-card border border-border w-full justify-start p-1 h-auto rounded-lg">
          <TabsTrigger value="training" className="py-2.5 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md">
            Custom Training
          </TabsTrigger>
          <TabsTrigger value="stats" className="py-2.5 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md">
            Storage Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="training" className="space-y-6 mt-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Q&A Knowledge Base</h2>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-memory">
                  <Plus className="w-4 h-4 mr-2" /> Inject Memory
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Inject Custom Knowledge</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Expected Query</label>
                    <Input 
                      required 
                      value={formData.question}
                      onChange={e => setFormData({...formData, question: e.target.value})}
                      className="bg-background border-border"
                      placeholder="e.g. What are your opening hours?"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Target Response</label>
                    <Textarea 
                      required 
                      value={formData.answer}
                      onChange={e => setFormData({...formData, answer: e.target.value})}
                      className="bg-background border-border min-h-[100px]"
                      placeholder="Provide the exact or semantic response..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category (Optional)</label>
                    <Input 
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="bg-background border-border"
                      placeholder="e.g. Support, Sales"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createMemory.isPending}>
                    {createMemory.isPending ? "Injecting..." : "Inject Record"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="bg-card border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-[30%] text-foreground">Query Vector</TableHead>
                  <TableHead className="w-[40%] text-foreground">Response Vector</TableHead>
                  <TableHead className="text-foreground">Category</TableHead>
                  <TableHead className="text-foreground">Created</TableHead>
                  <TableHead className="text-right text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customMemories?.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <Database className="w-8 h-8 mx-auto mb-3 opacity-20" />
                      No custom memory records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  customMemories?.map((mem) => (
                    <TableRow key={mem.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium">{mem.question}</TableCell>
                      <TableCell className="text-muted-foreground truncate max-w-xs">{mem.answer}</TableCell>
                      <TableCell>
                        {mem.category && <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">{mem.category}</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(new Date(mem.createdAt), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(mem.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive" data-testid={`button-delete-${mem.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="mt-0">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Conversations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{memorySummary?.totalConversations || 0}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Messages Indexed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{memorySummary?.totalMessages || 0}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Storage Used</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{memorySummary?.storageUsed || "0 B"}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

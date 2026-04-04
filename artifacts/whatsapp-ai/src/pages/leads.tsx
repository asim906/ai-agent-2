import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { 
  Users, 
  Mail, 
  Phone, 
  Search, 
  Settings2, 
  Plus, 
  Trash2, 
  GripVertical,
  Check
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { useState } from "react";
import { auth } from "@workspace/auth-firebase-web";
import { toast } from "sonner";

interface Column {
  id: string;
  label: string;
  key: string;
  type: string;
  visible: boolean;
}

interface LeadConfig {
  columns: Column[];
}

interface Lead {
  id: string;
  [key: string]: any;
}

export default function Leads() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: string, key: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  // 1. Fetch Config & Leads
  const { data: config, isLoading: configLoading } = useQuery<LeadConfig>({
    queryKey: ["leadsConfig"],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/leads/config", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json();
    }
  });

  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/leads", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    }
  });

  // 2. Mutations
  const updateConfigMutation = useMutation({
    mutationFn: async (newColumns: Column[]) => {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/leads/config", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ columns: newColumns })
      });
      if (!res.ok) throw new Error("Failed to update config");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadsConfig"] });
      toast.success("Columns updated");
    }
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json" 
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update lead");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setEditingCell(null);
    }
  });

  // 3. Handlers
  const filteredLeads = leads?.filter(lead => 
    Object.values(lead).some(val => 
      String(val).toLowerCase().includes(search.toLowerCase())
    )
  );

  const startEdit = (lead: Lead, key: string) => {
    setEditingCell({ id: lead.id, key });
    setEditValue(lead[key] || "");
  };

  const saveEdit = () => {
    if (!editingCell) return;
    updateLeadMutation.mutate({ 
      id: editingCell.id, 
      data: { [editingCell.key]: editValue } 
    });
  };

  const addColumn = () => {
    if (!config) return;
    const label = prompt("Enter column name:");
    if (!label) return;
    const key = label.toLowerCase().replace(/\s+/g, '_');
    const newCol: Column = { 
      id: `col_${Date.now()}`, 
      label, 
      key, 
      type: "text", 
      visible: true 
    };
    updateConfigMutation.mutate([...config.columns, newCol]);
  };

  const removeColumn = (id: string) => {
    if (!config) return;
    updateConfigMutation.mutate(config.columns.filter(c => c.id !== id));
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads CRM</h1>
          <p className="text-muted-foreground mt-1">Full control over your customer data and columns</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search everything..." 
              className="pl-9 bg-card border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Settings2 className="w-4 h-4" />
                Edit Columns
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Configure CRM Columns</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                {config?.columns.map((col) => (
                  <div key={col.id} className="flex items-center gap-3 bg-muted/30 p-2 rounded-lg border border-border group">
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                    <div className="flex-1">
                      <span className="text-sm font-medium">{col.label}</span>
                      <span className="text-[10px] text-muted-foreground block uppercase">{col.key}</span>
                    </div>
                    {col.id !== 'fullName' && col.id !== 'createdAt' && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeColumn(col.id)}
                        className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button onClick={addColumn} variant="outline" className="w-full gap-2 border-dashed">
                  <Plus className="w-4 h-4" />
                  Add New Column
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsConfigOpen(false)}>Done</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="bg-card border-border overflow-x-auto min-h-[400px]">
        <Table>
          <TableHeader className="bg-muted/50 whitespace-nowrap">
            <TableRow className="border-border hover:bg-transparent">
              {config?.columns.map((col) => (
                <TableHead key={col.id} className="text-foreground min-w-[150px] font-bold">
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(leadsLoading || configLoading) ? (
              <TableRow className="border-border">
                <TableCell colSpan={config?.columns.length || 5} className="text-center py-24">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredLeads?.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={config?.columns.length || 5} className="text-center py-24 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-10" />
                  No leads found.
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads?.map((lead) => (
                <TableRow key={lead.id} className="border-border group hover:bg-muted/30 transition-colors">
                  {config?.columns.map((col) => {
                    const isEditing = editingCell?.id === lead.id && editingCell?.key === col.key;
                    
                    return (
                      <TableCell 
                        key={`${lead.id}-${col.id}`} 
                        className="p-0 border-r border-border/50 last:border-0"
                      >
                        {isEditing ? (
                          <div className="p-1">
                            <Input 
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={saveEdit}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              className="h-9 text-sm bg-background ring-2 ring-primary border-transparent"
                            />
                          </div>
                        ) : (
                          <div 
                            onClick={() => startEdit(lead, col.key)}
                            className="px-4 py-4 text-sm min-h-[52px] flex items-center cursor-text hover:bg-primary/5 transition-colors"
                          >
                            {col.key === 'status' ? (
                              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 capitalize text-[10px]">
                                {lead[col.key] || "New"}
                              </Badge>
                            ) : col.key === 'createdAt' ? (
                              <span className="text-[11px] text-muted-foreground">
                                {lead[col.key] ? format(new Date(lead[col.key]), 'MMM d, h:mm a') : "-"}
                              </span>
                            ) : (
                              <span className={!lead[col.key] ? "text-muted-foreground/30 italic text-[10px]" : "text-foreground/80"}>
                                {lead[col.key] || "Empty"}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      
      <p className="mt-8 text-[11px] text-muted-foreground text-center flex items-center justify-center gap-2">
        <Check className="w-3 h-3 text-primary" />
        Synced to Google Sheets in real-time.
      </p>
    </div>
  );
}

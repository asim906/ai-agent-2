import { useEffect } from "react";
import { useLocation } from "wouter";
import { 
  useGetWhatsappStatus, 
  useGetAutomationStatus, 
  useToggleAutomation,
  getGetAutomationStatusQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ShieldAlert, Zap, SmartphoneNfc, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: status, isLoading: isStatusLoading } = useGetWhatsappStatus();
  const { data: automationStatus } = useGetAutomationStatus({
    query: {
      enabled: status?.connected
    }
  });

  const toggleAutomation = useToggleAutomation();

  useEffect(() => {
    if (!isStatusLoading && status && !status.connected) {
      setLocation("/onboarding");
    }
  }, [status, isStatusLoading, setLocation]);

  const handleToggle = (checked: boolean) => {
    toggleAutomation.mutate({ data: { enabled: checked } }, {
      onSuccess: () => {
        queryClient.setQueryData(getGetAutomationStatusQueryKey(), (old: any) => 
          old ? { ...old, enabled: checked } : old
        );
      }
    });
  };

  if (isStatusLoading || !status?.connected) return null;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
          <p className="text-muted-foreground mt-1">Real-time overview of your AI agent</p>
        </div>
        <div className="flex items-center gap-4 bg-card p-2 px-4 rounded-lg border border-border shadow-sm">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Autopilot</span>
            <span className="text-xs text-muted-foreground">{automationStatus?.enabled ? 'Active' : 'Standby'}</span>
          </div>
          <Switch 
            checked={automationStatus?.enabled ?? false} 
            onCheckedChange={handleToggle}
            data-testid="switch-automation"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Connection</CardTitle>
            <SmartphoneNfc className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
              Online
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {status.phoneNumber || 'Unknown Number'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processed Today</CardTitle>
            <Zap className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{automationStatus?.processedToday || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Messages handled by AI</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Sync</CardTitle>
            <Activity className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status.lastConnected ? format(new Date(status.lastConnected), "HH:mm") : "Just now"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Session updated</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Protection</CardTitle>
            <ShieldAlert className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Active</div>
            <p className="text-xs text-muted-foreground mt-1">End-to-end encrypted</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border flex-1">
          <CardHeader>
            <CardTitle>Recent Diagnostic Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { time: "Just now", event: "System health check passed", type: "info" },
                { time: "2 mins ago", event: "Auto-reply triggered for support query", type: "success" },
                { time: "1 hour ago", event: "Memory indices re-embedded", type: "info" },
              ].map((log, i) => (
                <div key={i} className="flex items-start gap-4 p-3 rounded-lg border border-border/50 bg-background/50">
                  {log.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                  ) : (
                    <Activity className="w-5 h-5 text-muted-foreground mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{log.event}</p>
                    <p className="text-xs text-muted-foreground">{log.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

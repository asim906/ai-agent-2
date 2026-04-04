import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/auth-firebase-web";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import SignUp from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import Onboarding from "@/pages/onboarding";
import Chats from "@/pages/chats";
import AiSettings from "@/pages/ai-settings";
import Memory from "@/pages/memory";
import Tools from "@/pages/tools";
import Analytics from "@/pages/analytics";
import Leads from "@/pages/leads";
import { Sidebar } from "@/components/Sidebar";
import { setBaseUrl, setAuthTokenGetter, useGetWhatsappStatus, getGetWhatsappStatusQueryKey } from "@workspace/api-client-react";
import { auth } from "@workspace/auth-firebase-web";

setBaseUrl("");
setAuthTokenGetter(async () => {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
});

const queryClient = new QueryClient();

function RequireWhatsApp({ children }: { children: React.ReactNode }) {
  const { data: status, isLoading } = useGetWhatsappStatus({
    query: { queryKey: getGetWhatsappStatusQueryKey(), refetchInterval: 5000 }
  });
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && status && !status.connected && location !== "/onboarding") {
      setLocation("/onboarding");
    }
  }, [status, isLoading, location, setLocation]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status && !status.connected) {
    return null; // The useEffect will handle the redirect
  }

  return <>{children}</>;
}

function ProtectedRoute({ component: Component, path }: { component: any; path: string }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading secure session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <Route path={path}>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {path === "/onboarding" ? (
            <Component />
          ) : (
            <RequireWhatsApp>
              <Component />
            </RequireWhatsApp>
          )}
        </main>
      </div>
    </Route>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse">Initializing Nexus Ops...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={SignUp} />
      <ProtectedRoute path="/onboarding" component={Onboarding} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/chats" component={Chats} />
      <ProtectedRoute path="/ai-settings" component={AiSettings} />
      <ProtectedRoute path="/memory" component={Memory} />
      <ProtectedRoute path="/tools" component={Tools} />
      <ProtectedRoute path="/analytics" component={Analytics} />
      <ProtectedRoute path="/leads" component={Leads} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

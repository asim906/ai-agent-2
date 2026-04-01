import { useAuth } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, setLocation]);

  return (
    <div className="min-h-[100dvh] w-full flex bg-background text-foreground relative overflow-hidden">
      {/* Decorative background effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      
      <div className="flex-1 flex flex-col justify-center items-center p-8 z-10">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="flex justify-center">
            <div className="p-4 bg-card border border-border rounded-xl shadow-2xl">
              <BrainCircuit className="w-12 h-12 text-primary" />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">Nexus Ops</h1>
            <p className="text-lg text-muted-foreground">
              Intelligent WhatsApp automation. Command center for your conversations.
            </p>
          </div>
          <div className="pt-8 border-t border-border">
            <Button 
              size="lg" 
              className="w-full h-14 text-lg font-medium"
              onClick={() => login()}
              data-testid="button-login"
            >
              Access System
            </Button>
          </div>
        </div>
      </div>
      <div className="hidden lg:flex flex-1 bg-card border-l border-border items-center justify-center relative">
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none" />
        <div className="max-w-lg p-12">
          <h2 className="text-3xl font-bold mb-6">Always on. <span className="text-primary">Always smart.</span></h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <p className="text-muted-foreground text-lg leading-relaxed">Instantly connect your WhatsApp business account with zero configuration overhead.</p>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <p className="text-muted-foreground text-lg leading-relaxed">Deploy state-of-the-art AI models to handle customer inquiries 24/7 with zero downtime.</p>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <p className="text-muted-foreground text-lg leading-relaxed">Train your digital agent on custom CSV data to ensure hyper-accurate, domain-specific responses.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

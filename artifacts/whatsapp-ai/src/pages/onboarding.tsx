import { useEffect } from "react";
import { useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { useGetWhatsappStatus, useGetWhatsappQr } from "@workspace/api-client-react";
import { Loader2, CheckCircle2, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { data: status, isLoading: isStatusLoading } = useGetWhatsappStatus();
  
  const { data: qrData, isLoading: isQrLoading } = useGetWhatsappQr({
    query: {
      enabled: status ? !status.connected : false,
      refetchInterval: (query) => {
        // Poll every 5 seconds if not connected
        return status?.connected ? false : 5000;
      }
    }
  });

  useEffect(() => {
    if (status?.connected) {
      setLocation("/dashboard");
    }
  }, [status, setLocation]);

  if (isStatusLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <div className="max-w-4xl mx-auto w-full p-8 py-16 flex flex-col items-center">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Initialize Connection</h1>
          <p className="text-xl text-muted-foreground">Link your WhatsApp device to activate the AI agent.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 w-full">
          <Card className="bg-card border-border shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Scan QR Code
              </CardTitle>
              <CardDescription>Open WhatsApp on your phone and scan to link</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8">
              {isQrLoading ? (
                <div className="w-64 h-64 flex flex-col items-center justify-center bg-muted/20 border border-border rounded-lg">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">Generating secure code...</p>
                </div>
              ) : qrData?.qr ? (
                <div className="p-4 bg-white rounded-xl shadow-sm">
                  {qrData.qr.startsWith('data:image') ? (
                    <img src={qrData.qr} alt="WhatsApp QR Code" className="w-64 h-64" data-testid="img-qr-code" />
                  ) : (
                    <QRCodeSVG value={qrData.qr} size={256} data-testid="svg-qr-code" />
                  )}
                </div>
              ) : (
                <div className="w-64 h-64 flex flex-col items-center justify-center bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
                  <p className="text-sm">Failed to load QR code</p>
                </div>
              )}
              <div className="mt-8 text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  1. Open WhatsApp on your phone<br/>
                  2. Tap Menu or Settings and select Linked Devices<br/>
                  3. Tap on Link a Device<br/>
                  4. Point your phone to this screen to capture the code
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>System Capabilities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <h3 className="font-medium">Autonomous Routing</h3>
                    <p className="text-sm text-muted-foreground">AI seamlessly handles incoming queries based on custom knowledge.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <h3 className="font-medium">Memory Injection</h3>
                    <p className="text-sm text-muted-foreground">Train the agent via CSV or manual Q&A pairs for hyper-specific responses.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <h3 className="font-medium">Multi-Model Support</h3>
                    <p className="text-sm text-muted-foreground">Switch between OpenAI, Gemini, and OpenRouter instantaneously.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

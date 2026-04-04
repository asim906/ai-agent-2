import { useEffect, useState } from "react";
import { 
  useGetAiSettings, 
  useUpdateAiSettings,
  getGetAiSettingsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Save, BrainCircuit, Key } from "lucide-react";

export default function AiSettings() {
  const { data: settings } = useGetAiSettings();
  const updateSettings = useUpdateAiSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    provider: "openai",
    model: "gpt-4o",
    apiKey: "",
    temperature: 0.7,
    maxTokens: 500,
    systemPrompt: ""
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKey || "",
        temperature: settings.temperature,
        maxTokens: settings.maxTokens || 500,
        systemPrompt: settings.systemPrompt || ""
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({ 
      data: {
        ...formData,
        provider: formData.provider as any,
      }
    }, {
      onSuccess: (newData) => {
        queryClient.setQueryData(getGetAiSettingsQueryKey(), newData);
        toast({
          title: "Configuration Saved",
          description: "AI parameters have been updated successfully.",
        });
      }
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Parameters</h1>
          <p className="text-muted-foreground mt-1">Configure neural engine behavior and API connections</p>
        </div>
        <Button onClick={handleSave} disabled={updateSettings.isPending} data-testid="button-save-settings">
          <Save className="w-4 h-4 mr-2" />
          {updateSettings.isPending ? "Saving..." : "Commit Changes"}
        </Button>
      </div>

      <div className="grid gap-8">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-primary" />
              Model Configuration
            </CardTitle>
            <CardDescription>Select the underlying intelligence provider</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select 
                  value={formData.provider} 
                  onValueChange={(v) => setFormData({...formData, provider: v})}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model Identifier</Label>
                <Input 
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  className="bg-background border-border"
                  placeholder="e.g. gpt-4o"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Key
              </Label>
              <Input 
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
                className="bg-background border-border font-mono"
                placeholder="sk-..."
              />
              <p className="text-xs text-muted-foreground">Key is stored encrypted at rest.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Behavior Tuning</CardTitle>
            <CardDescription>Adjust response creativity and constraints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Temperature (Creativity)</Label>
                <span className="text-sm font-mono text-primary">{formData.temperature}</span>
              </div>
              <Slider 
                value={[formData.temperature]} 
                max={2} 
                step={0.1}
                onValueChange={([v]) => setFormData({...formData, temperature: v})}
              />
            </div>

            <div className="space-y-2">
              <Label>System Directive (Base Prompt)</Label>
              <Textarea 
                value={formData.systemPrompt}
                onChange={(e) => setFormData({...formData, systemPrompt: e.target.value})}
                className="min-h-[150px] bg-background border-border font-mono text-sm leading-relaxed"
                placeholder="You are a helpful customer support assistant..."
              />
              <p className="text-xs text-muted-foreground">This defines the fundamental persona and rules for the agent.</p>
            </div>

            <div className="flex items-start gap-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <BrainCircuit className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-primary">How AI Automation Works</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  AI replies are controlled by two toggles: the <strong>Autopilot</strong> switch on the Dashboard (global on/off), and the <strong>AI MODE</strong> toggle inside each chat (per-conversation control). Configure your API key and system prompt here, then enable Autopilot from the Dashboard.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

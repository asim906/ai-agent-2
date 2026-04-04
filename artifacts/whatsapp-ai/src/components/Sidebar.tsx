import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  MessageSquare, 
  Settings, 
  BrainCircuit, 
  Wrench, 
  BarChart3, 
  LogOut,
  Users
} from "lucide-react";
import { useAuth, type AuthUser } from "@workspace/auth-firebase-web";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chats", label: "Chats", icon: MessageSquare },
  { href: "/ai-settings", label: "AI Settings", icon: Settings },
  { href: "/memory", label: "Memory", icon: BrainCircuit },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user }: { logout: () => void, user: AuthUser | null } = useAuth();

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col justify-between">
      <div>
        <div className="h-16 flex items-center px-6 border-b border-border">
          <BrainCircuit className="w-6 h-6 text-primary mr-3" />
          <span className="font-bold text-lg tracking-tight uppercase">Nexus Ops</span>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center px-3 py-2 rounded-md transition-colors text-sm font-medium",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )} data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
                <Icon className="w-4 h-4 mr-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-border">
        <div className="flex items-center mb-4 px-2">
          {user?.profileImageUrl ? (
            <img src={user.profileImageUrl} alt="Profile" className="w-8 h-8 rounded-full mr-3" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mr-3">
              {user?.firstName ? user.firstName[0] : 'U'}
            </div>
          )}
          <div className="overflow-hidden">
            <div className="text-sm font-medium truncate">{user?.firstName || 'User'}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email || 'Logged in'}</div>
          </div>
        </div>
        <button 
          onClick={logout}
          className="flex w-full items-center px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-colors"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Sign out
        </button>
      </div>
    </div>
  );
}

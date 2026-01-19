import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Settings,
  LogOut,
  Menu,
  X,
  FileText,
  Download,
  ArrowLeftRight,
  ClipboardList,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AppLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  superAdminOnly?: boolean;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Create Order', href: '/orders/new', icon: ShoppingCart },
  { name: 'Orders', href: '/orders', icon: FileText },
  { name: 'Parties', href: '/parties', icon: Users },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Stock Entry', href: '/stock-entry', icon: ArrowLeftRight },
  { name: 'Stock Reports', href: '/stock-reports', icon: ClipboardList },
  { name: 'Backup', href: '/backup', icon: Download },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'User Management', href: '/users', icon: UserCog, superAdminOnly: true },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isSuperAdmin } = useAuth();

  // Filter navigation items based on user role
  const filteredNavigation = navigation.filter(item => 
    !item.superAdminOnly || isSuperAdmin
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border z-50 flex items-center px-3 gap-2">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors shrink-0"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex-1 flex justify-center">
          <Link to="/" className="text-base font-display font-semibold text-sidebar-foreground truncate hover:text-sidebar-foreground/80 transition-colors">
            Mystic Vastra
          </Link>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground p-2"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-foreground/50 z-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-sidebar z-50 transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo and DateTime */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
            <div className="flex flex-col">
              <h1 className="text-lg font-display font-semibold text-sidebar-foreground">
                Mystic Vastra
              </h1>
              <div className="flex items-center gap-1.5 text-sidebar-foreground/70 text-xs">
                <span>{format(currentTime, 'dd MMM yyyy')}</span>
                <span>•</span>
                <span className="font-medium">{format(currentTime, 'hh:mm:ss a')}</span>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== '/' && location.pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Theme Toggle & Sign Out */}
          <div className="p-4 border-t border-sidebar-border space-y-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="h-5 w-5 mr-3" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

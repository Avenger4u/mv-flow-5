import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="flex items-center justify-between w-full px-3 py-2">
      <div className="flex items-center gap-3">
        {isDark ? (
          <Moon className="h-5 w-5 text-sidebar-foreground" />
        ) : (
          <Sun className="h-5 w-5 text-sidebar-foreground" />
        )}
        <Label htmlFor="theme-toggle" className="text-sm font-medium text-sidebar-foreground cursor-pointer">
          Dark Mode
        </Label>
      </div>
      <Switch
        id="theme-toggle"
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        className="data-[state=checked]:bg-sidebar-primary"
      />
    </div>
  );
}

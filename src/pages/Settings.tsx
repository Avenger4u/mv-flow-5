import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { User, Shield, Info } from 'lucide-react';
import { CategoryManager } from '@/components/settings/CategoryManager';
import { UnitManager } from '@/components/settings/UnitManager';
import { DataManagement } from '@/components/settings/DataManagement';

export default function Settings() {
  const { user, isAdmin } = useAuth();

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            Settings
          </h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <User className="h-5 w-5 text-primary" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <div className="flex items-center gap-2">
                  <Shield className={`h-4 w-4 ${isAdmin ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-medium">{isAdmin ? 'Administrator' : 'User'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <DataManagement />

        {/* Category Manager */}
        <CategoryManager />

        {/* Unit Manager */}
        <UnitManager />

        {/* App Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Info className="h-5 w-5 text-primary" />
              About
            </CardTitle>
            <CardDescription>Application information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Application</p>
                <p className="font-medium">Mystic Vastra</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Version</p>
                <p className="font-medium">1.0.0</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">Business Address</p>
                <p className="font-medium">Madhuvan Enclave, Krishna Nagar, Mathura</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

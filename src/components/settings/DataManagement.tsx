import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Database, Trash2, Loader2, AlertTriangle } from 'lucide-react';

export function DataManagement() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();

  const handleImportDemoData = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-demo-data', {
        body: { action: 'import' }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Import failed');

      toast({
        title: 'Demo Data Imported',
        description: 'Sample parties, materials, and orders have been added successfully.',
      });
      setImportDialogOpen(false);
    } catch (error) {
      console.error('Error importing demo data:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import demo data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleResetAllData = async () => {
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-demo-data', {
        body: { action: 'reset' }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Reset failed');

      toast({
        title: 'All Data Reset',
        description: 'All orders, parties, inventory, and ledger data have been deleted.',
      });
      setResetDialogOpen(false);
    } catch (error) {
      console.error('Error resetting data:', error);
      toast({
        title: 'Reset Failed',
        description: error instanceof Error ? error.message : 'Failed to reset data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Database className="h-5 w-5 text-primary" />
          Data Management
        </CardTitle>
        <CardDescription>Import demo data or reset all application data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={() => setImportDialogOpen(true)}
            className="flex-1"
          >
            <Database className="h-4 w-4 mr-2" />
            Import Demo Data
          </Button>
          <Button
            variant="destructive"
            onClick={() => setResetDialogOpen(true)}
            className="flex-1"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Reset All Data
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Demo data lets you explore features. Reset clears everything except admin accounts.
        </p>
      </CardContent>

      {/* Import Demo Data Dialog */}
      <AlertDialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Import Demo Data
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>This will add sample data for testing purposes including:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>5 sample parties (Sharma Textiles, Gupta Garments, etc.)</li>
                  <li>8 materials with stock (Cotton, Silk, Threads, etc.)</li>
                  <li>5 material categories</li>
                  <li>2 sample orders with items and deductions</li>
                  <li>Sample stock transactions</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={importing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleImportDemoData();
              }}
              disabled={importing}
              className="gradient-primary border-0"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import Demo Data'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset All Data Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Reset All Data
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="font-semibold text-destructive">
                  ⚠️ This will permanently delete ALL data. This cannot be undone!
                </p>
                <p>The following data will be deleted:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>All orders and order items</li>
                  <li>All parties</li>
                  <li>All materials and stock transactions</li>
                  <li>All material categories</li>
                  <li>All order templates</li>
                </ul>
                <p className="font-medium">Admin accounts will NOT be deleted.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleResetAllData();
              }}
              disabled={resetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Yes, Delete Everything'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Database } from '@/integrations/supabase/types';

type Party = Database['public']['Tables']['parties']['Insert'];
type Material = Database['public']['Tables']['materials']['Insert'];
type MaterialCategory = Database['public']['Tables']['material_categories']['Insert'];
type Order = Database['public']['Tables']['orders']['Insert'];
type OrderItem = Database['public']['Tables']['order_items']['Insert'];
type RawMaterialDeduction = Database['public']['Tables']['raw_material_deductions']['Insert'];
type StockTransaction = Database['public']['Tables']['stock_transactions']['Insert'];

interface BackupData {
  version: string;
  exportedAt: string;
  parties: Party[];
  materials: Material[];
  material_categories: MaterialCategory[];
  orders: Order[];
  order_items: OrderItem[];
  raw_material_deductions: RawMaterialDeduction[];
  stock_transactions: StockTransaction[];
}

export default function Backup() {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleDownloadBackup = async () => {
    setDownloading(true);

    try {
      // Fetch all data
      const [
        partiesRes,
        materialsRes,
        categoriesRes,
        ordersRes,
        orderItemsRes,
        deductionsRes,
        transactionsRes,
      ] = await Promise.all([
        supabase.from('parties').select('*'),
        supabase.from('materials').select('*'),
        supabase.from('material_categories').select('*'),
        supabase.from('orders').select('*'),
        supabase.from('order_items').select('*'),
        supabase.from('raw_material_deductions').select('*'),
        supabase.from('stock_transactions').select('*'),
      ]);

      const backupData: BackupData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        parties: partiesRes.data || [],
        materials: materialsRes.data || [],
        material_categories: categoriesRes.data || [],
        orders: ordersRes.data || [],
        order_items: orderItemsRes.data || [],
        raw_material_deductions: deductionsRes.data || [],
        stock_transactions: transactionsRes.data || [],
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mystic-vastra-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Backup Downloaded',
        description: 'Your data has been exported successfully',
      });
    } catch (error) {
      console.error('Error downloading backup:', error);
      toast({
        title: 'Error',
        description: 'Failed to download backup',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) return;

    setRestoring(true);

    try {
      const text = await selectedFile.text();
      const backupData: BackupData = JSON.parse(text);

      // Validate backup structure
      if (!backupData.version || !backupData.exportedAt) {
        throw new Error('Invalid backup file format');
      }

      // Clear existing data and restore (in order to respect foreign keys)
      // 1. Delete dependent tables first (order matters due to foreign keys)
      await supabase.from('stock_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('raw_material_deductions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('materials').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('material_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('parties').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // 2. Restore data in correct order (parent tables first)
      if (backupData.parties.length > 0) {
        const { error } = await supabase.from('parties').insert(backupData.parties);
        if (error) throw error;
      }

      if (backupData.material_categories.length > 0) {
        const { error } = await supabase.from('material_categories').insert(backupData.material_categories);
        if (error) throw error;
      }

      if (backupData.materials.length > 0) {
        const { error } = await supabase.from('materials').insert(backupData.materials);
        if (error) throw error;
      }

      if (backupData.orders.length > 0) {
        const { error } = await supabase.from('orders').insert(backupData.orders);
        if (error) throw error;
      }

      if (backupData.order_items.length > 0) {
        const { error } = await supabase.from('order_items').insert(backupData.order_items);
        if (error) throw error;
      }

      if (backupData.raw_material_deductions.length > 0) {
        const { error } = await supabase.from('raw_material_deductions').insert(backupData.raw_material_deductions);
        if (error) throw error;
      }

      if (backupData.stock_transactions.length > 0) {
        const { error } = await supabase.from('stock_transactions').insert(backupData.stock_transactions);
        if (error) throw error;
      }

      toast({
        title: 'Restore Complete',
        description: 'Your data has been restored successfully',
      });

      setSelectedFile(null);
      
      // Reset the file input
      const fileInput = document.getElementById('backup-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Error restoring backup:', error);
      toast({
        title: 'Restore Failed',
        description: error instanceof Error ? error.message : 'Failed to restore backup',
        variant: 'destructive',
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            Backup & Restore
          </h1>
          <p className="text-muted-foreground">
            Download your data or restore from a backup file
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Download Backup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Download className="h-5 w-5 text-primary" />
                Download Backup
              </CardTitle>
              <CardDescription>
                Export all your data including orders, parties, and inventory
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>All orders and packing lists</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Party information</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Inventory and stock data</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Raw material deductions</span>
                </div>
              </div>

              <Button
                onClick={handleDownloadBackup}
                disabled={downloading}
                className="w-full gradient-primary border-0"
              >
                {downloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download Full Backup
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Restore Backup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Upload className="h-5 w-5 text-primary" />
                Restore Backup
              </CardTitle>
              <CardDescription>
                Upload a backup file to restore your data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive">Warning</p>
                    <p className="text-muted-foreground">
                      Restoring will replace all existing data. Make sure to download a backup first.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="backup-file">Select Backup File</Label>
                <Input
                  id="backup-file"
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={!selectedFile || restoring}
                    className="w-full"
                  >
                    {restoring ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Restoring...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Restore Backup
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Restore</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all existing data and replace it with the backup. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleRestore}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, Restore
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Backup Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Download backups regularly to prevent data loss</li>
              <li>• Store backup files in a safe location (Google Drive, etc.)</li>
              <li>• Test restore on a new device before relying on backups</li>
              <li>• Material images are stored separately and not included in backup</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, AlertTriangle, CheckCircle, Loader2, XCircle, FileText, Users, Package, ShoppingCart, Layers, Scissors, History } from 'lucide-react';
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

interface BackupPreview {
  version: string;
  exportedAt: string;
  counts: {
    parties: number;
    materials: number;
    material_categories: number;
    orders: number;
    order_items: number;
    raw_material_deductions: number;
    stock_transactions: number;
  };
  isValid: boolean;
  errors: string[];
}

// Required fields for each table to validate structure
const REQUIRED_FIELDS = {
  parties: ['id', 'name'],
  materials: ['id', 'name', 'rate', 'current_stock', 'unit'],
  material_categories: ['id', 'name'],
  orders: ['id', 'order_number', 'status', 'order_date'],
  order_items: ['id', 'order_id', 'particular', 'quantity', 'rate_per_dzn', 'total', 'serial_no'],
  raw_material_deductions: ['id', 'order_id', 'material_name', 'quantity', 'rate', 'amount'],
  stock_transactions: ['id', 'material_id', 'transaction_type', 'quantity'],
};

export default function Backup() {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const { toast } = useToast();

  const validateBackupStructure = (data: unknown): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('Invalid JSON structure');
      return { isValid: false, errors };
    }

    const backup = data as Record<string, unknown>;

    // Check required top-level fields
    if (!backup.version || typeof backup.version !== 'string') {
      errors.push('Missing or invalid "version" field');
    }

    if (!backup.exportedAt || typeof backup.exportedAt !== 'string') {
      errors.push('Missing or invalid "exportedAt" field');
    }

    // Validate each table's structure
    const tables = ['parties', 'materials', 'material_categories', 'orders', 'order_items', 'raw_material_deductions', 'stock_transactions'] as const;

    for (const table of tables) {
      if (!Array.isArray(backup[table])) {
        errors.push(`Missing or invalid "${table}" array`);
        continue;
      }

      const records = backup[table] as Record<string, unknown>[];
      const requiredFields = REQUIRED_FIELDS[table];

      // Check first record for required fields (if any records exist)
      if (records.length > 0) {
        const firstRecord = records[0];
        for (const field of requiredFields) {
          if (!(field in firstRecord)) {
            errors.push(`Table "${table}" is missing required field "${field}"`);
          }
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  };

  const parseBackupFile = async (file: File): Promise<BackupPreview | null> => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const validation = validateBackupStructure(data);

      const preview: BackupPreview = {
        version: data.version || 'Unknown',
        exportedAt: data.exportedAt || 'Unknown',
        counts: {
          parties: Array.isArray(data.parties) ? data.parties.length : 0,
          materials: Array.isArray(data.materials) ? data.materials.length : 0,
          material_categories: Array.isArray(data.material_categories) ? data.material_categories.length : 0,
          orders: Array.isArray(data.orders) ? data.orders.length : 0,
          order_items: Array.isArray(data.order_items) ? data.order_items.length : 0,
          raw_material_deductions: Array.isArray(data.raw_material_deductions) ? data.raw_material_deductions.length : 0,
          stock_transactions: Array.isArray(data.stock_transactions) ? data.stock_transactions.length : 0,
        },
        isValid: validation.isValid,
        errors: validation.errors,
      };

      return preview;
    } catch (error) {
      return {
        version: 'Unknown',
        exportedAt: 'Unknown',
        counts: {
          parties: 0,
          materials: 0,
          material_categories: 0,
          orders: 0,
          order_items: 0,
          raw_material_deductions: 0,
          stock_transactions: 0,
        },
        isValid: false,
        errors: [error instanceof Error ? `Parse error: ${error.message}` : 'Failed to parse backup file'],
      };
    }
  };

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setParsing(true);
      const preview = await parseBackupFile(file);
      setBackupPreview(preview);
      setParsing(false);
    } else {
      setSelectedFile(null);
      setBackupPreview(null);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setBackupPreview(null);
    const fileInput = document.getElementById('backup-file') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleRestore = async () => {
    if (!selectedFile || !backupPreview?.isValid) return;

    setRestoring(true);

    try {
      const text = await selectedFile.text();
      const backupData: BackupData = JSON.parse(text);

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

      clearSelection();

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

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
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
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Selected: {selectedFile.name}
                    </p>
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Parsing indicator */}
              {parsing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing backup file...
                </div>
              )}

              {/* Backup Preview */}
              {backupPreview && !parsing && (
                <div className={`border rounded-lg p-4 space-y-3 ${backupPreview.isValid ? 'border-success/50 bg-success/5' : 'border-destructive/50 bg-destructive/5'}`}>
                  <div className="flex items-center gap-2">
                    {backupPreview.isValid ? (
                      <CheckCircle className="h-5 w-5 text-success" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span className="font-medium">
                      {backupPreview.isValid ? 'Valid Backup File' : 'Invalid Backup File'}
                    </span>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      Version: {backupPreview.version}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <History className="h-3.5 w-3.5" />
                      {formatDate(backupPreview.exportedAt)}
                    </div>
                  </div>

                  {/* Counts */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      <span>{backupPreview.counts.parties} Parties</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                      <span>{backupPreview.counts.orders} Orders</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-primary" />
                      <span>{backupPreview.counts.materials} Materials</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span>{backupPreview.counts.material_categories} Categories</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span>{backupPreview.counts.order_items} Order Items</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Scissors className="h-3.5 w-3.5 text-primary" />
                      <span>{backupPreview.counts.raw_material_deductions} Deductions</span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2">
                      <History className="h-3.5 w-3.5 text-primary" />
                      <span>{backupPreview.counts.stock_transactions} Stock Transactions</span>
                    </div>
                  </div>

                  {/* Validation Errors */}
                  {backupPreview.errors.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-destructive">Validation Errors:</p>
                      <ul className="text-sm text-destructive/80 space-y-0.5">
                        {backupPreview.errors.map((error, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="mt-1">•</span>
                            <span>{error}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={!selectedFile || !backupPreview?.isValid || restoring}
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
                    <AlertDialogDescription className="space-y-2">
                      <p>This will delete all existing data and replace it with the backup. This action cannot be undone.</p>
                      {backupPreview && (
                        <div className="mt-3 p-3 bg-muted rounded-md text-sm">
                          <p className="font-medium mb-2">You are about to restore:</p>
                          <ul className="space-y-1">
                            <li>• {backupPreview.counts.parties} parties</li>
                            <li>• {backupPreview.counts.orders} orders with {backupPreview.counts.order_items} items</li>
                            <li>• {backupPreview.counts.materials} materials in {backupPreview.counts.material_categories} categories</li>
                            <li>• {backupPreview.counts.raw_material_deductions} raw material deductions</li>
                            <li>• {backupPreview.counts.stock_transactions} stock transactions</li>
                          </ul>
                        </div>
                      )}
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

import { useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { 
  Download, Upload, AlertTriangle, CheckCircle, Loader2, XCircle, 
  FileText, Users, Package, ShoppingCart, Layers, Scissors, History,
  Image as ImageIcon, Archive
} from 'lucide-react';
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

type Party = Database['public']['Tables']['parties']['Row'];
type Material = Database['public']['Tables']['materials']['Row'];
type MaterialCategory = Database['public']['Tables']['material_categories']['Row'];
type Unit = Database['public']['Tables']['units']['Row'];
type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type RawMaterialDeduction = Database['public']['Tables']['raw_material_deductions']['Row'];
type StockTransaction = Database['public']['Tables']['stock_transactions']['Row'];

interface BackupData {
  parties: Party[];
  materials: Material[];
  material_categories: MaterialCategory[];
  units: Unit[];
  orders: Order[];
  order_items: OrderItem[];
  raw_material_deductions: RawMaterialDeduction[];
  stock_transactions: StockTransaction[];
  // Image mapping: original_url -> filename in images/ folder
  image_mapping: Record<string, string>;
}

interface BackupMetadata {
  version: string;
  app_name: string;
  exported_at: string;
  record_counts: {
    parties: number;
    materials: number;
    material_categories: number;
    units: number;
    orders: number;
    order_items: number;
    raw_material_deductions: number;
    stock_transactions: number;
    images: number;
  };
}

interface BackupPreview {
  metadata: BackupMetadata | null;
  isValid: boolean;
  errors: string[];
  hasImages: boolean;
  imageCount: number;
}

// Required fields for validation
const REQUIRED_FIELDS: Record<string, string[]> = {
  parties: ['id', 'name'],
  materials: ['id', 'name', 'rate', 'current_stock', 'unit'],
  material_categories: ['id', 'name'],
  units: ['id', 'name'],
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
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const { toast } = useToast();

  const validateBackupData = (data: unknown): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('Invalid backup.json structure');
      return { isValid: false, errors };
    }

    const backup = data as Record<string, unknown>;

    // Validate each table's structure
    const tables = Object.keys(REQUIRED_FIELDS);

    for (const table of tables) {
      if (!Array.isArray(backup[table])) {
        errors.push(`Missing or invalid "${table}" array`);
        continue;
      }

      const records = backup[table] as Record<string, unknown>[];
      const requiredFields = REQUIRED_FIELDS[table];

      // Check first record for required fields
      if (records.length > 0) {
        const firstRecord = records[0];
        for (const field of requiredFields) {
          if (!(field in firstRecord)) {
            errors.push(`Table "${table}" missing required field "${field}"`);
          }
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  };

  const parseBackupZip = async (file: File): Promise<BackupPreview> => {
    try {
      const zip = await JSZip.loadAsync(file);
      
      // Check for required files
      const backupJsonFile = zip.file('backup.json');
      const metadataJsonFile = zip.file('metadata.json');

      if (!backupJsonFile) {
        return {
          metadata: null,
          isValid: false,
          errors: ['Missing backup.json in ZIP file'],
          hasImages: false,
          imageCount: 0,
        };
      }

      if (!metadataJsonFile) {
        return {
          metadata: null,
          isValid: false,
          errors: ['Missing metadata.json in ZIP file'],
          hasImages: false,
          imageCount: 0,
        };
      }

      // Parse metadata
      const metadataText = await metadataJsonFile.async('text');
      const metadata: BackupMetadata = JSON.parse(metadataText);

      // Parse and validate backup data
      const backupText = await backupJsonFile.async('text');
      const backupData = JSON.parse(backupText);
      const validation = validateBackupData(backupData);

      // Count images in the images/ folder
      const imageFiles = Object.keys(zip.files).filter(
        (name) => name.startsWith('images/') && !name.endsWith('/')
      );

      return {
        metadata,
        isValid: validation.isValid,
        errors: validation.errors,
        hasImages: imageFiles.length > 0,
        imageCount: imageFiles.length,
      };
    } catch (error) {
      return {
        metadata: null,
        isValid: false,
        errors: [error instanceof Error ? `Parse error: ${error.message}` : 'Failed to parse backup file'],
        hasImages: false,
        imageCount: 0,
      };
    }
  };

  const downloadImage = async (url: string): Promise<Blob | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.blob();
    } catch {
      return null;
    }
  };

  const handleDownloadBackup = async () => {
    setDownloading(true);
    setProgress(0);
    setProgressMessage('Fetching data...');

    try {
      // Fetch all data
      setProgress(10);
      const [
        partiesRes,
        materialsRes,
        categoriesRes,
        unitsRes,
        ordersRes,
        orderItemsRes,
        deductionsRes,
        transactionsRes,
      ] = await Promise.all([
        supabase.from('parties').select('*'),
        supabase.from('materials').select('*'),
        supabase.from('material_categories').select('*'),
        supabase.from('units').select('*'),
        supabase.from('orders').select('*'),
        supabase.from('order_items').select('*'),
        supabase.from('raw_material_deductions').select('*'),
        supabase.from('stock_transactions').select('*'),
      ]);

      setProgress(30);
      setProgressMessage('Processing images...');

      const materials = materialsRes.data || [];
      const imageMapping: Record<string, string> = {};
      const zip = new JSZip();
      const imagesFolder = zip.folder('images');

      // Download all material images
      let imageIndex = 0;
      for (const material of materials) {
        if (material.image_url) {
          setProgressMessage(`Downloading image ${imageIndex + 1}/${materials.filter(m => m.image_url).length}...`);
          
          const imageBlob = await downloadImage(material.image_url);
          if (imageBlob && imagesFolder) {
            // Extract extension from URL or use jpg as default
            const urlParts = material.image_url.split('.');
            const ext = urlParts.length > 1 ? urlParts[urlParts.length - 1].split('?')[0] : 'jpg';
            const filename = `material_${material.id}.${ext}`;
            
            imagesFolder.file(filename, imageBlob);
            imageMapping[material.image_url] = filename;
          }
          imageIndex++;
        }
        setProgress(30 + Math.floor((imageIndex / Math.max(materials.filter(m => m.image_url).length, 1)) * 40));
      }

      setProgress(70);
      setProgressMessage('Creating backup archive...');

      // Create backup data
      const backupData: BackupData = {
        parties: partiesRes.data || [],
        materials: materialsRes.data || [],
        material_categories: categoriesRes.data || [],
        units: unitsRes.data || [],
        orders: ordersRes.data || [],
        order_items: orderItemsRes.data || [],
        raw_material_deductions: deductionsRes.data || [],
        stock_transactions: transactionsRes.data || [],
        image_mapping: imageMapping,
      };

      // Create metadata
      const metadata: BackupMetadata = {
        version: '2.0',
        app_name: 'Mystic Vastra',
        exported_at: new Date().toISOString(),
        record_counts: {
          parties: backupData.parties.length,
          materials: backupData.materials.length,
          material_categories: backupData.material_categories.length,
          units: backupData.units.length,
          orders: backupData.orders.length,
          order_items: backupData.order_items.length,
          raw_material_deductions: backupData.raw_material_deductions.length,
          stock_transactions: backupData.stock_transactions.length,
          images: Object.keys(imageMapping).length,
        },
      };

      // Add JSON files to ZIP
      zip.file('backup.json', JSON.stringify(backupData, null, 2));
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));

      setProgress(90);
      setProgressMessage('Generating ZIP file...');

      // Generate and download ZIP
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const filename = `mystic-vastra-backup-${new Date().toISOString().split('T')[0]}.zip`;
      saveAs(zipBlob, filename);

      setProgress(100);
      setProgressMessage('Complete!');

      toast({
        title: 'Backup Downloaded',
        description: `Backup saved with ${Object.keys(imageMapping).length} images`,
      });
    } catch (error) {
      console.error('Error downloading backup:', error);
      toast({
        title: 'Backup Failed',
        description: error instanceof Error ? error.message : 'Failed to create backup',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
      setProgress(0);
      setProgressMessage('');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setParsing(true);
      const preview = await parseBackupZip(file);
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
    setProgress(0);
    setProgressMessage('Reading backup file...');

    try {
      const zip = await JSZip.loadAsync(selectedFile);
      
      // Parse backup data
      const backupJsonFile = zip.file('backup.json');
      if (!backupJsonFile) throw new Error('Missing backup.json');
      
      const backupText = await backupJsonFile.async('text');
      const backupData: BackupData = JSON.parse(backupText);

      setProgress(10);
      setProgressMessage('Clearing existing data...');

      // Clear existing data in correct order (child tables first)
      await supabase.from('stock_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('raw_material_deductions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('materials').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('material_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('units').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('parties').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      setProgress(20);
      setProgressMessage('Restoring images...');

      // Upload images and create new URL mapping
      const newImageMapping: Record<string, string> = {};
      const imageEntries = Object.entries(backupData.image_mapping || {});
      
      for (let i = 0; i < imageEntries.length; i++) {
        const [originalUrl, filename] = imageEntries[i];
        const imageFile = zip.file(`images/${filename}`);
        
        if (imageFile) {
          setProgressMessage(`Uploading image ${i + 1}/${imageEntries.length}...`);
          
          const imageBlob = await imageFile.async('blob');
          const newFilename = `${Date.now()}_${filename}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('materials')
            .upload(newFilename, imageBlob, {
              contentType: imageBlob.type || 'image/jpeg',
              upsert: true,
            });

          if (!uploadError && uploadData) {
            const { data: urlData } = supabase.storage
              .from('materials')
              .getPublicUrl(uploadData.path);
            
            newImageMapping[originalUrl] = urlData.publicUrl;
          }
        }
        setProgress(20 + Math.floor(((i + 1) / imageEntries.length) * 30));
      }

      setProgress(50);
      setProgressMessage('Restoring database records...');

      // Update material image URLs with new storage URLs
      const materialsWithNewUrls = backupData.materials.map((material) => ({
        ...material,
        image_url: material.image_url ? newImageMapping[material.image_url] || null : null,
      }));

      // Restore data in correct order (parent tables first)
      // 1. Parties
      if (backupData.parties.length > 0) {
        setProgressMessage('Restoring parties...');
        const { error } = await supabase.from('parties').insert(backupData.parties);
        if (error) throw new Error(`Failed to restore parties: ${error.message}`);
      }

      setProgress(55);

      // 2. Material Categories
      if (backupData.material_categories.length > 0) {
        setProgressMessage('Restoring categories...');
        const { error } = await supabase.from('material_categories').insert(backupData.material_categories);
        if (error) throw new Error(`Failed to restore categories: ${error.message}`);
      }

      setProgress(60);

      // 3. Units
      if (backupData.units.length > 0) {
        setProgressMessage('Restoring units...');
        const { error } = await supabase.from('units').insert(backupData.units);
        if (error) throw new Error(`Failed to restore units: ${error.message}`);
      }

      setProgress(65);

      // 4. Materials (with updated image URLs)
      if (materialsWithNewUrls.length > 0) {
        setProgressMessage('Restoring materials...');
        const { error } = await supabase.from('materials').insert(materialsWithNewUrls);
        if (error) throw new Error(`Failed to restore materials: ${error.message}`);
      }

      setProgress(70);

      // 5. Orders
      if (backupData.orders.length > 0) {
        setProgressMessage('Restoring orders...');
        const { error } = await supabase.from('orders').insert(backupData.orders);
        if (error) throw new Error(`Failed to restore orders: ${error.message}`);
      }

      setProgress(80);

      // 6. Order Items
      if (backupData.order_items.length > 0) {
        setProgressMessage('Restoring order items...');
        const { error } = await supabase.from('order_items').insert(backupData.order_items);
        if (error) throw new Error(`Failed to restore order items: ${error.message}`);
      }

      setProgress(85);

      // 7. Raw Material Deductions
      if (backupData.raw_material_deductions.length > 0) {
        setProgressMessage('Restoring deductions...');
        const { error } = await supabase.from('raw_material_deductions').insert(backupData.raw_material_deductions);
        if (error) throw new Error(`Failed to restore deductions: ${error.message}`);
      }

      setProgress(90);

      // 8. Stock Transactions
      if (backupData.stock_transactions.length > 0) {
        setProgressMessage('Restoring stock transactions...');
        const { error } = await supabase.from('stock_transactions').insert(backupData.stock_transactions);
        if (error) throw new Error(`Failed to restore stock transactions: ${error.message}`);
      }

      setProgress(100);
      setProgressMessage('Restore complete!');

      toast({
        title: 'Restore Complete',
        description: 'All data and images have been restored successfully',
      });

      clearSelection();
    } catch (error) {
      console.error('Error restoring backup:', error);
      toast({
        title: 'Restore Failed',
        description: error instanceof Error ? error.message : 'Failed to restore backup. No partial data was saved.',
        variant: 'destructive',
      });
    } finally {
      setRestoring(false);
      setProgress(0);
      setProgressMessage('');
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
            Create a complete backup including all data and images
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Download Backup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Archive className="h-5 w-5 text-primary" />
                Download Full Backup
              </CardTitle>
              <CardDescription>
                Export all data and images as a portable ZIP file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>All orders, parties & inventory</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Material images included</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Stock transactions & history</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Cross-account compatible</span>
                </div>
              </div>

              {downloading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{progressMessage}</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              <Button
                onClick={handleDownloadBackup}
                disabled={downloading}
                className="w-full gradient-primary border-0"
              >
                {downloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Backup...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download Full Backup (ZIP)
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
                Upload a backup ZIP file to restore data & images
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive">Warning</p>
                    <p className="text-muted-foreground">
                      Restoring will replace all existing data. Download a backup first.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="backup-file">Select Backup ZIP File</Label>
                <Input
                  id="backup-file"
                  type="file"
                  accept=".zip"
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
                  {backupPreview.metadata && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        Version: {backupPreview.metadata.version}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <History className="h-3.5 w-3.5" />
                        {formatDate(backupPreview.metadata.exported_at)}
                      </div>
                    </div>
                  )}

                  {/* Counts */}
                  {backupPreview.metadata && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        <span>{backupPreview.metadata.record_counts.parties} Parties</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                        <span>{backupPreview.metadata.record_counts.orders} Orders</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-primary" />
                        <span>{backupPreview.metadata.record_counts.materials} Materials</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        <span>{backupPreview.metadata.record_counts.material_categories} Categories</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        <span>{backupPreview.metadata.record_counts.order_items} Order Items</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Scissors className="h-3.5 w-3.5 text-primary" />
                        <span>{backupPreview.metadata.record_counts.raw_material_deductions} Deductions</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-primary" />
                        <span>{backupPreview.metadata.record_counts.stock_transactions} Transactions</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5 text-primary" />
                        <span>{backupPreview.imageCount} Images</span>
                      </div>
                    </div>
                  )}

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

              {/* Progress during restore */}
              {restoring && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{progressMessage}</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
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
                    <AlertDialogTitle>Confirm Full Restore</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>This will delete all existing data and replace it with the backup. All images will be re-uploaded. This action cannot be undone.</p>
                      {backupPreview?.metadata && (
                        <div className="mt-3 p-3 bg-muted rounded-md text-sm">
                          <p className="font-medium mb-2">You are about to restore:</p>
                          <ul className="space-y-1">
                            <li>• {backupPreview.metadata.record_counts.parties} parties</li>
                            <li>• {backupPreview.metadata.record_counts.orders} orders with {backupPreview.metadata.record_counts.order_items} items</li>
                            <li>• {backupPreview.metadata.record_counts.materials} materials in {backupPreview.metadata.record_counts.material_categories} categories</li>
                            <li>• {backupPreview.metadata.record_counts.raw_material_deductions} raw material deductions</li>
                            <li>• {backupPreview.metadata.record_counts.stock_transactions} stock transactions</li>
                            <li>• {backupPreview.imageCount} material images</li>
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
                      Yes, Restore Everything
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
              <li>• Backup files are self-contained ZIP archives with all data and images</li>
              <li>• Backups can be restored to any account or new project</li>
              <li>• Store backup files safely (Google Drive, Dropbox, etc.)</li>
              <li>• Regular backups protect against accidental data loss</li>
              <li>• Large image collections may take longer to backup/restore</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

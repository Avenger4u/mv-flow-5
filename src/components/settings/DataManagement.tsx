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
      // First, clear existing demo-like data to avoid conflicts
      // Delete in correct order to respect foreign keys
      await supabase.from('raw_material_deductions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('stock_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('materials').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('material_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('parties').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('order_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Create sample parties
      const { data: parties, error: partiesError } = await supabase
        .from('parties')
        .insert([
          { name: 'Sharma Textiles', prefix: 'ST', address: 'Karol Bagh, Delhi', phone: '9876543210', email: 'sharma@example.com' },
          { name: 'Gupta Garments', prefix: 'GG', address: 'Chandni Chowk, Delhi', phone: '9876543211', email: 'gupta@example.com' },
          { name: 'Agarwal Fabrics', prefix: 'AF', address: 'Sadar Bazaar, Delhi', phone: '9876543212', email: 'agarwal@example.com' },
          { name: 'Jain Brothers', prefix: 'JB', address: 'Mathura Road, Delhi', phone: '9876543213' },
          { name: 'Bansal Trading Co', prefix: 'BT', address: 'Agra Highway, Mathura', phone: '9876543214' },
        ])
        .select();

      if (partiesError) throw partiesError;

      // Create sample material categories
      const { data: categories, error: categoriesError } = await supabase
        .from('material_categories')
        .insert([
          { name: 'Fabrics' },
          { name: 'Threads' },
          { name: 'Buttons' },
          { name: 'Zippers' },
          { name: 'Laces' },
        ])
        .select();

      if (categoriesError) throw categoriesError;

      // Create sample materials
      const { data: materials, error: materialsError } = await supabase
        .from('materials')
        .insert([
          { name: 'Cotton White', category_id: categories[0].id, unit: 'Mtr', rate: 120, opening_stock: 500, current_stock: 500, min_stock: 50 },
          { name: 'Silk Red', category_id: categories[0].id, unit: 'Mtr', rate: 350, opening_stock: 200, current_stock: 200, min_stock: 30 },
          { name: 'Polyester Blue', category_id: categories[0].id, unit: 'Mtr', rate: 80, opening_stock: 300, current_stock: 300, min_stock: 40 },
          { name: 'Thread Black', category_id: categories[1].id, unit: 'Pcs', rate: 25, opening_stock: 1000, current_stock: 1000, min_stock: 100 },
          { name: 'Thread White', category_id: categories[1].id, unit: 'Pcs', rate: 25, opening_stock: 800, current_stock: 800, min_stock: 100 },
          { name: 'Button Gold', category_id: categories[2].id, unit: 'Pcs', rate: 5, opening_stock: 5000, current_stock: 5000, min_stock: 500 },
          { name: 'Zipper Metal 6in', category_id: categories[3].id, unit: 'Pcs', rate: 15, opening_stock: 200, current_stock: 200, min_stock: 50 },
          { name: 'Lace Border Gold', category_id: categories[4].id, unit: 'Mtr', rate: 45, opening_stock: 150, current_stock: 150, min_stock: 20 },
        ])
        .select();

      if (materialsError) throw materialsError;

      // Create stock transactions for opening stock
      const stockTransactions = materials.map(m => ({
        material_id: m.id,
        transaction_type: 'in',
        quantity: m.opening_stock,
        transaction_date: new Date().toISOString().split('T')[0],
        source_type: 'opening_stock',
        balance_after: m.opening_stock,
        remarks: 'Opening stock entry (Demo)',
      }));

      const { error: stockTxError } = await supabase
        .from('stock_transactions')
        .insert(stockTransactions);

      if (stockTxError) throw stockTxError;

      // Create sample orders for first two parties
      if (parties && parties.length >= 2) {
        // Order 1
        const { data: order1, error: order1Error } = await supabase
          .from('orders')
          .insert({
            order_number: `${parties[0].prefix}/001`,
            party_id: parties[0].id,
            order_date: new Date().toISOString().split('T')[0],
            subtotal: 15000,
            raw_material_deductions: 2000,
            net_total: 13000,
            status: 'pending',
          })
          .select()
          .single();

        if (order1Error) throw order1Error;

        // Order 1 items
        await supabase.from('order_items').insert([
          { order_id: order1.id, serial_no: 1, particular: 'Cotton Kurta - White', quantity: 10, quantity_unit: 'Dzn', rate_per_dzn: 800, total: 8000 },
          { order_id: order1.id, serial_no: 2, particular: 'Silk Dupatta - Red', quantity: 5, quantity_unit: 'Dzn', rate_per_dzn: 1400, total: 7000 },
        ]);

        // Order 1 deductions
        await supabase.from('raw_material_deductions').insert([
          { order_id: order1.id, material_name: 'Cotton White', quantity: 10, rate: 120, amount: 1200 },
          { order_id: order1.id, material_name: 'Thread White', quantity: 32, rate: 25, amount: 800 },
        ]);

        // Update party last_order_number
        await supabase.from('parties').update({ last_order_number: 1 }).eq('id', parties[0].id);

        // Order 2
        const { data: order2, error: order2Error } = await supabase
          .from('orders')
          .insert({
            order_number: `${parties[1].prefix}/001`,
            party_id: parties[1].id,
            order_date: new Date().toISOString().split('T')[0],
            subtotal: 22000,
            raw_material_deductions: 3500,
            net_total: 18500,
            status: 'completed',
          })
          .select()
          .single();

        if (order2Error) throw order2Error;

        // Order 2 items
        await supabase.from('order_items').insert([
          { order_id: order2.id, serial_no: 1, particular: 'Polyester Shirt - Blue', quantity: 15, quantity_unit: 'Dzn', rate_per_dzn: 600, total: 9000 },
          { order_id: order2.id, serial_no: 2, particular: 'Cotton Pant - Black', quantity: 8, quantity_unit: 'Dzn', rate_per_dzn: 1000, total: 8000 },
          { order_id: order2.id, serial_no: 3, particular: 'Jacket - Navy', quantity: 5, quantity_unit: 'Dzn', rate_per_dzn: 1000, total: 5000 },
        ]);

        // Order 2 deductions
        await supabase.from('raw_material_deductions').insert([
          { order_id: order2.id, material_name: 'Polyester Blue', quantity: 20, rate: 80, amount: 1600 },
          { order_id: order2.id, material_name: 'Button Gold', quantity: 200, rate: 5, amount: 1000 },
          { order_id: order2.id, material_name: 'Zipper Metal 6in', quantity: 60, rate: 15, amount: 900 },
        ]);

        // Update party last_order_number
        await supabase.from('parties').update({ last_order_number: 1 }).eq('id', parties[1].id);
      }

      // Add some stock in/out entries
      if (materials && materials.length > 0) {
        await supabase.from('stock_transactions').insert([
          {
            material_id: materials[0].id,
            transaction_type: 'in',
            quantity: 100,
            transaction_date: new Date().toISOString().split('T')[0],
            source_type: 'market_purchase',
            balance_after: 600,
            rate: 115,
            remarks: 'Bulk purchase from local market',
          },
          {
            material_id: materials[3].id,
            transaction_type: 'out',
            quantity: 50,
            transaction_date: new Date().toISOString().split('T')[0],
            reason_type: 'sample',
            balance_after: 950,
            remarks: 'Sample for new customer',
          },
        ]);

        // Update stock for these materials
        await supabase.from('materials').update({ current_stock: 600 }).eq('id', materials[0].id);
        await supabase.from('materials').update({ current_stock: 950 }).eq('id', materials[3].id);
      }

      toast({
        title: 'Demo Data Imported',
        description: 'Sample parties, materials, and orders have been added successfully.',
      });
      setImportDialogOpen(false);
    } catch (error) {
      console.error('Error importing demo data:', error);
      toast({
        title: 'Import Failed',
        description: 'Failed to import demo data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleResetAllData = async () => {
    setResetting(true);
    try {
      // Delete in correct order to respect foreign keys
      // 1. Delete order-related data first
      await supabase.from('raw_material_deductions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 2. Delete stock transactions
      await supabase.from('stock_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 3. Delete materials
      await supabase.from('materials').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 4. Delete material categories
      await supabase.from('material_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 5. Delete parties
      await supabase.from('parties').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // 6. Delete order templates
      await supabase.from('order_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Reset order counter
      await supabase.from('order_counter').update({ current_number: 0 }).eq('id', 1);

      toast({
        title: 'All Data Reset',
        description: 'All orders, parties, inventory, and ledger data have been deleted.',
      });
      setResetDialogOpen(false);
    } catch (error) {
      console.error('Error resetting data:', error);
      toast({
        title: 'Reset Failed',
        description: 'Failed to reset data. Please try again.',
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
            <AlertDialogDescription>
              This will add sample data for testing purposes including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>5 sample parties (Sharma Textiles, Gupta Garments, etc.)</li>
                <li>8 materials with stock (Cotton, Silk, Threads, etc.)</li>
                <li>5 material categories</li>
                <li>2 sample orders with items and deductions</li>
                <li>Sample stock transactions</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={importing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleImportDemoData}
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
            <AlertDialogDescription className="space-y-2">
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
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetAllData}
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

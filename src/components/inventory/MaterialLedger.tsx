import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ArrowDownCircle, ArrowUpCircle, History, X } from 'lucide-react';

interface Material {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
}

interface StockTransaction {
  id: string;
  material_id: string;
  transaction_type: string;
  quantity: number;
  order_id: string | null;
  order_number: string | null;
  remarks: string | null;
  created_at: string;
}

interface MaterialLedgerProps {
  material: Material;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStockUpdated: () => void;
}

export function MaterialLedger({ material, open, onOpenChange, onStockUpdated }: MaterialLedgerProps) {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockAction, setStockAction] = useState<'add' | 'reduce'>('add');
  const [stockQuantity, setStockQuantity] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && material) {
      fetchTransactions();
    }
  }, [open, material]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_transactions')
        .select('*')
        .eq('material_id', material.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load stock history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStockUpdate = async () => {
    if (!stockQuantity) {
      toast({
        title: 'Error',
        description: 'Please enter a quantity',
        variant: 'destructive',
      });
      return;
    }

    const qty = parseFloat(stockQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid quantity',
        variant: 'destructive',
      });
      return;
    }

    const newStock = stockAction === 'add' 
      ? material.current_stock + qty 
      : material.current_stock - qty;

    if (newStock < 0) {
      toast({
        title: 'Error',
        description: 'Stock cannot be negative',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      // Update material stock
      const { error: updateError } = await supabase
        .from('materials')
        .update({ current_stock: newStock })
        .eq('id', material.id);

      if (updateError) throw updateError;

      // Add transaction record
      const { error: transactionError } = await supabase
        .from('stock_transactions')
        .insert({
          material_id: material.id,
          transaction_type: stockAction,
          quantity: qty,
          remarks: remarks.trim() || null,
        });

      if (transactionError) throw transactionError;

      toast({
        title: 'Success',
        description: `Stock ${stockAction === 'add' ? 'added' : 'reduced'} successfully`,
      });

      setStockQuantity('');
      setRemarks('');
      fetchTransactions();
      onStockUpdated();
    } catch (error) {
      console.error('Error updating stock:', error);
      toast({
        title: 'Error',
        description: 'Failed to update stock',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Calculate running balance
  const transactionsWithBalance = [...transactions].reverse().reduce((acc, tx, index) => {
    const prevBalance = index === 0 ? 0 : acc[index - 1].balance;
    const balance = tx.transaction_type === 'add' 
      ? prevBalance + tx.quantity 
      : prevBalance - tx.quantity;
    acc.push({ ...tx, balance });
    return acc;
  }, [] as (StockTransaction & { balance: number })[]).reverse();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Material Ledger: {material.name}
          </DialogTitle>
          <DialogDescription>
            Current Stock: <span className="font-semibold text-foreground">{material.current_stock} {material.unit}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Add/Reduce Stock Form */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={stockAction} onValueChange={(v) => setStockAction(v as 'add' | 'reduce')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">
                    <div className="flex items-center gap-2">
                      <ArrowDownCircle className="h-4 w-4 text-green-500" />
                      Stock In
                    </div>
                  </SelectItem>
                  <SelectItem value="reduce">
                    <div className="flex items-center gap-2">
                      <ArrowUpCircle className="h-4 w-4 text-red-500" />
                      Stock Out
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity ({material.unit})</Label>
              <Input
                type="number"
                step="0.01"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                placeholder="Enter quantity"
              />
            </div>
            <div className="space-y-2">
              <Label>Remarks (Optional)</Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g., Purchase, Return"
              />
            </div>
            <Button onClick={handleStockUpdate} disabled={saving} className="gradient-primary border-0">
              {saving ? 'Saving...' : 'Update Stock'}
            </Button>
          </div>
        </div>

        {/* Transaction History */}
        <div className="flex-1 overflow-auto mt-4">
          <div className="text-sm font-medium mb-2 text-muted-foreground">Stock History</div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No stock transactions yet.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactionsWithBalance.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">
                        {format(new Date(tx.created_at), 'dd MMM yyyy, hh:mm a')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tx.transaction_type === 'add' ? 'default' : 'destructive'}>
                          {tx.transaction_type === 'add' ? (
                            <span className="flex items-center gap-1">
                              <ArrowDownCircle className="h-3 w-3" /> IN
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <ArrowUpCircle className="h-3 w-3" /> OUT
                            </span>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        tx.transaction_type === 'add' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.transaction_type === 'add' ? '+' : '-'}{tx.quantity}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {tx.balance.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {tx.order_number ? (
                          <span className="text-primary font-medium">{tx.order_number}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                        {tx.remarks || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ArrowDownCircle, ArrowUpCircle, History, Download, Calendar, Pencil, Loader2 } from 'lucide-react';

interface Material {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  opening_stock?: number;
}

interface StockTransaction {
  id: string;
  material_id: string;
  transaction_type: string;
  quantity: number;
  transaction_date: string;
  source_type: string | null;
  reason_type: string | null;
  party_id: string | null;
  order_id: string | null;
  order_number: string | null;
  rate: number | null;
  remarks: string | null;
  balance_after: number | null;
  created_at: string;
  parties?: { name: string } | null;
}

interface MaterialLedgerProps {
  material: Material;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStockUpdated: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
  market_purchase: 'Market Purchase',
  party_supply: 'Party Supply',
  other_supplier: 'Other Supplier',
  return: 'Return',
  adjustment: 'Adjustment',
  opening_stock: 'Opening Stock',
};

const REASON_LABELS: Record<string, string> = {
  used_in_order: 'Used in Order',
  wastage: 'Wastage',
  sample: 'Sample',
  damage: 'Damage',
  returned: 'Returned',
  adjustment: 'Adjustment',
};

export function MaterialLedger({ material, open, onOpenChange, onStockUpdated }: MaterialLedgerProps) {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [editOpeningStockDialogOpen, setEditOpeningStockDialogOpen] = useState(false);
  const [newOpeningStock, setNewOpeningStock] = useState('');
  const [savingOpeningStock, setSavingOpeningStock] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && material) {
      fetchTransactions();
    }
  }, [open, material, startDate, endDate]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_transactions')
        .select('*, parties(name)')
        .eq('material_id', material.id)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true });

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

  // Helper to check transaction type - handles both 'add'/'in' and 'reduce'/'out' conventions
  const isStockIn = (type: string) => type === 'add' || type === 'in';
  const isStockOut = (type: string) => type === 'reduce' || type === 'out';

  // Calculate running balance from opening stock
  const transactionsWithBalance = transactions.reduce((acc, tx, index) => {
    const prevBalance = index === 0 ? (material.opening_stock || 0) : acc[index - 1].balance;
    const balance = isStockIn(tx.transaction_type) 
      ? prevBalance + tx.quantity 
      : prevBalance - tx.quantity;
    acc.push({ ...tx, balance });
    return acc;
  }, [] as (StockTransaction & { balance: number })[]);

  const totalIn = transactions.filter(tx => isStockIn(tx.transaction_type)).reduce((sum, tx) => sum + tx.quantity, 0);
  const totalOut = transactions.filter(tx => isStockOut(tx.transaction_type)).reduce((sum, tx) => sum + tx.quantity, 0);

  const exportToCSV = () => {
    let csvContent = 'Date,Type,In,Out,Balance,Source/Reason,Party,Order No,Remarks\n';
    transactionsWithBalance.forEach((tx) => {
      csvContent += `${tx.transaction_date},${isStockIn(tx.transaction_type) ? 'IN' : 'OUT'},`;
      csvContent += `${isStockIn(tx.transaction_type) ? tx.quantity : ''},`;
      csvContent += `${isStockOut(tx.transaction_type) ? tx.quantity : ''},`;
      csvContent += `${tx.balance},`;
      csvContent += `"${tx.source_type ? SOURCE_LABELS[tx.source_type] : tx.reason_type ? REASON_LABELS[tx.reason_type] : ''}",`;
      csvContent += `"${tx.parties?.name || ''}",`;
      csvContent += `"${tx.order_number || ''}",`;
      csvContent += `"${tx.remarks || ''}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${material.name}-ledger-${startDate}-to-${endDate}.csv`;
    link.click();

    toast({
      title: 'Export Complete',
      description: 'Ledger exported successfully',
    });
  };

  const handleOpenEditOpeningStock = () => {
    setNewOpeningStock((material.opening_stock || 0).toString());
    setEditOpeningStockDialogOpen(true);
  };

  const handleSaveOpeningStock = async () => {
    const newValue = parseFloat(newOpeningStock);
    if (isNaN(newValue) || newValue < 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid opening stock value',
        variant: 'destructive',
      });
      return;
    }

    setSavingOpeningStock(true);
    try {
      const oldOpeningStock = material.opening_stock || 0;
      const stockDifference = newValue - oldOpeningStock;

      // Update the material's opening_stock and adjust current_stock accordingly
      const newCurrentStock = material.current_stock + stockDifference;

      const { error: updateError } = await supabase
        .from('materials')
        .update({
          opening_stock: newValue,
          current_stock: newCurrentStock,
        })
        .eq('id', material.id);

      if (updateError) throw updateError;

      // Check if there's already an opening_stock transaction for this material
      const { data: existingOpeningTx } = await supabase
        .from('stock_transactions')
        .select('id, quantity')
        .eq('material_id', material.id)
        .eq('source_type', 'opening_stock')
        .maybeSingle();

      if (existingOpeningTx) {
        // Update existing opening stock transaction
        await supabase
          .from('stock_transactions')
          .update({
            quantity: newValue,
            balance_after: newValue,
            remarks: `Opening stock updated from ${oldOpeningStock} to ${newValue}`,
          })
          .eq('id', existingOpeningTx.id);
      } else if (newValue > 0) {
        // Create new opening stock transaction
        await supabase.from('stock_transactions').insert({
          material_id: material.id,
          transaction_type: 'in',
          quantity: newValue,
          transaction_date: new Date().toISOString().split('T')[0],
          source_type: 'opening_stock',
          balance_after: newValue,
          remarks: 'Opening stock entry',
        });
      }

      toast({
        title: 'Success',
        description: 'Opening stock updated successfully',
      });

      setEditOpeningStockDialogOpen(false);
      fetchTransactions();
      onStockUpdated();
    } catch (error) {
      console.error('Error updating opening stock:', error);
      toast({
        title: 'Error',
        description: 'Failed to update opening stock',
        variant: 'destructive',
      });
    } finally {
      setSavingOpeningStock(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-1">
          <DialogTitle className="font-display flex items-center gap-2 text-base sm:text-lg">
            <History className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
            <span className="truncate">{material.name}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
            <span>Current: <span className="font-semibold text-foreground">{material.current_stock} {material.unit}</span></span>
            <span className="text-muted-foreground hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              Opening: <span className="font-semibold">{material.opening_stock || 0} {material.unit}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={handleOpenEditOpeningStock}
                title="Edit Opening Stock"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Edit Opening Stock Dialog */}
        <Dialog open={editOpeningStockDialogOpen} onOpenChange={setEditOpeningStockDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-base sm:text-lg">Edit Opening Stock</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Update the opening stock for {material.name}. This will adjust the current stock accordingly.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="opening-stock">Opening Stock ({material.unit})</Label>
                <Input
                  id="opening-stock"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newOpeningStock}
                  onChange={(e) => setNewOpeningStock(e.target.value)}
                  placeholder="Enter opening stock"
                />
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-xs sm:text-sm space-y-1">
                <p><span className="text-muted-foreground">Current Opening Stock:</span> {material.opening_stock || 0} {material.unit}</p>
                <p><span className="text-muted-foreground">Current Stock:</span> {material.current_stock} {material.unit}</p>
                {newOpeningStock && !isNaN(parseFloat(newOpeningStock)) && (
                  <>
                    <hr className="my-2 border-border" />
                    <p className="font-medium">
                      <span className="text-muted-foreground">New Current Stock:</span>{' '}
                      {(material.current_stock + (parseFloat(newOpeningStock) - (material.opening_stock || 0))).toFixed(2)} {material.unit}
                    </p>
                  </>
                )}
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setEditOpeningStockDialogOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={handleSaveOpeningStock} disabled={savingOpeningStock} className="gradient-primary border-0 w-full sm:w-auto">
                {savingOpeningStock ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Date Filters */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 p-3 sm:p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs sm:text-sm font-medium">Date Range:</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Label htmlFor="ledger-start" className="sr-only">Start Date</Label>
            <Input
              id="ledger-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full sm:w-auto text-sm"
            />
            <span className="hidden sm:inline text-muted-foreground">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full sm:w-auto text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV} className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Total In</p>
            <p className="text-sm sm:text-lg font-bold text-green-600">+{totalIn}</p>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Total Out</p>
            <p className="text-sm sm:text-lg font-bold text-red-600">-{totalOut}</p>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Net Change</p>
            <p className={`text-sm sm:text-lg font-bold ${totalIn - totalOut >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalIn - totalOut >= 0 ? '+' : ''}{totalIn - totalOut}
            </p>
          </div>
        </div>

        {/* Transaction History */}
        <div className="flex-1 overflow-auto mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No stock transactions for this period.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs text-right text-green-600">In</TableHead>
                      <TableHead className="text-xs text-right text-red-600">Out</TableHead>
                      <TableHead className="text-xs text-right">Balance</TableHead>
                      <TableHead className="text-xs">Source/Reason</TableHead>
                      <TableHead className="text-xs">Party</TableHead>
                      <TableHead className="text-xs">Order</TableHead>
                      <TableHead className="text-xs">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Opening Balance Row */}
                    <TableRow className="bg-muted/30">
                      <TableCell className="font-medium text-xs">{startDate}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">OPENING</Badge>
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-bold text-xs">{material.opening_stock || 0}</TableCell>
                      <TableCell colSpan={4} className="text-muted-foreground text-xs">Opening Balance</TableCell>
                    </TableRow>
                    {transactionsWithBalance.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {format(new Date(tx.transaction_date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isStockIn(tx.transaction_type) ? 'default' : 'destructive'} className="text-xs">
                            {isStockIn(tx.transaction_type) ? (
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
                        <TableCell className="text-right text-green-600 font-medium text-xs">
                          {isStockIn(tx.transaction_type) ? `+${tx.quantity}` : ''}
                        </TableCell>
                        <TableCell className="text-right text-red-600 font-medium text-xs">
                          {isStockOut(tx.transaction_type) ? `-${tx.quantity}` : ''}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs">
                          {tx.balance.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {tx.source_type
                            ? SOURCE_LABELS[tx.source_type]
                            : tx.reason_type
                            ? REASON_LABELS[tx.reason_type]
                            : '—'}
                        </TableCell>
                        <TableCell className="text-xs">{tx.parties?.name || '—'}</TableCell>
                        <TableCell className="text-xs">{tx.order_number || '—'}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs">{tx.remarks || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-2">
                {/* Opening Balance Card */}
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <div className="flex justify-between items-center">
                    <div>
                      <Badge variant="outline" className="text-xs mb-1">OPENING</Badge>
                      <p className="text-xs text-muted-foreground">{startDate}</p>
                    </div>
                    <p className="font-bold">{material.opening_stock || 0} {material.unit}</p>
                  </div>
                </div>
                {transactionsWithBalance.map((tx) => (
                  <div key={tx.id} className={`p-3 rounded-lg border ${isStockIn(tx.transaction_type) ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={isStockIn(tx.transaction_type) ? 'default' : 'destructive'} className="text-xs">
                            {isStockIn(tx.transaction_type) ? 'IN' : 'OUT'}
                          </Badge>
                          <span className={`font-bold text-sm ${isStockIn(tx.transaction_type) ? 'text-green-600' : 'text-red-600'}`}>
                            {isStockIn(tx.transaction_type) ? '+' : '-'}{tx.quantity}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tx.transaction_date), 'dd MMM yyyy')}
                        </p>
                        <p className="text-xs truncate">
                          {tx.source_type
                            ? SOURCE_LABELS[tx.source_type]
                            : tx.reason_type
                            ? REASON_LABELS[tx.reason_type]
                            : tx.order_number || '—'}
                        </p>
                        {tx.remarks && <p className="text-xs text-muted-foreground truncate">{tx.remarks}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className="font-bold text-sm">{tx.balance.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

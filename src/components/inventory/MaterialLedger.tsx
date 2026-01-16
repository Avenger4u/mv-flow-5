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
import { ArrowDownCircle, ArrowUpCircle, History, Download, Calendar } from 'lucide-react';

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

  // Calculate running balance from opening stock
  const transactionsWithBalance = transactions.reduce((acc, tx, index) => {
    const prevBalance = index === 0 ? (material.opening_stock || 0) : acc[index - 1].balance;
    const balance = tx.transaction_type === 'add' 
      ? prevBalance + tx.quantity 
      : prevBalance - tx.quantity;
    acc.push({ ...tx, balance });
    return acc;
  }, [] as (StockTransaction & { balance: number })[]);

  const totalIn = transactions.filter(tx => tx.transaction_type === 'add').reduce((sum, tx) => sum + tx.quantity, 0);
  const totalOut = transactions.filter(tx => tx.transaction_type === 'reduce').reduce((sum, tx) => sum + tx.quantity, 0);

  const exportToCSV = () => {
    let csvContent = 'Date,Type,In,Out,Balance,Source/Reason,Party,Order No,Remarks\n';
    transactionsWithBalance.forEach((tx) => {
      csvContent += `${tx.transaction_date},${tx.transaction_type === 'add' ? 'IN' : 'OUT'},`;
      csvContent += `${tx.transaction_type === 'add' ? tx.quantity : ''},`;
      csvContent += `${tx.transaction_type === 'reduce' ? tx.quantity : ''},`;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Material Ledger: {material.name}
          </DialogTitle>
          <DialogDescription>
            Current Stock: <span className="font-semibold text-foreground">{material.current_stock} {material.unit}</span>
            {material.opening_stock !== undefined && (
              <span className="ml-4">Opening Stock: <span className="font-semibold">{material.opening_stock} {material.unit}</span></span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Date Filters */}
        <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Date Range:</span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="ledger-start" className="sr-only">Start Date</Label>
            <Input
              id="ledger-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-auto"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-auto"
            />
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
            <p className="text-xs text-muted-foreground">Total In</p>
            <p className="text-lg font-bold text-green-600">+{totalIn}</p>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <p className="text-xs text-muted-foreground">Total Out</p>
            <p className="text-lg font-bold text-red-600">-{totalOut}</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <p className="text-xs text-muted-foreground">Net Change</p>
            <p className={`text-lg font-bold ${totalIn - totalOut >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
            <div className="text-center py-8 text-muted-foreground">
              No stock transactions for this period.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right text-green-600">In</TableHead>
                    <TableHead className="text-right text-red-600">Out</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Source/Reason</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Opening Balance Row */}
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-medium">{startDate}</TableCell>
                    <TableCell>
                      <Badge variant="outline">OPENING</Badge>
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-bold">{material.opening_stock || 0}</TableCell>
                    <TableCell colSpan={4} className="text-muted-foreground">Opening Balance</TableCell>
                  </TableRow>
                  {transactionsWithBalance.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(tx.transaction_date), 'dd MMM yyyy')}
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
                      <TableCell className="text-right text-green-600 font-medium">
                        {tx.transaction_type === 'add' ? `+${tx.quantity}` : ''}
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-medium">
                        {tx.transaction_type === 'reduce' ? `-${tx.quantity}` : ''}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {tx.balance.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {tx.source_type
                          ? SOURCE_LABELS[tx.source_type]
                          : tx.reason_type
                          ? REASON_LABELS[tx.reason_type]
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {tx.parties?.name || '—'}
                      </TableCell>
                      <TableCell>
                        {tx.order_number ? (
                          <span className="text-primary font-medium">{tx.order_number}</span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                        {tx.remarks || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Closing Balance Row */}
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-medium">{endDate}</TableCell>
                    <TableCell>
                      <Badge variant="outline">CLOSING</Badge>
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-bold">+{totalIn}</TableCell>
                    <TableCell className="text-right text-red-600 font-bold">-{totalOut}</TableCell>
                    <TableCell className="text-right font-bold">
                      {transactionsWithBalance.length > 0 
                        ? transactionsWithBalance[transactionsWithBalance.length - 1].balance.toFixed(2)
                        : (material.opening_stock || 0)}
                    </TableCell>
                    <TableCell colSpan={4} className="text-muted-foreground">Closing Balance</TableCell>
                  </TableRow>
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

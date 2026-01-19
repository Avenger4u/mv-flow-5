import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowDownCircle, ArrowUpCircle, Save, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';

interface Material {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  rate: number;
}

interface Party {
  id: string;
  name: string;
}

interface LastEntry {
  type: 'in' | 'out';
  material_id: string;
  quantity: string;
  source_type?: string;
  reason_type?: string;
  party_id?: string;
  rate?: string;
  remarks?: string;
}

const STOCK_IN_SOURCES = [
  { value: 'market_purchase', label: 'Market Purchase' },
  { value: 'party_supply', label: 'Party Supply' },
  { value: 'other_supplier', label: 'Other Supplier' },
  { value: 'return', label: 'Return' },
  { value: 'adjustment', label: 'Adjustment' },
];

const STOCK_OUT_REASONS = [
  { value: 'used_in_order', label: 'Used in Order' },
  { value: 'wastage', label: 'Wastage' },
  { value: 'sample', label: 'Sample' },
  { value: 'damage', label: 'Damage' },
  { value: 'returned', label: 'Returned to Supplier' },
  { value: 'adjustment', label: 'Adjustment' },
];

export default function StockEntry() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastEntry, setLastEntry] = useState<LastEntry | null>(null);
  const { toast } = useToast();

  // Stock In Form State
  const [stockInData, setStockInData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    material_id: '',
    quantity: '',
    source_type: '',
    party_id: '',
    rate: '',
    remarks: '',
  });

  // Stock Out Form State
  const [stockOutData, setStockOutData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    material_id: '',
    quantity: '',
    reason_type: '',
    order_number: '',
    remarks: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [materialsRes, partiesRes] = await Promise.all([
        supabase.from('materials').select('id, name, unit, current_stock, rate').order('name'),
        supabase.from('parties').select('id, name').order('name'),
      ]);

      if (materialsRes.error) throw materialsRes.error;
      if (partiesRes.error) throw partiesRes.error;

      setMaterials(materialsRes.data || []);
      setParties(partiesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRepeatLastEntry = () => {
    if (!lastEntry) {
      toast({
        title: 'No Previous Entry',
        description: 'Make a stock entry first to use the repeat feature',
        variant: 'destructive',
      });
      return;
    }

    if (lastEntry.type === 'in') {
      setStockInData({
        date: format(new Date(), 'yyyy-MM-dd'),
        material_id: lastEntry.material_id,
        quantity: lastEntry.quantity,
        source_type: lastEntry.source_type || '',
        party_id: lastEntry.party_id || '',
        rate: lastEntry.rate || '',
        remarks: lastEntry.remarks || '',
      });
      toast({
        title: 'Entry Repeated',
        description: 'Stock In form has been pre-filled with last entry',
      });
    } else {
      setStockOutData({
        date: format(new Date(), 'yyyy-MM-dd'),
        material_id: lastEntry.material_id,
        quantity: lastEntry.quantity,
        reason_type: lastEntry.reason_type || '',
        order_number: '',
        remarks: lastEntry.remarks || '',
      });
      toast({
        title: 'Entry Repeated',
        description: 'Stock Out form has been pre-filled with last entry',
      });
    }
  };

  const handleStockIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stockInData.material_id || !stockInData.quantity || !stockInData.source_type) {
      toast({
        title: 'Error',
        description: 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (stockInData.source_type === 'party_supply' && !stockInData.party_id) {
      toast({
        title: 'Error',
        description: 'Please select a party for Party Supply',
        variant: 'destructive',
      });
      return;
    }

    const qty = parseFloat(stockInData.quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid quantity',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const material = materials.find((m) => m.id === stockInData.material_id);
      if (!material) throw new Error('Material not found');

      const newStock = material.current_stock + qty;

      // Update material stock
      const { error: updateError } = await supabase
        .from('materials')
        .update({ current_stock: newStock })
        .eq('id', stockInData.material_id);

      if (updateError) throw updateError;

      // Create transaction record with 'in' type for consistency
      const { error: transactionError } = await supabase.from('stock_transactions').insert({
        material_id: stockInData.material_id,
        transaction_type: 'in',
        quantity: qty,
        transaction_date: stockInData.date,
        source_type: stockInData.source_type,
        party_id: stockInData.source_type === 'party_supply' ? stockInData.party_id : null,
        rate: parseFloat(stockInData.rate) || 0,
        remarks: stockInData.remarks.trim() || null,
        balance_after: newStock,
      });

      if (transactionError) throw transactionError;

      // Save as last entry for repeat feature
      setLastEntry({
        type: 'in',
        material_id: stockInData.material_id,
        quantity: stockInData.quantity,
        source_type: stockInData.source_type,
        party_id: stockInData.source_type === 'party_supply' ? stockInData.party_id : undefined,
        rate: stockInData.rate,
        remarks: stockInData.remarks,
      });

      toast({
        title: 'Success',
        description: `Stock added successfully. New balance: ${newStock} ${material.unit}`,
      });

      // Reset form
      setStockInData({
        date: format(new Date(), 'yyyy-MM-dd'),
        material_id: '',
        quantity: '',
        source_type: '',
        party_id: '',
        rate: '',
        remarks: '',
      });

      // Refresh materials
      fetchData();
    } catch (error) {
      console.error('Error adding stock:', error);
      toast({
        title: 'Error',
        description: 'Failed to add stock',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStockOut = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stockOutData.material_id || !stockOutData.quantity || !stockOutData.reason_type) {
      toast({
        title: 'Error',
        description: 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    const qty = parseFloat(stockOutData.quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid quantity',
        variant: 'destructive',
      });
      return;
    }

    const material = materials.find((m) => m.id === stockOutData.material_id);
    if (!material) {
      toast({
        title: 'Error',
        description: 'Material not found',
        variant: 'destructive',
      });
      return;
    }

    if (qty > material.current_stock) {
      toast({
        title: 'Error',
        description: `Insufficient stock. Available: ${material.current_stock} ${material.unit}`,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const newStock = material.current_stock - qty;

      // Update material stock
      const { error: updateError } = await supabase
        .from('materials')
        .update({ current_stock: newStock })
        .eq('id', stockOutData.material_id);

      if (updateError) throw updateError;

      // Create transaction record with 'out' type for consistency
      const { error: transactionError } = await supabase.from('stock_transactions').insert({
        material_id: stockOutData.material_id,
        transaction_type: 'out',
        quantity: qty,
        transaction_date: stockOutData.date,
        reason_type: stockOutData.reason_type,
        order_number: stockOutData.order_number.trim() || null,
        remarks: stockOutData.remarks.trim() || null,
        balance_after: newStock,
      });

      if (transactionError) throw transactionError;

      // Save as last entry for repeat feature
      setLastEntry({
        type: 'out',
        material_id: stockOutData.material_id,
        quantity: stockOutData.quantity,
        reason_type: stockOutData.reason_type,
        remarks: stockOutData.remarks,
      });

      toast({
        title: 'Success',
        description: `Stock reduced successfully. New balance: ${newStock} ${material.unit}`,
      });

      // Reset form
      setStockOutData({
        date: format(new Date(), 'yyyy-MM-dd'),
        material_id: '',
        quantity: '',
        reason_type: '',
        order_number: '',
        remarks: '',
      });

      // Refresh materials
      fetchData();
    } catch (error) {
      console.error('Error reducing stock:', error);
      toast({
        title: 'Error',
        description: 'Failed to reduce stock',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedStockInMaterial = materials.find((m) => m.id === stockInData.material_id);
  const selectedStockOutMaterial = materials.find((m) => m.id === stockOutData.material_id);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground">
              Stock Entry
            </h1>
            <p className="text-sm text-muted-foreground">
              Record stock movements with proper documentation
            </p>
          </div>
          {lastEntry && (
            <Button variant="outline" onClick={handleRepeatLastEntry} size="sm" className="w-full sm:w-auto">
              <RotateCcw className="h-4 w-4 mr-2" />
              Repeat Last Entry
            </Button>
          )}
        </div>

        <Tabs defaultValue="stock-in" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="stock-in" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <ArrowDownCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
              <span>Stock In</span>
            </TabsTrigger>
            <TabsTrigger value="stock-out" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <ArrowUpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
              <span>Stock Out</span>
            </TabsTrigger>
          </TabsList>

          {/* Stock In Tab */}
          <TabsContent value="stock-in">
            <Card>
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <ArrowDownCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  Stock In Entry
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Record incoming stock - purchases, party supplies, returns, etc.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <form onSubmit={handleStockIn} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stockin-date">Date *</Label>
                      <Input
                        id="stockin-date"
                        type="date"
                        value={stockInData.date}
                        onChange={(e) => setStockInData({ ...stockInData, date: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stockin-material">Material *</Label>
                      <Select
                        value={stockInData.material_id}
                        onValueChange={(value) => setStockInData({ ...stockInData, material_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select material" />
                        </SelectTrigger>
                        <SelectContent>
                          {materials.map((material) => (
                            <SelectItem key={material.id} value={material.id}>
                              {material.name} ({material.current_stock} {material.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stockin-qty">
                        Quantity {selectedStockInMaterial && `(${selectedStockInMaterial.unit})`} *
                      </Label>
                      <Input
                        id="stockin-qty"
                        type="number"
                        step="0.01"
                        value={stockInData.quantity}
                        onChange={(e) => setStockInData({ ...stockInData, quantity: e.target.value })}
                        placeholder="Enter quantity"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stockin-source">Source *</Label>
                      <Select
                        value={stockInData.source_type}
                        onValueChange={(value) => setStockInData({ ...stockInData, source_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          {STOCK_IN_SOURCES.map((source) => (
                            <SelectItem key={source.value} value={source.value}>
                              {source.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {stockInData.source_type === 'party_supply' && (
                      <div className="space-y-2">
                        <Label htmlFor="stockin-party">Party *</Label>
                        <Select
                          value={stockInData.party_id}
                          onValueChange={(value) => setStockInData({ ...stockInData, party_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select party" />
                          </SelectTrigger>
                          <SelectContent>
                            {parties.map((party) => (
                              <SelectItem key={party.id} value={party.id}>
                                {party.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="stockin-rate">Rate (₹) (Optional)</Label>
                      <Input
                        id="stockin-rate"
                        type="number"
                        step="0.01"
                        value={stockInData.rate}
                        onChange={(e) => setStockInData({ ...stockInData, rate: e.target.value })}
                        placeholder="Purchase rate"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2 lg:col-span-3">
                      <Label htmlFor="stockin-remarks">Remarks (Optional)</Label>
                      <Textarea
                        id="stockin-remarks"
                        value={stockInData.remarks}
                        onChange={(e) => setStockInData({ ...stockInData, remarks: e.target.value })}
                        placeholder="Additional notes..."
                        rows={2}
                      />
                    </div>
                  </div>

                  {selectedStockInMaterial && stockInData.quantity && (
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Current Stock:</span>{' '}
                        <span className="font-medium">{selectedStockInMaterial.current_stock} {selectedStockInMaterial.unit}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">After Entry:</span>{' '}
                        <span className="font-semibold text-green-600">
                          {(selectedStockInMaterial.current_stock + parseFloat(stockInData.quantity || '0')).toFixed(2)} {selectedStockInMaterial.unit}
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button type="submit" disabled={saving} className="gradient-primary border-0">
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Stock In Entry'}
                    </Button>
                    {lastEntry?.type === 'in' && (
                      <Button type="button" variant="outline" onClick={handleRepeatLastEntry}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Repeat Last
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stock Out Tab */}
          <TabsContent value="stock-out">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpCircle className="h-5 w-5 text-red-500" />
                  Stock Out Entry
                </CardTitle>
                <CardDescription>
                  Record outgoing stock - usage in orders, wastage, samples, etc.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleStockOut} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stockout-date">Date *</Label>
                      <Input
                        id="stockout-date"
                        type="date"
                        value={stockOutData.date}
                        onChange={(e) => setStockOutData({ ...stockOutData, date: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stockout-material">Material *</Label>
                      <Select
                        value={stockOutData.material_id}
                        onValueChange={(value) => setStockOutData({ ...stockOutData, material_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select material" />
                        </SelectTrigger>
                        <SelectContent>
                          {materials.map((material) => (
                            <SelectItem key={material.id} value={material.id}>
                              {material.name} ({material.current_stock} {material.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stockout-qty">
                        Quantity {selectedStockOutMaterial && `(${selectedStockOutMaterial.unit})`} *
                      </Label>
                      <Input
                        id="stockout-qty"
                        type="number"
                        step="0.01"
                        value={stockOutData.quantity}
                        onChange={(e) => setStockOutData({ ...stockOutData, quantity: e.target.value })}
                        placeholder="Enter quantity"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stockout-reason">Reason *</Label>
                      <Select
                        value={stockOutData.reason_type}
                        onValueChange={(value) => setStockOutData({ ...stockOutData, reason_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          {STOCK_OUT_REASONS.map((reason) => (
                            <SelectItem key={reason.value} value={reason.value}>
                              {reason.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {stockOutData.reason_type === 'used_in_order' && (
                      <div className="space-y-2">
                        <Label htmlFor="stockout-order">Order Number</Label>
                        <Input
                          id="stockout-order"
                          value={stockOutData.order_number}
                          onChange={(e) => setStockOutData({ ...stockOutData, order_number: e.target.value })}
                          placeholder="e.g., SG/001"
                        />
                      </div>
                    )}

                    <div className="space-y-2 md:col-span-2 lg:col-span-3">
                      <Label htmlFor="stockout-remarks">Remarks (Optional)</Label>
                      <Textarea
                        id="stockout-remarks"
                        value={stockOutData.remarks}
                        onChange={(e) => setStockOutData({ ...stockOutData, remarks: e.target.value })}
                        placeholder="Additional notes..."
                        rows={2}
                      />
                    </div>
                  </div>

                  {selectedStockOutMaterial && stockOutData.quantity && (
                    <div className={`p-4 rounded-lg border ${
                      parseFloat(stockOutData.quantity) > selectedStockOutMaterial.current_stock
                        ? 'bg-red-500/10 border-red-500/20'
                        : 'bg-orange-500/10 border-orange-500/20'
                    }`}>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Current Stock:</span>{' '}
                        <span className="font-medium">{selectedStockOutMaterial.current_stock} {selectedStockOutMaterial.unit}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">After Entry:</span>{' '}
                        <span className={`font-semibold ${
                          parseFloat(stockOutData.quantity) > selectedStockOutMaterial.current_stock
                            ? 'text-red-600'
                            : 'text-orange-600'
                        }`}>
                          {(selectedStockOutMaterial.current_stock - parseFloat(stockOutData.quantity || '0')).toFixed(2)} {selectedStockOutMaterial.unit}
                          {parseFloat(stockOutData.quantity) > selectedStockOutMaterial.current_stock && ' (Insufficient!)'}
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      disabled={saving}
                      variant="destructive"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Stock Out Entry'}
                    </Button>
                    {lastEntry?.type === 'out' && (
                      <Button type="button" variant="outline" onClick={handleRepeatLastEntry}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Repeat Last
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

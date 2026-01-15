import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, Loader2, ArrowLeft } from 'lucide-react';

interface Party {
  id: string;
  name: string;
}

interface OrderItem {
  id: string;
  particular: string;
  quantity: string;
  quantity_unit: string;
  rate_per_dzn: string;
  total: number;
  isNew?: boolean;
}

interface DeductionItem {
  id: string;
  material_name: string;
  quantity: string;
  rate: string;
  amount: number;
  isNew?: boolean;
}

export default function EditOrder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [partyId, setPartyId] = useState('');

  // Items
  const [items, setItems] = useState<OrderItem[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);

  // Deductions
  const [deductions, setDeductions] = useState<DeductionItem[]>([]);
  const [deletedDeductionIds, setDeletedDeductionIds] = useState<string[]>([]);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      const [partiesRes, orderRes, itemsRes, deductionsRes] = await Promise.all([
        supabase.from('parties').select('id, name').order('name'),
        supabase.from('orders').select('*').eq('id', id).single(),
        supabase.from('order_items').select('*').eq('order_id', id).order('serial_no'),
        supabase.from('raw_material_deductions').select('*').eq('order_id', id),
      ]);

      if (orderRes.error) throw orderRes.error;

      setParties(partiesRes.data || []);
      
      const order = orderRes.data;
      setOrderNumber(order.order_number);
      setOrderDate(order.order_date);
      setPartyId(order.party_id || '');

      setItems(
        (itemsRes.data || []).map((item) => ({
          id: item.id,
          particular: item.particular,
          quantity: item.quantity.toString(),
          quantity_unit: item.quantity_unit,
          rate_per_dzn: item.rate_per_dzn.toString(),
          total: item.total,
        }))
      );

      setDeductions(
        (deductionsRes.data || []).map((d) => ({
          id: d.id,
          material_name: d.material_name,
          quantity: d.quantity.toString(),
          rate: d.rate.toString(),
          amount: d.amount,
        }))
      );
    } catch (error) {
      console.error('Error fetching order:', error);
      toast({
        title: 'Error',
        description: 'Failed to load order',
        variant: 'destructive',
      });
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  const calculateItemTotal = (quantity: string, rate: string): number => {
    const qty = parseFloat(quantity) || 0;
    const r = parseFloat(rate) || 0;
    return qty * r;
  };

  const updateItem = (itemId: string, field: keyof OrderItem, value: string) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== itemId) return item;

        const updated = { ...item, [field]: value };

        if (field === 'quantity' || field === 'rate_per_dzn') {
          updated.total = calculateItemTotal(
            field === 'quantity' ? value : item.quantity,
            field === 'rate_per_dzn' ? value : item.rate_per_dzn
          );
        }

        return updated;
      })
    );
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: `new-${Date.now()}`,
        particular: '',
        quantity: '',
        quantity_unit: 'Dzn',
        rate_per_dzn: '',
        total: 0,
        isNew: true,
      },
    ]);
  };

  const removeItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item && !item.isNew) {
      setDeletedItemIds([...deletedItemIds, itemId]);
    }
    setItems(items.filter((i) => i.id !== itemId));
  };

  const updateDeduction = (deductionId: string, field: keyof DeductionItem, value: string) => {
    setDeductions((prevDeductions) =>
      prevDeductions.map((item) => {
        if (item.id !== deductionId) return item;

        const updated = { ...item, [field]: value };

        if (field === 'quantity' || field === 'rate') {
          const qty = parseFloat(field === 'quantity' ? value : item.quantity) || 0;
          const r = parseFloat(field === 'rate' ? value : item.rate) || 0;
          updated.amount = qty * r;
        }

        return updated;
      })
    );
  };

  const addDeduction = () => {
    setDeductions([
      ...deductions,
      {
        id: `new-${Date.now()}`,
        material_name: '',
        quantity: '',
        rate: '',
        amount: 0,
        isNew: true,
      },
    ]);
  };

  const removeDeduction = (deductionId: string) => {
    const deduction = deductions.find((d) => d.id === deductionId);
    if (deduction && !deduction.isNew) {
      setDeletedDeductionIds([...deletedDeductionIds, deductionId]);
    }
    setDeductions(deductions.filter((d) => d.id !== deductionId));
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalDeductions = deductions.reduce((sum, item) => sum + item.amount, 0);
  const netTotal = subtotal - totalDeductions;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter((item) => item.particular.trim() && item.quantity);
    if (validItems.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one item',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      // Update order
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          order_date: orderDate,
          party_id: partyId || null,
          subtotal: subtotal,
          raw_material_deductions: totalDeductions,
          net_total: netTotal,
        })
        .eq('id', id);

      if (orderError) throw orderError;

      // Delete removed items
      if (deletedItemIds.length > 0) {
        await supabase.from('order_items').delete().in('id', deletedItemIds);
      }

      // Note: Deduction deletion with stock restoration is handled below

      // Update/insert items
      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        const itemData = {
          order_id: id,
          serial_no: i + 1,
          particular: item.particular.trim(),
          quantity: parseFloat(item.quantity),
          quantity_unit: item.quantity_unit,
          rate_per_dzn: parseFloat(item.rate_per_dzn) || 0,
          total: item.total,
        };

        if (item.isNew) {
          await supabase.from('order_items').insert(itemData);
        } else {
          await supabase.from('order_items').update(itemData).eq('id', item.id);
        }
      }

      // Handle deleted deductions - restore stock
      if (deletedDeductionIds.length > 0) {
        // Get deleted deduction details first
        const { data: deletedDeductions } = await supabase
          .from('raw_material_deductions')
          .select('material_name, quantity')
          .in('id', deletedDeductionIds);

        if (deletedDeductions) {
          for (const d of deletedDeductions) {
            const { data: material } = await supabase
              .from('materials')
              .select('id, current_stock')
              .ilike('name', d.material_name)
              .maybeSingle();

            if (material) {
              // Create stock-in transaction to restore stock
              await supabase.from('stock_transactions').insert({
                material_id: material.id,
                transaction_type: 'in',
                quantity: d.quantity,
                order_id: id,
                order_number: orderNumber,
                remarks: `Restored from deleted deduction in order ${orderNumber}`,
              });

              // Update current stock
              await supabase
                .from('materials')
                .update({ current_stock: material.current_stock + d.quantity })
                .eq('id', material.id);
            }
          }
        }

        await supabase.from('raw_material_deductions').delete().in('id', deletedDeductionIds);
      }

      // Update/insert deductions
      const validDeductions = deductions.filter((d) => d.material_name.trim() && d.quantity);
      for (const d of validDeductions) {
        const deductionData = {
          order_id: id,
          material_name: d.material_name.trim(),
          quantity: parseFloat(d.quantity),
          rate: parseFloat(d.rate) || 0,
          amount: d.amount,
        };

        if (d.isNew) {
          await supabase.from('raw_material_deductions').insert(deductionData);

          // Auto-deduct stock for new deduction
          const { data: material } = await supabase
            .from('materials')
            .select('id, current_stock')
            .ilike('name', d.material_name.trim())
            .maybeSingle();

          if (material) {
            await supabase.from('stock_transactions').insert({
              material_id: material.id,
              transaction_type: 'out',
              quantity: parseFloat(d.quantity),
              order_id: id,
              order_number: orderNumber,
              remarks: `Used in order ${orderNumber}`,
            });

            await supabase
              .from('materials')
              .update({ current_stock: material.current_stock - parseFloat(d.quantity) })
              .eq('id', material.id);
          }
        } else {
          await supabase.from('raw_material_deductions').update(deductionData).eq('id', d.id);
        }
      }

      toast({
        title: 'Success',
        description: 'Order updated successfully',
      });

      navigate(`/orders/${id}`);
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: 'Error',
        description: 'Failed to update order',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

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
      <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to={`/orders/${id}`}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
                Edit Order {orderNumber}
              </h1>
              <p className="text-muted-foreground">Modify order details</p>
            </div>
          </div>
          <Button type="submit" disabled={saving} className="gradient-primary border-0">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Order Details</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Order Number</Label>
              <Input value={orderNumber} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Party</Label>
              <Select value={partyId} onValueChange={setPartyId}>
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
          </CardContent>
        </Card>

        {/* Items Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-display">Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 w-12">S.No</th>
                    <th className="text-left py-2 px-2">Particular</th>
                    <th className="text-left py-2 px-2 w-24">Qty</th>
                    <th className="text-left py-2 px-2 w-24">Unit</th>
                    <th className="text-left py-2 px-2 w-28">Rate/Dzn</th>
                    <th className="text-right py-2 px-2 w-28">Total</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-2 px-2">{index + 1}</td>
                      <td className="py-2 px-2">
                        <Input
                          value={item.particular}
                          onChange={(e) => updateItem(item.id, 'particular', e.target.value)}
                          placeholder="Item name"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Select
                          value={item.quantity_unit}
                          onValueChange={(value) => updateItem(item.id, 'quantity_unit', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Dzn">Dzn</SelectItem>
                            <SelectItem value="Pcs">Pcs</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.rate_per_dzn}
                          onChange={(e) => updateItem(item.id, 'rate_per_dzn', e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                      <td className="py-2 px-2 text-right font-medium">
                        {formatCurrency(item.total)}
                      </td>
                      <td className="py-2 px-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Item {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <Input
                    value={item.particular}
                    onChange={(e) => updateItem(item.id, 'particular', e.target.value)}
                    placeholder="Item name"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Unit</Label>
                      <Select
                        value={item.quantity_unit}
                        onValueChange={(value) => updateItem(item.id, 'quantity_unit', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dzn">Dzn</SelectItem>
                          <SelectItem value="Pcs">Pcs</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Rate</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.rate_per_dzn}
                        onChange={(e) => updateItem(item.id, 'rate_per_dzn', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="text-right font-medium">
                    Total: {formatCurrency(item.total)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Deductions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-display">Raw Material Deductions</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addDeduction}>
              <Plus className="h-4 w-4 mr-1" />
              Add Deduction
            </Button>
          </CardHeader>
          <CardContent>
            {deductions.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">
                No deductions added
              </p>
            ) : (
              <div className="space-y-4">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Material Name</th>
                        <th className="text-left py-2 px-2 w-28">Qty</th>
                        <th className="text-left py-2 px-2 w-28">Rate</th>
                        <th className="text-right py-2 px-2 w-28">Amount</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {deductions.map((d) => (
                        <tr key={d.id} className="border-b">
                          <td className="py-2 px-2">
                            <Input
                              value={d.material_name}
                              onChange={(e) =>
                                updateDeduction(d.id, 'material_name', e.target.value)
                              }
                              placeholder="Material name"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={d.quantity}
                              onChange={(e) =>
                                updateDeduction(d.id, 'quantity', e.target.value)
                              }
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={d.rate}
                              onChange={(e) =>
                                updateDeduction(d.id, 'rate', e.target.value)
                              }
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-2 text-right font-medium text-destructive">
                            -{formatCurrency(d.amount)}
                          </td>
                          <td className="py-2 px-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeDeduction(d.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {deductions.map((d) => (
                    <div key={d.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Deduction</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDeduction(d.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <Input
                        value={d.material_name}
                        onChange={(e) =>
                          updateDeduction(d.id, 'material_name', e.target.value)
                        }
                        placeholder="Material name"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Qty</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={d.quantity}
                            onChange={(e) =>
                              updateDeduction(d.id, 'quantity', e.target.value)
                            }
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Rate</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={d.rate}
                            onChange={(e) =>
                              updateDeduction(d.id, 'rate', e.target.value)
                            }
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div className="text-right font-medium text-destructive">
                        Amount: -{formatCurrency(d.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totals */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="space-y-2 max-w-sm ml-auto">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sub Total:</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-destructive">
                <span>Raw Material Deductions:</span>
                <span className="font-medium">-{formatCurrency(totalDeductions)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t text-lg font-bold">
                <span>Net Total:</span>
                <span className="text-primary">{formatCurrency(netTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </AppLayout>
  );
}

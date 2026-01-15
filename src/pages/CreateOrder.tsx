import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Plus, Trash2, Save, Loader2, Hash, Pencil } from 'lucide-react';
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

interface Party {
  id: string;
  name: string;
  prefix: string | null;
  last_order_number: number;
}

interface OrderItem {
  id: string;
  particular: string;
  quantity: string;
  quantity_unit: string;
  rate_per_dzn: string;
  total: number;
}

interface DeductionItem {
  id: string;
  material_name: string;
  quantity: string;
  rate: string;
  amount: number;
}

export default function CreateOrder() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingOrderNumber, setCheckingOrderNumber] = useState(false);

  // Form State
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyId, setPartyId] = useState('');
  const [nextOrderNumber, setNextOrderNumber] = useState<string | null>(null);
  const [customOrderNumber, setCustomOrderNumber] = useState<string>('');
  const [isEditingOrderNumber, setIsEditingOrderNumber] = useState(false);
  const [showOrderNumberConfirm, setShowOrderNumberConfirm] = useState(false);
  const [pendingOrderNumber, setPendingOrderNumber] = useState<string>('');
  const [newPartyName, setNewPartyName] = useState('');
  const [showNewParty, setShowNewParty] = useState(false);

  // Items
  const [items, setItems] = useState<OrderItem[]>([
    { id: '1', particular: '', quantity: '', quantity_unit: 'Dzn', rate_per_dzn: '', total: 0 },
  ]);

  // Deductions
  const [deductions, setDeductions] = useState<DeductionItem[]>([]);

  useEffect(() => {
    fetchParties();
  }, []);

  // Calculate next order number when party changes
  useEffect(() => {
    if (partyId && !showNewParty) {
      const party = parties.find(p => p.id === partyId);
      if (party) {
        const prefix = party.prefix || generatePrefix(party.name);
        const nextNum = party.last_order_number + 1;
        const autoOrderNumber = `${prefix}/${String(nextNum).padStart(3, '0')}`;
        setNextOrderNumber(autoOrderNumber);
        // Reset custom order number when party changes
        if (!customOrderNumber) {
          setCustomOrderNumber('');
        }
      }
    } else if (showNewParty && newPartyName.trim()) {
      const prefix = generatePrefix(newPartyName);
      setNextOrderNumber(`${prefix}/001`);
      setCustomOrderNumber('');
    } else {
      setNextOrderNumber(null);
      setCustomOrderNumber('');
    }
  }, [partyId, parties, showNewParty, newPartyName]);

  const generatePrefix = (name: string): string => {
    const words = name.toUpperCase().split(' ');
    let prefix = '';
    for (const word of words) {
      if (prefix.length < 3 && word.length > 0) {
        prefix += word[0];
      }
    }
    if (prefix.length < 2) {
      prefix = name.toUpperCase().substring(0, 2);
    }
    return prefix;
  };

  const handleEditOrderNumber = () => {
    setPendingOrderNumber(customOrderNumber || nextOrderNumber || '');
    setIsEditingOrderNumber(true);
  };

  const handleOrderNumberChange = (value: string) => {
    setPendingOrderNumber(value.toUpperCase());
  };

  const checkOrderNumberExists = async (orderNumber: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', orderNumber)
      .maybeSingle();
    
    if (error) {
      console.error('Error checking order number:', error);
      return false;
    }
    return !!data;
  };

  const handleSaveOrderNumber = async () => {
    if (!pendingOrderNumber.trim()) return;
    
    setCheckingOrderNumber(true);
    try {
      const exists = await checkOrderNumberExists(pendingOrderNumber.trim());
      if (exists) {
        toast({
          title: 'Order Number Already Exists',
          description: `The order number "${pendingOrderNumber.trim()}" is already in use. Please choose a different one.`,
          variant: 'destructive',
        });
        return;
      }
      setShowOrderNumberConfirm(true);
    } catch (error) {
      console.error('Error checking order number:', error);
      toast({
        title: 'Error',
        description: 'Failed to validate order number',
        variant: 'destructive',
      });
    } finally {
      setCheckingOrderNumber(false);
    }
  };

  const confirmOrderNumber = () => {
    setCustomOrderNumber(pendingOrderNumber.trim());
    setIsEditingOrderNumber(false);
    setShowOrderNumberConfirm(false);
    toast({
      title: 'Order Number Updated',
      description: `Order number set to ${pendingOrderNumber.trim()}`,
    });
  };

  const cancelEditOrderNumber = () => {
    setIsEditingOrderNumber(false);
    setPendingOrderNumber('');
  };

  const getDisplayOrderNumber = () => {
    return customOrderNumber || nextOrderNumber;
  };

  const fetchParties = async () => {
    try {
      const { data, error } = await supabase
        .from('parties')
        .select('id, name, prefix, last_order_number')
        .order('name');

      if (error) throw error;
      setParties(data || []);
    } catch (error) {
      console.error('Error fetching parties:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateItemTotal = (quantity: string, rate: string): number => {
    const qty = parseFloat(quantity) || 0;
    const r = parseFloat(rate) || 0;
    return qty * r;
  };

  const updateItem = (id: string, field: keyof OrderItem, value: string) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== id) return item;

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
        id: Date.now().toString(),
        particular: '',
        quantity: '',
        quantity_unit: 'Dzn',
        rate_per_dzn: '',
        total: 0,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateDeduction = (id: string, field: keyof DeductionItem, value: string) => {
    setDeductions((prevDeductions) =>
      prevDeductions.map((item) => {
        if (item.id !== id) return item;

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
        id: Date.now().toString(),
        material_name: '',
        quantity: '',
        rate: '',
        amount: 0,
      },
    ]);
  };

  const removeDeduction = (id: string) => {
    setDeductions(deductions.filter((item) => item.id !== id));
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalDeductions = deductions.reduce((sum, item) => sum + item.amount, 0);
  const netTotal = subtotal - totalDeductions;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!partyId && !newPartyName.trim()) {
      toast({
        title: 'Error',
        description: 'Please select or add a party',
        variant: 'destructive',
      });
      return;
    }

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
      let finalPartyId = partyId;

      // Create new party if needed
      if (showNewParty && newPartyName.trim()) {
        const { data: newParty, error: partyError } = await supabase
          .from('parties')
          .insert({ name: newPartyName.trim() })
          .select()
          .single();

        if (partyError) throw partyError;
        finalPartyId = newParty.id;
      }

      // Determine order number - use custom if set, otherwise generate
      let finalOrderNumber: string;
      
      if (customOrderNumber) {
        // Use the custom order number
        finalOrderNumber = customOrderNumber;
      } else {
        // Get next order number for this party
        const { data: orderNumber, error: orderNumberError } = await supabase.rpc('get_party_order_number', {
          p_party_id: finalPartyId
        });

        if (orderNumberError) throw orderNumberError;
        finalOrderNumber = orderNumber;
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: finalOrderNumber,
          party_id: finalPartyId,
          order_date: orderDate,
          subtotal: subtotal,
          raw_material_deductions: totalDeductions,
          net_total: netTotal,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = validItems.map((item, index) => ({
        order_id: order.id,
        serial_no: index + 1,
        particular: item.particular.trim(),
        quantity: parseFloat(item.quantity),
        quantity_unit: item.quantity_unit,
        rate_per_dzn: parseFloat(item.rate_per_dzn) || 0,
        total: item.total,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      // Create deductions if any and auto-deduct stock
      if (deductions.length > 0) {
        const validDeductions = deductions.filter(
          (d) => d.material_name.trim() && d.quantity
        );

        if (validDeductions.length > 0) {
          const deductionItems = validDeductions.map((d) => ({
            order_id: order.id,
            material_name: d.material_name.trim(),
            quantity: parseFloat(d.quantity),
            rate: parseFloat(d.rate) || 0,
            amount: d.amount,
          }));

          const { error: deductionsError } = await supabase
            .from('raw_material_deductions')
            .insert(deductionItems);

          if (deductionsError) throw deductionsError;

          // Auto-deduct stock for each material
          for (const d of validDeductions) {
            const materialName = d.material_name.trim();
            const qty = parseFloat(d.quantity);

            // Find material by name
            const { data: material } = await supabase
              .from('materials')
              .select('id, current_stock')
              .ilike('name', materialName)
              .maybeSingle();

            if (material) {
              // Create stock transaction
              await supabase.from('stock_transactions').insert({
                material_id: material.id,
                transaction_type: 'out',
                quantity: qty,
                order_id: order.id,
                order_number: finalOrderNumber,
                remarks: `Used in order ${finalOrderNumber}`,
              });

              // Update current stock
              await supabase
                .from('materials')
                .update({ current_stock: material.current_stock - qty })
                .eq('id', material.id);
            }
          }
        }
      }

      toast({
        title: 'Success',
        description: `Order ${finalOrderNumber} created successfully`,
      });

      navigate(`/orders/${order.id}`);
    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: 'Error',
        description: 'Failed to create order',
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
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              Create Order
            </h1>
            <p className="text-muted-foreground">Create a new packing list order</p>
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
                Save Order
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
            {/* Order Number Preview */}
            <div className="space-y-2">
              <Label>Order Number</Label>
              {isEditingOrderNumber ? (
                <div className="flex gap-2">
                  <Input
                    value={pendingOrderNumber}
                    onChange={(e) => handleOrderNumberChange(e.target.value)}
                    placeholder="e.g., SG/001"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleSaveOrderNumber}
                    disabled={!pendingOrderNumber.trim() || checkingOrderNumber}
                  >
                    {checkingOrderNumber ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Save'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={cancelEditOrderNumber}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="h-10 px-3 flex items-center justify-between bg-muted rounded-md border">
                  {getDisplayOrderNumber() ? (
                    <>
                      <span className="font-mono font-semibold text-primary flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        {getDisplayOrderNumber()}
                        {customOrderNumber && (
                          <span className="text-xs text-muted-foreground">(custom)</span>
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleEditOrderNumber}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-sm">Select a party</span>
                  )}
                </div>
              )}
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
              {!showNewParty ? (
                <div className="flex gap-2">
                  <Select value={partyId} onValueChange={setPartyId}>
                    <SelectTrigger className="flex-1">
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewParty(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="New party name"
                    value={newPartyName}
                    onChange={(e) => setNewPartyName(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowNewParty(false);
                      setNewPartyName('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
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
                  <div className="text-right font-semibold">
                    Total: {formatCurrency(item.total)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Raw Material Deductions */}
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
              <p className="text-center text-muted-foreground py-4">
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
                        <th className="text-left py-2 px-2 w-24">Qty</th>
                        <th className="text-left py-2 px-2 w-28">Rate</th>
                        <th className="text-right py-2 px-2 w-28">Amount</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {deductions.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="py-2 px-2">
                            <Input
                              value={item.material_name}
                              onChange={(e) =>
                                updateDeduction(item.id, 'material_name', e.target.value)
                              }
                              placeholder="Material name"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) =>
                                updateDeduction(item.id, 'quantity', e.target.value)
                              }
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.rate}
                              onChange={(e) =>
                                updateDeduction(item.id, 'rate', e.target.value)
                              }
                              placeholder="0.00"
                            />
                          </td>
                          <td className="py-2 px-2 text-right font-medium text-destructive">
                            -{formatCurrency(item.amount)}
                          </td>
                          <td className="py-2 px-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeDeduction(item.id)}
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
                  {deductions.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4 space-y-3 border-destructive/30">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-destructive">Deduction</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDeduction(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <Input
                        value={item.material_name}
                        onChange={(e) =>
                          updateDeduction(item.id, 'material_name', e.target.value)
                        }
                        placeholder="Material name"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Qty</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) =>
                              updateDeduction(item.id, 'quantity', e.target.value)
                            }
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Rate</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) =>
                              updateDeduction(item.id, 'rate', e.target.value)
                            }
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div className="text-right font-semibold text-destructive">
                        -{formatCurrency(item.amount)}
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
              {totalDeductions > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Raw Material Deductions:</span>
                  <span className="font-medium">-{formatCurrency(totalDeductions)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t text-lg font-bold">
                <span>Net Total:</span>
                <span className="text-primary">{formatCurrency(netTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Order Number Confirmation Dialog */}
      <AlertDialog open={showOrderNumberConfirm} onOpenChange={setShowOrderNumberConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Custom Order Number</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to use <strong className="text-foreground font-mono">{pendingOrderNumber}</strong> as the order number? 
              This will override the auto-generated number and may cause conflicts if this number already exists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowOrderNumberConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmOrderNumber}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

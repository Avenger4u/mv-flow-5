import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Copy, Package } from 'lucide-react';
import { generateOrderPDF } from '@/lib/pdf-generator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';

interface OrderPreviewCardProps {
  order: {
    id: string;
    order_number: string;
    order_date: string;
    subtotal: number;
    raw_material_deductions?: number;
    net_total: number;
    status: string;
    parties: { name: string } | null;
    party_id?: string | null;
  };
  onDuplicate?: () => void;
}

interface OrderItem {
  serial_no: number;
  particular: string;
  quantity: number;
  quantity_unit: string;
  rate_per_dzn: number;
  total: number;
}

interface Deduction {
  material_name: string;
  quantity: number;
  rate: number;
  amount: number;
}

export function OrderPreviewCard({ order, onDuplicate }: OrderPreviewCardProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [loading, setLoading] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success text-success-foreground text-xs">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-warning text-warning-foreground text-xs">Pending</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const handleViewPDF = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    
    try {
      const [itemsRes, deductionsRes, orderRes] = await Promise.all([
        supabase.from('order_items').select('*').eq('order_id', order.id).order('serial_no'),
        supabase.from('raw_material_deductions').select('*').eq('order_id', order.id),
        supabase.from('orders').select('*, parties(name, address)').eq('id', order.id).single()
      ]);

      if (orderRes.error) throw orderRes.error;

      const fullOrder = {
        ...orderRes.data,
        raw_material_deductions: orderRes.data.raw_material_deductions || 0
      };

      await generateOrderPDF(fullOrder, itemsRes.data || [], deductionsRes.data || []);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDuplicating(true);

    try {
      // Fetch items and deductions
      const [itemsRes, deductionsRes] = await Promise.all([
        supabase.from('order_items').select('*').eq('order_id', order.id),
        supabase.from('raw_material_deductions').select('*').eq('order_id', order.id),
      ]);

      // Generate new order number
      const { data: newOrderNumber } = await supabase.rpc('get_party_order_number', {
        p_party_id: order.party_id,
      });

      // Create new order with today's date
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: newOrderNumber || `DUP-${Date.now()}`,
          order_date: new Date().toISOString().split('T')[0],
          party_id: order.party_id,
          subtotal: order.subtotal,
          raw_material_deductions: order.raw_material_deductions || 0,
          net_total: order.net_total,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Copy items
      if (itemsRes.data && itemsRes.data.length > 0) {
        const newItems = itemsRes.data.map((item) => ({
          order_id: newOrder.id,
          serial_no: item.serial_no,
          particular: item.particular,
          quantity: item.quantity,
          quantity_unit: item.quantity_unit,
          rate_per_dzn: item.rate_per_dzn,
          total: item.total,
        }));
        await supabase.from('order_items').insert(newItems);
      }

      // Copy deductions (without stock deduction - that happens on order completion)
      if (deductionsRes.data && deductionsRes.data.length > 0) {
        const newDeductions = deductionsRes.data.map((d) => ({
          order_id: newOrder.id,
          material_name: d.material_name,
          quantity: d.quantity,
          rate: d.rate,
          amount: d.amount,
        }));
        await supabase.from('raw_material_deductions').insert(newDeductions);
      }

      toast({
        title: 'Order Duplicated',
        description: `New order ${newOrderNumber} created`,
      });

      onDuplicate?.();
      navigate(`/orders/${newOrder.id}`);
    } catch (error) {
      console.error('Error duplicating order:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate order',
        variant: 'destructive',
      });
    } finally {
      setDuplicating(false);
    }
  };

  // Fetch items and deductions for preview on mount
  useEffect(() => {
    const fetchPreviewData = async () => {
      const [itemsRes, deductionsRes] = await Promise.all([
        supabase
          .from('order_items')
          .select('serial_no, particular, quantity, quantity_unit, rate_per_dzn, total')
          .eq('order_id', order.id)
          .order('serial_no')
          .limit(3),
        supabase
          .from('raw_material_deductions')
          .select('material_name, quantity, rate, amount')
          .eq('order_id', order.id)
          .limit(2),
      ]);
      
      if (itemsRes.data) setItems(itemsRes.data);
      if (deductionsRes.data) setDeductions(deductionsRes.data);
    };
    
    fetchPreviewData();
  }, [order.id]);

  return (
    <Card className="hover:shadow-md transition-all duration-200 border-border/50 overflow-hidden">
      <CardContent className="p-0">
        {/* Header - Mimics PDF header */}
        <div className="bg-primary/5 border-b border-primary/20 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <h3 className="font-display font-semibold text-sm truncate">Mystic Vastra</h3>
            </div>
            {getStatusBadge(order.status)}
          </div>
        </div>

        {/* Order Info */}
        <Link to={`/orders/${order.id}`} className="block">
          <div className="px-4 py-3 space-y-3">
            {/* Party & Order Info */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Party:</span>
                <span className="font-medium truncate max-w-[120px]">{order.parties?.name || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Order:</span>
                <span className="font-medium">{order.order_number}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">{formatDate(order.order_date)}</span>
              </div>
            </div>

            {/* Items Preview Table */}
            {items.length > 0 && (
              <div className="bg-muted/30 rounded-md p-2 text-xs">
                <div className="grid grid-cols-12 gap-1 font-medium text-muted-foreground border-b border-border/50 pb-1 mb-1">
                  <div className="col-span-1">S.No</div>
                  <div className="col-span-5">Particular</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Rate</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {items.slice(0, 3).map((item) => (
                  <div key={item.serial_no} className="grid grid-cols-12 gap-1 py-0.5">
                    <div className="col-span-1">{item.serial_no}</div>
                    <div className="col-span-5 truncate">{item.particular}</div>
                    <div className="col-span-2 text-right">{item.quantity}</div>
                    <div className="col-span-2 text-right">{formatCurrency(item.rate_per_dzn)}</div>
                    <div className="col-span-2 text-right font-medium">{formatCurrency(item.total)}</div>
                  </div>
                ))}
                {items.length > 3 && (
                  <div className="text-muted-foreground text-center pt-1">
                    +{items.length - 3} more items...
                  </div>
                )}
              </div>
            )}

            {/* Raw Material Deductions Preview */}
            {(deductions.length > 0 || (order.raw_material_deductions && order.raw_material_deductions > 0)) && (
              <div className="bg-destructive/5 rounded-md p-2 text-xs border border-destructive/10">
                <div className="flex items-center gap-1 font-medium text-destructive/80 mb-1">
                  <Package className="h-3 w-3" />
                  <span>Raw Material Deductions</span>
                </div>
                {deductions.length > 0 ? (
                  <>
                    {deductions.map((d, idx) => (
                      <div key={idx} className="flex justify-between py-0.5 text-muted-foreground">
                        <span className="truncate max-w-[60%]">{d.material_name}</span>
                        <span className="font-medium text-destructive/70">-{formatCurrency(d.amount)}</span>
                      </div>
                    ))}
                    {deductions.length > 2 && (
                      <div className="text-muted-foreground text-center pt-1">
                        +more deductions...
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted-foreground">Total Deductions</span>
                    <span className="font-medium text-destructive/70">-{formatCurrency(order.raw_material_deductions || 0)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Totals */}
            <div className="pt-2 border-t border-border/50 space-y-1">
              {(order.raw_material_deductions && order.raw_material_deductions > 0) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(order.subtotal)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Net Total</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(order.net_total)}</span>
              </div>
            </div>
          </div>
        </Link>

        {/* Action Buttons */}
        <div className="px-4 pb-3 flex gap-2">
          <Button 
            onClick={handleViewPDF}
            disabled={loading}
            className="flex-1 gradient-primary border-0"
            size="sm"
          >
            <FileText className="h-4 w-4 mr-2" />
            {loading ? 'Loading...' : 'View PDF'}
          </Button>
          <Button
            onClick={handleDuplicate}
            disabled={duplicating}
            variant="outline"
            size="sm"
            className="shrink-0"
          >
            <Copy className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only sm:ml-2">
              {duplicating ? 'Copying...' : 'Duplicate'}
            </span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

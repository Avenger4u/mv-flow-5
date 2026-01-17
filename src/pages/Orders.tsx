import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
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
import { Plus, Search, Eye, FileText, Copy, Loader2 } from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  order_date: string;
  subtotal: number;
  net_total: number;
  status: string;
  parties: { name: string } | null;
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, order_date, subtotal, net_total, status, parties(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (orderId: string) => {
    setDuplicating(orderId);
    try {
      // Fetch original order with items and deductions
      const [orderRes, itemsRes, deductionsRes] = await Promise.all([
        supabase.from('orders').select('*').eq('id', orderId).single(),
        supabase.from('order_items').select('*').eq('order_id', orderId).order('serial_no'),
        supabase.from('raw_material_deductions').select('*').eq('order_id', orderId),
      ]);

      if (orderRes.error) throw orderRes.error;

      const originalOrder = orderRes.data;
      const originalItems = itemsRes.data || [];
      const originalDeductions = deductionsRes.data || [];

      // Get new order number for the party
      const { data: newOrderNumber, error: orderNumberError } = await supabase.rpc('get_party_order_number', {
        p_party_id: originalOrder.party_id
      });

      if (orderNumberError) throw orderNumberError;

      // Create new order with today's date
      const { data: newOrder, error: newOrderError } = await supabase
        .from('orders')
        .insert({
          order_number: newOrderNumber,
          party_id: originalOrder.party_id,
          order_date: new Date().toISOString().split('T')[0],
          subtotal: originalOrder.subtotal,
          raw_material_deductions: originalOrder.raw_material_deductions,
          net_total: originalOrder.net_total,
          notes: originalOrder.notes,
          status: 'pending',
        })
        .select()
        .single();

      if (newOrderError) throw newOrderError;

      // Copy order items
      if (originalItems.length > 0) {
        const newItems = originalItems.map((item) => ({
          order_id: newOrder.id,
          serial_no: item.serial_no,
          particular: item.particular,
          quantity: item.quantity,
          quantity_unit: item.quantity_unit,
          rate_per_dzn: item.rate_per_dzn,
          total: item.total,
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(newItems);
        if (itemsError) throw itemsError;
      }

      // Copy deductions and auto-deduct stock
      if (originalDeductions.length > 0) {
        const newDeductions = originalDeductions.map((d) => ({
          order_id: newOrder.id,
          material_name: d.material_name,
          quantity: d.quantity,
          rate: d.rate,
          amount: d.amount,
        }));

        const { error: deductionsError } = await supabase.from('raw_material_deductions').insert(newDeductions);
        if (deductionsError) throw deductionsError;

        // Auto-deduct stock for each material
        for (const d of originalDeductions) {
          const { data: material } = await supabase
            .from('materials')
            .select('id, current_stock')
            .ilike('name', d.material_name)
            .maybeSingle();

          if (material) {
            const newBalance = material.current_stock - d.quantity;
            
            await supabase.from('stock_transactions').insert({
              material_id: material.id,
              transaction_type: 'out',
              quantity: d.quantity,
              rate: d.rate,
              order_id: newOrder.id,
              order_number: newOrderNumber,
              party_id: originalOrder.party_id,
              transaction_date: new Date().toISOString().split('T')[0],
              reason_type: 'used_in_order',
              balance_after: newBalance,
              remarks: `Used in duplicated order ${newOrderNumber} (from ${originalOrder.order_number})`,
            });

            await supabase
              .from('materials')
              .update({ current_stock: newBalance })
              .eq('id', material.id);
          }
        }
      }

      toast({
        title: 'Order Duplicated',
        description: `New order ${newOrderNumber} created successfully`,
      });

      // Navigate to edit the new order
      navigate(`/orders/${newOrder.id}/edit`);
    } catch (error) {
      console.error('Error duplicating order:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate order',
        variant: 'destructive',
      });
    } finally {
      setDuplicating(null);
    }
  };

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
        return <Badge className="bg-success text-success-foreground">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-warning text-warning-foreground">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.parties?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              Orders
            </h1>
            <p className="text-muted-foreground">Manage all your orders and packing lists</p>
          </div>
          <Button asChild className="gradient-primary border-0">
            <Link to="/orders/new">
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== 'all'
                    ? 'No orders found'
                    : 'No orders yet. Create your first order!'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop Table */}
            <Card className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="table-header">
                    <TableHead>Order No.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="table-row-hover">
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{formatDate(order.order_date)}</TableCell>
                      <TableCell>{order.parties?.name || 'Unknown'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(order.net_total)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild title="View Order">
                            <Link to={`/orders/${order.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDuplicate(order.id)}
                            disabled={duplicating === order.id}
                            title="Duplicate Order"
                          >
                            {duplicating === order.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredOrders.map((order) => (
                <Card key={order.id} className="hover:bg-muted/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <Link to={`/orders/${order.id}`} className="flex-1">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{order.order_number}</h3>
                            {getStatusBadge(order.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {order.parties?.name || 'Unknown'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(order.order_date)}
                          </p>
                        </div>
                      </Link>
                      <div className="flex flex-col items-end gap-2">
                        <p className="font-bold text-lg">{formatCurrency(order.net_total)}</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDuplicate(order.id)}
                          disabled={duplicating === order.id}
                        >
                          {duplicating === order.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Copy className="h-3 w-3 mr-1" />
                          )}
                          Duplicate
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Pencil, Trash2, Printer, Download } from 'lucide-react';
import { generateOrderPDF } from '@/lib/pdf-generator';

interface Order {
  id: string;
  order_number: string;
  order_date: string;
  subtotal: number;
  raw_material_deductions: number;
  net_total: number;
  status: string;
  notes: string | null;
  parties: { id: string; name: string; address: string | null } | null;
}

interface OrderItem {
  id: string;
  serial_no: number;
  particular: string;
  quantity: number;
  quantity_unit: string;
  rate_per_dzn: number;
  total: number;
}

interface Deduction {
  id: string;
  material_name: string;
  quantity: number;
  rate: number;
  amount: number;
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const fetchOrder = async () => {
    try {
      const [orderRes, itemsRes, deductionsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*, parties(id, name, address)')
          .eq('id', id)
          .single(),
        supabase
          .from('order_items')
          .select('*')
          .eq('order_id', id)
          .order('serial_no'),
        supabase
          .from('raw_material_deductions')
          .select('*')
          .eq('order_id', id),
      ]);

      if (orderRes.error) throw orderRes.error;

      setOrder(orderRes.data);
      setItems(itemsRes.data || []);
      setDeductions(deductionsRes.data || []);
    } catch (error) {
      console.error('Error fetching order:', error);
      toast({
        title: 'Error',
        description: 'Failed to load order',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (error) throw error;

      setOrder({ ...order, status: newStatus });
      toast({
        title: 'Success',
        description: 'Order status updated',
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!order) return;

    try {
      const { error } = await supabase.from('orders').delete().eq('id', order.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Order deleted successfully',
      });
      navigate('/orders');
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete order',
        variant: 'destructive',
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!order) return;
    
    try {
      await generateOrderPDF(order, items, deductions);
      toast({
        title: 'Success',
        description: 'PDF downloaded successfully',
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
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

  if (!order) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Order not found</p>
          <Button asChild className="mt-4">
            <Link to="/orders">Back to Orders</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link to="/orders">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground truncate">
                {order.order_number}
              </h1>
              <p className="text-sm text-muted-foreground">{formatDate(order.order_date)}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 print:hidden">
            <Select value={order.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button variant="outline" asChild size="sm" className="flex-1 sm:flex-none">
                <Link to={`/orders/${order.id}/edit`}>
                  <Pencil className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Edit</span>
                </Link>
              </Button>

              <Button variant="outline" onClick={handlePrint} size="sm" className="flex-1 sm:flex-none">
                <Printer className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Print</span>
              </Button>

              <Button variant="outline" onClick={handleDownloadPDF} size="sm" className="flex-1 sm:flex-none">
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">PDF</span>
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="flex-1 sm:flex-none">
                    <Trash2 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Order?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete order {order.order_number}. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {/* Printable Content */}
        <div ref={printRef} className="print:p-8">
          {/* Print Header */}
          <div className="hidden print:block text-center mb-8">
            <h1 className="text-2xl font-bold">Mystic Vastra</h1>
            <p className="text-sm">Madhuvan Enclave, Krishna Nagar, Mathura</p>
            <h2 className="text-xl font-semibold mt-4">Packing List</h2>
          </div>

          {/* Order Info */}
          <Card className="print:shadow-none print:border-0">
            <CardContent className="pt-6">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Party Name</p>
                  <p className="font-semibold">{order.parties?.name || 'Unknown'}</p>
                  {order.parties?.address && (
                    <p className="text-sm text-muted-foreground">{order.parties.address}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Order No.</p>
                  <p className="font-semibold">{order.order_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-semibold">{formatDate(order.order_date)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card className="mt-4 sm:mt-6 print:shadow-none print:border-0">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg font-display">Items</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 w-12">S.No</th>
                      <th className="text-left py-2 px-2">Particular</th>
                      <th className="text-right py-2 px-2 w-20">Qty</th>
                      <th className="text-right py-2 px-2 w-24">Rate</th>
                      <th className="text-right py-2 px-2 w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2 px-2">{item.serial_no}</td>
                        <td className="py-2 px-2">{item.particular}</td>
                        <td className="py-2 px-2 text-right whitespace-nowrap">
                          {item.quantity} {item.quantity_unit}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {formatCurrency(item.rate_per_dzn)}
                        </td>
                        <td className="py-2 px-2 text-right font-medium">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile Cards */}
              <div className="sm:hidden space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border bg-muted/20">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{item.serial_no}. {item.particular}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.quantity} {item.quantity_unit} × {formatCurrency(item.rate_per_dzn)}
                        </p>
                      </div>
                      <p className="font-semibold text-sm shrink-0">{formatCurrency(item.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Deductions */}
          {deductions.length > 0 && (
            <Card className="mt-4 sm:mt-6 print:shadow-none print:border-0">
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="text-base sm:text-lg font-display">Raw Material Received</CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Material</th>
                        <th className="text-right py-2 px-2 w-20">Qty</th>
                        <th className="text-right py-2 px-2 w-24">Rate</th>
                        <th className="text-right py-2 px-2 w-24">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deductions.map((d) => (
                        <tr key={d.id} className="border-b">
                          <td className="py-2 px-2">{d.material_name}</td>
                          <td className="py-2 px-2 text-right">{d.quantity}</td>
                          <td className="py-2 px-2 text-right">{formatCurrency(d.rate)}</td>
                          <td className="py-2 px-2 text-right font-medium text-destructive">
                            -{formatCurrency(d.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile Cards */}
                <div className="sm:hidden space-y-2">
                  {deductions.map((d) => (
                    <div key={d.id} className="p-3 rounded-lg border bg-destructive/5 border-destructive/20">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{d.material_name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {d.quantity} × {formatCurrency(d.rate)}
                          </p>
                        </div>
                        <p className="font-semibold text-sm text-destructive shrink-0">-{formatCurrency(d.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Totals */}
          <Card className="mt-4 sm:mt-6 bg-muted/30 print:shadow-none print:border print:bg-transparent">
            <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
              <div className="space-y-2 max-w-sm ml-auto text-sm sm:text-base">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sub Total:</span>
                  <span className="font-medium">{formatCurrency(order.subtotal)}</span>
                </div>
                {order.raw_material_deductions > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span className="text-sm">Raw Material:</span>
                    <span className="font-medium">
                      -{formatCurrency(order.raw_material_deductions)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t text-base sm:text-lg font-bold">
                  <span>Net Total:</span>
                  <span className="text-primary print:text-foreground">
                    {formatCurrency(order.net_total)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          [class*="print:hidden"] {
            display: none !important;
          }
        }
      `}</style>
    </AppLayout>
  );
}

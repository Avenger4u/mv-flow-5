import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Phone, Mail, MapPin, FileText, IndianRupee, TrendingUp } from 'lucide-react';

interface Party {
  id: string;
  name: string;
  prefix: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  last_order_number: number;
}

interface Order {
  id: string;
  order_number: string;
  order_date: string;
  subtotal: number;
  raw_material_deductions: number;
  net_total: number;
  status: string;
}

export default function PartyDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [party, setParty] = useState<Party | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      const [partyRes, ordersRes] = await Promise.all([
        supabase.from('parties').select('*').eq('id', id).single(),
        supabase
          .from('orders')
          .select('id, order_number, order_date, subtotal, raw_material_deductions, net_total, status')
          .eq('party_id', id)
          .order('order_date', { ascending: false }),
      ]);

      if (partyRes.error) throw partyRes.error;

      setParty(partyRes.data);
      setOrders(ordersRes.data || []);
    } catch (error) {
      console.error('Error fetching party:', error);
      toast({
        title: 'Error',
        description: 'Failed to load party details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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

  const totalBusiness = orders.reduce((sum, order) => sum + order.net_total, 0);
  const pendingOrders = orders.filter((order) => order.status === 'pending');
  const completedOrders = orders.filter((order) => order.status === 'completed');
  const pendingAmount = pendingOrders.reduce((sum, order) => sum + order.net_total, 0);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!party) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Party not found</p>
          <Button asChild className="mt-4">
            <Link to="/parties">Back to Parties</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/parties">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
                {party.name}
              </h1>
              {party.prefix && (
                <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-1 rounded">
                  {party.prefix}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
              {party.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {party.phone}
                </span>
              )}
              {party.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {party.email}
                </span>
              )}
              {party.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {party.address}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{orders.length}</p>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(totalBusiness)}</p>
                  <p className="text-sm text-muted-foreground">Total Business</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <IndianRupee className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(pendingAmount)}</p>
                  <p className="text-sm text-muted-foreground">Pending Amount</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <FileText className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedOrders.length}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Order History</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No orders yet for this party
              </p>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="table-header">
                        <TableHead>Order No.</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-right">Deductions</TableHead>
                        <TableHead className="text-right">Net Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id} className="table-row-hover">
                          <TableCell>
                            <Link
                              to={`/orders/${order.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {order.order_number}
                            </Link>
                          </TableCell>
                          <TableCell>{formatDate(order.order_date)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(order.subtotal)}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {order.raw_material_deductions > 0
                              ? `-${formatCurrency(order.raw_material_deductions)}`
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(order.net_total)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={order.status === 'completed' ? 'default' : 'secondary'}
                              className={
                                order.status === 'completed'
                                  ? 'bg-success text-success-foreground'
                                  : 'bg-warning/20 text-warning'
                              }
                            >
                              {order.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {orders.map((order) => (
                    <Link key={order.id} to={`/orders/${order.id}`}>
                      <Card className="hover:bg-muted/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-primary">{order.order_number}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(order.order_date)}
                              </p>
                            </div>
                            <Badge
                              variant={order.status === 'completed' ? 'default' : 'secondary'}
                              className={
                                order.status === 'completed'
                                  ? 'bg-success text-success-foreground'
                                  : 'bg-warning/20 text-warning'
                              }
                            >
                              {order.status}
                            </Badge>
                          </div>
                          <div className="mt-3 flex justify-between text-sm">
                            <span className="text-muted-foreground">Net Total</span>
                            <span className="font-semibold">{formatCurrency(order.net_total)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {party.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{party.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  AlertTriangle,
  Plus,
  IndianRupee,
  Calendar,
} from 'lucide-react';

interface DashboardStats {
  totalOrders: number;
  todayTotal: number;
  monthlyTotal: number;
  pendingAmount: number;
  totalParties: number;
  lowStockCount: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  net_total: number;
  order_date: string;
  parties: { name: string } | null;
}

interface LowStockMaterial {
  id: string;
  name: string;
  current_stock: number;
  min_stock: number;
  unit: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    todayTotal: 0,
    monthlyTotal: 0,
    pendingAmount: 0,
    totalParties: 0,
    lowStockCount: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lowStockMaterials, setLowStockMaterials] = useState<LowStockMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split('T')[0];

      // Fetch orders stats
      const { data: ordersData, count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact' });

      const { data: todayOrders } = await supabase
        .from('orders')
        .select('net_total')
        .eq('order_date', today);

      const { data: monthOrders } = await supabase
        .from('orders')
        .select('net_total')
        .gte('order_date', startOfMonth);

      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('net_total')
        .eq('status', 'pending');

      // Fetch parties count
      const { count: partiesCount } = await supabase
        .from('parties')
        .select('*', { count: 'exact' });

      // Fetch low stock materials
      const { data: materials } = await supabase
        .from('materials')
        .select('id, name, current_stock, min_stock, unit');

      const lowStock = materials?.filter(
        (m) => m.min_stock && m.current_stock <= m.min_stock
      ) || [];

      // Fetch recent orders
      const { data: recent } = await supabase
        .from('orders')
        .select('id, order_number, net_total, order_date, parties(name)')
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        totalOrders: totalOrders || 0,
        todayTotal: todayOrders?.reduce((sum, o) => sum + Number(o.net_total), 0) || 0,
        monthlyTotal: monthOrders?.reduce((sum, o) => sum + Number(o.net_total), 0) || 0,
        pendingAmount: pendingOrders?.reduce((sum, o) => sum + Number(o.net_total), 0) || 0,
        totalParties: partiesCount || 0,
        lowStockCount: lowStock.length,
      });

      setRecentOrders(recent || []);
      setLowStockMaterials(lowStock.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Welcome to Mystic Vastra Management
            </p>
          </div>
          <Button asChild className="gradient-primary border-0">
            <Link to="/orders/new">
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-semibold">{stats.totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Calendar className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today</p>
                  <p className="text-xl font-semibold">{formatCurrency(stats.todayTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <TrendingUp className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-xl font-semibold">{formatCurrency(stats.monthlyTotal)}</p>
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
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-xl font-semibold">{formatCurrency(stats.pendingAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <Users className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Parties</p>
                  <p className="text-2xl font-semibold">{stats.totalParties}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Low Stock</p>
                  <p className="text-2xl font-semibold">{stats.lowStockCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders & Low Stock */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Orders */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-display">Recent Orders</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/orders">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No orders yet. Create your first order!
                </p>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      to={`/orders/${order.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{order.order_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.parties?.name || 'Unknown Party'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(order.net_total)}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(order.order_date)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Alert */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-display">Low Stock Alert</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/inventory">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {lowStockMaterials.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  All materials are well stocked! 👍
                </p>
              ) : (
                <div className="space-y-3">
                  {lowStockMaterials.map((material) => (
                    <div
                      key={material.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                    >
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-destructive" />
                        <div>
                          <p className="font-medium">{material.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Min: {material.min_stock} {material.unit}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-destructive">
                          {material.current_stock} {material.unit}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

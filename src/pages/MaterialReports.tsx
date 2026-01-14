import { useState, useEffect } from 'react';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Calendar, 
  Download, 
  FileText, 
  Package,
  TrendingDown,
  TrendingUp
} from 'lucide-react';

interface Material {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
}

interface StockTransaction {
  id: string;
  material_id: string;
  transaction_type: string;
  quantity: number;
  order_id: string | null;
  order_number: string | null;
  remarks: string | null;
  created_at: string;
  materials?: {
    name: string;
    unit: string;
  };
}

interface DateWiseReport {
  material_id: string;
  material_name: string;
  unit: string;
  total_in: number;
  total_out: number;
  net_change: number;
}

export default function MaterialReports() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [dateWiseReport, setDateWiseReport] = useState<DateWiseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const { toast } = useToast();

  useEffect(() => {
    fetchMaterials();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, selectedMaterial]);

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, unit, current_stock')
        .order('name');

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Error fetching materials:', error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('stock_transactions')
        .select('*, materials(name, unit)')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: false });

      if (selectedMaterial !== 'all') {
        query = query.eq('material_id', selectedMaterial);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTransactions(data || []);

      // Calculate date-wise summary
      const summaryMap = new Map<string, DateWiseReport>();
      (data || []).forEach((tx) => {
        const key = tx.material_id;
        const existing = summaryMap.get(key) || {
          material_id: tx.material_id,
          material_name: tx.materials?.name || 'Unknown',
          unit: tx.materials?.unit || '',
          total_in: 0,
          total_out: 0,
          net_change: 0,
        };

        if (tx.transaction_type === 'add') {
          existing.total_in += tx.quantity;
        } else {
          existing.total_out += tx.quantity;
        }
        existing.net_change = existing.total_in - existing.total_out;
        summaryMap.set(key, existing);
      });

      setDateWiseReport(Array.from(summaryMap.values()));
    } catch (error) {
      console.error('Error fetching report:', error);
      toast({
        title: 'Error',
        description: 'Failed to load report',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (type: 'summary' | 'detailed') => {
    let csvContent = '';
    let filename = '';

    if (type === 'summary') {
      csvContent = 'Material,Unit,Total In,Total Out,Net Change\n';
      dateWiseReport.forEach((row) => {
        csvContent += `"${row.material_name}",${row.unit},${row.total_in},${row.total_out},${row.net_change}\n`;
      });
      filename = `material-summary-${startDate}-to-${endDate}.csv`;
    } else {
      csvContent = 'Date,Material,Type,Quantity,Order,Remarks\n';
      transactions.forEach((tx) => {
        csvContent += `"${format(new Date(tx.created_at), 'dd MMM yyyy HH:mm')}","${tx.materials?.name}",${tx.transaction_type === 'add' ? 'IN' : 'OUT'},${tx.quantity},"${tx.order_number || ''}","${tx.remarks || ''}"\n`;
      });
      filename = `material-ledger-${startDate}-to-${endDate}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    toast({
      title: 'Success',
      description: 'Report exported successfully',
    });
  };

  const totalIn = dateWiseReport.reduce((sum, r) => sum + r.total_in, 0);
  const totalOut = dateWiseReport.reduce((sum, r) => sum + r.total_out, 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            Material Reports
          </h1>
          <p className="text-muted-foreground">
            Track material utilisation and generate reports
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Material</Label>
                <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Materials" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Materials</SelectItem>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" onClick={() => exportToCSV('summary')}>
                  <Download className="h-4 w-4 mr-2" />
                  Summary
                </Button>
                <Button variant="outline" onClick={() => exportToCSV('detailed')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Detailed
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Stock In</p>
                  <p className="text-2xl font-bold text-green-600">+{totalIn.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Stock Out</p>
                  <p className="text-2xl font-bold text-red-600">-{totalOut.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Change</p>
                  <p className={`text-2xl font-bold ${totalIn - totalOut >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalIn - totalOut >= 0 ? '+' : ''}{(totalIn - totalOut).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Summary and Detailed View */}
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Summary Report</TabsTrigger>
            <TabsTrigger value="detailed">Detailed Ledger</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Material-wise Summary</CardTitle>
                <CardDescription>
                  Stock movement summary for the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : dateWiseReport.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions found for the selected period.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="text-right text-green-600">Stock In</TableHead>
                          <TableHead className="text-right text-red-600">Stock Out</TableHead>
                          <TableHead className="text-right">Net Change</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dateWiseReport.map((row) => (
                          <TableRow key={row.material_id}>
                            <TableCell className="font-medium">{row.material_name}</TableCell>
                            <TableCell>{row.unit}</TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              +{row.total_in.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-red-600 font-medium">
                              -{row.total_out.toFixed(2)}
                            </TableCell>
                            <TableCell className={`text-right font-bold ${
                              row.net_change >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {row.net_change >= 0 ? '+' : ''}{row.net_change.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detailed">
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Detailed Ledger</CardTitle>
                <CardDescription>
                  All stock transactions for the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions found for the selected period.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Material</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead>Order</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-sm">
                              {format(new Date(tx.created_at), 'dd MMM yyyy, hh:mm a')}
                            </TableCell>
                            <TableCell className="font-medium">{tx.materials?.name}</TableCell>
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
                            <TableCell className={`text-right font-medium ${
                              tx.transaction_type === 'add' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {tx.transaction_type === 'add' ? '+' : '-'}{tx.quantity}
                            </TableCell>
                            <TableCell>
                              {tx.order_number ? (
                                <span className="text-primary font-medium">{tx.order_number}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                              {tx.remarks || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

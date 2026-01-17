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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  FileSpreadsheet,
  Package,
  Users,
  FileText,
  Calendar,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface Material {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  opening_stock: number;
}

interface Party {
  id: string;
  name: string;
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
  materials?: { name: string; unit: string };
  parties?: { name: string } | null;
}

interface MaterialSummary {
  material_id: string;
  material_name: string;
  unit: string;
  opening_stock: number;
  total_in: number;
  total_out: number;
  closing_stock: number;
}

interface PartySummary {
  party_id: string;
  party_name: string;
  materials: {
    material_id: string;
    material_name: string;
    unit: string;
    total_received: number;
    total_used: number;
    balance: number;
  }[];
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

export default function StockReports() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [materialSummary, setMaterialSummary] = useState<MaterialSummary[]>([]);
  const [partySummary, setPartySummary] = useState<PartySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Filters
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');
  const [selectedParty, setSelectedParty] = useState<string>('all');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (materials.length > 0) {
      fetchReports();
    }
  }, [startDate, endDate, selectedMaterial, selectedParty, materials]);

  const fetchInitialData = async () => {
    try {
      const [materialsRes, partiesRes] = await Promise.all([
        supabase.from('materials').select('id, name, unit, current_stock, opening_stock').order('name'),
        supabase.from('parties').select('id, name').order('name'),
      ]);

      if (materialsRes.error) throw materialsRes.error;
      if (partiesRes.error) throw partiesRes.error;

      setMaterials(materialsRes.data || []);
      setParties(partiesRes.data || []);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      let query = supabase
        .from('stock_transactions')
        .select('*, materials(name, unit), parties(name)')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (selectedMaterial !== 'all') {
        query = query.eq('material_id', selectedMaterial);
      }

      if (selectedParty !== 'all') {
        query = query.eq('party_id', selectedParty);
      }

      const { data, error } = await query;

      if (error) throw error;

      setTransactions(data || []);

      // Calculate material summary
      const summary: Record<string, MaterialSummary> = {};
      materials.forEach((m) => {
        if (selectedMaterial === 'all' || selectedMaterial === m.id) {
          summary[m.id] = {
            material_id: m.id,
            material_name: m.name,
            unit: m.unit,
            opening_stock: m.opening_stock,
            total_in: 0,
            total_out: 0,
            closing_stock: m.current_stock,
          };
        }
      });

      (data || []).forEach((tx) => {
        if (summary[tx.material_id]) {
          // Handle both 'add'/'in' for stock in and 'reduce'/'out' for stock out
          if (tx.transaction_type === 'add' || tx.transaction_type === 'in') {
            summary[tx.material_id].total_in += tx.quantity;
          } else if (tx.transaction_type === 'reduce' || tx.transaction_type === 'out') {
            summary[tx.material_id].total_out += tx.quantity;
          }
        }
      });

      setMaterialSummary(Object.values(summary));

      // Calculate party summary
      const partyData: Record<string, PartySummary> = {};
      (data || [])
        .filter((tx) => tx.party_id)
        .forEach((tx) => {
          const partyName = tx.parties?.name || 'Unknown';
          if (!partyData[tx.party_id!]) {
            partyData[tx.party_id!] = {
              party_id: tx.party_id!,
              party_name: partyName,
              materials: [],
            };
          }

          let material = partyData[tx.party_id!].materials.find(
            (m) => m.material_id === tx.material_id
          );
          if (!material) {
            material = {
              material_id: tx.material_id,
              material_name: tx.materials?.name || 'Unknown',
              unit: tx.materials?.unit || '',
              total_received: 0,
              total_used: 0,
              balance: 0,
            };
            partyData[tx.party_id!].materials.push(material);
          }

          // Handle both 'add'/'in' for stock in and 'reduce'/'out' for stock out
          if (tx.transaction_type === 'add' || tx.transaction_type === 'in') {
            material.total_received += tx.quantity;
          } else if (tx.transaction_type === 'reduce' || tx.transaction_type === 'out') {
            material.total_used += tx.quantity;
          }
          material.balance = material.total_received - material.total_used;
        });

      setPartySummary(Object.values(partyData));
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({
        title: 'Error',
        description: 'Failed to load reports',
        variant: 'destructive',
      });
    }
  };

  const exportToCSV = (type: 'material' | 'party' | 'detailed' | 'order') => {
    let csvContent = '';
    let filename = '';

    if (type === 'material') {
      csvContent = 'Material,Unit,Opening Stock,Stock In,Stock Out,Closing Stock\n';
      materialSummary.forEach((m) => {
        csvContent += `"${m.material_name}",${m.unit},${m.opening_stock},${m.total_in},${m.total_out},${m.closing_stock}\n`;
      });
      filename = `material-wise-report-${startDate}-to-${endDate}.csv`;
    } else if (type === 'party') {
      csvContent = 'Party,Material,Unit,Received,Used,Balance\n';
      partySummary.forEach((p) => {
        p.materials.forEach((m) => {
          csvContent += `"${p.party_name}","${m.material_name}",${m.unit},${m.total_received},${m.total_used},${m.balance}\n`;
        });
      });
      filename = `party-wise-report-${startDate}-to-${endDate}.csv`;
    } else if (type === 'detailed') {
      csvContent = 'Date,Material,Type,In,Out,Balance,Source/Reason,Party,Order,Remarks\n';
      transactions.forEach((tx) => {
        const isIn = tx.transaction_type === 'add' || tx.transaction_type === 'in';
        const isOut = tx.transaction_type === 'reduce' || tx.transaction_type === 'out';
        csvContent += `${tx.transaction_date},"${tx.materials?.name}",${isIn ? 'IN' : 'OUT'},`;
        csvContent += `${isIn ? tx.quantity : ''},`;
        csvContent += `${isOut ? tx.quantity : ''},`;
        csvContent += `${tx.balance_after || ''},`;
        csvContent += `"${tx.source_type ? SOURCE_LABELS[tx.source_type] : tx.reason_type ? REASON_LABELS[tx.reason_type] : ''}",`;
        csvContent += `"${tx.parties?.name || ''}",`;
        csvContent += `"${tx.order_number || ''}",`;
        csvContent += `"${tx.remarks || ''}"\n`;
      });
      filename = `detailed-ledger-${startDate}-to-${endDate}.csv`;
    } else if (type === 'order') {
      const orderTransactions = transactions.filter((tx) => tx.order_number);
      csvContent = 'Order No,Date,Material,Quantity,Unit,Remarks\n';
      orderTransactions.forEach((tx) => {
        csvContent += `"${tx.order_number}",${tx.transaction_date},"${tx.materials?.name}",${tx.quantity},${tx.materials?.unit},"${tx.remarks || ''}"\n`;
      });
      filename = `order-wise-consumption-${startDate}-to-${endDate}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    toast({
      title: 'Export Complete',
      description: `Report exported as ${filename}`,
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

  const totalStockIn = materialSummary.reduce((sum, m) => sum + m.total_in, 0);
  const totalStockOut = materialSummary.reduce((sum, m) => sum + m.total_out, 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              Stock Reports
            </h1>
            <p className="text-muted-foreground">
              Comprehensive stock movement and ledger reports
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
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
                    {materials.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Party</Label>
                <Select value={selectedParty} onValueChange={setSelectedParty}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Parties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Parties</SelectItem>
                    {parties.map((party) => (
                      <SelectItem key={party.id} value={party.id}>
                        {party.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <ArrowDownCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Stock In</p>
                  <p className="text-2xl font-bold text-green-600">{totalStockIn.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-red-500/10">
                  <ArrowUpCircle className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Stock Out</p>
                  <p className="text-2xl font-bold text-red-600">{totalStockOut.toFixed(2)}</p>
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
                  <p className={`text-2xl font-bold ${totalStockIn - totalStockOut >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalStockIn - totalStockOut >= 0 ? '+' : ''}{(totalStockIn - totalStockOut).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Tabs */}
        <Tabs defaultValue="material-wise" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="material-wise" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Material-wise</span>
            </TabsTrigger>
            <TabsTrigger value="party-wise" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Party-wise</span>
            </TabsTrigger>
            <TabsTrigger value="order-wise" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Order-wise</span>
            </TabsTrigger>
            <TabsTrigger value="detailed" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Detailed Ledger</span>
            </TabsTrigger>
          </TabsList>

          {/* Material-wise Report */}
          <TabsContent value="material-wise">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Material-wise Summary</CardTitle>
                  <CardDescription>Stock movement summary for each material</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV('material')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Opening</TableHead>
                        <TableHead className="text-right text-green-600">Stock In</TableHead>
                        <TableHead className="text-right text-red-600">Stock Out</TableHead>
                        <TableHead className="text-right">Closing</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materialSummary.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No data for selected period
                          </TableCell>
                        </TableRow>
                      ) : (
                        materialSummary.map((m) => (
                          <TableRow key={m.material_id}>
                            <TableCell className="font-medium">{m.material_name}</TableCell>
                            <TableCell>{m.unit}</TableCell>
                            <TableCell className="text-right">{m.opening_stock}</TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              +{m.total_in}
                            </TableCell>
                            <TableCell className="text-right text-red-600 font-medium">
                              -{m.total_out}
                            </TableCell>
                            <TableCell className="text-right font-bold">{m.closing_stock}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Party-wise Report */}
          <TabsContent value="party-wise">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Party-wise Material Tracking</CardTitle>
                  <CardDescription>Materials received from each party</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV('party')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {partySummary.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No party-wise data for selected period
                  </div>
                ) : (
                  <div className="space-y-6">
                    {partySummary.map((party) => (
                      <div key={party.party_id} className="border rounded-lg overflow-hidden">
                        <div className="bg-muted/50 px-4 py-3 border-b">
                          <h3 className="font-semibold flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {party.party_name}
                          </h3>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Material</TableHead>
                              <TableHead>Unit</TableHead>
                              <TableHead className="text-right text-green-600">Received</TableHead>
                              <TableHead className="text-right text-red-600">Used</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {party.materials.map((m) => (
                              <TableRow key={m.material_id}>
                                <TableCell className="font-medium">{m.material_name}</TableCell>
                                <TableCell>{m.unit}</TableCell>
                                <TableCell className="text-right text-green-600">
                                  +{m.total_received}
                                </TableCell>
                                <TableCell className="text-right text-red-600">
                                  -{m.total_used}
                                </TableCell>
                                <TableCell className={`text-right font-bold ${m.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {m.balance}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Order-wise Report */}
          <TabsContent value="order-wise">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Order-wise Consumption</CardTitle>
                  <CardDescription>Materials consumed per order</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV('order')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order No</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.filter((tx) => tx.order_number).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No order-linked transactions for selected period
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions
                          .filter((tx) => tx.order_number)
                          .map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell>
                                <span className="font-medium text-primary">{tx.order_number}</span>
                              </TableCell>
                              <TableCell>{format(new Date(tx.transaction_date), 'dd MMM yyyy')}</TableCell>
                              <TableCell>{tx.materials?.name}</TableCell>
                              <TableCell className="text-right text-red-600 font-medium">
                                -{tx.quantity} {tx.materials?.unit}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{tx.remarks || '—'}</TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Detailed Ledger */}
          <TabsContent value="detailed">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Detailed Stock Ledger</CardTitle>
                  <CardDescription>Complete transaction history</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV('detailed')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Material</TableHead>
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
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                            No transactions for selected period
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(tx.transaction_date), 'dd MMM yyyy')}
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
                            <TableCell className="text-right text-green-600 font-medium">
                              {tx.transaction_type === 'add' ? `+${tx.quantity}` : ''}
                            </TableCell>
                            <TableCell className="text-right text-red-600 font-medium">
                              {tx.transaction_type === 'reduce' ? `-${tx.quantity}` : ''}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {tx.balance_after ?? '—'}
                            </TableCell>
                            <TableCell>
                              {tx.source_type
                                ? SOURCE_LABELS[tx.source_type]
                                : tx.reason_type
                                ? REASON_LABELS[tx.reason_type]
                                : '—'}
                            </TableCell>
                            <TableCell>{tx.parties?.name || '—'}</TableCell>
                            <TableCell>
                              {tx.order_number ? (
                                <span className="text-primary font-medium">{tx.order_number}</span>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-[150px] truncate">
                              {tx.remarks || '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
  RefreshCw,
} from 'lucide-react';
import { format, startOfMonth, startOfYear } from 'date-fns';

interface Material {
  id: string;
  name: string;
  unit: string;
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

// Helper to check transaction type - handles both 'add'/'in' and 'reduce'/'out' conventions
const normalizeTxType = (type: string) => (type || '').toLowerCase().trim();
const isStockIn = (type: string) => {
  const t = normalizeTxType(type);
  return t === 'add' || t === 'in' || t === 'stock_in' || t === 'stockin';
};
const isStockOut = (type: string) => {
  const t = normalizeTxType(type);
  return (
    t === 'reduce' ||
    t === 'out' ||
    t === 'order_deduction' ||
    t === 'stock_out' ||
    t === 'stockout'
  );
};

export default function StockReports() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<StockTransaction[]>([]);
  const [materialSummary, setMaterialSummary] = useState<MaterialSummary[]>([]);
  const [partySummary, setPartySummary] = useState<PartySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initializingLedger, setInitializingLedger] = useState(false);
  const [syncingOrderLedger, setSyncingOrderLedger] = useState(false);
  const [needsOrderLedgerSync, setNeedsOrderLedgerSync] = useState(false);
  const { toast } = useToast();

  // Filters (default: include historical opening stock entries)
  const [startDate, setStartDate] = useState('2000-01-01');
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');
  const [selectedParty, setSelectedParty] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<string>('all');

  const handleDatePreset = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    
    switch (preset) {
      case 'this_month':
        setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'this_year':
        setStartDate(format(startOfYear(today), 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'all':
      default:
        setStartDate('2000-01-01');
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (materials.length > 0) {
      fetchReports();
    }
  }, [startDate, endDate, selectedMaterial, selectedParty, materials]);

  const fetchInitialData = async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) setRefreshing(true);
      
      const [materialsRes, partiesRes, deductionsCountRes, orderTxCountRes] = await Promise.all([
        supabase.from('materials').select('id, name, unit').order('name'),
        supabase.from('parties').select('id, name').order('name'),
        supabase.from('raw_material_deductions').select('id', { count: 'exact', head: true }),
        supabase
          .from('stock_transactions')
          .select('id', { count: 'exact', head: true })
          .not('order_id', 'is', null),
      ]);

      if (materialsRes.error) throw materialsRes.error;
      if (partiesRes.error) throw partiesRes.error;
      if (deductionsCountRes.error) throw deductionsCountRes.error;
      if (orderTxCountRes.error) throw orderTxCountRes.error;

      setMaterials(materialsRes.data || []);
      setParties(partiesRes.data || []);

      const deductionsCount = deductionsCountRes.count || 0;
      const orderTxCount = orderTxCountRes.count || 0;
      setNeedsOrderLedgerSync(deductionsCount > 0 && orderTxCount === 0);
      
      if (showRefreshToast) {
        toast({
          title: 'Reports Refreshed',
          description: 'Stock reports have been updated with latest data',
        });
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const handleRefresh = () => {
    fetchInitialData(true);
  };

  const handleInitializeLedger = async () => {
    setInitializingLedger(true);
    try {
      const { data, error } = await supabase.functions.invoke('init-stock-ledger');
      if (error) throw error;

      toast({
        title: 'Ledger Initialized',
        description: `${data?.inserted || 0} opening balance entries created`,
      });

      await fetchReports();
    } catch (error) {
      console.error('Error initializing ledger:', error);
      toast({
        title: 'Error',
        description: 'Failed to initialize ledger',
        variant: 'destructive',
      });
    } finally {
      setInitializingLedger(false);
    }
  };

  const handleSyncOrderLedger = async () => {
    setSyncingOrderLedger(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-order-ledger');
      if (error) throw error;

      toast({
        title: 'Order Ledger Synced',
        description: data?.message || `${data?.synced || 0} order deductions synced to ledger`,
      });

      setNeedsOrderLedgerSync(false);
      await fetchInitialData();
      await fetchReports();
    } catch (error) {
      console.error('Error syncing order ledger:', error);
      toast({
        title: 'Error',
        description: 'Failed to sync order ledger',
        variant: 'destructive',
      });
    } finally {
      setSyncingOrderLedger(false);
    }
  };

  const fetchReports = async () => {
    try {
      // Fetch ALL transactions for opening stock calculation (before start date)
      let allTxQuery = supabase
        .from('stock_transactions')
        .select('*, materials(name, unit), parties(name)')
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (selectedMaterial !== 'all') {
        allTxQuery = allTxQuery.eq('material_id', selectedMaterial);
      }

      const { data: allTxData, error: allTxError } = await allTxQuery;
      if (allTxError) throw allTxError;

      setAllTransactions(allTxData || []);

      // Filter transactions within the selected date range
      let filteredTx = (allTxData || []).filter(tx => {
        const txDate = tx.transaction_date;
        const inDateRange = txDate >= startDate && txDate <= endDate;
        const matchesParty = selectedParty === 'all' || tx.party_id === selectedParty;
        return inDateRange && matchesParty;
      });

      setTransactions(filteredTx);

      // Calculate material summary from ledger entries
      const summary: Record<string, MaterialSummary> = {};
      
      // Initialize summary for all materials (or selected material)
      materials.forEach((m) => {
        if (selectedMaterial === 'all' || selectedMaterial === m.id) {
          summary[m.id] = {
            material_id: m.id,
            material_name: m.name,
            unit: m.unit,
            opening_stock: 0,
            total_in: 0,
            total_out: 0,
            closing_stock: 0,
          };
        }
      });

      // Calculate opening stock from all transactions BEFORE start date
      (allTxData || []).forEach((tx) => {
        if (summary[tx.material_id] && tx.transaction_date < startDate) {
          if (isStockIn(tx.transaction_type)) {
            summary[tx.material_id].opening_stock += tx.quantity;
          } else if (isStockOut(tx.transaction_type)) {
            summary[tx.material_id].opening_stock -= tx.quantity;
          }
        }
      });

      // Calculate In/Out within the date range
      filteredTx.forEach((tx) => {
        if (summary[tx.material_id]) {
          if (isStockIn(tx.transaction_type)) {
            summary[tx.material_id].total_in += tx.quantity;
          } else if (isStockOut(tx.transaction_type)) {
            summary[tx.material_id].total_out += tx.quantity;
          }
        }
      });

      // Calculate closing stock: Opening + In - Out
      Object.values(summary).forEach((m) => {
        m.closing_stock = m.opening_stock + m.total_in - m.total_out;
      });

      setMaterialSummary(Object.values(summary));

      // Calculate party summary
      const partyData: Record<string, PartySummary> = {};
      filteredTx
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

          if (isStockIn(tx.transaction_type)) {
            material.total_received += tx.quantity;
          } else if (isStockOut(tx.transaction_type)) {
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
        csvContent += `"${m.material_name}",${m.unit},${m.opening_stock.toFixed(2)},${m.total_in.toFixed(2)},${m.total_out.toFixed(2)},${m.closing_stock.toFixed(2)}\n`;
      });
      filename = `material-wise-report-${startDate}-to-${endDate}.csv`;
    } else if (type === 'party') {
      csvContent = 'Party,Material,Unit,Received,Used,Balance\n';
      partySummary.forEach((p) => {
        p.materials.forEach((m) => {
          csvContent += `"${p.party_name}","${m.material_name}",${m.unit},${m.total_received.toFixed(2)},${m.total_used.toFixed(2)},${m.balance.toFixed(2)}\n`;
        });
      });
      filename = `party-wise-report-${startDate}-to-${endDate}.csv`;
    } else if (type === 'detailed') {
      csvContent = 'Date,Material,Type,In,Out,Balance,Source/Reason,Party,Order,Remarks\n';
      
      // Calculate running balance for detailed ledger
      const sortedTx = [...transactions].sort((a, b) => {
        if (a.transaction_date !== b.transaction_date) {
          return a.transaction_date.localeCompare(b.transaction_date);
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      // Group by material and calculate balance
      const materialBalances: Record<string, number> = {};
      materialSummary.forEach(m => {
        materialBalances[m.material_id] = m.opening_stock;
      });

      sortedTx.forEach((tx) => {
        const balance = isStockIn(tx.transaction_type)
          ? (materialBalances[tx.material_id] || 0) + tx.quantity
          : (materialBalances[tx.material_id] || 0) - tx.quantity;
        materialBalances[tx.material_id] = balance;

        csvContent += `${tx.transaction_date},"${tx.materials?.name}",${isStockIn(tx.transaction_type) ? 'IN' : 'OUT'},`;
        csvContent += `${isStockIn(tx.transaction_type) ? tx.quantity.toFixed(2) : ''},`;
        csvContent += `${isStockOut(tx.transaction_type) ? tx.quantity.toFixed(2) : ''},`;
        csvContent += `${balance.toFixed(2)},`;
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
        csvContent += `"${tx.order_number}",${tx.transaction_date},"${tx.materials?.name}",${tx.quantity.toFixed(2)},${tx.materials?.unit},"${tx.remarks || ''}"\n`;
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

  // Calculate running balance for detailed ledger display
  const getTransactionsWithBalance = () => {
    const sortedTx = [...transactions].sort((a, b) => {
      if (a.transaction_date !== b.transaction_date) {
        return a.transaction_date.localeCompare(b.transaction_date);
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    // Get opening balances for each material
    const materialBalances: Record<string, number> = {};
    materialSummary.forEach(m => {
      materialBalances[m.material_id] = m.opening_stock;
    });

    return sortedTx.map(tx => {
      const balance = isStockIn(tx.transaction_type)
        ? (materialBalances[tx.material_id] || 0) + tx.quantity
        : (materialBalances[tx.material_id] || 0) - tx.quantity;
      materialBalances[tx.material_id] = balance;
      return { ...tx, runningBalance: balance };
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
  const transactionsWithBalance = getTransactionsWithBalance();

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6 animate-fade-in px-1 sm:px-0">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground">
              Stock Reports
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Comprehensive stock movement and ledger reports
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {allTransactions.length === 0 && (
              <Button
                onClick={handleInitializeLedger}
                disabled={initializingLedger || refreshing || syncingOrderLedger}
                className="gap-2 flex-1 sm:flex-none"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 ${initializingLedger ? 'animate-spin' : ''}`} />
                {initializingLedger ? 'Initializing…' : 'Initialize Ledger'}
              </Button>
            )}
            {needsOrderLedgerSync && (
              <Button
                onClick={handleSyncOrderLedger}
                disabled={syncingOrderLedger || refreshing || initializingLedger}
                className="gap-2 flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 ${syncingOrderLedger ? 'animate-spin' : ''}`} />
                {syncingOrderLedger ? 'Syncing…' : 'Sync Order Ledger'}
              </Button>
            )}
            <Button 
              onClick={handleRefresh} 
              disabled={refreshing || initializingLedger || syncingOrderLedger}
              variant="outline"
              className="gap-2 flex-1 sm:flex-none"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick Date Presets */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Quick Filter</Label>
              <ToggleGroup type="single" value={datePreset} onValueChange={(v) => v && handleDatePreset(v)} className="justify-start">
                <ToggleGroupItem value="this_month" aria-label="This Month" className="text-xs sm:text-sm px-3">
                  This Month
                </ToggleGroupItem>
                <ToggleGroupItem value="this_year" aria-label="This Year" className="text-xs sm:text-sm px-3">
                  This Year
                </ToggleGroupItem>
                <ToggleGroupItem value="all" aria-label="All Time" className="text-xs sm:text-sm px-3">
                  All Time
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset('');
                  }}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset('');
                  }}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Material</Label>
                <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                  <SelectTrigger className="text-sm">
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
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Party</Label>
                <Select value={selectedParty} onValueChange={setSelectedParty}>
                  <SelectTrigger className="text-sm">
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
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-full bg-green-500/10 shrink-0">
                  <ArrowDownCircle className="h-4 w-4 sm:h-6 sm:w-6 text-green-500" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xs sm:text-sm text-muted-foreground">Stock In</p>
                  <p className="text-lg sm:text-2xl font-bold text-green-600">{totalStockIn.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-full bg-red-500/10 shrink-0">
                  <ArrowUpCircle className="h-4 w-4 sm:h-6 sm:w-6 text-red-500" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xs sm:text-sm text-muted-foreground">Stock Out</p>
                  <p className="text-lg sm:text-2xl font-bold text-red-600">{totalStockOut.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-full bg-primary/10 shrink-0">
                  <Package className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xs sm:text-sm text-muted-foreground">Net Change</p>
                  <p className={`text-lg sm:text-2xl font-bold ${totalStockIn - totalStockOut >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalStockIn - totalStockOut >= 0 ? '+' : ''}{(totalStockIn - totalStockOut).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Tabs */}
        <Tabs defaultValue="material-wise" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 h-auto p-1">
            <TabsTrigger value="material-wise" className="gap-1 sm:gap-2 px-1 sm:px-3 py-2 text-xs sm:text-sm">
              <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Material</span>
            </TabsTrigger>
            <TabsTrigger value="party-wise" className="gap-1 sm:gap-2 px-1 sm:px-3 py-2 text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Party</span>
            </TabsTrigger>
            <TabsTrigger value="order-wise" className="gap-1 sm:gap-2 px-1 sm:px-3 py-2 text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Order</span>
            </TabsTrigger>
            <TabsTrigger value="detailed" className="gap-1 sm:gap-2 px-1 sm:px-3 py-2 text-xs sm:text-sm">
              <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Ledger</span>
            </TabsTrigger>
          </TabsList>

          {/* Material-wise Report */}
          <TabsContent value="material-wise">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4">
                <div>
                  <CardTitle className="text-base sm:text-lg">Material-wise Summary</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Stock movement summary for each material (calculated from ledger)</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV('material')} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm whitespace-nowrap">Material</TableHead>
                        <TableHead className="text-xs sm:text-sm text-right">Opening</TableHead>
                        <TableHead className="text-xs sm:text-sm text-right text-green-600">In</TableHead>
                        <TableHead className="text-xs sm:text-sm text-right text-red-600">Out</TableHead>
                        <TableHead className="text-xs sm:text-sm text-right">Closing</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materialSummary.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                            No data for selected period
                          </TableCell>
                        </TableRow>
                      ) : (
                        materialSummary.map((m) => (
                          <TableRow key={m.material_id}>
                            <TableCell className="font-medium text-xs sm:text-sm">
                              <div>{m.material_name}</div>
                              <div className="text-xs text-muted-foreground">{m.unit}</div>
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">{m.opening_stock.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-green-600 font-medium text-xs sm:text-sm">
                              +{m.total_in.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-red-600 font-medium text-xs sm:text-sm">
                              -{m.total_out.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-xs sm:text-sm">{m.closing_stock.toFixed(2)}</TableCell>
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
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4">
                <div>
                  <CardTitle className="text-base sm:text-lg">Party-wise Material Tracking</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Materials received from each party</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV('party')} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                {partySummary.length === 0 ? (
                  <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                    No party-wise data for selected period
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-6">
                    {partySummary.map((party) => (
                      <div key={party.party_id} className="border rounded-lg overflow-hidden">
                        <div className="bg-muted/50 px-3 sm:px-4 py-2 sm:py-3 border-b">
                          <h3 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
                            <Users className="h-4 w-4" />
                            {party.party_name}
                          </h3>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs sm:text-sm">Material</TableHead>
                                <TableHead className="text-xs sm:text-sm text-right text-green-600">In</TableHead>
                                <TableHead className="text-xs sm:text-sm text-right text-red-600">Out</TableHead>
                                <TableHead className="text-xs sm:text-sm text-right">Balance</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {party.materials.map((m) => (
                                <TableRow key={m.material_id}>
                                  <TableCell className="font-medium text-xs sm:text-sm">
                                    <div>{m.material_name}</div>
                                    <div className="text-xs text-muted-foreground">{m.unit}</div>
                                  </TableCell>
                                  <TableCell className="text-right text-green-600 text-xs sm:text-sm">
                                    +{m.total_received.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right text-red-600 text-xs sm:text-sm">
                                    -{m.total_used.toFixed(2)}
                                  </TableCell>
                                  <TableCell className={`text-right font-bold text-xs sm:text-sm ${m.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {m.balance.toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
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
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4">
                <div>
                  <CardTitle className="text-base sm:text-lg">Order-wise Consumption</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Materials consumed per order</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV('order')} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm whitespace-nowrap">Order No</TableHead>
                        <TableHead className="text-xs sm:text-sm">Date</TableHead>
                        <TableHead className="text-xs sm:text-sm">Material</TableHead>
                        <TableHead className="text-xs sm:text-sm text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.filter((tx) => tx.order_number).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                            No order-linked transactions for selected period
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions
                          .filter((tx) => tx.order_number)
                          .map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell className="text-xs sm:text-sm">
                                <span className="font-medium text-primary">{tx.order_number}</span>
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm whitespace-nowrap">{format(new Date(tx.transaction_date), 'dd MMM')}</TableCell>
                              <TableCell className="text-xs sm:text-sm">
                                <div>{tx.materials?.name}</div>
                                <div className="text-xs text-muted-foreground">{tx.remarks || ''}</div>
                              </TableCell>
                              <TableCell className="text-right text-red-600 font-medium text-xs sm:text-sm whitespace-nowrap">
                                -{tx.quantity.toFixed(2)}
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

          {/* Detailed Ledger */}
          <TabsContent value="detailed">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4">
                <div>
                  <CardTitle className="text-base sm:text-lg">Detailed Stock Ledger</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Complete transaction history with running balance</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV('detailed')} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Date</TableHead>
                        <TableHead className="text-xs sm:text-sm">Material</TableHead>
                        <TableHead className="text-xs sm:text-sm">Type</TableHead>
                        <TableHead className="text-xs sm:text-sm text-right text-green-600">In</TableHead>
                        <TableHead className="text-xs sm:text-sm text-right text-red-600">Out</TableHead>
                        <TableHead className="text-xs sm:text-sm text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactionsWithBalance.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                            No transactions for selected period
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactionsWithBalance.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                              {format(new Date(tx.transaction_date), 'dd MMM')}
                            </TableCell>
                            <TableCell className="font-medium text-xs sm:text-sm">
                              <div>{tx.materials?.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {tx.source_type
                                  ? SOURCE_LABELS[tx.source_type]
                                  : tx.reason_type
                                  ? REASON_LABELS[tx.reason_type]
                                  : tx.order_number || ''}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={isStockIn(tx.transaction_type) ? 'default' : 'destructive'} className="text-xs px-1.5 py-0.5">
                                {isStockIn(tx.transaction_type) ? 'IN' : 'OUT'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-green-600 font-medium text-xs sm:text-sm">
                              {isStockIn(tx.transaction_type) ? `+${tx.quantity.toFixed(2)}` : ''}
                            </TableCell>
                            <TableCell className="text-right text-red-600 font-medium text-xs sm:text-sm">
                              {isStockOut(tx.transaction_type) ? `-${tx.quantity.toFixed(2)}` : ''}
                            </TableCell>
                            <TableCell className="text-right font-medium text-xs sm:text-sm">
                              {tx.runningBalance.toFixed(2)}
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

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Ruler } from 'lucide-react';

interface Unit {
  id: string;
  name: string;
  created_at: string;
}

interface UnitWithUsage extends Unit {
  usage_count: number;
}

export function UnitManager() {
  const [units, setUnits] = useState<UnitWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitName, setUnitName] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      // Fetch units
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('*')
        .order('name');

      if (unitsError) throw unitsError;

      // Fetch usage count for each unit
      const { data: materialsData, error: materialsError } = await supabase
        .from('materials')
        .select('unit');

      if (materialsError) throw materialsError;

      const usageMap = new Map<string, number>();
      materialsData?.forEach((m) => {
        if (m.unit) {
          usageMap.set(m.unit, (usageMap.get(m.unit) || 0) + 1);
        }
      });

      const unitsWithUsage: UnitWithUsage[] = (unitsData || []).map((unit) => ({
        ...unit,
        usage_count: usageMap.get(unit.name) || 0,
      }));

      setUnits(unitsWithUsage);
    } catch (error) {
      console.error('Error fetching units:', error);
      toast({
        title: 'Error',
        description: 'Failed to load units',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!unitName.trim()) {
      toast({
        title: 'Error',
        description: 'Unit name is required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      if (editingUnit) {
        // Update unit name in units table
        const { error: unitError } = await supabase
          .from('units')
          .update({ name: unitName.trim() })
          .eq('id', editingUnit.id);

        if (unitError) throw unitError;

        // Also update all materials using this unit
        const { error: materialsError } = await supabase
          .from('materials')
          .update({ unit: unitName.trim() })
          .eq('unit', editingUnit.name);

        if (materialsError) throw materialsError;

        toast({
          title: 'Success',
          description: 'Unit updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('units')
          .insert({ name: unitName.trim() });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Unit added successfully',
        });
      }

      handleDialogClose();
      fetchUnits();
    } catch (error: any) {
      console.error('Error saving unit:', error);
      toast({
        title: 'Error',
        description: error.message?.includes('duplicate') 
          ? 'Unit already exists' 
          : 'Failed to save unit',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setUnitName(unit.name);
    setDialogOpen(true);
  };

  const handleDelete = async (unit: UnitWithUsage) => {
    if (unit.usage_count > 0) {
      toast({
        title: 'Cannot Delete',
        description: `This unit is used by ${unit.usage_count} material(s). Change materials to a different unit first.`,
        variant: 'destructive',
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete "${unit.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unit.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Unit deleted successfully',
      });
      fetchUnits();
    } catch (error) {
      console.error('Error deleting unit:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete unit',
        variant: 'destructive',
      });
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingUnit(null);
    setUnitName('');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="h-5 w-5 text-primary" />
            <CardTitle className="font-display">Manage Units</CardTitle>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gradient-primary border-0">
                <Plus className="h-4 w-4 mr-2" />
                Add Unit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingUnit ? 'Edit Unit' : 'Add New Unit'}
                </DialogTitle>
                <DialogDescription>
                  {editingUnit
                    ? 'Update the unit name'
                    : 'Enter a name for the new unit'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="unitName">Unit Name *</Label>
                  <Input
                    id="unitName"
                    value={unitName}
                    onChange={(e) => setUnitName(e.target.value)}
                    placeholder="e.g., Meter, Kg, Pcs"
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : editingUnit ? 'Update' : 'Add'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
          Add, edit or delete measurement units (e.g., Meter, Thaan, Kg, Pcs)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : units.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No units added yet. Click "Add Unit" to create one.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit Name</TableHead>
                  <TableHead className="text-center">Materials Using</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.name}</TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        unit.usage_count > 0 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {unit.usage_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(unit)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(unit)}
                          disabled={unit.usage_count > 0}
                          className={unit.usage_count > 0 ? 'opacity-50 cursor-not-allowed' : ''}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Search, Upload, Package, AlertTriangle } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface Material {
  id: string;
  name: string;
  category_id: string | null;
  unit: string;
  rate: number;
  current_stock: number;
  min_stock: number | null;
  image_url: string | null;
  notes: string | null;
  material_categories: Category | null;
}

interface MaterialFormData {
  name: string;
  category_id: string;
  unit: string;
  rate: string;
  current_stock: string;
  min_stock: string;
  notes: string;
}

const initialFormData: MaterialFormData = {
  name: '',
  category_id: '',
  unit: 'Pcs',
  rate: '',
  current_stock: '0',
  min_stock: '0',
  notes: '',
};

const unitOptions = ['Pcs', 'Dzn', 'Meter', 'Thaan', 'Kg', 'Gram', 'Set'];

export default function Inventory() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [stockAction, setStockAction] = useState<'add' | 'reduce'>('add');
  const [stockQuantity, setStockQuantity] = useState('');
  const [formData, setFormData] = useState<MaterialFormData>(initialFormData);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [materialsRes, categoriesRes] = await Promise.all([
        supabase
          .from('materials')
          .select('*, material_categories(id, name)')
          .order('name'),
        supabase.from('material_categories').select('*').order('name'),
      ]);

      if (materialsRes.error) throw materialsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setMaterials(materialsRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load inventory',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `materials/${fileName}`;

    const { error } = await supabase.storage
      .from('materials')
      .upload(filePath, file);

    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('materials')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Material name is required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      let imageUrl = editingMaterial?.image_url || null;

      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const materialData = {
        name: formData.name.trim(),
        category_id: formData.category_id || null,
        unit: formData.unit,
        rate: parseFloat(formData.rate) || 0,
        current_stock: parseFloat(formData.current_stock) || 0,
        min_stock: parseFloat(formData.min_stock) || 0,
        notes: formData.notes.trim() || null,
        image_url: imageUrl,
      };

      if (editingMaterial) {
        const { error } = await supabase
          .from('materials')
          .update(materialData)
          .eq('id', editingMaterial.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Material updated successfully',
        });
      } else {
        const { error } = await supabase.from('materials').insert(materialData);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Material added successfully',
        });
      }

      handleDialogClose();
      fetchData();
    } catch (error) {
      console.error('Error saving material:', error);
      toast({
        title: 'Error',
        description: 'Failed to save material',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStockUpdate = async () => {
    if (!selectedMaterial || !stockQuantity) return;

    const qty = parseFloat(stockQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid quantity',
        variant: 'destructive',
      });
      return;
    }

    const newStock =
      stockAction === 'add'
        ? selectedMaterial.current_stock + qty
        : selectedMaterial.current_stock - qty;

    if (newStock < 0) {
      toast({
        title: 'Error',
        description: 'Stock cannot be negative',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('materials')
        .update({ current_stock: newStock })
        .eq('id', selectedMaterial.id);

      if (updateError) throw updateError;

      const { error: transactionError } = await supabase
        .from('stock_transactions')
        .insert({
          material_id: selectedMaterial.id,
          transaction_type: stockAction,
          quantity: qty,
        });

      if (transactionError) throw transactionError;

      toast({
        title: 'Success',
        description: `Stock ${stockAction === 'add' ? 'added' : 'reduced'} successfully`,
      });

      setStockDialogOpen(false);
      setSelectedMaterial(null);
      setStockQuantity('');
      fetchData();
    } catch (error) {
      console.error('Error updating stock:', error);
      toast({
        title: 'Error',
        description: 'Failed to update stock',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    setFormData({
      name: material.name,
      category_id: material.category_id || '',
      unit: material.unit,
      rate: material.rate.toString(),
      current_stock: material.current_stock.toString(),
      min_stock: material.min_stock?.toString() || '0',
      notes: material.notes || '',
    });
    setImagePreview(material.image_url);
    setDialogOpen(true);
  };

  const handleDelete = async (material: Material) => {
    if (!confirm(`Are you sure you want to delete "${material.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', material.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Material deleted successfully',
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting material:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete material',
        variant: 'destructive',
      });
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setFormData(initialFormData);
    setEditingMaterial(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const filteredMaterials = materials.filter((material) => {
    const matchesSearch = material.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      filterCategory === 'all' || material.category_id === filterCategory;
    return matchesSearch && matchesCategory;
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
              Inventory
            </h1>
            <p className="text-muted-foreground">
              Manage raw materials and stock
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary border-0">
                <Plus className="h-4 w-4 mr-2" />
                Add Material
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingMaterial ? 'Edit Material' : 'Add New Material'}
                </DialogTitle>
                <DialogDescription>
                  Enter material details
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Image Upload */}
                <div className="space-y-2">
                  <Label>Material Image</Label>
                  <div className="flex items-center gap-4">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-20 h-20 object-cover rounded-lg border"
                      />
                    ) : (
                      <div className="w-20 h-20 flex items-center justify-center rounded-lg border border-dashed bg-muted">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="name">Material Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Enter material name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(value) =>
                        setFormData({ ...formData, unit: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {unitOptions.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rate">Rate (₹)</Label>
                    <Input
                      id="rate"
                      type="number"
                      step="0.01"
                      value={formData.rate}
                      onChange={(e) =>
                        setFormData({ ...formData, rate: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="current_stock">Current Stock</Label>
                    <Input
                      id="current_stock"
                      type="number"
                      step="0.01"
                      value={formData.current_stock}
                      onChange={(e) =>
                        setFormData({ ...formData, current_stock: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="min_stock">Minimum Stock (Alert Level)</Label>
                    <Input
                      id="min_stock"
                      type="number"
                      step="0.01"
                      value={formData.min_stock}
                      onChange={(e) =>
                        setFormData({ ...formData, min_stock: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving} className="gradient-primary border-0">
                    {saving ? 'Saving...' : editingMaterial ? 'Update' : 'Add Material'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search materials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Materials Grid */}
        {filteredMaterials.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">
                {searchQuery || filterCategory !== 'all'
                  ? 'No materials found'
                  : 'No materials yet. Add your first material!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMaterials.map((material) => {
              const isLowStock =
                material.min_stock && material.current_stock <= material.min_stock;

              return (
                <Card
                  key={material.id}
                  className={`overflow-hidden ${
                    isLowStock ? 'border-destructive/50 bg-destructive/5' : ''
                  }`}
                >
                  {/* Image */}
                  <div className="aspect-square bg-muted relative">
                    {material.image_url ? (
                      <img
                        src={material.image_url}
                        alt={material.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-16 w-16 text-muted-foreground/30" />
                      </div>
                    )}
                    {isLowStock && (
                      <div className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive">
                        <AlertTriangle className="h-4 w-4 text-destructive-foreground" />
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold line-clamp-1">{material.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {material.material_categories?.name || 'Uncategorized'}
                          </p>
                        </div>
                        <p className="font-semibold text-primary">₹{material.rate}</p>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t">
                        <div>
                          <p className="text-sm text-muted-foreground">Stock</p>
                          <p className={`font-semibold ${isLowStock ? 'text-destructive' : ''}`}>
                            {material.current_stock} {material.unit}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedMaterial(material);
                              setStockAction('add');
                              setStockDialogOpen(true);
                            }}
                          >
                            +
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedMaterial(material);
                              setStockAction('reduce');
                              setStockDialogOpen(true);
                            }}
                          >
                            −
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(material)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDelete(material)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Stock Update Dialog */}
        <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {stockAction === 'add' ? 'Add Stock' : 'Reduce Stock'}
              </DialogTitle>
              <DialogDescription>
                {selectedMaterial?.name} - Current: {selectedMaterial?.current_stock}{' '}
                {selectedMaterial?.unit}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  placeholder="Enter quantity"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStockDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleStockUpdate}
                className={stockAction === 'add' ? 'bg-success hover:bg-success/90' : ''}
                variant={stockAction === 'reduce' ? 'destructive' : 'default'}
              >
                {stockAction === 'add' ? 'Add Stock' : 'Reduce Stock'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

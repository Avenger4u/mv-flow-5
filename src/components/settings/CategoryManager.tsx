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
import { Plus, Pencil, Trash2, Tags } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  created_at: string;
}

interface CategoryWithUsage extends Category {
  usage_count: number;
}

export function CategoryManager() {
  const [categories, setCategories] = useState<CategoryWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('material_categories')
        .select('*')
        .order('name');

      if (categoriesError) throw categoriesError;

      // Fetch usage count for each category
      const { data: materialsData, error: materialsError } = await supabase
        .from('materials')
        .select('category_id');

      if (materialsError) throw materialsError;

      const usageMap = new Map<string, number>();
      materialsData?.forEach((m) => {
        if (m.category_id) {
          usageMap.set(m.category_id, (usageMap.get(m.category_id) || 0) + 1);
        }
      });

      const categoriesWithUsage: CategoryWithUsage[] = (categoriesData || []).map((cat) => ({
        ...cat,
        usage_count: usageMap.get(cat.id) || 0,
      }));

      setCategories(categoriesWithUsage);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        title: 'Error',
        description: 'Failed to load categories',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryName.trim()) {
      toast({
        title: 'Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('material_categories')
          .update({ name: categoryName.trim() })
          .eq('id', editingCategory.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Category updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('material_categories')
          .insert({ name: categoryName.trim() });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Category added successfully',
        });
      }

      handleDialogClose();
      fetchCategories();
    } catch (error: any) {
      console.error('Error saving category:', error);
      toast({
        title: 'Error',
        description: error.message?.includes('duplicate') 
          ? 'Category already exists' 
          : 'Failed to save category',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setDialogOpen(true);
  };

  const handleDelete = async (category: CategoryWithUsage) => {
    if (category.usage_count > 0) {
      toast({
        title: 'Cannot Delete',
        description: `This category is used by ${category.usage_count} material(s). Remove materials first.`,
        variant: 'destructive',
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('material_categories')
        .delete()
        .eq('id', category.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Category deleted successfully',
      });
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete category',
        variant: 'destructive',
      });
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingCategory(null);
    setCategoryName('');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" />
            <CardTitle className="font-display">Manage Categories</CardTitle>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gradient-primary border-0">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </DialogTitle>
                <DialogDescription>
                  {editingCategory
                    ? 'Update the category name'
                    : 'Enter a name for the new category'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="categoryName">Category Name *</Label>
                  <Input
                    id="categoryName"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="e.g., Lace, Fabric, Border"
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : editingCategory ? 'Update' : 'Add'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
          Add, edit or delete material categories (e.g., Lace, Fabric, Border, Net)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No categories added yet. Click "Add Category" to create one.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category Name</TableHead>
                  <TableHead className="text-center">Materials Using</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        category.usage_count > 0 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {category.usage_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(category)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(category)}
                          disabled={category.usage_count > 0}
                          className={category.usage_count > 0 ? 'opacity-50 cursor-not-allowed' : ''}
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

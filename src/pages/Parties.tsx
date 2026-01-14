import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Pencil, Trash2, Search, Phone, Mail, MapPin, Eye } from 'lucide-react';

interface Party {
  id: string;
  name: string;
  prefix: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  last_order_number: number;
  created_at: string;
}

interface PartyFormData {
  name: string;
  prefix: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
}

const initialFormData: PartyFormData = {
  name: '',
  prefix: '',
  address: '',
  phone: '',
  email: '',
  notes: '',
};

export default function Parties() {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [formData, setFormData] = useState<PartyFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchParties();
  }, []);

  const fetchParties = async () => {
    try {
      const { data, error } = await supabase
        .from('parties')
        .select('*')
        .order('name');

      if (error) throw error;
      setParties(data || []);
    } catch (error) {
      console.error('Error fetching parties:', error);
      toast({
        title: 'Error',
        description: 'Failed to load parties',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Party name is required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      if (editingParty) {
        const { error } = await supabase
          .from('parties')
          .update({
            name: formData.name.trim(),
            prefix: formData.prefix.trim().toUpperCase() || null,
            address: formData.address.trim() || null,
            phone: formData.phone.trim() || null,
            email: formData.email.trim() || null,
            notes: formData.notes.trim() || null,
          })
          .eq('id', editingParty.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Party updated successfully',
        });
      } else {
        const { error } = await supabase.from('parties').insert({
          name: formData.name.trim(),
          prefix: formData.prefix.trim().toUpperCase() || null,
          address: formData.address.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          notes: formData.notes.trim() || null,
        });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Party added successfully',
        });
      }

      setDialogOpen(false);
      setFormData(initialFormData);
      setEditingParty(null);
      fetchParties();
    } catch (error) {
      console.error('Error saving party:', error);
      toast({
        title: 'Error',
        description: 'Failed to save party',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (party: Party) => {
    setEditingParty(party);
    setFormData({
      name: party.name,
      prefix: party.prefix || '',
      address: party.address || '',
      phone: party.phone || '',
      email: party.email || '',
      notes: party.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (party: Party) => {
    if (!confirm(`Are you sure you want to delete "${party.name}"?`)) return;

    try {
      const { error } = await supabase.from('parties').delete().eq('id', party.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Party deleted successfully',
      });
      fetchParties();
    } catch (error) {
      console.error('Error deleting party:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete party',
        variant: 'destructive',
      });
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setFormData(initialFormData);
    setEditingParty(null);
  };

  const filteredParties = parties.filter(
    (party) =>
      party.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      party.phone?.includes(searchQuery) ||
      party.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              Parties
            </h1>
            <p className="text-muted-foreground">
              Manage your customers and suppliers
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary border-0">
                <Plus className="h-4 w-4 mr-2" />
                Add Party
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingParty ? 'Edit Party' : 'Add New Party'}
                </DialogTitle>
                <DialogDescription>
                  {editingParty
                    ? 'Update party information'
                    : 'Enter party details to add a new party'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="name">Party Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Enter party name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prefix">Order Prefix</Label>
                    <Input
                      id="prefix"
                      value={formData.prefix}
                      onChange={(e) =>
                        setFormData({ ...formData, prefix: e.target.value.toUpperCase() })
                      }
                      placeholder="SG"
                      maxLength={4}
                      className="uppercase"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="Enter email address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Enter address"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Additional notes"
                    rows={2}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving} className="gradient-primary border-0">
                    {saving ? 'Saving...' : editingParty ? 'Update' : 'Add Party'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search parties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Parties List */}
        {filteredParties.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">
                {searchQuery ? 'No parties found' : 'No parties yet. Add your first party!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop Table */}
            <Card className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="table-header">
                    <TableHead>Name</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParties.map((party) => (
                    <TableRow key={party.id} className="table-row-hover">
                      <TableCell className="font-medium">{party.name}</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                          {party.prefix || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {party.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-3 w-3" />
                              {party.phone}
                            </div>
                          )}
                          {party.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3" />
                              {party.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {party.address || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                          >
                            <Link to={`/parties/${party.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(party)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(party)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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
              {filteredParties.map((party) => (
                <Card key={party.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{party.name}</h3>
                          {party.prefix && (
                            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                              {party.prefix}
                            </span>
                          )}
                        </div>
                        {party.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {party.phone}
                          </div>
                        )}
                        {party.email && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {party.email}
                          </div>
                        )}
                        {party.address && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {party.address}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                        >
                          <Link to={`/parties/${party.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(party)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(party)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

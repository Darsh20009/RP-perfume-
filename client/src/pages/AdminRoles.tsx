import { useQuery, useMutation } from "@tanstack/react-query";
import { Role, InsertRole, employeePermissions } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Shield, Plus, Trash2, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

export default function AdminRoles() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const { data: roles, isLoading } = useQuery<Role[]>({
    queryKey: ["/api/admin/roles"],
  });

  const form = useForm<InsertRole>({
    defaultValues: {
      name: "",
      description: "",
      permissions: [],
      isSystem: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertRole) => {
      const res = await apiRequest("POST", "/api/admin/roles", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      toast({ title: "تم النجاح", description: "تم إضافة الدور بنجاح" });
      setIsOpen(false);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      toast({ title: "تم الحذف", description: "تم حذف الدور بنجاح" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black uppercase tracking-widest">إدارة الأدوار والصلاحيات</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              إضافة دور جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-right">إضافة دور جديد</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel>اسم الدور</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="text-right">
                      <FormLabel>الوصف</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-3">
                  <FormLabel className="text-right block">الصلاحيات</FormLabel>
                  <div className="grid grid-cols-2 gap-3 border p-4 rounded-md bg-black/5">
                    {employeePermissions.map((permission) => (
                      <FormField
                        key={permission}
                        control={form.control}
                        name="permissions"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 space-x-reverse">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(permission)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), permission])
                                    : field.onChange(field.value?.filter((v) => v !== permission));
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-xs">{permission}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ الدور"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles?.map((role) => (
          <Card key={role.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-bold">{role.name}</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{role.description || "لا يوجد وصف"}</p>
              <div className="flex flex-wrap gap-1 mb-4">
                {role.permissions.map((p) => (
                  <span key={p} className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded font-medium">
                    {p}
                  </span>
                ))}
              </div>
              {!role.isSystem && (
                <Button variant="ghost" size="sm" className="w-full text-destructive gap-2" onClick={() => deleteMutation.mutate(role.id)}>
                  <Trash2 className="h-4 w-4" />
                  حذف الدور
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

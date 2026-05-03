import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, MapPin, Lock, ArrowRight, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { queryClient } from "@/lib/queryClient";

type Branch = {
  id: string;
  _id?: string;
  name: string;
  nameEn?: string;
  city?: string;
  address?: string;
  mapUrl?: string;
  isActive?: boolean;
};

export default function BranchLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { refetch: refetchUser } = useAuth();
  const [selected, setSelected] = useState<Branch | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: branches, isLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const activeBranches = (branches || []).filter((b) => b.isActive !== false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !password) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/auth/branch-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ branchId: selected.id || selected._id, password }),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || "فشل تسجيل الدخول");
      }
      const data = await r.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      await refetchUser();
      toast({ title: "تم تسجيل الدخول", description: `أهلاً بك في ${selected.name}` });
      setLocation(data.redirectTo || "/branch-dashboard");
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ", description: err.message || "كلمة المرور غير صحيحة" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[#DFB369]/10 text-[#8B6F1F] px-4 py-1.5 rounded-full text-xs font-bold mb-3">
            <Store className="h-3.5 w-3.5" />
            دخول الفروع
          </div>
          <h1 className="text-3xl font-bold text-slate-800">دخول موظفي الفروع</h1>
          <p className="text-slate-500 text-sm mt-2">اختر فرعك ثم أدخل كلمة السر للدخول إلى لوحة الفرع</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin h-8 w-8 text-[#DFB369]" />
          </div>
        ) : !selected ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {activeBranches.length === 0 && (
              <p className="col-span-2 text-center text-slate-500 py-10">لا توجد فروع متاحة حالياً</p>
            )}
            {activeBranches.map((b) => (
              <Card
                key={b.id || b._id}
                data-testid={`card-branch-${b.id || b._id}`}
                className="p-5 cursor-pointer hover-elevate active-elevate-2 border-2 border-transparent hover:border-[#DFB369] transition-all"
                onClick={() => setSelected(b)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#DFB369]/15 flex items-center justify-center shrink-0">
                    <Store className="h-6 w-6 text-[#8B6F1F]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 text-lg" data-testid={`text-branch-name-${b.id || b._id}`}>
                      {b.name}
                    </h3>
                    {(b.address || b.city) && (
                      <p className="text-sm text-slate-500 mt-0.5">{b.address || b.city}</p>
                    )}
                    {b.mapUrl && (
                      <a
                        href={b.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-[#8B6F1F] hover:underline mt-2"
                        data-testid={`link-map-${b.id || b._id}`}
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        فتح الموقع على الخريطة
                      </a>
                    )}
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-400 shrink-0 rotate-180" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 max-w-md mx-auto">
            <button
              onClick={() => { setSelected(null); setPassword(""); }}
              className="text-sm text-slate-500 hover:text-slate-800 mb-4 inline-flex items-center gap-1"
              data-testid="button-back-branches"
            >
              <ArrowRight className="h-4 w-4" />
              تغيير الفرع
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#DFB369]/15 flex items-center justify-center mx-auto mb-3">
                <Lock className="h-7 w-7 text-[#8B6F1F]" />
              </div>
              <h2 className="text-xl font-bold text-slate-800" data-testid="text-selected-branch">{selected.name}</h2>
              {selected.address && <p className="text-sm text-slate-500 mt-1">{selected.address}</p>}
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">كلمة سر الفرع</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoFocus
                  className="text-base"
                  data-testid="input-branch-password"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting || !password}
                className="w-full bg-[#DFB369] hover:bg-[#C99A4D] text-white font-bold h-11"
                data-testid="button-branch-login"
              >
                {submitting ? <Loader2 className="animate-spin h-4 w-4" /> : "دخول الفرع"}
              </Button>
            </form>
          </Card>
        )}

        <p className="text-center text-xs text-slate-400 mt-8">
          هذه الصفحة مخصصة لموظفي الفروع فقط
        </p>
      </div>
    </div>
  );
}

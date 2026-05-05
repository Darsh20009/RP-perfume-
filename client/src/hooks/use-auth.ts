import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type LoginRequest, type InsertUser } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/use-cart";

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const loadCartFromServer = useCart(s => s.loadFromServer);

  const { data: user, isLoading, error } = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return api.auth.me.responses[200].parse(await res.json());
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      if (!res.ok) {
        let serverMsg = "";
        try {
          const txt = await res.text();
          try {
            const j = JSON.parse(txt);
            serverMsg = j?.message || j?.error || txt;
          } catch {
            serverMsg = txt;
          }
        } catch {}
        if (!serverMsg) {
          serverMsg = res.status === 401
            ? "بيانات الدخول غير صحيحة"
            : res.status === 429
              ? "محاولات كثيرة، حاول بعد قليل"
              : "تعذّر تسجيل الدخول، حاول مرة أخرى";
        }
        throw new Error(serverMsg);
      }
      const data = await res.json();
      return {
        ...api.auth.login.responses[200].parse(data),
        redirectTo: data.redirectTo
      };
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.auth.me.path], data);
      toast({ title: "مرحباً", description: `تم الدخول بنجاح` });
      loadCartFromServer();
    },
    onError: (error: Error) => {
      toast({ title: "فشل الدخول", description: error.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch(api.auth.logout.path, { method: api.auth.logout.method, credentials: "include" });
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
      queryClient.clear();
      toast({ title: "Signed out" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      const res = await fetch(api.auth.register.path, {
        method: api.auth.register.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Registration failed");
      return api.auth.register.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      toast({ title: "Account created", description: "You can now log in." });
    },
    onError: (error: Error) => {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    },
  });

  return {
    user,
    isLoading,
    error,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    register: registerMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
  };
}

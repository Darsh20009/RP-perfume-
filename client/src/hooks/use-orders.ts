import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type Order, type InsertOrder } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "./use-auth";

export function useMyOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [api.orders.my.path],
    queryFn: async () => {
      const res = await fetch(api.orders.my.path);
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json() as Promise<Order[]>;
    },
    enabled: !!user,
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: async (order: InsertOrder) => {
      const res = await fetch(api.orders.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });
      if (!res.ok) throw new Error("Failed to create order");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.orders.my.path] });
      queryClient.invalidateQueries({ queryKey: [api.orders.list.path] });
    },
  });
}

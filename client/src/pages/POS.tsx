import { User, Product, Category, Branch, BranchInventory, Order } from "@shared/schema";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  Wallet,
  Barcode,
  Package,
  X,
  ChevronLeft,
  Loader2,
  Building
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";

interface CartItem {
  productId: string;
  variantSku: string;
  name: string;
  variantName: string;
  price: number;
  quantity: number;
  image?: string;
}

export default function POS() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedBranchId] = useState<string>(user?.branchId || "central");
  
  const { data: inventory } = useQuery<BranchInventory[]>({
    queryKey: ["/api/admin/inventory", selectedBranchId],
    enabled: !!selectedBranchId,
  });

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [manualDiscount, setManualDiscount] = useState(0);

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: customer } = useQuery<any>({
    queryKey: ["/api/admin/users/by-phone", customerPhone],
    enabled: customerPhone.length === 9 || customerPhone.length === 10,
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/by-phone/${customerPhone}`);
      if (!res.ok) return null;
      return res.json();
    }
  });

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
  }, [cart]);

  const loyaltyDiscount = useMemo(() => {
    if (!customer) return 0;
    // 10 points = 1 SAR discount
    return Math.min(Math.floor((customer.loyaltyPoints || 0) / 10), subtotal);
  }, [customer, subtotal]);

  const phoneDiscount = useMemo(() => {
    if (!customer || !customer.phoneDiscountEligible) return 0;
    // Apply 5% discount if eligible by phone/loyalty history
    return subtotal * 0.05;
  }, [customer, subtotal]);

  const totalDiscount = useMemo(() => {
    return loyaltyDiscount + phoneDiscount + manualDiscount;
  }, [loyaltyDiscount, phoneDiscount, manualDiscount]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - totalDiscount);
  }, [subtotal, totalDiscount]);

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: branch } = useQuery<Branch>({
    queryKey: ["/api/branches", user?.branchId],
    enabled: !!user?.branchId,
  });

  const handlePrintReceipt = (orderId: string) => {
    const printWindow = window.open('', '', 'height=600,width=400');
    if (!printWindow) return;
    
    const itemsHtml = cart.map(item => 
      `<div class="item"><span>${item.quantity}x ${item.name}</span><span>${(item.price * item.quantity).toFixed(2)} ر.س</span></div>`
    ).join('');
    
    const taxAmount = total * 0.15;
    const finalTotal = total + taxAmount;
    
    // ZATCA QR Code Data (Simplified for this version)
    // In a real production app, this would be a Base64 TLV encoded string
    const qrData = `Seller: ${branch?.name || "عطور آر اف"}\nVAT: 312037024200003\nTime: ${new Date().toISOString()}\nTotal: ${finalTotal.toFixed(2)}\nTax: ${taxAmount.toFixed(2)}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;

    const printContent = `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="utf-8">
  <title>فاتورة #${orderId.slice(-6).toUpperCase()}</title>
  <style>
    body { font-family: 'Cairo', sans-serif; text-align: right; padding: 10px; font-size: 12px; line-height: 1.2; color: #000; }
    .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
    .header h2 { margin: 0; font-size: 14px; }
    .header p { margin: 2px 0; font-size: 10px; }
    .info { margin-bottom: 8px; font-size: 10px; }
    .items { margin: 5px 0; border-bottom: 1px dashed #000; padding-bottom: 5px; }
    .item { display: flex; justify-content: space-between; padding: 2px 0; }
    .total-section { font-weight: bold; margin-top: 5px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
    .qr { text-align: center; margin-top: 10px; }
    .footer { text-align: center; margin-top: 10px; font-size: 9px; }
    @media print { body { width: 80mm; } }
  </style>
</head>
<body>
  <div class="header">
    <h2>${branch?.name || "عطور آر اف"}</h2>
    <p>الرقم الضريبي: 312037024200003</p>
    <p>فاتورة ضريبية مبسطة</p>
  </div>
  <div class="info">
    <div>الرقم: <strong>#${orderId.slice(-6).toUpperCase()}</strong></div>
    <div>التاريخ: ${new Date().toLocaleString('ar-SA')}</div>
    <div>الكاشير: ${user?.name}</div>
    <div>الفرع: ${branch?.name || "المركز الرئيسي"}</div>
  </div>
  <div class="items">
    ${itemsHtml}
  </div>
  <div class="total-section">
    <div class="item">
      <span>المجموع الفرعي:</span>
      <span>${total.toFixed(2)} ر.س</span>
    </div>
    <div class="item">
      <span>ضريبة القيمة المضافة (15%):</span>
      <span>${taxAmount.toFixed(2)} ر.س</span>
    </div>
    <div class="item" style="font-size: 14px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px;">
      <span>الإجمالي النهائي:</span>
      <span>${finalTotal.toFixed(2)} ر.س</span>
    </div>
  </div>
  <div class="qr">
    <img src="${qrUrl}" alt="QR" width="120" />
    <div style="font-size: 8px; margin-top: 3px;">فاتورة ضريبية معتمدة</div>
  </div>
  <div class="footer">
    شكراً لتسوقكم معنا<br/>
    Visit us at rfperfume.sa
  </div>
</body>
</html>`;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // Filtered products
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => {
      const prod = p as any;
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          (prod.variants && prod.variants.some((v: any) => v.sku.toLowerCase().includes(search.toLowerCase())));
      const pCatIds: string[] = (p as any).categoryIds?.length ? (p as any).categoryIds : (p as any).categoryId ? [(p as any).categoryId] : [];
      const matchesCategory = !selectedCategory || pCatIds.includes(selectedCategory);
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  const addToCart = (product: Product, variantSku: string) => {
    const prod = product as any;
    console.log(`[POS] addToCart called for product: ${product.name}, variant: ${variantSku}`);
    
    // Check if variants exist, if not create a default one to allow addition
    const variant = (prod.variants && prod.variants.length > 0) 
      ? prod.variants.find((v: any) => v.sku === variantSku)
      : (variantSku === "default" ? { sku: "default", color: "N/A", size: "N/A", stock: 999 } : null);
    
    if (!variant) {
      console.error(`[POS] Variant ${variantSku} not found for product ${product.name}`);
      toast({ variant: "destructive", title: "خطأ", description: "لم يتم العثور على هذا الخيار للمنتج" });
      return;
    }

    setCart(prev => {
      // Use both productId and variantSku to find uniqueness
      const existing = prev.find(item => item.variantSku === variantSku && item.productId === product.id);
      if (existing) {
        console.log(`[POS] Increasing quantity for existing item: ${variantSku}`);
        return prev.map(item => 
          (item.variantSku === variantSku && item.productId === product.id) ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      
      // Prefer per-variant price (e.g. different sizes have different prices),
      // then fall back to product base price. This was the bug where staff
      // saw the wrong price after configuring per-variant pricing.
      const variantPrice = Number((variant as any)?.price);
      const finalPrice = Number.isFinite(variantPrice) && variantPrice > 0
        ? variantPrice
        : Number(product.price);
      const newItem = {
        productId: product.id,
        variantSku: variant.sku,
        name: product.name,
        variantName: (variant.sku === "default" || (!variant.color && !variant.size)) ? "افتراضي" : `${variant.color || ""} / ${variant.size || ""}`,
        price: finalPrice,
        quantity: 1,
        image: variant.image || (product.images && product.images[0])
      };
      
      console.log(`[POS] Adding new item to cart:`, newItem);
      return [...prev, newItem];
    });
    
    toast({ title: "تمت الإضافة", description: `${product.name} أضيف إلى السلة` });
  };

  const removeFromCart = (sku: string) => {
    setCart(prev => prev.filter(item => item.variantSku !== sku));
  };

  const updateQuantity = (sku: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.variantSku === sku) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "wallet" | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: async (paymentMethod: string) => {
      const res = await apiRequest("POST", "/api/orders", {
        userId: customer?.id || user?.id, // Use customer id if searched for loyalty
        type: "pos",
        branchId: user?.branchId || "main",
        cashierId: user?.id,
        items: cart.map(item => ({
          productId: item.productId,
          variantSku: item.variantSku,
          quantity: item.quantity,
          price: item.price,
          cost: 0,
          title: item.name
        })),
        total: (total + (total * 0.15)).toString(),
        subtotal: total.toString(),
        vatAmount: (total * 0.15).toString(),
        shippingCost: "0",
        shippingMethod: "pickup",
        paymentMethod,
        status: "completed",
        paymentStatus: "paid",
        pointsEarned: Math.floor(total / 10), // Earn 1 point per 10 SAR
        pointsUsed: pointsToRedeem
      });
      return res.json();
    },
    onSuccess: async (data) => {
      toast({ title: "تم إتمام الطلب", description: "تم إصدار الفاتورة بنجاح" });
      handlePrintReceipt(data.id);
      setCart([]);
      setPaymentMethod(null);
      setCustomerPhone("");
      setPointsToRedeem(0);
      setManualDiscount(0);
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/by-phone"] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    }
  });

  // Barcode scanner simulation handler
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput) return;
    
    const product = products?.find(p => {
      const prod = p as any;
      return prod.variants?.some((v: any) => v.sku === barcodeInput);
    });
    if (product) {
      addToCart(product, barcodeInput);
      setBarcodeInput("");
      toast({ title: "تمت الإضافة", description: "تم مسح الباركود بنجاح" });
    } else {
      toast({ variant: "destructive", title: "خطأ", description: "الباركود غير معروف" });
    }
  };

  return (
    <div className="flex h-screen w-full bg-secondary/5 overflow-hidden" dir="rtl">
      {/* Back Button */}
      <div className="fixed bottom-4 left-4 z-50">
        <Button 
          variant="outline" 
          size="sm" 
          className="rounded-none bg-white shadow-lg border-black/10 hover:bg-black hover:text-white transition-all font-black text-[10px] uppercase tracking-widest"
          onClick={() => window.location.href = '/admin'}
        >
          <ChevronLeft className="ml-2 h-3 w-3" />
          لوحة التحكم
        </Button>
      </div>

      {/* Products Section */}
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        <header className="flex items-center gap-4 bg-white p-4 border border-black/5 shadow-sm">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="ابحث عن منتج أو امسح باركود..." 
              className="pr-10 rounded-none h-11 border-black/5"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <form onSubmit={handleBarcodeSubmit} className="w-48 relative">
            <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="الباركود..." 
              className="pr-10 rounded-none h-11 border-black/5 bg-secondary/20"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              autoFocus
            />
          </form>
          <div className="flex items-center gap-2 px-4 border-r border-black/10">
            <Building className="h-4 w-4 text-black/40" />
            <span className="text-xs font-black uppercase tracking-widest">{branch?.name || "المركز الرئيسي"}</span>
          </div>
        </header>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <Button 
            variant={selectedCategory === null ? "default" : "outline"}
            className="rounded-none h-9 font-bold text-xs"
            onClick={() => setSelectedCategory(null)}
          >
            الكل
          </Button>
          {categories?.map(cat => (
            <Button 
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              className="rounded-none h-9 font-bold text-xs"
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex items-center gap-4 bg-white p-4 border border-black/5 shadow-sm">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="رقم هاتف العميل لنقاط الولاء..." 
              className="pr-10 rounded-none h-11 border-black/5"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
          {customer && (
            <div className="px-4 border-r border-black/10 text-right">
              <p className="text-[10px] font-black uppercase">النقاط المتاحة</p>
              <p className="text-xs font-bold text-green-600">{customer.loyaltyPoints} نقطة ({loyaltyDiscount} SAR خصم)</p>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          {productsLoading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map(product => (
                <Card key={product.id} className="rounded-none border-black/5 hover-elevate overflow-hidden group">
                  <div className="aspect-square relative overflow-hidden bg-black/5">
                    {product.images[0] ? (
                      <img src={product.images[0]} className="w-full h-full object-cover transition-transform " />
                    ) : (
                      <Package className="w-12 h-12 absolute inset-0 m-auto text-black/10" />
                    )}
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-tight line-clamp-1">{product.name}</h3>
                    <p className="text-[8px] text-muted-foreground">المخزون: {(product as any).variants?.reduce((sum: number, v: any) => sum + v.stock, 0) || 0}</p>
                    <div className="flex flex-wrap gap-1">
                      {(product as any).variants && (product as any).variants.length > 0 ? (
                        (product as any).variants.map((v: any) => (
                          <div key={v.sku} className="flex gap-1 items-center">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-6 text-[8px] font-black rounded-none px-1.5"
                              onClick={() => {
                                console.log(`[POS] Adding variant to cart: ${v.sku}`);
                                addToCart(product, v.sku);
                              }}
                              disabled={selectedBranchId !== "central" && ((inventory?.find(i => i.variantSku === v.sku)?.stock || 0) <= 0)}
                            >
                              {v.size} / {v.color}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-none opacity-40 hover:opacity-100"
                              onClick={() => {
                                const printWindow = window.open('', '', 'height=200,width=400');
                                if (printWindow) {
                                  printWindow.document.write(`
                                    <html>
                                      <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; font-family:Arial;">
                                        <div style="font-weight:bold; margin-bottom:5px;">${product.name}</div>
                                        <div style="font-size:12px; margin-bottom:10px;">${v.color} - ${v.size}</div>
                                        <svg id="barcode"></svg>
                                        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                                        <script>
                                          JsBarcode("#barcode", "${v.sku}", {
                                            format: "CODE128",
                                            width: 2,
                                            height: 50,
                                            displayValue: true
                                          });
                                          setTimeout(() => window.print(), 500);
                                        </script>
                                      </body>
                                    </html>
                                  `);
                                  printWindow.document.close();
                                }
                              }}
                            >
                              <Barcode className="h-3 w-3" />
                            </Button>
                          </div>
                        ))
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-6 text-[8px] font-black rounded-none px-3"
                          onClick={() => {
                            console.log(`[POS] Adding default variant for: ${product.id}`);
                            addToCart(product, "default");
                          }}
                        >
                          إضافة للسلة
                        </Button>
                      )}
                    </div>
                    <p className="text-sm font-black">{product.price} SAR</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Cart Section */}
      <div className="w-[400px] bg-white border-r border-black/5 flex flex-col shadow-xl">
        <div className="p-4 border-b border-black/5 bg-black text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <h2 className="font-black uppercase tracking-widest text-sm">سلة البيع</h2>
          </div>
          <Badge variant="outline" className="text-white border-white/20 rounded-none font-bold">
            {cart.length} أصناف
          </Badge>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Package className="h-12 w-12 opacity-10 mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">السلة فارغة</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.variantSku} className="flex gap-3 bg-secondary/5 p-3 group relative">
                  <div className="w-12 h-12 bg-black/5 shrink-0 overflow-hidden">
                    {item.image && <img src={item.image} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[10px] font-black uppercase tracking-tight truncate">{item.name}</h4>
                    <p className="text-[9px] font-bold text-muted-foreground">{item.variantName}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <Button 
                          size="icon" 
                          variant="outline" 
                          className="h-6 w-6 rounded-none"
                          onClick={() => updateQuantity(item.variantSku, -1)}
                        >
                          <Minus className="h-3 h-3" />
                        </Button>
                        <span className="text-xs font-black w-6 text-center">{item.quantity}</span>
                        <Button 
                          size="icon" 
                          variant="outline" 
                          className="h-6 w-6 rounded-none"
                          onClick={() => updateQuantity(item.variantSku, 1)}
                        >
                          <Plus className="h-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-xs font-black">{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-black/5"
                    onClick={() => removeFromCart(item.variantSku)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Checkout Summary */}
        <div className="p-4 bg-secondary/10 border-t border-black/5 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-muted-foreground">
              <span>المجموع الفرعي</span>
              <span>{subtotal.toFixed(2)} SAR</span>
            </div>
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between text-xs font-bold text-green-600">
                <span>خصم النقاط</span>
                <span>-{loyaltyDiscount.toFixed(2)} SAR</span>
              </div>
            )}
            {phoneDiscount > 0 && (
              <div className="flex justify-between text-xs font-bold text-indigo-600">
                <span>خصم رقم الهاتف (5%)</span>
                <span>-{phoneDiscount.toFixed(2)} SAR</span>
              </div>
            )}
            {manualDiscount > 0 && (
              <div className="flex justify-between text-xs font-bold text-blue-600">
                <span>خصم إضافي</span>
                <span>-{manualDiscount.toFixed(2)} SAR</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-bold text-muted-foreground pt-1 border-t border-black/10">
              <span>ضريبة القيمة المضافة (15%)</span>
              <span>{(total * 0.15).toFixed(2)} SAR</span>
            </div>
            <div className="flex justify-between text-lg font-black pt-2 border-t-2 border-black/10">
              <span className="uppercase tracking-tighter">الإجمالي</span>
              <span>{(total + (total * 0.15)).toFixed(2)} SAR</span>
            </div>
          </div>
          
          {user?.permissions?.includes("orders.edit") && (
            <div className="space-y-2 p-3 bg-warning/5 border border-warning/20 rounded">
              <Label className="text-[10px] font-black uppercase">خصم إضافي (صلاحية الموظف)</Label>
              <div className="flex gap-2">
                <Input 
                  type="number" 
                  placeholder="0.00"
                  value={manualDiscount}
                  onChange={(e) => setManualDiscount(Math.max(0, Number(e.target.value)))}
                  className="h-8 text-sm rounded-none"
                  min="0"
                  step="0.5"
                  max={subtotal}
                />
                <span className="text-xs font-bold self-center">ر.س</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Button 
              variant={paymentMethod === "cash" ? "default" : "outline"} 
              className={`rounded-none flex-col h-16 gap-1 border-black/10 transition-all ${paymentMethod === "cash" ? "bg-black text-white" : "hover:bg-black hover:text-white"}`}
              onClick={() => setPaymentMethod("cash")}
            >
              <Banknote className="h-4 w-4" />
              <span className="text-[9px] font-black uppercase">نقداً</span>
            </Button>
            <Button 
              variant={paymentMethod === "card" ? "default" : "outline"} 
              className={`rounded-none flex-col h-16 gap-1 border-black/10 transition-all ${paymentMethod === "card" ? "bg-black text-white" : "hover:bg-black hover:text-white"}`}
              onClick={() => setPaymentMethod("card")}
            >
              <CreditCard className="h-4 w-4" />
              <span className="text-[9px] font-black uppercase">بطاقة</span>
            </Button>
            <Button 
              variant={paymentMethod === "wallet" ? "default" : "outline"} 
              className={`rounded-none flex-col h-16 gap-1 border-black/10 transition-all ${paymentMethod === "wallet" ? "bg-black text-white" : "hover:bg-black hover:text-white"}`}
              onClick={() => setPaymentMethod("wallet")}
            >
              <Wallet className="h-4 w-4" />
              <span className="text-[9px] font-black uppercase">محفظة</span>
            </Button>
          </div>

          {paymentMethod === "wallet" && (
            <div className="space-y-2 p-3 bg-primary/5 border border-primary/20 animate-in fade-in slide-in-from-top-1">
              <Label className="text-[10px] font-black uppercase">رصيد العميل في المحفظة</Label>
              {customer ? (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold">{customer.name}</span>
                  <span className={`text-sm font-black ${Number(customer.walletBalance) >= total ? 'text-green-600' : 'text-destructive'}`}>
                    {customer.walletBalance} ر.س
                  </span>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground italic">يرجى إدخال رقم هاتف العميل للتحقق من الرصيد</p>
              )}
            </div>
          )}

          <Button 
            className="w-full h-12 rounded-none font-black uppercase tracking-widest text-xs" 
            disabled={cart.length === 0 || !paymentMethod || checkoutMutation.isPending}
            onClick={() => paymentMethod && checkoutMutation.mutate(paymentMethod)}
          >
            {checkoutMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "تأكيد الطلب وإصدار الفاتورة"}
          </Button>
        </div>
      </div>
    </div>
  );
}

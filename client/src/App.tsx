import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useLanguage } from "@/hooks/use-language";
import { AuthProvider } from "@/components/auth-provider";
import { SplashScreen } from "@/components/SplashScreen";
import { useState, Component, ReactNode, lazy, Suspense } from "react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Products from "@/pages/Products";
import ProductDetails from "@/pages/ProductDetails";
import Cart from "@/pages/Cart";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { PWAPrompt } from "@/components/PWAPrompt";
import { IOSInstallGuide } from "@/components/IOSInstallGuide";

const ProfileInvoices = lazy(() => import("@/pages/ProfileInvoices"));
const Admin = lazy(() => import("@/pages/Admin"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Employees = lazy(() => import("@/pages/Employees"));
const Orders = lazy(() => import("@/pages/Orders"));
const OrderDetail = lazy(() => import("@/pages/OrderDetail"));
const Terms = lazy(() => import("@/pages/Terms"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ActivateAccount = lazy(() => import("@/pages/ActivateAccount"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const PaymentGateway = lazy(() => import("@/pages/PaymentGateway"));
const TamaraCheckout = lazy(() => import("@/pages/TamaraCheckout"));
const TabbyCheckout = lazy(() => import("@/pages/TabbyCheckout"));
const STCCheckout = lazy(() => import("@/pages/STCCheckout"));
const PaymobResult = lazy(() => import("@/pages/PaymobResult"));
const Profile = lazy(() => import("@/pages/Profile"));
const AdminBranches = lazy(() => import("@/pages/AdminBranches"));
const AdminBranchAnalytics = lazy(() => import("@/pages/AdminBranchAnalytics"));
const AdminBranchInventory = lazy(() => import("@/pages/AdminBranchInventory"));
const AdminStaff = lazy(() => import("@/pages/AdminStaff"));
const AdminBanners = lazy(() => import("@/pages/AdminBanners"));
const AdminAuditLogs = lazy(() => import("@/pages/AdminAuditLogs"));
const AdminRoles = lazy(() => import("@/pages/AdminRoles"));
const AdminShippingCompanies = lazy(() => import("@/pages/AdminShippingCompanies"));
const ProfileWishlist = lazy(() => import("@/pages/ProfileWishlist"));
const POS = lazy(() => import("@/pages/POS"));
const VendorApply = lazy(() => import("@/pages/VendorApply"));
const VendorDashboard = lazy(() => import("@/pages/VendorDashboard"));
const VendorStore = lazy(() => import("@/pages/VendorStore"));
const VendorsList = lazy(() => import("@/pages/VendorsList"));
const CashDrawer = lazy(() => import("@/pages/CashDrawer"));
const CashDrawerReport = lazy(() => import("@/pages/CashDrawerReport"));
const AdminAbandonedCarts = lazy(() => import("@/pages/AdminAbandonedCarts"));
const EmployeeInbox = lazy(() => import("@/pages/admin/AdminInbox"));
const AdminCancellationPolicy = lazy(() => import("@/pages/AdminCancellationPolicy"));
const CustomPage = lazy(() => import("@/pages/CustomPage"));
const Branches = lazy(() => import("@/pages/Branches"));
const BranchDashboard = lazy(() => import("@/pages/BranchDashboard"));

function LazyFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="h-8 w-8 animate-spin text-[#c9a96e]" />
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error("[ErrorBoundary] Caught error:", error.message, "\nStack:", error.stack, "\nInfo:", info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-8 text-center" dir="rtl">
          <h2 className="text-xl font-bold mb-3 text-slate-800">حدث خطأ غير متوقع</h2>
          <p className="text-slate-500 text-sm mb-6">يرجى إعادة تحميل الصفحة</p>
          {isDev && this.state.error && (
            <pre className="text-left text-xs text-red-600 bg-red-50 border border-red-200 rounded p-4 mb-4 max-w-2xl overflow-auto text-wrap">
              {this.state.error.message}{"\n"}{this.state.error.stack}
            </pre>
          )}
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            className="px-6 py-2 bg-black text-white text-sm font-bold rounded-none hover:bg-slate-800 transition-colors"
          >
            إعادة التحميل
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ component: Component, permission }: { component: React.ComponentType, permission?: string }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin" /></div>;
  if (!user) {
    const redirect = encodeURIComponent(location);
    return <Redirect to={`/login?redirect=${redirect}`} />;
  }

  if (permission && user.role !== "admin" && (!user.permissions || !user.permissions.includes(permission))) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8 text-center" dir="rtl">
        <h2 className="text-2xl font-bold mb-4">عذراً، ليس لديك صلاحية للوصول لهذه الصفحة</h2>
        <p className="text-muted-foreground">يرجى التواصل مع الإدارة إذا كنت تعتقد أن هذا خطأ.</p>
      </div>
    );
  }

  return <Component />;
}

function Router() {
  return (
    <Suspense fallback={<LazyFallback />}>
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/products" component={Products} />
      <Route path="/products/:id" component={ProductDetails} />
      <Route path="/cart" component={Cart} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/activate" component={ActivateAccount} />
      <Route path="/profile">
        <ProtectedRoute component={Profile} />
      </Route>
      <Route path="/profile/wishlist">
        <ProtectedRoute component={ProfileWishlist} />
      </Route>
      <Route path="/profile/invoices">
        <ProtectedRoute component={ProfileInvoices} />
      </Route>
      <Route path="/orders">
        <ProtectedRoute component={Orders} />
      </Route>
      <Route path="/orders/:id">
        <ProtectedRoute component={OrderDetail} />
      </Route>
      <Route path="/employees">
        <ProtectedRoute component={Employees} permission="staff.manage" />
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/inbox">
        <ProtectedRoute component={EmployeeInbox} />
      </Route>

      {/* Admin Section */}
      <Route path="/admin">
        <ProtectedRoute component={Admin} />
      </Route>
      <Route path="/admin/branches">
        <ProtectedRoute component={AdminBranches} permission="settings.manage" />
      </Route>
      <Route path="/admin/branch-analytics">
        <ProtectedRoute component={AdminBranchAnalytics} />
      </Route>
      <Route path="/admin/staff">
        <ProtectedRoute component={AdminStaff} permission="staff.manage" />
      </Route>
      <Route path="/admin/banners">
        <ProtectedRoute component={AdminBanners} permission="settings.manage" />
      </Route>
      <Route path="/admin/audit-logs">
        <ProtectedRoute component={AdminAuditLogs} permission="staff.manage" />
      </Route>
      <Route path="/admin/roles">
        <ProtectedRoute component={AdminRoles} permission="staff.manage" />
      </Route>
      <Route path="/admin/inventory">
        <ProtectedRoute component={AdminBranchInventory} permission="settings.manage" />
      </Route>
      <Route path="/admin/shipping">
        <ProtectedRoute component={AdminShippingCompanies} permission="settings.manage" />
      </Route>
      <Route path="/admin/abandoned-carts">
        <ProtectedRoute component={AdminAbandonedCarts} permission="customers.view" />
      </Route>
      <Route path="/admin/cancellation-policy">
        <ProtectedRoute component={AdminCancellationPolicy} permission="settings.manage" />
      </Route>

      <Route path="/pos">
        <ProtectedRoute component={POS} permission="pos.access" />
      </Route>
      <Route path="/cash-drawer">
        <ProtectedRoute component={CashDrawer} permission="pos.access" />
      </Route>
      <Route path="/cash-report">
        <ProtectedRoute component={CashDrawerReport} permission="reports.view" />
      </Route>
      <Route path="/payment/gateway" component={PaymentGateway} />
      <Route path="/payment/tamara-checkout" component={TamaraCheckout} />
      <Route path="/payment/tabby-checkout" component={TabbyCheckout} />
      <Route path="/payment/stc-checkout" component={STCCheckout} />
      <Route path="/paymob/result" component={PaymobResult} />
      <Route path="/terms" component={Terms} />
      <Route path="/pages/:slug" component={CustomPage} />
      <Route path="/branches" component={Branches} />
      <Route path="/branch-dashboard">
        <ProtectedRoute component={BranchDashboard} permission="branch.orders" />
      </Route>
      <Route path="/admin/stores">
        <ProtectedRoute component={VendorsList} permission="staff.manage" />
      </Route>
      <Route path="/admin/stores/:id">
        <ProtectedRoute component={VendorStore} permission="staff.manage" />
      </Route>
      <Route path="/vendor/apply">
        <ProtectedRoute component={VendorApply} />
      </Route>
      <Route path="/vendor/dashboard">
        <ProtectedRoute component={VendorDashboard} />
      </Route>
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function AppContent() {
  const { language } = useLanguage();

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
      <ErrorBoundary>
        <Router />
        <PWAPrompt />
        <IOSInstallGuide />
      </ErrorBoundary>
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(() => {
    const seen = sessionStorage.getItem("rf_splash_seen");
    return !seen;
  });

  const handleSplashFinish = () => {
    sessionStorage.setItem("rf_splash_seen", "1");
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="rf-perfume-theme">
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            {showSplash ? (
              <SplashScreen onFinish={handleSplashFinish} />
            ) : (
              <AppContent />
            )}
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

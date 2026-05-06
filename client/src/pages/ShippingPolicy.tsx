import { Layout } from "@/components/Layout";
import { Store, MapPin, Bell, Clock, Package, Phone } from "lucide-react";

const sections = [
  {
    icon: Store,
    title: "الاستلام من الفرع",
    content:
      "حالياً يتوفر الاستلام من فروعنا فقط. بعد إتمام طلبك ودفعه، يمكنك الحضور لأي فرع من فروع عطور آر اف لاستلام طلبك. يُرجى إحضار رقم الطلب أو رسالة التأكيد عند الاستلام.",
  },
  {
    icon: Bell,
    title: "إشعار الجاهزية",
    content:
      "ستصلك رسالة نصية أو إشعار عبر البريد الإلكتروني فور جاهزية طلبك للاستلام. في العادة يُجهّز الطلب خلال ١-٢ ساعة من تأكيد الدفع خلال أوقات الدوام الرسمي. يُرجى انتظار إشعار الجاهزية قبل المجيء للفرع.",
  },
  {
    icon: Clock,
    title: "مدة الاحتفاظ بالطلب",
    content:
      "يُحتفظ بطلبك في الفرع لمدة ٧ أيام من تاريخ إشعار الجاهزية. في حال عدم الاستلام خلال هذه المدة، يُرجى التواصل مع خدمة العملاء لترتيب موعد بديل. قد يُلغى الطلب بعد انتهاء المدة مع استرداد كامل للمبلغ.",
  },
  {
    icon: MapPin,
    title: "فروع الاستلام",
    content:
      "يمكنك الاستلام من أي فرع من فروع عطور آر اف المتاحة في المملكة العربية السعودية. لعرض جميع الفروع ومواقعها وأوقات العمل، يُرجى زيارة صفحة الفروع على موقعنا.",
  },
  {
    icon: Package,
    title: "التغليف والجودة",
    content:
      "جميع منتجاتنا تُعبّأ بعناية فائقة في علب فاخرة تعكس هوية عطور آر اف. يُرجى فحص الطلب عند الاستلام والتأكد من مطابقته للطلب قبل المغادرة. في حال وجود أي ملاحظة، أخبر الموظف فوراً.",
  },
  {
    icon: Phone,
    title: "تواصل معنا",
    content:
      "لأي استفسار حول طلبك أو مواعيد الاستلام، تواصل معنا عبر: واتساب 966551329821+ أو البريد الإلكتروني support@rfperfume.sa. فريق خدمة العملاء متاح من السبت إلى الخميس من ٩ صباحاً حتى ١٠ مساءً.",
  },
];

export default function ShippingPolicy() {
  return (
    <Layout>
      <div className="min-h-screen bg-white" dir="rtl">

        {/* Hero */}
        <div className="relative bg-gradient-to-br from-[#1a1a3e] via-[#2B2B60] to-[#1a1a3e] text-white overflow-hidden">
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(ellipse at 20% 50%, #DFB369 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, #DFB369 0%, transparent 60%)" }} />
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23DFB369' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E\")" }} />
          <div className="container relative px-4 py-16 sm:py-20 md:py-28 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-5 bg-[#DFB369]/10 border border-[#DFB369]/30 rounded-2xl flex items-center justify-center">
              <Store className="h-7 w-7 text-[#DFB369]" />
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight mb-3">سياسة الشحن والتوصيل</h1>
            <div className="w-16 h-0.5 bg-[#DFB369] mx-auto mb-4" />
            <p className="max-w-xl mx-auto text-sm sm:text-base text-white/70 font-medium leading-relaxed">
              معلومات حول استلام طلباتك من فروع عطور آر اف
            </p>
          </div>
        </div>

        {/* Pickup-only notice */}
        <div className="bg-[#DFB369]/8 border-b border-[#DFB369]/20">
          <div className="container px-4 py-5 max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-3 text-center">
              <MapPin className="h-5 w-5 text-[#DFB369] shrink-0" />
              <p className="text-sm font-bold text-[#2B2B60]">
                الاستلام من الفروع متاح — يتم إشعارك فور جاهزية طلبك
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container px-4 py-12 sm:py-16 max-w-3xl mx-auto">
          <div className="space-y-6">
            {sections.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-[#2B2B60]/5 rounded-xl flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-[#2B2B60]" />
                    </div>
                    <h2 className="text-base sm:text-lg font-black text-[#2B2B60] tracking-wide">{s.title}</h2>
                  </div>
                  <p className="text-sm sm:text-[15px] text-gray-600 leading-relaxed">{s.content}</p>
                </div>
              );
            })}
          </div>

          {/* CTA: Branches */}
          <div className="mt-8 p-6 bg-gradient-to-br from-[#2B2B60] to-[#1a1a3e] rounded-2xl text-white text-center">
            <MapPin className="h-8 w-8 text-[#DFB369] mx-auto mb-3" />
            <p className="font-black text-base mb-1">ابحث عن أقرب فرع إليك</p>
            <p className="text-xs text-white/60 mb-4">اعرض مواقع الفروع وأوقات الدوام</p>
            <a
              href="/branches"
              className="inline-block px-8 py-3 bg-[#DFB369] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-[#c89853] transition-colors"
            >
              عرض الفروع
            </a>
          </div>

          <div className="mt-6 p-6 bg-[#2B2B60]/3 border border-[#DFB369]/20 rounded-2xl text-center">
            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
              تُطبَّق هذه السياسة على جميع طلبات متجر عطور آر اف الإلكتروني. نحتفظ بحق تعديلها في أي وقت.
            </p>
            <p className="text-xs text-[#DFB369] font-bold mt-3 tracking-widest uppercase">عطور آر اف — RF Perfume</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

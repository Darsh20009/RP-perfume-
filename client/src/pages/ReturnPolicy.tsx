import { Layout } from "@/components/Layout";
import { RotateCcw, CheckCircle, XCircle, Clock, Wallet, Phone } from "lucide-react";

const sections = [
  {
    icon: Clock,
    title: "مدة الاسترجاع",
    content:
      "يحق لك إرجاع أي منتج خلال ٧ أيام من تاريخ الاستلام، شريطة أن يكون المنتج في حالته الأصلية وغير مستخدم، مع الاحتفاظ بالتغليف والعبوة الأصلية كاملة. لا تُقبل طلبات الإرجاع بعد انتهاء هذه المدة.",
  },
  {
    icon: CheckCircle,
    title: "شروط قبول الإرجاع",
    content:
      "يُقبل الإرجاع في الحالات التالية: المنتج لم يُستخدم ولا يزال مختوماً بتغليفه الأصلي، وجود عيب تصنيعي أو خلل واضح، استلام منتج مختلف عما طُلب. يجب تقديم طلب الإرجاع عبر خدمة العملاء مع إرفاق صورة واضحة للمنتج وفاتورة الشراء.",
  },
  {
    icon: XCircle,
    title: "حالات عدم قبول الإرجاع",
    content:
      "لا يُقبل الإرجاع في الحالات التالية: المنتجات المستخدمة أو التالفة بعد الاستلام، المنتجات المخصصة أو المعدّلة بطلب خاص، تجاوز مدة الإرجاع المحددة (٧ أيام)، منتجات العروض والتخفيضات الخاصة التي تُحدد إشعارات بعدم إرجاعها.",
  },
  {
    icon: Wallet,
    title: "استرداد المبلغ",
    content:
      "بعد استلام المنتج المُعاد والتحقق منه، يتم استرداد المبلغ كاملاً خلال ٥-٧ أيام عمل على نفس وسيلة الدفع المستخدمة. في حال الدفع نقداً، يُضاف المبلغ إلى محفظتك الإلكترونية في المتجر لاستخدامه في عمليات الشراء القادمة.",
  },
  {
    icon: RotateCcw,
    title: "الاستبدال",
    content:
      "يمكنك استبدال المنتج بآخر من نفس الفئة أو قيمة مساوية خلال مدة الإرجاع المحددة، وذلك في حال توفر المنتج المطلوب في المخزون. إن كان المنتج البديل أعلى سعراً، يُدفع فرق السعر؛ وإن كان أقل، يُضاف الفرق لمحفظتك.",
  },
  {
    icon: Phone,
    title: "كيفية طلب الإرجاع",
    content:
      "للبدء بعملية الإرجاع أو الاستبدال، تواصل معنا عبر: واتساب 966551329821+ أو البريد الإلكتروني support@rfperfume.sa مع ذكر رقم الطلب وسبب الإرجاع وصورة للمنتج. سيتواصل معك فريقنا خلال ٢٤ ساعة لإتمام الإجراءات.",
  },
];

export default function ReturnPolicy() {
  return (
    <Layout>
      <div className="min-h-screen bg-white" dir="rtl">

        {/* Hero */}
        <div className="relative bg-gradient-to-br from-[#1a1a3e] via-[#2B2B60] to-[#1a1a3e] text-white overflow-hidden">
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(ellipse at 20% 50%, #DFB369 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, #DFB369 0%, transparent 60%)" }} />
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23DFB369' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E\")" }} />
          <div className="container relative px-4 py-16 sm:py-20 md:py-28 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-5 bg-[#DFB369]/10 border border-[#DFB369]/30 rounded-2xl flex items-center justify-center">
              <RotateCcw className="h-7 w-7 text-[#DFB369]" />
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight mb-3">سياسة الاسترجاع والاستبدال</h1>
            <div className="w-16 h-0.5 bg-[#DFB369] mx-auto mb-4" />
            <p className="max-w-xl mx-auto text-sm sm:text-base text-white/70 font-medium leading-relaxed">
              رضاك التام أولويتنا — نضمن لك تجربة شراء آمنة ومريحة
            </p>
          </div>
        </div>

        {/* Summary banner */}
        <div className="bg-[#DFB369]/8 border-b border-[#DFB369]/20">
          <div className="container px-4 py-5 max-w-3xl mx-auto">
            <div className="flex flex-wrap justify-center gap-6 sm:gap-10 text-center">
              {[
                { label: "مدة الإرجاع", value: "٧ أيام" },
                { label: "وقت الاسترداد", value: "٥-٧ أيام عمل" },
                { label: "الاستبدال", value: "متاح" },
              ].map((item, i) => (
                <div key={i}>
                  <p className="text-lg sm:text-xl font-black text-[#2B2B60]">{item.value}</p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">{item.label}</p>
                </div>
              ))}
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

          <div className="mt-10 p-6 bg-[#2B2B60]/3 border border-[#DFB369]/20 rounded-2xl text-center">
            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
              تسري هذه السياسة على جميع مشتريات متجر عطور آر اف الإلكتروني والفروع. نحتفظ بحق تعديل هذه السياسة في أي وقت.
            </p>
            <p className="text-xs text-[#DFB369] font-bold mt-3 tracking-widest uppercase">عطور آر اف — RF Perfume</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

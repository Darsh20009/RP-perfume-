import { Layout } from "@/components/Layout";
import { FileText, ShieldCheck, CreditCard, Package, User, AlertCircle } from "lucide-react";

const sections = [
  {
    icon: FileText,
    title: "قبول الشروط",
    content:
      "بزيارتك أو استخدامك لمتجر عطور آر اف الإلكتروني أو تطبيقه أو أي من خدماته، فإنك تُقر بقراءتك وفهمك وموافقتك على الالتزام بجميع الشروط والأحكام الواردة أدناه. في حال عدم موافقتك على أي من هذه الشروط، يُرجى التوقف عن استخدام خدماتنا.",
  },
  {
    icon: AlertCircle,
    title: "تعديل الشروط",
    content:
      "تحتفظ عطور آر اف بالحق الكامل في تعديل أو تحديث هذه الشروط والأحكام في أي وقت دون إشعار مسبق. تكون هذه التعديلات سارية المفعول فور نشرها على الموقع. يُرجى مراجعة هذه الصفحة بانتظام للاطلاع على أي تغييرات.",
  },
  {
    icon: Package,
    title: "المنتجات والطلبات",
    content:
      "جميع منتجاتنا من عطور وبخور فاخرة أصيلة 100%. نحتفظ بحق رفض أي طلب أو إلغائه في حالات التلاعب أو توفر معلومات غير صحيحة. الأسعار المعروضة بالريال السعودي وتشمل ضريبة القيمة المضافة وقد تتغير دون إشعار مسبق. تأكيد الطلب عبر البريد الإلكتروني أو الرسائل النصية لا يُعدّ ضماناً نهائياً بتوفر المنتج.",
  },
  {
    icon: CreditCard,
    title: "الدفع",
    content:
      "نقبل مجموعة من وسائل الدفع الآمنة تشمل: بطاقات الائتمان والخصم، STC Pay، Apple Pay، Tabby، وتمارة. لا يتم تخزين بيانات بطاقاتك المصرفية على خوادمنا — جميع معاملات الدفع تتم عبر بوابات دفع مشفرة ومعتمدة. في حال فشل الدفع، يُرجى التواصل مع البنك أو مزود الخدمة.",
  },
  {
    icon: User,
    title: "حساب المستخدم",
    content:
      "أنت مسؤول عن الحفاظ على سرية بيانات حسابك وكلمة مرورك وعن جميع الأنشطة التي تتم من خلاله. في حال اشتباهك بوجود استخدام غير مصرح به لحسابك، يُرجى التواصل معنا فوراً عبر خدمة العملاء.",
  },
  {
    icon: ShieldCheck,
    title: "الملكية الفكرية",
    content:
      "جميع المحتويات الواردة في هذا الموقع، بما تشمل الشعارات والصور والنصوص والتصاميم، هي ملك حصري لعطور آر اف محمية بموجب قوانين الملكية الفكرية. يُحظر نسخ أي محتوى أو إعادة توزيعه دون إذن كتابي مسبق.",
  },
];

export default function Terms() {
  return (
    <Layout>
      <div className="min-h-screen bg-white" dir="rtl">

        {/* Hero */}
        <div className="relative bg-gradient-to-br from-[#1a1a3e] via-[#2B2B60] to-[#1a1a3e] text-white overflow-hidden">
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(ellipse at 20% 50%, #DFB369 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, #DFB369 0%, transparent 60%)" }} />
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23DFB369' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E\")" }} />
          <div className="container relative px-4 py-16 sm:py-20 md:py-28 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-5 bg-[#DFB369]/10 border border-[#DFB369]/30 rounded-2xl flex items-center justify-center">
              <FileText className="h-7 w-7 text-[#DFB369]" />
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight mb-3">الشروط والأحكام</h1>
            <div className="w-16 h-0.5 bg-[#DFB369] mx-auto mb-4" />
            <p className="max-w-xl mx-auto text-sm sm:text-base text-white/70 font-medium leading-relaxed">
              يُرجى قراءة هذه الشروط بعناية قبل استخدام خدمات متجر عطور آر اف
            </p>
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

          {/* Footer note */}
          <div className="mt-10 p-6 bg-[#2B2B60]/3 border border-[#DFB369]/20 rounded-2xl text-center">
            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
              بدخولك إلى الموقع أو استخدامك لخدماتنا، فأنت توافق على الالتزام بهذه الشروط وجميع القوانين واللوائح المعمول بها في المملكة العربية السعودية.
            </p>
            <p className="text-xs text-[#DFB369] font-bold mt-3 tracking-widest uppercase">عطور آر اف — RF Perfume</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

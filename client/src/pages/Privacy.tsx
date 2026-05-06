import { Layout } from "@/components/Layout";
import { ShieldCheck, Database, Share2, Lock, Eye, Mail } from "lucide-react";

const sections = [
  {
    icon: Database,
    title: "المعلومات التي نجمعها",
    content:
      "نجمع المعلومات التي تقدمها عند إنشاء حساب أو تقديم طلب، وتشمل: الاسم الكامل، رقم الجوال، عنوان البريد الإلكتروني، عنوان الاستلام. كما قد نجمع بيانات تلقائية مثل عنوان IP ونوع المتصفح وصفحات الزيارة لتحسين تجربتك على الموقع.",
  },
  {
    icon: Eye,
    title: "كيف نستخدم معلوماتك",
    content:
      "نستخدم بياناتك الشخصية لأغراض محددة فقط تشمل: معالجة طلباتك وتأكيدها، التواصل معك بشأن حالة الطلب، إرسال عروض وإشعارات مخصصة (بموافقتك)، تحسين منتجاتنا وخدماتنا، والامتثال للمتطلبات القانونية والتنظيمية في المملكة العربية السعودية.",
  },
  {
    icon: Share2,
    title: "مشاركة المعلومات",
    content:
      "لا نبيع بياناتك الشخصية لأطراف ثالثة. قد نشارك معلومات محدودة مع شركاء موثوقين مثل شركات الشحن وبوابات الدفع لإتمام طلباتك فحسب. جميع شركائنا ملزمون بمعايير صارمة لحماية بياناتك.",
  },
  {
    icon: Lock,
    title: "حماية البيانات",
    content:
      "نستخدم تقنيات تشفير متطورة (SSL/TLS) لحماية جميع بياناتك أثناء النقل والتخزين. لا نحتفظ ببيانات بطاقاتك البنكية على خوادمنا — تتم جميع عمليات الدفع عبر بوابات مشفرة ومعتمدة. نُجري مراجعات أمنية دورية لضمان سلامة منظومتنا.",
  },
  {
    icon: ShieldCheck,
    title: "حقوقك",
    content:
      "يحق لك في أي وقت: الاطلاع على البيانات التي نحتفظ بها، تصحيح أي بيانات غير دقيقة، طلب حذف حسابك وبياناتك، إلغاء الاشتراك في النشرات البريدية. لممارسة أي من هذه الحقوق، تواصل معنا عبر البريد الإلكتروني أو خدمة العملاء.",
  },
  {
    icon: Mail,
    title: "التواصل معنا",
    content:
      "إن كان لديك أي استفسار حول سياسة الخصوصية أو طريقة تعاملنا مع بياناتك، يُرجى التواصل معنا عبر: البريد الإلكتروني support@rfperfume.sa أو عبر واتساب على الرقم 966551329821+.",
  },
];

export default function Privacy() {
  return (
    <Layout>
      <div className="min-h-screen bg-white" dir="rtl">

        {/* Hero */}
        <div className="relative bg-gradient-to-br from-[#1a1a3e] via-[#2B2B60] to-[#1a1a3e] text-white overflow-hidden">
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(ellipse at 20% 50%, #DFB369 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, #DFB369 0%, transparent 60%)" }} />
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23DFB369' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E\")" }} />
          <div className="container relative px-4 py-16 sm:py-20 md:py-28 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-5 bg-[#DFB369]/10 border border-[#DFB369]/30 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-[#DFB369]" />
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight mb-3">سياسة الخصوصية</h1>
            <div className="w-16 h-0.5 bg-[#DFB369] mx-auto mb-4" />
            <p className="max-w-xl mx-auto text-sm sm:text-base text-white/70 font-medium leading-relaxed">
              نلتزم بحماية خصوصيتك وأمان بياناتك الشخصية بأعلى المعايير
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

          <div className="mt-10 p-6 bg-[#2B2B60]/3 border border-[#DFB369]/20 rounded-2xl text-center">
            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
              تُطبَّق هذه السياسة على جميع خدمات ومنصات عطور آر اف الرقمية. آخر تحديث: ٢٠٢٦
            </p>
            <p className="text-xs text-[#DFB369] font-bold mt-3 tracking-widest uppercase">عطور آر اف — RF Perfume</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

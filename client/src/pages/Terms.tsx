import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";

export default function Terms() {
  return (
    <Layout>
      <div className="container px-4 py-24 max-w-4xl mx-auto" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white p-8 md:p-12 shadow-sm border border-black/5"
        >
          <h1 className="text-3xl md:text-5xl font-black mb-12 text-black uppercase tracking-tighter">الشروط والأحكام</h1>
          
          <div className="space-y-12 text-muted-foreground leading-relaxed text-sm md:text-base">
            <section>
              <p className="font-bold text-black mb-4">نرجو قراءة الشروط والأحكام بعناية قبل البدء.</p>
              <p>بتسجيلك وشرائك لأي من منتجات متجرنا المختلفة، فإنك تُقر بموافقتك على جميع الشروط والأحكام الواردة أدناه، بالإضافة إلى سياسة الخصوصية. في حال عدم موافقتك على أي من الشروط والأحكام الواردة أدناه، يُرجى التوقف عن استخدام خدمات متجرنا.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-black mb-4 uppercase tracking-widest">تعديل الشروط</h2>
              <p>يحتفظ متجر جين إم زد بالحق الكامل في تعديل أو تغيير أو تحديث هذه الشروط والأحكام في أي وقت، وتكون هذه التعديلات أو التغييرات أو التحديثات ملزمة للمشتري فور صدورها. لذلك، يُرجى الاطلاع عليها باستمرار قبل الشراء من الموقع.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-black mb-4 uppercase tracking-widest">عن الموقع</h2>
              <p>يُعد الموقع أو متجر جين إم زد متجرًا لبيع الملابس داخل المملكة العربية السعودية من خلال موقعنا الإلكتروني.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-black mb-4 uppercase tracking-widest">سياسة الخصوصية</h2>
              <p>توضح سياسة الخصوصية كيفية جمع واستخدام المعلومات الشخصية التي تقدمها عبر موقعنا، وذلك لأغراض الشحن والتوصيل، وتقديم العروض الدقيقة، وإرسال النشرات البريدية والعروض الخاصة بنا وبشركائنا. كما توضح الخيارات المتاحة لك بخصوص استخدامنا لمعلوماتك الشخصية، وكيف يمكنك الوصول إليها وتحديثها.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-black mb-4 uppercase tracking-widest">مشاركة المعلومات</h2>
              <p>قد يتيح متجر جين إم زد بعض التفاصيل الشخصية مثل اسم المستخدم، عنوان البريد الإلكتروني، ورقم الهاتف لشركات أخرى لأغراض التوصيل، التسليم، والتسويق.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-black mb-4 uppercase tracking-widest">حماية البيانات</h2>
              <p>تُعد حماية البيانات مسألة مهمة لمتجر جين إم زد ، ولذلك يستخدم المتجر المعلومات فقط بالطريقة الموضحة في سياسة الخصوصية هذه، لغرض توصيل وتوثيق الطلب باسمك وبياناتك وإيصالها بالشكل السليم، وكذلك لغرض إرسال العروض أو رسائل التوصيل إلى رقمك أو بريدك الإلكتروني من خلال المتجر أو شركائه.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-black mb-4 uppercase tracking-widest">الدفع</h2>
              <p>لا يقوم الموقع بتخزين بيانات بطاقتك الائتمانية على الموقع الإلكتروني، فجميع معلوماتك يتم تشفيرها بالكامل بغرض الحماية.</p>
            </section>

            <section>
              <p className="italic border-t pt-8">بدخولك إلى الموقع فأنت توافق على الإلتزام بهذه الشروط، وعلى جميع القوانين واللوائح المعمول بها، وتقر كذلك بأنك مسئول عن الإمتثال لأي قوانين محلية سارية. إذا كنت لا توافق على أي من هذه الشروط، فلا يحق لك استخدام أو الدخول إلى هذا الموقع.</p>
            </section>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}

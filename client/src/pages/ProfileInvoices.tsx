import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { Invoice } from "@shared/schema";
import { format } from "date-fns";
import { FileText, Download, Eye, X } from "lucide-react";
import { useState } from "react";

function printInvoice(invoice: Invoice, language: string) {
  const isAr = language === "ar";
  const html = `<!DOCTYPE html>
<html dir="${isAr ? "rtl" : "ltr"}" lang="${isAr ? "ar" : "en"}">
<head>
  <meta charset="UTF-8" />
  <title>${isAr ? "فاتورة" : "Invoice"} ${invoice.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; padding: 32px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 24px; }
    .brand { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
    .brand-sub { font-size: 10px; color: #888; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
    .invoice-meta { text-align: ${isAr ? "left" : "right"}; }
    .invoice-meta .inv-num { font-size: 18px; font-weight: 900; }
    .invoice-meta .inv-date { font-size: 11px; color: #666; margin-top: 4px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #888; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .info-block p { font-size: 12px; color: #333; line-height: 1.6; }
    .info-block strong { font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f4f4f4; text-align: ${isAr ? "right" : "left"}; padding: 8px 10px; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #555; }
    td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; font-size: 12px; }
    tr:last-child td { border-bottom: none; }
    .totals { margin-${isAr ? "left" : "right"}: 0; margin-${isAr ? "right" : "left"}: auto; width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; border-bottom: 1px solid #f0f0f0; }
    .total-row:last-child { border-bottom: none; font-weight: 900; font-size: 14px; border-top: 2px solid #111; margin-top: 4px; padding-top: 8px; }
    .status-badge { display: inline-block; padding: 3px 10px; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; background: #f0f9f0; color: #16a34a; border: 1px solid #bbf7d0; }
    .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 16px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">رفيف العود</div>
      <div class="brand-sub">${isAr ? "فاتورة ضريبية" : "Tax Invoice"}</div>
    </div>
    <div class="invoice-meta">
      <div class="inv-num">${invoice.invoiceNumber}</div>
      <div class="inv-date">${isAr ? "تاريخ الإصدار:" : "Issue Date:"} ${format(new Date(invoice.issueDate), "yyyy-MM-dd")}</div>
      ${invoice.dueDate ? `<div class="inv-date">${isAr ? "تاريخ الاستحقاق:" : "Due Date:"} ${format(new Date(invoice.dueDate), "yyyy-MM-dd")}</div>` : ""}
      <div style="margin-top:6px"><span class="status-badge">${(invoice as any).status === "paid" ? (isAr ? "مدفوعة" : "PAID") : ["pending","draft","issued"].includes((invoice as any).status) ? (isAr ? "معلقة" : "PENDING") : (invoice as any).status}</span></div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-block">
      <div class="section-title">${isAr ? "من" : "From"}</div>
      <p><strong>رفيف العود</strong></p>
      <p>${isAr ? "المملكة العربية السعودية" : "Saudi Arabia"}</p>
    </div>
    ${invoice.customerId ? `<div class="info-block">
      <div class="section-title">${isAr ? "إلى" : "To"}</div>
      <p><strong>${isAr ? "العميل" : "Customer"}</strong></p>
      <p>${invoice.customerId}</p>
    </div>` : ""}
  </div>

  ${invoice.items && (invoice.items as any[]).length > 0 ? `
  <div class="section">
    <div class="section-title">${isAr ? "البنود" : "Line Items"}</div>
    <table>
      <thead>
        <tr>
          <th>${isAr ? "الوصف" : "Description"}</th>
          <th style="text-align:center">${isAr ? "الكمية" : "Qty"}</th>
          <th style="text-align:${isAr ? "left" : "right"}">${isAr ? "السعر" : "Unit Price"}</th>
          <th style="text-align:${isAr ? "left" : "right"}">${isAr ? "الإجمالي" : "Total"}</th>
        </tr>
      </thead>
      <tbody>
        ${(invoice.items as any[]).map((item: any) => `
        <tr>
          <td>${item.description || item.name || ""}</td>
          <td style="text-align:center">${item.quantity || 1}</td>
          <td style="text-align:${isAr ? "left" : "right"}">${Number(item.unitPrice || item.price || 0).toFixed(2)} ${isAr ? "ر.س" : "SAR"}</td>
          <td style="text-align:${isAr ? "left" : "right"}">${Number(item.total || (item.quantity || 1) * (item.unitPrice || item.price || 0)).toFixed(2)} ${isAr ? "ر.س" : "SAR"}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>` : ""}

  <div class="totals">
    ${invoice.subtotal != null ? `<div class="total-row"><span>${isAr ? "المجموع الفرعي" : "Subtotal"}</span><span>${Number(invoice.subtotal).toFixed(2)} ${isAr ? "ر.س" : "SAR"}</span></div>` : ""}
    ${invoice.discount != null && Number(invoice.discount) > 0 ? `<div class="total-row"><span>${isAr ? "الخصم" : "Discount"}</span><span>-${Number(invoice.discount).toFixed(2)} ${isAr ? "ر.س" : "SAR"}</span></div>` : ""}
    ${invoice.tax != null ? `<div class="total-row"><span>${isAr ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)"}</span><span>${Number(invoice.tax).toFixed(2)} ${isAr ? "ر.س" : "SAR"}</span></div>` : ""}
    <div class="total-row"><span>${isAr ? "الإجمالي الكلي" : "Grand Total"}</span><span>${Number(invoice.total).toFixed(2)} ${isAr ? "ر.س" : "SAR"}</span></div>
  </div>

  ${invoice.notes ? `<div class="section" style="margin-top:24px"><div class="section-title">${isAr ? "ملاحظات" : "Notes"}</div><p style="font-size:12px;color:#555">${invoice.notes}</p></div>` : ""}

  <div class="footer">
    رفيف العود &bull; ${isAr ? "شكراً لتعاملكم معنا" : "Thank you for your business"}
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

export default function ProfileInvoices() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const [viewing, setViewing] = useState<Invoice | null>(null);

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  if (isLoading) return <div className="p-8 text-center">{t("loading")}</div>;

  return (
    <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      <h2 className="text-2xl font-bold font-display">{isAr ? "فواتيري" : "My Invoices"}</h2>

      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div
            className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-none shadow-2xl"
            onClick={e => e.stopPropagation()}
            dir={isAr ? "rtl" : "ltr"}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-black text-base">{viewing.invoiceNumber}</h3>
              <button onClick={() => setViewing(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" data-testid="button-close-invoice">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">{isAr ? "فاتورة ضريبية" : "Tax Invoice"}</p>
                  <p className="font-black text-xl mt-1">رفيف العود</p>
                </div>
                <div className={isAr ? "text-left" : "text-right"}>
                  <p className="font-black text-lg">{viewing.invoiceNumber}</p>
                  <p className="text-xs text-slate-400 mt-1">{format(new Date(viewing.issueDate), "yyyy-MM-dd")}</p>
                  <span className={`inline-block mt-2 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-none ${
                    viewing.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                    (["pending","draft","issued"] as string[]).includes(viewing.status) ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {viewing.status === "paid" ? (isAr ? "مدفوعة" : "PAID") :
                     (["pending","draft","issued"] as string[]).includes(viewing.status) ? (isAr ? "معلقة" : "PENDING") : viewing.status}
                  </span>
                </div>
              </div>

              {viewing.items && (viewing.items as any[]).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2 mb-3">{isAr ? "البنود" : "Line Items"}</p>
                  <div className="space-y-2">
                    {(viewing.items as any[]).map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm" data-testid={`row-invoice-item-${idx}`}>
                        <span className="text-slate-700">{item.description || item.name || `${isAr ? "منتج" : "Item"} ${idx + 1}`}</span>
                        <div className="flex items-center gap-4 text-slate-600">
                          <span className="text-xs">×{item.quantity || 1}</span>
                          <span className="font-bold">{Number(item.total || 0).toFixed(2)} {isAr ? "ر.س" : "SAR"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`border-t border-slate-100 pt-4 space-y-2 ${isAr ? "text-left" : "text-right"}`}>
                {viewing.subtotal != null && (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>{isAr ? "المجموع الفرعي" : "Subtotal"}</span>
                    <span>{Number(viewing.subtotal).toFixed(2)} {isAr ? "ر.س" : "SAR"}</span>
                  </div>
                )}
                {viewing.discount != null && Number(viewing.discount) > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>{isAr ? "الخصم" : "Discount"}</span>
                    <span>-{Number(viewing.discount).toFixed(2)} {isAr ? "ر.س" : "SAR"}</span>
                  </div>
                )}
                {viewing.tax != null && (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>{isAr ? "ضريبة القيمة المضافة" : "VAT (15%)"}</span>
                    <span>{Number(viewing.tax).toFixed(2)} {isAr ? "ر.س" : "SAR"}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-base border-t border-slate-200 pt-2 mt-2">
                  <span>{isAr ? "الإجمالي" : "Total"}</span>
                  <span>{Number(viewing.total).toFixed(2)} {isAr ? "ر.س" : "SAR"}</span>
                </div>
              </div>

              {viewing.notes && (
                <div className="bg-slate-50 p-3 rounded-none text-sm text-slate-600">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{isAr ? "ملاحظات" : "Notes"}</p>
                  {viewing.notes}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => printInvoice(viewing, language)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors rounded-none"
                data-testid="button-download-invoice"
              >
                <Download className="w-4 h-4" />
                {isAr ? "تحميل PDF" : "Download PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {!invoices || invoices.length === 0 ? (
          <p className="text-muted-foreground">{isAr ? "لا يوجد فواتير حالياً" : "No invoices found"}</p>
        ) : (
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between p-4 bg-white border border-black/5 hover-elevate"
              data-testid={`card-invoice-${invoice.id}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/5 flex items-center justify-center rounded-none">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm" data-testid={`text-invoice-number-${invoice.id}`}>{invoice.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(invoice.issueDate), "yyyy-MM-dd")}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold" data-testid={`text-invoice-total-${invoice.id}`}>
                  {Number(invoice.total).toFixed(2)} {t("currency")}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-none ${
                  invoice.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                  (["pending","draft","issued"] as string[]).includes(invoice.status) ? "bg-amber-100 text-amber-700" :
                  "bg-slate-100 text-slate-500"
                }`}>
                  {invoice.status === "paid" ? (isAr ? "مدفوعة" : "Paid") :
                   (["pending","draft","issued"] as string[]).includes(invoice.status) ? (isAr ? "معلقة" : "Pending") : invoice.status}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setViewing(invoice)}
                    className="p-2 hover:bg-black/5 transition-colors rounded-none"
                    title={isAr ? "عرض" : "View"}
                    data-testid={`button-view-invoice-${invoice.id}`}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => printInvoice(invoice, language)}
                    className="p-2 hover:bg-black/5 transition-colors rounded-none"
                    title={isAr ? "تحميل PDF" : "Download PDF"}
                    data-testid={`button-download-invoice-${invoice.id}`}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

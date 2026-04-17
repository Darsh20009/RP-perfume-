import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Barcode as BarcodeIcon, Copy, Download } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    JsBarcode: any;
  }
}

export function BarcodeGenerator({ productId, productName }: { productId: string; productName: string }) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [barcode, setBarcode] = useState(productId);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen && window.JsBarcode && canvasRef.current) {
      try {
        window.JsBarcode(canvasRef.current, barcode, {
          format: "CODE128",
          width: 2,
          height: 100,
          displayValue: true,
          fontSize: 14,
        });
      } catch (err) {
        console.error("Failed to generate barcode:", err);
      }
    }
  }, [barcode, isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(barcode);
    toast({ title: "تم النسخ", description: "تم نسخ الباركود إلى الحافظة" });
  };

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement("a");
      link.href = canvasRef.current.toDataURL("image/png");
      link.download = `barcode-${productName}-${barcode}.png`;
      link.click();
      toast({ title: "تم التنزيل", description: "تم تنزيل الباركود" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid={`button-barcode-${productId}`}>
          <BarcodeIcon className="h-4 w-4" />
          الباركود
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-right">توليد الباركود - {productName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-right block">قيمة الباركود</label>
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="أدخل قيمة الباركود"
              maxLength={50}
              dir="ltr"
            />
          </div>

          <div className="border rounded-lg p-4 flex justify-center bg-white">
            <canvas ref={canvasRef} />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCopy} variant="outline" className="flex-1 gap-2">
              <Copy className="h-4 w-4" />
              نسخ
            </Button>
            <Button onClick={handleDownload} className="flex-1 gap-2">
              <Download className="h-4 w-4" />
              تنزيل
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-right">
            يمكنك تخصيص قيمة الباركود ثم تنزيل الصورة للطباعة
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

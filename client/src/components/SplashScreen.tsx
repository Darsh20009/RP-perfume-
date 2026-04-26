import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [isVisible, setIsVisible] = useState(true);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;

    const dismiss = () => {
      setIsVisible(false);
      setTimeout(onFinish, 600);
    };

    if (video) {
      const onCanPlay = () => {
        setVideoLoaded(true);
        video.play().catch(() => {});
      };
      const onEnded = () => dismiss();

      video.addEventListener("canplaythrough", onCanPlay);
      video.addEventListener("ended", onEnded);

      const fallback = setTimeout(dismiss, 3500);

      return () => {
        video.removeEventListener("canplaythrough", onCanPlay);
        video.removeEventListener("ended", onEnded);
        clearTimeout(fallback);
      };
    } else {
      const t = setTimeout(dismiss, 3500);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#f6f6f5]"
        >
          {!videoLoaded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <img
                src="/images/logos/logo-light.png"
                alt="RF Perfume"
                className="h-20 md:h-28 w-auto object-contain"
              />
              <div className="w-16 h-[2px] bg-gradient-to-r from-transparent via-[#DFB369] to-transparent animate-pulse" />
            </motion.div>
          )}
          <video
            ref={videoRef}
            src="/videos/splash.mp4"
            muted
            playsInline
            preload="auto"
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ background: "#f6f6f5" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

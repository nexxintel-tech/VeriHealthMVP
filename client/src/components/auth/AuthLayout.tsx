import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import bg1 from "@assets/auth-bg-1.png";
import bg2 from "@assets/auth-bg-2.png";
import bg3 from "@assets/auth-bg-3.png";
import bg4 from "@assets/auth-bg-4.png";

const slides = [
  {
    image: bg1,
    label: "Nigerian Savanna",
    caption: "A winding path through the golden savanna at dusk",
  },
  {
    image: bg2,
    label: "River Delta",
    caption: "Mist rising over a serene mangrove waterway at dawn",
  },
  {
    image: bg3,
    label: "Jos Plateau",
    caption: "Rolling green hills and wildflowers of the Jos Plateau",
  },
  {
    image: bg4,
    label: "Rainforest Falls",
    caption: "A cascading waterfall deep in Nigeria's tropical rainforest",
  },
];

const SLIDE_DURATION = 5000;
const FADE_DURATION = 1200;

interface AuthLayoutProps {
  children: React.ReactNode;
  panelQuote?: string;
  panelAuthor?: string;
  panelFeatures?: string[];
}

export default function AuthLayout({
  children,
  panelQuote,
  panelAuthor,
  panelFeatures,
}: AuthLayoutProps) {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = (index: number) => {
    if (transitioning || index === current) return;
    setPrev(current);
    setTransitioning(true);
    setTimeout(() => {
      setCurrent(index);
      setPrev(null);
      setTransitioning(false);
    }, FADE_DURATION);
  };

  const advance = () => {
    const next = (current + 1) % slides.length;
    goTo(next);
  };

  useEffect(() => {
    timerRef.current = setTimeout(advance, SLIDE_DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  });

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-gradient-to-br from-teal-50 via-white to-indigo-50">
      <div className="h-1 w-full bg-gradient-to-r from-teal-400 to-indigo-600 lg:hidden flex-shrink-0" />

      <div className="flex-1 flex items-start lg:items-center justify-center p-6 sm:p-8 lg:p-12 lg:min-h-screen overflow-y-auto">
        <div className="w-full max-w-md py-8 lg:py-0">{children}</div>
      </div>

      <div className="hidden lg:flex relative flex-1 flex-col justify-between p-12 overflow-hidden">
        {prev !== null && (
          <img
            src={slides[prev].image}
            alt={slides[prev].label}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: transitioning ? 0 : 1,
              transition: `opacity ${FADE_DURATION}ms ease-in-out`,
            }}
          />
        )}
        <img
          src={slides[current].image}
          alt={slides[current].label}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: transitioning ? 1 : 1,
            animation: "kenburns 12s ease-in-out infinite alternate",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-br from-teal-900/65 via-teal-800/45 to-indigo-900/75" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.07)_0%,_transparent_60%)]" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm text-white backdrop-blur-sm border border-white/25 shadow-lg">
            <ShieldCheck className="h-4 w-4 text-teal-300" />
            HIPAA Compliant &amp; Secure
          </div>
        </div>

        <div className="relative z-10 space-y-5">
          {panelFeatures && panelFeatures.length > 0 && (
            <ul className="space-y-3 mb-2">
              {panelFeatures.map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-white/90 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-300 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          )}

          {panelQuote && (
            <blockquote className="space-y-3">
              <p className="text-white text-xl font-medium leading-relaxed font-heading">
                "{panelQuote}"
              </p>
              {panelAuthor && (
                <footer className="text-white/60 text-sm">— {panelAuthor}</footer>
              )}
            </blockquote>
          )}

          <div className="flex items-center gap-2 pt-1">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-1 rounded-full transition-all duration-500 cursor-pointer ${
                  i === current
                    ? "w-6 bg-white"
                    : "w-2 bg-white/35 hover:bg-white/60"
                }`}
                aria-label={`Go to slide ${i + 1}`}
                data-testid={`button-slide-${i}`}
              />
            ))}
          </div>

          <p className="text-white/45 text-xs tracking-wide">
            {slides[current].caption}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes kenburns {
          0%   { transform: scale(1.0) translate(0%, 0%); }
          100% { transform: scale(1.1) translate(-2%, -1%); }
        }
      `}</style>
    </div>
  );
}

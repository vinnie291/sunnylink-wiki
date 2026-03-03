import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from '@/components/BottomNav';
import { LanguageProvider } from '@/lib/i18n';

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Sunnylink Wiki | Sunnypilot Settings Database",
  description: "The complete wiki for Sunnypilot. A searchable database of settings, driving models, and features.",
  keywords: ["sunnylink", "sunnylink wiki", "sunnylink ai", "sunnypilot", "sunnypilot wiki", "sunnypilot features", "sunnylink app", "sunnypilot settings", "sunnypilot sunnylink", "sunnylink sunnypilot latest version", "openpilot", "MADS", "NNLC", "self-driving", "comma.ai", "settings", "toggles", "models"],
  openGraph: {
    title: "Sunnylink Wiki",
    description: "The complete wiki for Sunnypilot. Settings, models, and features.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sunnylink Wiki",
    description: "The complete wiki for Sunnypilot. Settings, models, and features.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Google Analytics — deferred until user interaction to save ~60 KiB on initial load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var loaded = false;
                function loadGA() {
                  if (loaded) return;
                  loaded = true;
                  var s = document.createElement('script');
                  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-Y7B8JQEQH9';
                  s.async = true;
                  document.head.appendChild(s);
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', 'G-Y7B8JQEQH9');
                }
                ['scroll','click','keydown','touchstart'].forEach(function(e) {
                  window.addEventListener(e, loadGA, {once:true, passive:true});
                });
                // Fallback: load after 5s if no interaction
                setTimeout(loadGA, 5000);
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased pb-20 md:pb-0 overflow-x-hidden">
        <LanguageProvider>
          {children}
          <BottomNav />
        </LanguageProvider>
      </body>
    </html>
  );
}

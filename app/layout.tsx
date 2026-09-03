import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from '@/components/BottomNav';
import UniversalSearchTrigger from '@/components/UniversalSearchTrigger';
import GlobalControls from '@/components/GlobalControls';
import { LanguageProvider } from '@/lib/i18n';
import WebMCP from '@/components/WebMCP';
import SessionDonateModal from '@/components/SessionDonateModal';

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
        {/* Theme bootstrap — applies saved/system theme before first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('theme');
                  if (!t) {
                    t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
                  }
                  if (t === 'light') document.documentElement.classList.add('light');
                } catch (e) {}
              })();
            `,
          }}
        />
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
                  window.gtag = gtag;
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
        {/* Microsoft Clarity — deferred until user interaction to avoid cache TTL audit & initial load overhead */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var loaded = false;
                function loadClarity() {
                  if (loaded) return;
                  loaded = true;
                  (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                  })(window, document, "clarity", "script", "w4z7g8jgmv");
                }
                ['scroll','click','keydown','touchstart'].forEach(function(e) {
                  window.addEventListener(e, loadClarity, {once:true, passive:true});
                });
                setTimeout(loadClarity, 5000);
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased pb-20 md:pb-0 overflow-x-hidden" suppressHydrationWarning>
        <LanguageProvider>
          {children}
          <GlobalControls />
          <UniversalSearchTrigger />
          <BottomNav />
          <WebMCP />
          <SessionDonateModal />
        </LanguageProvider>
      </body>
    </html>
  );
}

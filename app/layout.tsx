import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Sunnylink Wiki | Sunnypilot Settings Database",
  description: "The complete wiki for Sunnypilot. A searchable database of settings, driving models, and features.",
  keywords: ["sunnypilot", "openpilot", "MADS", "NNLC", "self-driving", "comma.ai", "settings", "toggles", "models"],
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
    <html lang="en" className={inter.variable}>
      <head>
        {/* Google Analytics */}
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=G-Y7B8JQEQH9`}
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-Y7B8JQEQH9');
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

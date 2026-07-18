import type { Metadata } from "next";
import { Manrope, Inter, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Providers from "@/components/Providers";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const manrope = Manrope({
  variable: "--font-heading",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: "Lakzee Fitness Studio | Enterprise Management",
    template: "%s | Lakzee Fitness Studio"
  },
  description: "Premium Gym Management Platform providing membership, attendance, and analytics solutions for modern fitness centers.",
  keywords: ["gym management software", "fitness studio platform", "lakzee fitness", "gym ERP", "member tracking"],
  authors: [{ name: "Lakzee Fitness" }],
  creator: "Lakzee Fitness",
  publisher: "Lakzee Fitness",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'Lakzee Fitness Studio | Enterprise Management',
    description: 'Premium Gym Management Platform providing membership, attendance, and analytics solutions.',
    siteName: 'Lakzee Fitness',
    images: [{
      url: '/logo.png',
      width: 800,
      height: 600,
      alt: 'Lakzee Fitness Logo'
    }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lakzee Fitness Studio',
    description: 'Premium Gym Management Platform',
    images: ['/logo.png'],
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`h-full antialiased dark ${manrope.variable} ${inter.variable}`}>
      <body className="h-full bg-background text-foreground selection:bg-brand-gold/30">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

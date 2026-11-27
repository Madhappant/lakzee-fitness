import type { Metadata } from "next";
import { Barlow_Condensed, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { Toaster } from "sonner";

const barlowCondensed = Barlow_Condensed({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "Lakzee Fitness Studio | Strength, Conditioning & Member Portal",
    template: "%s | Lakzee Fitness Studio",
  },
  description:
    "Strength and conditioning studio in Tamil Nadu with calibrated free weights, coaching, QR attendance, and custom training plans.",
  keywords: [
    "gym management software",
    "fitness studio platform",
    "lakzee fitness",
    "strength and conditioning",
    "member tracking",
  ],
  authors: [{ name: "Lakzee Fitness" }],
  creator: "Lakzee Fitness",
  publisher: "Lakzee Fitness",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Lakzee Fitness Studio",
    description:
      "Strength and conditioning studio with calibrated free weights, coaching, QR attendance, and custom training plans.",
    siteName: "Lakzee Fitness",
    images: [
      {
        url: "/logo.jpg",
        width: 800,
        height: 600,
        alt: "Lakzee Fitness Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lakzee Fitness Studio",
    description: "Strength and conditioning studio in Tamil Nadu",
    images: ["/logo.jpg"],
  },
  icons: {
    icon: "/icon.jpg",
    apple: "/icon.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full antialiased dark ${barlowCondensed.variable} ${plusJakartaSans.variable}`}
    >
      <body className="h-full bg-background text-foreground selection:bg-brand-gold/30">
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Syne, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { Toaster } from "sonner";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
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
      className={`h-full antialiased dark ${syne.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="h-full bg-background text-foreground selection:bg-[#D4FF00]/25 selection:text-foreground">
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}

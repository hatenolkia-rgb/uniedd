import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { FaWhatsapp } from "react-icons/fa";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const siteTitle = "UniEDD | Live 1:1 Music, Dance, Chess & Public Speaking Classes";
const siteDescription =
  "UniEDD is a New Delhi-based academy offering live 1-on-1 online classes in Guitar, Keyboard, Vocals, Tabla, Dance, Public Speaking, and Chess for kids and adults.";

export const metadata: Metadata = {
  metadataBase: new URL("https://uniedd.com"),
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "https://uniedd.com",
    siteName: "UniEDD",
    images: [{ url: "/logo.png", width: 2332, height: 908, alt: "UniEDD" }],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
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
      className={`${inter.variable} ${playfair.variable} antialiased`}
    >
      <body className="min-h-screen">{children}
         <div className="fixed z-40 bottom-4 right-2 md:right-6 flex flex-col gap-4">
          <div className="relative w-14 h-14">
            {/* Ripple Background */}
            <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ripple"></span>

            {/* WhatsApp Button */}
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-[#25D366] hover:scale-110 duration-300">
              <Link href="https://wa.me/918383857710" target="_blank" rel="noreferrer">
                <FaWhatsapp className="text-2xl text-white" />
              </Link>
            </span>
          </div>
        </div>
      </body>
    </html>
  );
}

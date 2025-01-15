import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from './components/theme-provider'
import ThemeToggle from './components/theme-toggle'
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
    title: {
        default: "Henry Anyimadu | Software Engineer & Entrepreneur",
        template: "%s | Henry Anyimadu"
    },
    description: "Full-stack software engineer and entrepreneur specializing in innovative web solutions, data systems, marketing, and HCI. Based in St. Louis, MO.",
    keywords: ["Software Engineer", "Entrepreneur", "Full Stack Developer", "React", "Next.js", "Vue.js", "WashU", "St. Louis"],
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        }
    },

};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Add the prefix logic here
  const prefix = process.env.NODE_ENV === 'production'
    ? 'https://www.henryany.com'
    : '';

  return (
    <html lang="en">
      <head>
        {/* Add font preloading */}
        <link
          rel="preload"
          href={`${prefix}/_next/static/media/569ce4b8f30dc480-s.p.woff2`}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href={`${prefix}/_next/static/media/93f479601ee12b01-s.p.woff2`}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <ThemeToggle />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

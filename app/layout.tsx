import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Henry Anyimadu',
  description: 'Henry Anyimadu.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-ink">
      <head><link rel="preload" href="/fonts/source-serif-pro-semibold.ttf" as="font" type="font/ttf" crossOrigin="anonymous" /></head>
      <body className="m-0 font-sans text-base text-ink text-white antialiased selection:bg-sky selection:text-ink [&_a]:touch-manipulation [&_a]:[-webkit-tap-highlight-color:transparent] [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-6 [&_a:focus-visible]:outline-sky [&_button]:[-webkit-tap-highlight-color:transparent] [&_svg]:shrink-0 [&_[data-slot=dialog-overlay]]:bg-ink/22 [&_[data-slot=dialog-overlay]]:backdrop-blur-sm motion-reduce:[&_*]:transition-none motion-reduce:[&_*]:animate-none">
        {children}
      </body>
    </html>
  );
}

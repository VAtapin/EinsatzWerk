import { ReactNode, Suspense } from 'react';
import { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import '@/styles/globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata: Metadata = {
  title: {
    template: '%s | EinsatzWerk',
    default: 'EinsatzWerk',
  },
  description: 'Service. Planung. Außendienst.',
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html className="h-full" suppressHydrationWarning>
      <body className="flex h-full bg-background font-sans text-base text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          storageKey="einsatzwerk-theme"
          enableSystem={false}
          disableTransitionOnChange
          enableColorScheme
        >
          <TooltipProvider delayDuration={0}>
            <Suspense>{children}</Suspense>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

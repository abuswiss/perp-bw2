import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import LegalSidebar from '@/components/LegalSidebar';
import { Toaster } from 'sonner';
import ThemeProvider from '@/components/theme/Provider';
import { MatterProvider } from '@/contexts/MatterContext';
import ErrorBoundary from '@/components/ErrorBoundary';

// Import polyfills globally
import '@/lib/polyfills';

const montserrat = Montserrat({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  fallback: ['Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'BenchWise - AI Legal Research Assistant',
  description:
    'BenchWise is an AI-powered legal research platform for legal professionals.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="h-full" lang="en" suppressHydrationWarning>
      <body className={cn('h-full', montserrat.className)}>
        <ErrorBoundary>
          <ThemeProvider>
            <MatterProvider>
              <LegalSidebar>{children}</LegalSidebar>
              <Toaster
                toastOptions={{
                  unstyled: true,
                  classNames: {
                    toast:
                      'bg-light-primary dark:bg-dark-secondary dark:text-white/70 text-black-70 rounded-lg p-4 flex flex-row items-center space-x-2',
                  },
                }}
              />
            </MatterProvider>
          </ThemeProvider>
        </ErrorBoundary>
        <div id="tooltip-portal-root"></div>
      </body>
    </html>
  );
}

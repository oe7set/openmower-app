import {loadAppConfig} from '@/lib/actions';
import {Box} from '@mui/material';
import {AppRouterCacheProvider} from '@mui/material-nextjs/v15-appRouter';
import type {Metadata} from 'next';
import {Roboto} from 'next/font/google';
import {DialogProvider} from 'react-dialog-async';
import {ConfigInitializer} from '../components/ConfigInitializer';
import ThemeRegistry from '../components/ThemeRegistry';
import AppShell from '../components/navigation/AppShell';
import './globals.css';

export const dynamic = 'force-dynamic';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  title: 'OpenMower App',
  description: 'Control and monitor your OpenMower robotic lawnmower',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await loadAppConfig();
  return (
    <html lang="en" className={roboto.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Runs before React hydrates — sets body background immediately so the
            blank-before-mount period matches the final theme colour. Reads the
            persisted uiStore ('openmower-ui') first; falls back to prefers-color-scheme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var stored=localStorage.getItem('openmower-ui');var mode='system';if(stored){var s=JSON.parse(stored);if(s&&s.state&&s.state.themeMode)mode=s.state.themeMode;}var d=mode==='dark'||(mode==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');document.body.style.background=d?'#121212':'#fafafa';}catch(e){}})()`,
          }}
        />
        <ConfigInitializer config={config} />
        <AppRouterCacheProvider>
          <ThemeRegistry>
            <DialogProvider>
              <AppShell>{children}</AppShell>
            </DialogProvider>
          </ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}

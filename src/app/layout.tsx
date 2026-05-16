import {loadAppConfig} from '@/lib/actions';
import {AppRouterCacheProvider} from '@mui/material-nextjs/v15-appRouter';
import type {Metadata, Viewport} from 'next';
import {DM_Mono, DM_Sans} from 'next/font/google';
import {DialogProvider} from 'react-dialog-async';
import {ConfigInitializer} from '../components/ConfigInitializer';
import {ServiceWorkerRegister} from '../components/ServiceWorkerRegister';
import ThemeRegistry from '../components/ThemeRegistry';
import AppShell from '../components/navigation/AppShell';
import './globals.css';

export const dynamic = 'force-dynamic';

const dmSans = DM_Sans({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
});

const dmMono = DM_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-mono',
});

export const metadata: Metadata = {
  title: 'OpenMower',
  description: 'Control and monitor your OpenMower robotic lawnmower',
  applicationName: 'OpenMower',
  appleWebApp: {capable: true, title: 'OpenMower', statusBarStyle: 'black-translucent'},
};

export const viewport: Viewport = {
  themeColor: '#0C5E2B',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await loadAppConfig();
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Runs before React hydrates — sets body background immediately so the
            blank-before-mount period matches the final theme colour. Reads the
            persisted uiStore ('openmower-ui') first; falls back to prefers-color-scheme.
            Background hex values must stay in sync with PRE_HYDRATION_BG in src/theme.ts. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var stored=localStorage.getItem('openmower-ui');var mode='system';if(stored){var s=JSON.parse(stored);if(s&&s.state&&s.state.themeMode)mode=s.state.themeMode;}var d=mode==='dark'||(mode==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');document.body.style.background=d?'#0E0F10':'#FFFFFF';}catch(e){}})()`,
          }}
        />
        <ConfigInitializer config={config} />
        <ServiceWorkerRegister />
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

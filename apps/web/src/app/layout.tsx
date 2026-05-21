import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "./providers";
import "./globals.css";

const ubuntu = localFont({
  src: "../fonts/Ubuntu.ttf",
  variable: "--font-sans",
  display: "swap",
});

const ubuntuMono = localFont({
  src: "../fonts/UbuntuSansMono.ttf",
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agent Office",
  description: "Personal fleet manager for Claude Code subagents.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} data-theme="light" className={`${ubuntu.variable} ${ubuntuMono.variable}`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

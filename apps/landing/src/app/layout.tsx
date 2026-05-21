import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Office — A desktop workspace for Claude Code agents",
  description:
    "Roster your Claude Code agents to a project, summon them with a prompt, watch output stream back in real time. Runs locally, stores everything in SQLite.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}

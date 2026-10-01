import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/contexts/AppProviders";

export const metadata: Metadata = {
  title: "LiveSplit Timer",
  description: "Overlay web para LiveSplit: timer, splits, gráfico de comparação e previsões em tempo real.",
};

export const viewport: Viewport = {
  themeColor: "#050505",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The language attribute is updated on the client from the saved settings.
    <html lang="pt-BR">
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

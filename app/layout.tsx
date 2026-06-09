import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Mission Control",
  description: "Personal life planning and daily mission control",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}


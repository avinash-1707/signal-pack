import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Signal Pack",
  description: "Evidence-backed creator briefs for product launches.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import "./globals.css";
import { Inter } from "next/font/google";
import { Navbar } from "../components/layout/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Chronos - Your Personal Productivity Manager",
  description: "Track your time, habits, and progress with Chronos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} bg-gray-900 text-white min-h-screen`}
      >
        <Navbar />
        <div className="py-4">{children}</div>
      </body>
    </html>
  );
}

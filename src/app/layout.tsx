export const metadata = {
  title: "Atunṣe",
  description: "Sneaker cleaning and restoration — RestoredByDJ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

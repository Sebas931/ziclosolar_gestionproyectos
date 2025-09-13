import "./globals.css";
import { Toaster } from 'sonner';

export const metadata = {
  title: "Ziklo Time Tracking",
  description: "Plataforma de gestión de tiempos y proyectos con cierre por exportación",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
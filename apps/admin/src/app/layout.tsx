import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pillow Thief Admin',
  description: 'Administrative dashboard for the Pillow Thief platform.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

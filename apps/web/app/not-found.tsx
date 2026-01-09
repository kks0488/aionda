import Link from 'next/link';

export default function NotFound() {
  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <div className="text-center px-4">
          <div className="text-6xl font-bold mb-4">404</div>
          <h2 className="text-xl mb-4">Page Not Found</h2>
          <Link
            href="/"
            className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 inline-block"
          >
            Go Home
          </Link>
        </div>
      </body>
    </html>
  );
}

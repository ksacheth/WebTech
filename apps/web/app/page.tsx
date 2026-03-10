export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-neutral-950">
      <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-50">
        Welcome
      </h1>
      <p className="mt-3 text-neutral-500 dark:text-neutral-400">
        Get started by editing{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-sm dark:bg-neutral-800">
          app/page.tsx
        </code>
      </p>
    </main>
  );
}

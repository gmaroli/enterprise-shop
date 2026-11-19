import Link from 'next/link';
import { loginAction } from '@/app/actions';
import { Button, ErrorBanner, Field } from '@/components/ui';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Log in</h1>
      <ErrorBanner message={error} />
      <form action={loginAction} className="space-y-4">
        <Field label="Email" name="email" type="email" />
        <Field label="Password" name="password" type="password" />
        <Button type="submit" className="w-full">
          Log in
        </Button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        New here?{' '}
        <Link href="/register" className="text-indigo-700 underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

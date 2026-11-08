import Link from 'next/link';
import { registerAction } from '@/app/actions';
import { Button, ErrorBanner, Field } from '@/components/ui';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Create an account</h1>
      <ErrorBanner message={error} />
      <form action={registerAction} className="space-y-4">
        <Field label="Full name" name="name" />
        <Field label="Email" name="email" type="email" />
        <Field label="Password (8+ characters)" name="password" type="password" />
        <Button type="submit" className="w-full">
          Sign up
        </Button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="text-indigo-700 underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

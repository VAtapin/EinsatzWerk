'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, Mail, Wrench } from 'lucide-react';
import {
  apiRequest,
  getAccessToken,
  storeAccessToken,
} from '@/lib/einsatzwerk-api';
import { EinsatzWerkBrand } from '@/components/einsatzwerk/brand';

type LoginResponse = {
  token: string;
  user: {
    landing_path: string;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const [organization, setOrganization] = useState('einsatzwerk');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (getAccessToken()) router.replace('/office/call-intake');
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const result = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          organization,
          email,
          password,
          device_name: 'EinsatzWerk Web',
        }),
      });
      storeAccessToken(result.token);
      router.replace(result.user.landing_path);
    } catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : 'Anmeldung nicht möglich.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#061b31] px-5">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <EinsatzWerkBrand />
        </div>
        <form
          onSubmit={submit}
          className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl"
        >
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-[#10213d]">Anmelden</h1>
            <p className="mt-2 text-sm text-slate-500">
              Direkt zur Anrufannahme und zum Kunden.
            </p>
          </div>

          <label className="mb-1 block text-sm font-medium">Betrieb</label>
          <div className="relative mb-4">
            <Wrench className="absolute top-3 left-3 size-4 text-slate-400" />
            <input
              value={organization}
              onChange={(event) => setOrganization(event.target.value)}
              className="h-11 w-full rounded-lg border pl-10 outline-none focus:border-[#ff5a0a]"
              required
            />
          </div>

          <label className="mb-1 block text-sm font-medium">E-Mail</label>
          <div className="relative mb-4">
            <Mail className="absolute top-3 left-3 size-4 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-lg border pl-10 outline-none focus:border-[#ff5a0a]"
              autoComplete="username"
              required
            />
          </div>

          <label className="mb-1 block text-sm font-medium">Passwort</label>
          <div className="relative mb-5">
            <LockKeyhole className="absolute top-3 left-3 size-4 text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-lg border pl-10 outline-none focus:border-[#ff5a0a]"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            disabled={submitting}
            className="h-12 w-full rounded-lg bg-gradient-to-r from-[#ff5a0a] to-[#ff6d00] font-semibold text-white disabled:opacity-60"
          >
            {submitting ? 'Anmeldung…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </main>
  );
}

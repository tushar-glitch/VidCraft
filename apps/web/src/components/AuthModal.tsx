import { useEffect, useState, type FormEvent } from 'react';
import { FiX } from 'react-icons/fi';
import { loginSchema, registerSchema } from '@vidcraft/shared';
import { z } from 'zod';
import { useAuth } from '../auth/AuthContext.tsx';
import { ApiError } from '../lib/api.ts';
import { Field, inputClass } from '../tools/fields.tsx';

type Errors = Record<string, string | undefined>;

/** Sign-in and sign-up in one modal. Validation uses the same schemas as the API. */
export function AuthModal() {
  const { modal, closeModal, openModal, login, register } = useAuth();
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setErrors({}), [modal]);
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeModal();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, closeModal]);

  if (!modal) return null;
  const isSignup = modal === 'signup';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = (isSignup ? registerSchema : loginSchema).safeParse(values);
    if (!parsed.success) {
      const fields = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>;
      return setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, friendly(k, v?.[0])])));
    }
    setSubmitting(true);
    setErrors({});
    try {
      if (isSignup) await register(parsed.data as z.infer<typeof registerSchema>);
      else await login(parsed.data);
      closeModal();
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4" onClick={closeModal}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="w-full max-w-md rounded-lg bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h3 id="auth-title" className="text-xl font-semibold text-gray-900">
            {isSignup ? 'Create your account' : 'Sign in to VidCraft'}
          </h3>
          <button type="button" aria-label="Close" className="text-gray-400 hover:text-gray-900" onClick={closeModal}>
            <FiX className="h-6 w-6" />
          </button>
        </div>
        <form className="space-y-4 p-4" onSubmit={onSubmit} noValidate>
          {isSignup && (
            <div className="grid grid-cols-2 gap-4">
              <Input name="firstName" label="First name" autoComplete="given-name" error={errors.firstName} />
              <Input name="lastName" label="Last name" autoComplete="family-name" error={errors.lastName} />
            </div>
          )}
          <Input name="email" type="email" label="Email" autoComplete="email" error={errors.email} />
          <Input
            name="password"
            type="password"
            label="Password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            hint={isSignup ? 'At least 8 characters.' : undefined}
            error={errors.password}
          />
          {errors.form && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{errors.form}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {submitting ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
          <p className="text-sm text-gray-500">
            {isSignup ? 'Already have an account?' : 'Not registered?'}{' '}
            <button type="button" className="text-brand hover:underline" onClick={() => openModal(isSignup ? 'signin' : 'signup')}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

function Input(props: { name: string; label: string; type?: string; autoComplete?: string; hint?: string; error?: string }) {
  return (
    <Field label={props.label} hint={props.error ? undefined : props.hint}>
      <input
        name={props.name}
        type={props.type ?? 'text'}
        autoComplete={props.autoComplete}
        aria-invalid={Boolean(props.error)}
        className={`${inputClass} ${props.error ? 'border-red-400' : ''}`}
      />
      {props.error && <span className="mt-1 block text-sm text-red-600">{props.error}</span>}
    </Field>
  );
}

function friendly(field: string, message: string | undefined): string | undefined {
  if (!message) return undefined;
  if (field === 'email') return 'Please enter a valid email address';
  if (field === 'password') return 'Password must be 8–72 characters';
  if (field === 'firstName' || field === 'lastName') return 'Required';
  return message;
}

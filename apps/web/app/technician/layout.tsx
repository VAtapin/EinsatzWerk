import { ReactNode } from 'react';
import { TechnicianShell } from '@/components/einsatzwerk/technician-shell';

export default function TechnicianLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <TechnicianShell>{children}</TechnicianShell>;
}

import { ReactNode } from 'react';
import { OfficeShell } from '@/components/einsatzwerk/office-shell';

export default function OfficeLayout({ children }: { children: ReactNode }) {
  return <OfficeShell>{children}</OfficeShell>;
}

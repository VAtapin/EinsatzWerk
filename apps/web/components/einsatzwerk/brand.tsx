import { Cog, MapPin, Wrench } from 'lucide-react';

export function EinsatzWerkBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex size-11 shrink-0 items-center justify-center">
        <Cog className="absolute size-11 text-white" strokeWidth={2.3} />
        <MapPin
          className="absolute size-8 translate-y-1 fill-[#ff5a0a] text-[#ff5a0a]"
          strokeWidth={2.4}
        />
        <Wrench
          className="absolute size-3.5 -translate-y-0.5 text-white"
          strokeWidth={3}
        />
      </div>
      {!compact && (
        <div>
          <div className="text-[25px] leading-none font-bold tracking-tight text-white">
            Einsatz<span className="text-[#ff5a0a]">Werk</span>
          </div>
          <div className="mt-1 text-[8px] font-semibold tracking-[0.18em] text-white/80 uppercase">
            Service. Planung. Außendienst.
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { type SVGProps, useId } from "react";

export function LogoSymbol(props: SVGProps<SVGSVGElement>) {
  const mask = useId();
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" {...props}>
      <mask id={mask}>
        <rect width="32" height="32" rx="9" className="fill-white" />
        <circle cx="14" cy="17.5" r="5.5" fill="none" strokeWidth="3.4" className="stroke-black" />
        <path d="M22.3 10.2v12.6" fill="none" strokeWidth="3.4" strokeLinecap="round" className="stroke-black" />
      </mask>
      <rect width="32" height="32" rx="9" mask={`url(#${mask})`} />
      <path d="M22.3 10.2v12.6" fill="none" strokeWidth="2.6" strokeLinecap="round" className="stroke-accent" />
    </svg>
  );
}

export function Logo(props: SVGProps<SVGSVGElement>) {
  const mask = useId();
  return (
    <svg viewBox="0 0 176 32" fill="currentColor" {...props}>
      <mask id={mask}>
        <rect width="32" height="32" rx="9" className="fill-white" />
        <circle cx="14" cy="17.5" r="5.5" fill="none" strokeWidth="3.4" className="stroke-black" />
        <path d="M22.3 10.2v12.6" fill="none" strokeWidth="3.4" strokeLinecap="round" className="stroke-black" />
      </mask>
      <rect width="32" height="32" rx="9" mask={`url(#${mask})`} />
      <path d="M22.3 10.2v12.6" fill="none" strokeWidth="2.6" strokeLinecap="round" className="stroke-accent" />
      <text x="42" y="24.5" fontSize="26" fontWeight="650" textLength="132" lengthAdjust="spacingAndGlyphs">
        alternative
      </text>
    </svg>
  );
}

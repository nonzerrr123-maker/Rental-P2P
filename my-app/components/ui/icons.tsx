import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconBase({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}

export function SearchIcon(props: IconProps) { return <IconBase {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></IconBase>; }
export function HomeIcon(props: IconProps) { return <IconBase {...props}><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></IconBase>; }
export function CompassIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z"/></IconBase>; }
export function MapPinIcon(props: IconProps) { return <IconBase {...props}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></IconBase>; }
export function BoltIcon(props: IconProps) { return <IconBase {...props}><path d="m13 2-7 12h6l-1 8 7-12h-6l1-8Z"/></IconBase>; }
export function UsersIcon(props: IconProps) { return <IconBase {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></IconBase>; }
export function ShieldCheckIcon(props: IconProps) { return <IconBase {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></IconBase>; }
export function MessageIcon(props: IconProps) { return <IconBase {...props}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/></IconBase>; }
export function BellIcon(props: IconProps) { return <IconBase {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></IconBase>; }
export function UserIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></IconBase>; }
export function PlusIcon(props: IconProps) { return <IconBase {...props}><path d="M12 5v14M5 12h14"/></IconBase>; }
export function PackageIcon(props: IconProps) { return <IconBase {...props}><path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="m3 8 9 5 9-5v8l-9 5-9-5V8Z"/><path d="M12 13v8"/></IconBase>; }
export function ClockIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></IconBase>; }
export function CalendarIcon(props: IconProps) { return <IconBase {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></IconBase>; }
export function StarIcon(props: IconProps) { return <IconBase {...props}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></IconBase>; }
export function ArrowRightIcon(props: IconProps) { return <IconBase {...props}><path d="M5 12h14M13 6l6 6-6 6"/></IconBase>; }
export function ChevronRightIcon(props: IconProps) { return <IconBase {...props}><path d="m9 18 6-6-6-6"/></IconBase>; }
export function ChevronLeftIcon(props: IconProps) { return <IconBase {...props}><path d="m15 18-6-6 6-6"/></IconBase>; }
export function CheckIcon(props: IconProps) { return <IconBase {...props}><path d="m5 12 4 4L19 6"/></IconBase>; }
export function SaveIcon(props: IconProps) { return <IconBase {...props}><path d="M5 3h12l2 2v16H5V3Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></IconBase>; }
export function SlidersIcon(props: IconProps) { return <IconBase {...props}><path d="M4 6h16M7 12h10M10 18h4"/></IconBase>; }
export function ImageIcon(props: IconProps) { return <IconBase {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></IconBase>; }
export function HeartIcon(props: IconProps) { return <IconBase {...props}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z"/></IconBase>; }
export function MenuIcon(props: IconProps) { return <IconBase {...props}><path d="M4 7h16M4 12h16M4 17h16"/></IconBase>; }
export function CloseIcon(props: IconProps) { return <IconBase {...props}><path d="m6 6 12 12M18 6 6 18"/></IconBase>; }
export function LogOutIcon(props: IconProps) { return <IconBase {...props}><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></IconBase>; }
export function LayoutDashboardIcon(props: IconProps) { return <IconBase {...props}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></IconBase>; }
export function SparkleIcon(props: IconProps) { return <IconBase {...props}><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="m18 14 .7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14Z"/></IconBase>; }
export function CameraIcon(props: IconProps) { return <IconBase {...props}><path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/></IconBase>; }
export function CreditCardIcon(props: IconProps) { return <IconBase {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></IconBase>; }
export function SendIcon(props: IconProps) { return <IconBase {...props}><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></IconBase>; }

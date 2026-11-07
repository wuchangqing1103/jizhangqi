import {
  BookOpen,
  Briefcase,
  Bus,
  Gamepad2,
  Gift,
  HeartPulse,
  Home,
  PiggyBank,
  ShoppingBag,
  TrendingUp,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  food: Utensils,
  transport: Bus,
  shopping: ShoppingBag,
  housing: Home,
  fun: Gamepad2,
  medical: HeartPulse,
  study: BookOpen,
  social: Gift,
  other: Wallet,
  salary: Briefcase,
  bonus: Gift,
  invest: TrendingUp,
  parttime: PiggyBank,
  'income-other': Wallet,
}

interface CategoryIconProps {
  id: string
  size?: number
}

export function CategoryIcon({ id, size = 18 }: CategoryIconProps) {
  const Icon = ICONS[id] ?? Wallet
  return <Icon size={size} strokeWidth={1.9} aria-hidden="true" />
}
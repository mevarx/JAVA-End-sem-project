import type { ReactElement } from 'react'
import type { LucideIcon, LucideProps } from 'lucide-react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  BedDouble,
  Building2,
  Calendar,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileText,
  HeartPulse,
  History,
  Inbox,
  Info,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Moon,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Siren,
  Stethoscope,
  Sun,
  Timer,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react'

type IconProps = LucideProps
export type IconComponent = (props: IconProps) => ReactElement

function createIcon(Base: LucideIcon): IconComponent {
  return function Icon({ className, strokeWidth = 1.75, ...props }: IconProps) {
    return (
      <Base
        aria-hidden="true"
        strokeWidth={strokeWidth}
        className={`h-5 w-5 shrink-0 ${className ?? ''}`.trim()}
        {...props}
      />
    )
  }
}

export const AlertIcon = createIcon(TriangleAlert)
export const AlertTriangleIcon = createIcon(AlertTriangle)
export const TriangleAlertIcon = AlertTriangleIcon
export const AlertCircleIcon = createIcon(AlertCircle)
export const ActivityIcon = createIcon(Activity)
export const ArrowRightIcon = createIcon(ArrowRight)
export const BellIcon = createIcon(Bell)
export const BedIcon = createIcon(BedDouble)
export const BuildingIcon = createIcon(Building2)
export const CalendarIcon = createIcon(Calendar)
export const CalendarDaysIcon = createIcon(CalendarDays)
export const CheckIcon = createIcon(Check)
export const CheckCheckIcon = createIcon(CheckCheck)
export const CheckCircleIcon = createIcon(CheckCircle2)
export const ChevronLeftIcon = createIcon(ChevronLeft)
export const ChevronRightIcon = createIcon(ChevronRight)
export const CircleDotIcon = createIcon(CircleDot)
export const ClipboardIcon = createIcon(ClipboardList)
export const ClockIcon = createIcon(Clock)
export const DownloadIcon = createIcon(Download)
export const EyeIcon = createIcon(Eye)
export const EyeOffIcon = createIcon(EyeOff)
export const FileTextIcon = createIcon(FileText)
export const HeartPulseIcon = createIcon(HeartPulse)
export const HistoryIcon = createIcon(History)
export const InboxIcon = createIcon(Inbox)
export const InfoIcon = createIcon(Info)
export const LayoutDashboardIcon = createIcon(LayoutDashboard)
export const LockIcon = createIcon(Lock)
export const LogOutIcon = createIcon(LogOut)
export const MenuIcon = createIcon(Menu)
export const MoonIcon = createIcon(Moon)
export const MapPinIcon = createIcon(MapPin)
export const PhoneIcon = createIcon(Phone)
export const PlusIcon = createIcon(Plus)
export const RefreshIcon = createIcon(RefreshCw)
export const ReportIcon = createIcon(FileText)
export const SearchIcon = createIcon(Search)
export const SendIcon = createIcon(Send)
export const SirenIcon = createIcon(Siren)
export const StethoscopeIcon = createIcon(Stethoscope)
export const SunIcon = createIcon(Sun)
export const TimerIcon = createIcon(Timer)
export const TrashIcon = createIcon(Trash2)
export const UploadIcon = createIcon(Upload)
export const UserIcon = createIcon(User)
export const UsersIcon = createIcon(Users)
export const CloseIcon = createIcon(X)
export const XCircleIcon = createIcon(XCircle)

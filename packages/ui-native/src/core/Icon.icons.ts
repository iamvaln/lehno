import {
  ArrowUpRight,
  Bell,
  Bookmark,
  Cake,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleQuestionMark,
  CircleCheck,
  CircleX,
  CloudOff,
  Coins,
  Copy,
  CornerUpLeft,
  CreditCard,
  Database,
  Dot,
  Download,
  ExternalLink,
  FileText,
  Eye,
  Gift,
  Heart,
  House,
  ImagePlus,
  Info,
  KeyRound,
  Languages,
  Link,
  LogOut,
  Loader,
  Lock,
  Mail,
  Menu,
  Monitor,
  Minus,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Star,
  Send,
  Settings,
  Share2,
  Shield,
  Smartphone,
  Sparkles,
  Trash2,
  TriangleAlert,
  User,
  UserPen,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react-native";

/* Le tableau des icônes embarquées, et une dette assumée.
 *
 * Sur le web, l'enveloppe cherchait l'icône par son nom dans un objet global
 * chargé depuis un CDN : le coût ne touchait pas le produit. En natif, la
 * bibliothèque entre dans le paquet — plus de mille cinq cents icônes pour les
 * quarante-cinq que la charte emploie. Mesuré : environ deux mégaoctets.
 *
 * CE QUI A ÉTÉ TENTÉ, ET POURQUOI ÇA NE MARCHE PAS ENCORE.
 * Metro n'élague pas : des imports nommés depuis le baril laissent quand même
 * tout entrer — vérifié en lisant le bundle, où `Aperture` et `Rocket` figurent
 * alors qu'aucun écran ne les demande. L'entrée profonde que le paquet expose
 * sous « ./icons/* » serait la réponse, mais Metro ne résout pas ce motif :
 * Node trouve le fichier, Metro non, y compris avec les noms de conditions
 * posés et le cache vidé.
 *
 * DEUX ISSUES, quand le sujet reviendra : embarquer nous-mêmes les tracés des
 * quarante-cinq icônes sur react-native-svg, déjà présent — quelques kilooctets
 * au lieu de deux mégaoctets, au prix d'une donnée à tenir ; ou attendre que
 * l'élagage de Metro sorte de l'expérimental.
 *
 * Le tableau reste tenu à jour par un test qui relit le code porté et échoue si
 * une icône demandée y manque. C'est lui qui compte : une icône absente ne rend
 * rien, et le trou ne se verrait qu'à l'usage.
 */
export const ICONES = {
  "arrow-up-right": ArrowUpRight,
  "bell": Bell,
  "bookmark": Bookmark,
  "cake": Cake,
  "calendar": Calendar,
  "check": Check,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "circle-alert": CircleAlert,
  "circle-question-mark": CircleQuestionMark,
  "circle-check": CircleCheck,
  "circle-x": CircleX,
  "cloud-off": CloudOff,
  "coins": Coins,
  "copy": Copy,
  "corner-up-left": CornerUpLeft,
  "credit-card": CreditCard,
  "database": Database,
  "dot": Dot,
  "download": Download,
  "external-link": ExternalLink,
  "file-text": FileText,
  "eye": Eye,
  "gift": Gift,
  "heart": Heart,
  "house": House,
  "image-plus": ImagePlus,
  "info": Info,
  "key-round": KeyRound,
  "languages": Languages,
  "link": Link,
  "log-out": LogOut,
  "loader": Loader,
  "lock": Lock,
  "mail": Mail,
  "menu": Menu,
  "monitor": Monitor,
  "minus": Minus,
  "more-horizontal": MoreHorizontal,
  "pencil": Pencil,
  "pin": Pin,
  "plus": Plus,
  "refresh-cw": RefreshCw,
  "search": Search,
  "star": Star,
  "send": Send,
  "settings": Settings,
  "share-2": Share2,
  "shield": Shield,
  "smartphone": Smartphone,
  "sparkles": Sparkles,
  "trash-2": Trash2,
  "triangle-alert": TriangleAlert,
  "user": User,
  "user-pen": UserPen,
  "user-plus": UserPlus,
  "users": Users,
  "wallet": Wallet,
  "x": X,
} as const;

export type NomDIcone = keyof typeof ICONES;

import { BRAND_COLOR } from "@/lib/map/constants";

export type PinIcon = {
  id: string;
  emoji: string;
  label: string;
};

export const PIN_ICONS: readonly PinIcon[] = [
  { id: "place", emoji: "📍", label: "場所" },
  { id: "star", emoji: "⭐", label: "スター" },
  { id: "food", emoji: "🍜", label: "食事" },
  { id: "cafe", emoji: "☕", label: "カフェ" },
  { id: "drink", emoji: "🍺", label: "飲食" },
  { id: "home", emoji: "🏠", label: "家" },
  { id: "hotel", emoji: "🏨", label: "ホテル" },
  { id: "shop", emoji: "🛍️", label: "買い物" },
  { id: "hospital", emoji: "🏥", label: "病院" },
  { id: "car", emoji: "🚗", label: "車" },
  { id: "parking", emoji: "🅿️", label: "駐車場" },
  { id: "sport", emoji: "🏃", label: "スポーツ" },
  { id: "fish", emoji: "🎣", label: "釣り" },
  { id: "camera", emoji: "📷", label: "写真" },
  { id: "blossom", emoji: "🌸", label: "観光" },
  { id: "travel", emoji: "✈️", label: "旅行" },
  { id: "heart", emoji: "❤️", label: "お気に入り" },
  { id: "start", emoji: "🏁", label: "スタート" },
  { id: "goal", emoji: "🏁", label: "ゴール" },
  { id: "toilet", emoji: "🚻", label: "トイレ" },
  { id: "water", emoji: "💧", label: "給水" },
  { id: "aid", emoji: "➕", label: "救護" },
  { id: "caution", emoji: "⚠️", label: "注意地点" },
  { id: "staff", emoji: "👤", label: "スタッフ" },
  { id: "reception", emoji: "🎪", label: "受付" },
  { id: "warning", emoji: "⚠️", label: "危険" },
];

export const MARATHON_ICON_IDS = [
  "start",
  "goal",
  "toilet",
  "water",
  "aid",
  "parking",
  "caution",
  "staff",
  "reception",
  "warning",
] as const;

export const PIN_CATEGORIES = [
  "場所",
  "食事",
  "カフェ",
  "買い物",
  "ホテル",
  "病院",
  "駐車場",
  "スポーツ",
  "給水",
  "受付",
  "スタート",
  "ゴール",
  "救護",
  "トイレ",
  "注意地点",
  "スタッフ配置",
  "その他",
  "観光",
  "宿泊",
  "生活",
  "移動",
  "お気に入り",
] as const;

export const MARATHON_CATEGORIES = [
  "スタート",
  "ゴール",
  "トイレ",
  "給水",
  "救護",
  "駐車場",
  "注意地点",
  "スタッフ配置",
  "受付",
] as const;

export const PIN_COLORS = [
  BRAND_COLOR,
  "#E8A838",
  "#3C9D7A",
  "#3B82C4",
  "#7C6BB5",
  "#D45D7A",
  "#5C6B73",
  "#2F2A26",
] as const;

export const DEFAULT_PIN_ICON = "place";
export const DEFAULT_PIN_CATEGORY = "場所";

const iconIds = new Set(PIN_ICONS.map((icon) => icon.id));
const categoryNames = new Set<string>(PIN_CATEGORIES);
const colorValues = new Set<string>(PIN_COLORS);

export function isPinIconId(value: string): boolean {
  return iconIds.has(value);
}

export function isPinCategory(value: string): boolean {
  return categoryNames.has(value);
}

export function isPinColor(value: string): boolean {
  return colorValues.has(value);
}

export function pinIconById(id: string): PinIcon {
  return PIN_ICONS.find((icon) => icon.id === id) ?? PIN_ICONS[0];
}

export function iconsForMap(marathon: boolean): readonly PinIcon[] {
  if (!marathon) return PIN_ICONS;
  const rank = new Map<string, number>(MARATHON_ICON_IDS.map((id, index) => [id, index]));
  return [...PIN_ICONS].sort((left, right) => (rank.get(left.id) ?? 100) - (rank.get(right.id) ?? 100));
}

export function categoriesForMap(marathon: boolean): readonly string[] {
  if (!marathon) return PIN_CATEGORIES;
  const preferred = new Set<string>(MARATHON_CATEGORIES);
  return [...MARATHON_CATEGORIES, ...PIN_CATEGORIES.filter((category) => !preferred.has(category))];
}

export function titleForPin(icon: string, category: string, title: string): string {
  if (title.trim()) return title.trim();
  if (icon === "toilet" || category === "トイレ") return "トイレ";
  return title;
}

export function pinIconImageId(iconId: string): string {
  return `pin-icon-${iconId}`;
}

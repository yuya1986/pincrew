const STAFF_LABEL_KEY = "kokomemo:staff-label";

export function readStaffLabel(): string {
  try {
    return localStorage.getItem(STAFF_LABEL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeStaffLabel(value: string) {
  try {
    localStorage.setItem(STAFF_LABEL_KEY, value.trim().slice(0, 40));
  } catch {
    // 端末名は表示用。保存できなくてもピン自体は残る。
  }
}

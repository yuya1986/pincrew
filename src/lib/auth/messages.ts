export function authErrorMessage(message: string, mode: "login" | "signup"): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "メールアドレスかパスワードが違います。";
  }
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "このメールアドレスは登録済みです。ログインしてください。";
  }
  if (text.includes("password")) return "パスワードは8文字以上にしてください。";
  if (text.includes("valid email") || text.includes("unable to validate email")) {
    return "メールアドレスの形式を確認してください。";
  }
  return mode === "signup" ? "アカウントを作成できませんでした。" : "ログインできませんでした。";
}

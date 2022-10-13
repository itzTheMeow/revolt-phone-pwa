export function escapeHTML(txt: string) {
  return txt
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
export function escapeRegex(r: RegExp) {
  return new RegExp(escapeHTML(r.source), r.flags);
}
export function proxyURL(url: string = "", type: "any" | "image") {
  return `/proxy?url=${encodeURIComponent(url)}&t=${type}`;
}

export const Matches = {
  user: /<@([A-z0-9]{26})>/g,
  channel: /<#([A-z0-9]{26})>/g,
  emojiCustom: /:([A-z0-9]{26}):/g,
  emojiDefault: /:([A-z0-9_]+?):/g,
};
export enum ListState {
  LEFT,
  MIDDLE,
  RIGHT,
}

export interface ThemeSettings {
  accent?: string;
  background?: string;
  block?: string;
  error?: string;
  foreground?: string;
  hover?: string;
  mention?: string;
  "message-box"?: string;
  "primary-background"?: string;
  "primary-header"?: string;
  "scrollbar-thumb"?: string;
  "secondary-background"?: string;
  "secondary-foreground"?: string;
  "secondary-header"?: string;
  "status-away"?: string;
  "status-busy"?: string;
  "status-invisible"?: string;
  "status-online"?: string;
  success?: string;
  "tertiary-background"?: string;
  "tertiary-foreground"?: string;
  warning?: string;
  tooltip?: string;
  "scrollbar-track"?: string;
  "status-focus"?: string;
  "status-streaming"?: string;
  light?: boolean;
}

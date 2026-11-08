export const OPEN_CHAT_EVENT = "nexus:open-chat";

export type OpenChatDetail = { prompt?: string };

export function openChat(prompt?: string) {
  window.dispatchEvent(new CustomEvent<OpenChatDetail>(OPEN_CHAT_EVENT, { detail: { prompt } }));
}

export const queryKeys = {
  capabilities: ['capabilities'] as const,
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
};

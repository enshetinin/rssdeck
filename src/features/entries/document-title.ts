/** "(21) All entries": the total unread count first, so it shows in a narrow tab. */
export function withUnreadCount(title: string, unread: number): string {
  return unread > 0 ? `(${unread}) ${title}` : title;
}

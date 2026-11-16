/** Start speech alongside text reveal; cancellation must never restore an obsolete reply. */
export async function presentChatReply(options: {
  current(): boolean;
  speak(): void;
  reveal(): Promise<void>;
  finish(): void;
}) {
  if (!options.current()) return
  options.speak()
  await options.reveal()
  if (options.current()) options.finish()
}

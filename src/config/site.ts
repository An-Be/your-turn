// Everything user-facing that names the tool reads from here.
export const site = {
  name: "TagYourTurn",
  description: "Whose turn is it today? One shared link for two people. No login, no reminders, forgets after 7 days.",
  tagline: "Tiny tools for keeping a rhythm.",
  author: { name: "Andrea", url: "https://andreaberrocal.com" },
  themeColor: "#ffffff",
  /**
   * The landing page is public. Tracker pages stay out of search engines on
   * their own (page metadata + X-Robots-Tag on /t/* in next.config.ts).
   */
  indexable: true,
} as const;

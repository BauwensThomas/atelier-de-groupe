declare global {
  interface Liveblocks {
    Presence: { name: string; color: string; typing?: boolean; prof?: boolean };
    UserMeta: {
      id: string;
      info: { name: string; color: string };
    };
  }
}

export {};

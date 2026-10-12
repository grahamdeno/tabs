// Tabs — core logic
// Personal guitar tabs library. All data stays in localStorage.

const STORAGE_KEY = "tabs-v1";

export const Tabs = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { songs: [], settings: { theme: "dark", scrollSpeed: 40 } };
    } catch {
      return { songs: [], settings: { theme: "dark", scrollSpeed: 40 } };
    }
  },

  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  addSong(data, song) {
    song.id = Date.now().toString();
    song.created = new Date().toISOString();
    song.favorite = false;
    data.songs.unshift(song);
    this.save(data);
    return song;
  },

  updateSong(data, id, updates) {
    const song = data.songs.find(s => s.id === id);
    if (song) Object.assign(song, updates);
    this.save(data);
    return song;
  },

  deleteSong(data, id) {
    data.songs = data.songs.filter(s => s.id !== id);
    this.save(data);
  },

  toggleFavorite(data, id) {
    const song = data.songs.find(s => s.id === id);
    if (song) song.favorite = !song.favorite;
    this.save(data);
    return song;
  },

  export(data) {
    return JSON.stringify(data, null, 2);
  },

  import(json) {
    try {
      const data = JSON.parse(json);
      if (!data.songs || !Array.isArray(data.songs)) throw new Error("Invalid format");
      this.save(data);
      return data;
    } catch {
      return null;
    }
  }
};

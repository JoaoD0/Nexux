// X1 Map pool with splash images
export interface MapInfo {
  name: string;
  image: string;
}

export const X1_MAP_POOL: MapInfo[] = [
  { name: "Ascent", image: "https://static.wikia.nocookie.net/valorant/images/e/e7/Loading_Screen_Ascent.png" },
  { name: "Split", image: "https://static.wikia.nocookie.net/valorant/images/d/d6/Loading_Screen_Split.png" },
  { name: "Fracture", image: "https://static.wikia.nocookie.net/valorant/images/f/f0/Loading_Screen_Fracture.png" },
  { name: "Bind", image: "https://static.wikia.nocookie.net/valorant/images/2/23/Loading_Screen_Bind.png" },
  { name: "Breeze", image: "https://static.wikia.nocookie.net/valorant/images/1/10/Loading_Screen_Breeze.png" },
  { name: "Abyss", image: "https://static.wikia.nocookie.net/valorant/images/b/b6/Loading_Screen_Abyss.png" },
  { name: "Lotus", image: "https://static.wikia.nocookie.net/valorant/images/d/d0/Loading_Screen_Lotus.png" },
  { name: "Sunset", image: "https://static.wikia.nocookie.net/valorant/images/5/5c/Loading_Screen_Sunset.png" },
  { name: "Pearl", image: "https://static.wikia.nocookie.net/valorant/images/a/af/Loading_Screen_Pearl.png" },
  { name: "Icebox", image: "https://static.wikia.nocookie.net/valorant/images/1/13/Loading_Screen_Icebox.png" },
  { name: "Corrode", image: "https://static.wikia.nocookie.net/valorant/images/7/74/Loading_Screen_Corrode.png" },
  { name: "Haven", image: "https://static.wikia.nocookie.net/valorant/images/7/70/Loading_Screen_Haven.png" },
];

export const TOTAL_BANS = X1_MAP_POOL.length - 1; // 11 bans, 1 map remains

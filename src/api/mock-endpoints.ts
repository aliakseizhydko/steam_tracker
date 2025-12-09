import type { Achievement } from "./dtos";

const MOCK_DATA: Achievement[] = [
  {
    id: "ASD_ASD_ASD_ASD",
    game: "Dark Souls 3",
    obtained_at: new Date("2020-05-05"),
  },
  {
    id: "XYZ_XYZ_XYZ_XYZ",
    game: "World of Warcraft",
    obtained_at: new Date("2022-12-10"),
  },
];

export const getAchievementsMock = () =>
  new Promise<Achievement[]>((resolve) =>
    setTimeout(() => {
      resolve(MOCK_DATA);
    }, 1000)
  );

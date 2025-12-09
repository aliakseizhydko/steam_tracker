import type { Achievement } from "./dtos";

// Our function returns "Promise<Achievement[]>", which helps to get type safe experience in client code.
// Please verify types, server host and endpoint path to correspond real endpoints
// Server host can be configured dynamically using ENV vars later
export const getAchievements = () =>
  fetch("http://localhost:3000/api/achievements").then(
    (response) => response.json() as unknown as Achievement[]
  );

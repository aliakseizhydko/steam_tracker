import { useQuery } from "@tanstack/react-query";
import { Loader } from "lucide-react";
import { getAchievementsMock } from "../api";

export const Achievements = () => {
  const { data, isPending, isError } = useQuery({
    queryKey: ["GET_ACHIEVEMENTS"],
    queryFn: getAchievementsMock, // Swap for "getAchievements" when ready, but fix DTO types to get proper errors
  });

  if (isPending) {
    return (
      <div className="h-full flex justify-center items-center">
        <Loader className="animate-spin text-blue-950" size={40} />
      </div>
    );
  }

  if (isError) {
    return <div>Display error</div>;
  }

  // On this point "data" is not "undefined", and we can safely use it
  // If your "queryFn" typed properly (which it should be), you will 
  // get type safe experience here (hover over data on 6 and 30 lines to view its types).
  return (
    <div className="max-w-xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4 text-center">Achievements</h2>
      <ul className="space-y-3">
        {data.map((ach) => (
          <li
            key={ach.id}
            className="bg-white shadow-md rounded-lg p-4 flex justify-between items-center hover:bg-gray-50 transition"
          >
            <div>
              <p className="text-lg font-semibold text-gray-800">{ach.game}</p>
              <p className="text-sm text-gray-500">
                Obtained: {ach.obtained_at.toLocaleDateString()}
              </p>
            </div>
            <span className="text-xs text-gray-400">#{ach.id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

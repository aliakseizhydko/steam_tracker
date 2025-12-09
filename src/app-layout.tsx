import { Award, House, User } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { twMerge } from "tailwind-merge";
import { AppLink } from "./components";

export const AppLayout = () => {
  return (
    <div className="bg-blue-200 h-full flex flex-col">
      <div className="grow p-4">
        {/* Here will be rendered the content of current active route */}
        <Outlet />
      </div>

      <div className="flex flex-row bg-blue-950 p-2 items-center gap-4 justify-center">
        <NavLink
          to="/"
          className={({ isActive }) =>
            twMerge(
              "flex flex-row text-white gap-2 p-2 hover:scale-110 transition",
              isActive && "text-amber-200"
            )
          }
        >
          <House />
          Home
        </NavLink>
        {/* 
          Here is the example of custom reusable components we create to keep DRY (Don't Repeat Yourself).
          Fell add <AppLink /> instead of NavLink above.
        */}
        <AppLink to="/profile">
          <User />
          Profile
        </AppLink>
        <AppLink to="/achievements">
          <Award />
          Achievements
        </AppLink>
      </div>
    </div>
  );
};

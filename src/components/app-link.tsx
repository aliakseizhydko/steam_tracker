import type { FC, PropsWithChildren } from "react";
import { NavLink } from "react-router";
import { twMerge } from "tailwind-merge";

export type AppLinkProps = {
  to: string;
};

export const AppLink: FC<PropsWithChildren<AppLinkProps>> = ({
  to,
  children,
}) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        twMerge(
          "flex flex-row text-white gap-2 p-2 hover:scale-110 transition",
          isActive && "text-amber-200"
        )
      }
    >
      {children}
    </NavLink>
  );
};

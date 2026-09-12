import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { hasStoredSession } from "../services/apiFetch";


type GuardProps = {
  children: ReactNode;
};


export function PublicOnlyRoute({
  children,
}: GuardProps) {
  if (hasStoredSession()) {
    return (
      <Navigate
        to="/temple-admin-dashboard"
        replace
      />
    );
  }

  return children;
}


export function ProtectedRoute({
  children,
}: GuardProps) {
  if (!hasStoredSession()) {
    return (
      <Navigate
        to="/temple-admin-login"
        replace
      />
    );
  }

  return children;
}
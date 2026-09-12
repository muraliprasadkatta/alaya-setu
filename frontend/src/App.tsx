import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router";

import TempleAdminRegister from "./pages/TempleAdminRegister";
import TempleAdminLogin from "./pages/TempleAdminLogin";
import TempleRequest from "./pages/TempleRequest";
import TempleAdminDashboard from "./pages/TempleAdminDashboard";
import ManageTemple from "./pages/ManageTemple";
import ProfilePage from "./pages/ProfilePage";

import TempleOverview from "./pages/temple_management/TempleOverview";
import TempleMembers from "./pages/temple_management/TempleMembers";
import TempleAnnouncements from "./pages/temple_management/TempleAnnouncements";
import TempleEvents from "./pages/temple_management/TempleEvents";
import TempleSettings from "./pages/temple_management/TempleSettings";

import TempleAdminDashboardLayout from "./components/temple_admin_dashboard/TempleAdminDashboardLayout";

import {
  ProtectedRoute,
  PublicOnlyRoute,
} from "./routes/AuthGuards";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to="/admin-register"
              replace
            />
          }
        />

        <Route
          path="/admin-register"
          element={
            <PublicOnlyRoute>
              <TempleAdminRegister />
            </PublicOnlyRoute>
          }
        />

        <Route
          path="/temple-admin-login"
          element={
            <PublicOnlyRoute>
              <TempleAdminLogin />
            </PublicOnlyRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <TempleAdminDashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/temple-admin-dashboard"
            element={<TempleAdminDashboard />}
          />

          <Route
            path="/profile"
            element={<ProfilePage />}
          />

          <Route
            path="/temple-request"
            element={<TempleRequest />}
          />

          <Route
            path="/temples/:templeId/manage"
            element={<ManageTemple />}
          >
            <Route
              index
              element={<TempleOverview />}
            />

            <Route
              path="members"
              element={<TempleMembers />}
            />

            <Route
              path="announcements"
              element={<TempleAnnouncements />}
            />

            <Route
              path="events"
              element={<TempleEvents />}
            />

            <Route
              path="settings"
              element={<TempleSettings />}
            />
          </Route>
        </Route>

        <Route
          path="*"
          element={
            <Navigate
              to="/admin-register"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}


export default App;
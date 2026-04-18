import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  createAdminLocation,
  createAdminPark,
  getAdminAuditLogs,
  getAdminLocations,
  getAdminOverview,
  getAdminParks,
  getAdminRequests,
  getAdminUsers,
  updateAdminLocation,
  updateAdminPark,
  updateAdminRequest,
  updateAdminUser,
} from "../api/admin.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { invalidateLocationsCache } from "../api/locations.js";
import { invalidateParksCache } from "../api/parks.js";

const ADMIN_ROLES = new Set(["ADMIN", "SUPERADMIN"]);
const AUDIT_LOG_LIMIT = 20;
const LOCATION_LIST_LIMIT = 50;
const REQUEST_LIST_LIMIT = 30;
const USER_LIST_LIMIT = 25;

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function sortParksByName(items) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name));
}

function updateUsersOverview(current, updater) {
  if (!current) return current;

  return {
    ...current,
    users: updater(current.users),
  };
}

function updateCatalogOverview(current, section, updater) {
  if (!current) return current;

  return {
    ...current,
    [section]: updater(current[section]),
  };
}

function updateRequestsOverview(current, previousStatus, nextStatus) {
  if (!current || previousStatus === nextStatus) return current;

  const nextRequests = { ...current.requests };
  const decrementKey =
    previousStatus === "OPEN"
      ? "open"
      : previousStatus === "PENDING"
        ? "pending"
        : previousStatus === "ACCEPTED"
          ? "accepted"
          : null;
  const incrementKey =
    nextStatus === "OPEN"
      ? "open"
      : nextStatus === "PENDING"
        ? "pending"
        : nextStatus === "ACCEPTED"
          ? "accepted"
          : null;

  if (decrementKey) {
    nextRequests[decrementKey] = Math.max(0, nextRequests[decrementKey] - 1);
  }

  if (incrementKey) {
    nextRequests[incrementKey] += 1;
  }

  return {
    ...current,
    requests: nextRequests,
  };
}

function AdminSection({ title, description, actions, children }) {
  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2 className="section-title">{title}</h2>
          <div className="muted">{description}</div>
        </div>

        {actions ? <div className="toolbar">{actions}</div> : null}
      </div>

      {children}
    </section>
  );
}

export default function Admin() {
  const { user: sessionUser } = useAuth();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [parks, setParks] = useState([]);
  const [locations, setLocations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingActions, setPendingActions] = useState(() => new Set());

  const [userSearch, setUserSearch] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const userQueryRef = useRef("");
  const requestQueryRef = useRef("");
  const pendingActionsRef = useRef(new Set());

  const [parkForm, setParkForm] = useState({
    id: "",
    name: "",
    isActive: true,
  });
  const [locationForm, setLocationForm] = useState({
    id: "",
    name: "",
    parkId: "",
    area: "Merch",
    isActive: true,
  });

  const loadOverview = useCallback(async () => {
    const data = await getAdminOverview();
    setOverview(data);
  }, []);

  const setActionPending = useCallback((key, isPending) => {
    const nextPending = new Set(pendingActionsRef.current);

    if (isPending) {
      nextPending.add(key);
    } else {
      nextPending.delete(key);
    }

    pendingActionsRef.current = nextPending;
    setPendingActions(nextPending);
  }, []);

  const runPendingAction = useCallback(
    async (key, fallbackMessage, action) => {
      if (pendingActionsRef.current.has(key)) {
        return;
      }

      setActionPending(key, true);
      setError("");

      try {
        await action();
      } catch (nextError) {
        setError(nextError.message || fallbackMessage);
      } finally {
        setActionPending(key, false);
      }
    },
    [setActionPending]
  );

  const loadUsers = useCallback(async (query = userQueryRef.current) => {
    const normalizedQuery = String(query || "").trim();
    userQueryRef.current = normalizedQuery;
    const data = await getAdminUsers({ q: normalizedQuery, limit: USER_LIST_LIMIT });
    setUsers(data);
  }, []);

  const loadParks = useCallback(async () => {
    const data = await getAdminParks();
    setParks(data);
    setLocationForm((current) => ({
      ...current,
      parkId: current.parkId || data[0]?.id || "",
    }));
  }, []);

  const loadLocations = useCallback(async () => {
    const data = await getAdminLocations({ limit: LOCATION_LIST_LIMIT });
    setLocations(data);
  }, []);

  const loadRequests = useCallback(async (query = requestQueryRef.current) => {
    const normalizedQuery = String(query || "").trim();
    requestQueryRef.current = normalizedQuery;
    const data = await getAdminRequests({ q: normalizedQuery, limit: REQUEST_LIST_LIMIT });
    setRequests(data);
  }, []);

  const loadAuditLogs = useCallback(async () => {
    const data = await getAdminAuditLogs({ limit: AUDIT_LOG_LIMIT });
    setAuditLogs(data);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      await Promise.all([
        loadOverview(),
        loadUsers(),
        loadParks(),
        loadLocations(),
        loadRequests(),
        loadAuditLogs(),
      ]);
    } catch (nextError) {
      setError(nextError.message || "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }, [loadAuditLogs, loadLocations, loadOverview, loadParks, loadRequests, loadUsers]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleCreatePark = async (e) => {
    e.preventDefault();

    await runPendingAction("park:create", "Failed to create park.", async () => {
      const createdPark = await createAdminPark(parkForm);
      invalidateParksCache();
      setParkForm({ id: "", name: "", isActive: true });
      setParks((current) => sortParksByName([...current, createdPark]));
      setOverview((current) =>
        updateCatalogOverview(current, "parks", (parksOverview) => ({
          ...parksOverview,
          total: parksOverview.total + 1,
          active: createdPark.isActive ? parksOverview.active + 1 : parksOverview.active,
        }))
      );
      await loadAuditLogs();
    });
  };

  const handleCreateLocation = async (e) => {
    e.preventDefault();

    await runPendingAction("location:create", "Failed to create location.", async () => {
      const createdLocation = await createAdminLocation(locationForm);
      invalidateLocationsCache();
      setLocationForm((current) => ({
        ...current,
        id: "",
        name: "",
      }));
      setLocations((current) => [createdLocation, ...current].slice(0, LOCATION_LIST_LIMIT));
      setOverview((current) =>
        updateCatalogOverview(current, "locations", (locationsOverview) => ({
          ...locationsOverview,
          total: locationsOverview.total + 1,
          active: createdLocation.isActive
            ? locationsOverview.active + 1
            : locationsOverview.active,
        }))
      );
      await loadAuditLogs();
    });
  };

  const handleUserRoleChange = async (userId, role) => {
    await runPendingAction(`user:role:${userId}`, "Failed to update user.", async () => {
      const previousUser = users.find((user) => user.id === userId);
      const updatedUser = await updateAdminUser(userId, { role });

      setUsers((current) => current.map((user) => (user.id === userId ? updatedUser : user)));
      setOverview((current) =>
        updateUsersOverview(current, (usersOverview) => ({
          ...usersOverview,
          admins: previousUser
            ? Math.max(
                0,
                usersOverview.admins +
                  Number(ADMIN_ROLES.has(updatedUser.role)) -
                  Number(ADMIN_ROLES.has(previousUser.role))
              )
            : usersOverview.admins,
        }))
      );
      await loadAuditLogs();
    });
  };

  const handleUserActiveToggle = async (userId, isActive) => {
    await runPendingAction(`user:status:${userId}`, "Failed to update user.", async () => {
      const previousUser = users.find((user) => user.id === userId);
      const updatedUser = await updateAdminUser(userId, { isActive: !isActive });

      setUsers((current) => current.map((user) => (user.id === userId ? updatedUser : user)));
      setOverview((current) =>
        updateUsersOverview(current, (usersOverview) => ({
          ...usersOverview,
          active: previousUser
            ? Math.max(
                0,
                usersOverview.active +
                  Number(updatedUser.isActive) -
                  Number(previousUser.isActive)
              )
            : usersOverview.active,
        }))
      );
      await loadAuditLogs();
    });
  };

  const handleParkToggle = async (parkId, isActive) => {
    await runPendingAction(`park:status:${parkId}`, "Failed to update park.", async () => {
      const previousPark = parks.find((park) => park.id === parkId);
      const updatedPark = await updateAdminPark(parkId, { isActive: !isActive });

      invalidateParksCache();
      invalidateLocationsCache();
      setParks((current) =>
        sortParksByName(current.map((park) => (park.id === parkId ? updatedPark : park)))
      );
      setOverview((current) =>
        updateCatalogOverview(current, "parks", (parksOverview) => ({
          ...parksOverview,
          active: previousPark
            ? Math.max(
                0,
                parksOverview.active +
                  Number(updatedPark.isActive) -
                  Number(previousPark.isActive)
              )
            : parksOverview.active,
        }))
      );
      await loadAuditLogs();
    });
  };

  const handleLocationToggle = async (locationId, isActive) => {
    await runPendingAction(
      `location:status:${locationId}`,
      "Failed to update location.",
      async () => {
        const previousLocation = locations.find((location) => location.id === locationId);
        const updatedLocation = await updateAdminLocation(locationId, { isActive: !isActive });

        invalidateLocationsCache();
        setLocations((current) => [
          updatedLocation,
          ...current.filter((location) => location.id !== locationId),
        ]);
        setOverview((current) =>
          updateCatalogOverview(current, "locations", (locationsOverview) => ({
            ...locationsOverview,
            active: previousLocation
              ? Math.max(
                  0,
                  locationsOverview.active +
                    Number(updatedLocation.isActive) -
                    Number(previousLocation.isActive)
                )
              : locationsOverview.active,
          }))
        );
        await loadAuditLogs();
      }
    );
  };

  const handleRequestAction = async (requestId, status) => {
    await runPendingAction(`request:${requestId}:${status}`, "Failed to update request.", async () => {
      const previousRequest = requests.find((request) => request.id === requestId);
      const updatedRequest = await updateAdminRequest(requestId, { status });

      setRequests((current) =>
        current.map((request) => (request.id === requestId ? updatedRequest : request))
      );
      setOverview((current) =>
        updateRequestsOverview(current, previousRequest?.status, updatedRequest.status)
      );
      await loadAuditLogs();
    });
  };

  const handleUserSearch = async (e) => {
    e.preventDefault();

    try {
      setError("");
      await loadUsers(userSearch);
    } catch (nextError) {
      setError(nextError.message || "Failed to load users.");
    }
  };

  const handleRequestSearch = async (e) => {
    e.preventDefault();

    try {
      setError("");
      await loadRequests(requestSearch);
    } catch (nextError) {
      setError(nextError.message || "Failed to load requests.");
    }
  };

  const isPending = useCallback((key) => pendingActions.has(key), [pendingActions]);
  const canManageSuperadmins = sessionUser?.role === "SUPERADMIN";
  const roleOptions = canManageSuperadmins
    ? ["USER", "ADMIN", "SUPERADMIN"]
    : ["USER", "ADMIN"];

  return (
    <div className="page">
      <section className="hero-card">
        <div className="section-header">
          <div>
            <div className="eyebrow">Admin Console</div>
            <h1>Control users, catalog, requests and audit activity from one board.</h1>
          </div>

          <button className="btn primary" type="button" onClick={refreshAll} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {overview ? (
          <div className="metric-row">
            <div className="metric-card">
              <span className="metric-label">Users</span>
              <strong>{overview.users.active}/{overview.users.total} active</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Admins</span>
              <strong>{overview.users.admins}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Parks</span>
              <strong>{overview.parks.active}/{overview.parks.total} active</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Locations</span>
              <strong>{overview.locations.active}/{overview.locations.total} active</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Open requests</span>
              <strong>{overview.requests.open}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Last 7 days</span>
              <strong>{overview.requests.last7Days}</strong>
            </div>
          </div>
        ) : null}

        {error ? <div className="error">{error}</div> : null}
      </section>

      <AdminSection
        title="Users"
        description="Review roles, active status and request ownership."
        actions={
          <form className="toolbar" onSubmit={handleUserSearch}>
            <input
              className="input admin-search"
              placeholder="Search users"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <button className="ghost-btn" type="submit" disabled={loading}>
              Search
            </button>
          </form>
        }
      >
        <div className="admin-grid">
          {users.map((user) => {
            const isSelf = sessionUser?.id === user.id;
            const isProtectedUser = !canManageSuperadmins && user.role === "SUPERADMIN";
            const userRoleOptions = roleOptions.includes(user.role)
              ? roleOptions
              : [user.role, ...roleOptions];

            return (
              <div key={user.id} className="list-card">
                <div className="list-row">
                  <div>
                    <div className="list-title">{user.firstName} {user.lastName}</div>
                    <div className="list-sub">{user.email}</div>
                  </div>
                  <div className="count-pill">{user.pernerNumber}</div>
                </div>

                <div className="admin-meta">
                  <span>Owned requests: {user._count.ownedRequests}</span>
                  <span>Status: {user.isActive ? "Active" : "Disabled"}</span>
                </div>

                <div className="action-row">
                  <select
                    className="input admin-inline-control"
                    value={user.role}
                    disabled={isSelf || isProtectedUser || isPending(`user:role:${user.id}`)}
                    onChange={(e) => handleUserRoleChange(user.id, e.target.value)}
                  >
                    {userRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>

                  <button
                    className={`btn small ${user.isActive ? "danger" : "confirm"}`}
                    type="button"
                    disabled={isSelf || isProtectedUser || isPending(`user:status:${user.id}`)}
                    onClick={() => handleUserActiveToggle(user.id, user.isActive)}
                  >
                    {user.isActive ? "Disable" : "Activate"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </AdminSection>

      <AdminSection title="Parks" description="Create parks and control whether they are available to users.">
        <form className="admin-form" onSubmit={handleCreatePark}>
          <input
            className="input"
            placeholder="park_id"
            value={parkForm.id}
            onChange={(e) => setParkForm((current) => ({ ...current, id: e.target.value }))}
            required
          />
          <input
            className="input"
            placeholder="Park name"
            value={parkForm.name}
            onChange={(e) => setParkForm((current) => ({ ...current, name: e.target.value }))}
            required
          />
          <button className="btn publish" type="submit" disabled={isPending("park:create")}>
            {isPending("park:create") ? "Creating..." : "Create park"}
          </button>
        </form>

        <div className="admin-grid">
          {parks.map((park) => (
            <div key={park.id} className="list-card">
              <div className="list-row">
                <div>
                  <div className="list-title">{park.name}</div>
                  <div className="list-sub">{park.id}</div>
                </div>
                <div className="count-pill">{park._count.locations} locations</div>
              </div>

              <div className="action-row">
                <button
                  className={`btn small ${park.isActive ? "danger" : "confirm"}`}
                  type="button"
                  disabled={isPending(`park:status:${park.id}`)}
                  onClick={() => handleParkToggle(park.id, park.isActive)}
                >
                  {park.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection title="Locations" description="Create locations and control whether they appear in the live board.">
        <form className="admin-form" onSubmit={handleCreateLocation}>
          <input
            className="input"
            placeholder="location_id"
            value={locationForm.id}
            onChange={(e) => setLocationForm((current) => ({ ...current, id: e.target.value }))}
            required
          />
          <input
            className="input"
            placeholder="Location name"
            value={locationForm.name}
            onChange={(e) => setLocationForm((current) => ({ ...current, name: e.target.value }))}
            required
          />
          <select
            className="input"
            value={locationForm.parkId}
            onChange={(e) => setLocationForm((current) => ({ ...current, parkId: e.target.value }))}
            required
          >
            <option value="">Select park</option>
            {parks.map((park) => (
              <option key={park.id} value={park.id}>{park.name}</option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Area"
            value={locationForm.area}
            onChange={(e) => setLocationForm((current) => ({ ...current, area: e.target.value }))}
            required
          />
          <button className="btn publish" type="submit" disabled={isPending("location:create")}>
            {isPending("location:create") ? "Creating..." : "Create location"}
          </button>
        </form>

        <div className="admin-grid">
          {locations.map((location) => (
            <div key={location.id} className="list-card">
              <div className="list-row">
                <div>
                  <div className="list-title">{location.name}</div>
                  <div className="list-sub">{location.id}</div>
                </div>
                <div className="count-pill">{location.park?.name || "-"}</div>
              </div>

              <div className="admin-meta">
                <span>Area: {location.area}</span>
                <span>Requests: {location._count.requests}</span>
              </div>

              <div className="action-row">
                <button
                  className={`btn small ${location.isActive ? "danger" : "confirm"}`}
                  type="button"
                  disabled={isPending(`location:status:${location.id}`)}
                  onClick={() => handleLocationToggle(location.id, location.isActive)}
                >
                  {location.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        title="Requests"
        description="Search requests globally and force cancel or reopen when needed."
        actions={
          <form className="toolbar" onSubmit={handleRequestSearch}>
            <input
              className="input admin-search"
              placeholder="Search requests"
              value={requestSearch}
              onChange={(e) => setRequestSearch(e.target.value)}
            />
            <button className="ghost-btn" type="submit" disabled={loading}>
              Search
            </button>
          </form>
        }
      >
        <div className="list">
          {requests.map((request) => (
            <div key={request.id} className="list-card">
              <div className="list-row">
                <div>
                  <div className="list-title">
                    {request.location?.name || "-"} | {request.role}
                  </div>
                  <div className="list-sub">
                    {request.date} {request.start}-{request.end}
                  </div>
                </div>
                <div className="count-pill">{request.status}</div>
              </div>

              <div className="admin-meta">
                <span>Owner: {request.owner?.firstName} {request.owner?.lastName}</span>
                <span>Accepted by: {request.acceptedByUser?.firstName || "-"}</span>
              </div>

              <div className="action-row">
                <button
                  className="btn small danger"
                  type="button"
                  disabled={
                    request.status === "CANCELED" || isPending(`request:${request.id}:CANCELED`)
                  }
                  onClick={() => handleRequestAction(request.id, "CANCELED")}
                >
                  Force cancel
                </button>
                <button
                  className="btn small confirm"
                  type="button"
                  disabled={request.status === "OPEN" || isPending(`request:${request.id}:OPEN`)}
                  onClick={() => handleRequestAction(request.id, "OPEN")}
                >
                  Reopen
                </button>
              </div>
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection title="Audit log" description="Latest admin operations across users, catalog and requests.">
        <div className="list">
          {auditLogs.map((log) => (
            <div key={log.id} className="list-card">
              <div className="list-row">
                <div className="list-title">
                  {log.action} {log.entityType}
                </div>
                <div className="count-pill">{formatDateTime(log.createdAt)}</div>
              </div>

              <div className="list-sub">
                Actor: {log.actorUser?.email || "Unknown"} | Entity: {log.entityId || "-"}
              </div>
            </div>
          ))}
        </div>
      </AdminSection>
    </div>
  );
}

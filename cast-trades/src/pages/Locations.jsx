import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { todayISO } from "../utils/dateUtils";
import { getParks } from "../api/parks.js";
import { getLocations } from "../api/locations.js";
import {
  getRequests,
  createRequest,
  updateRequest,
  acceptRequest,
  deleteRequest,
} from "../api/requests.js";
import CreateRequestPanel from "../components/CreateRequestPanel.jsx";
import CalendarPanel from "../components/CalendarPanel.jsx";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function minutesFromHHMM(time) {
  const [hours, minutes] = (time || "00:00").split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

function durationLabel(start, end) {
  let diff = minutesFromHHMM(end) - minutesFromHHMM(start);
  if (diff < 0) diff += 24 * 60;

  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  if (minutes === 0) return `${hours} hrs`;
  return `${hours} hrs ${minutes} min`;
}

function timeToMinutes(time) {
  if (!time || !time.includes(":")) return null;

  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  return hours * 60 + minutes;
}

function isRequestVisibleInCalendar(request, { parkId, area, calendarDate }) {
  if (!request || request.status !== "OPEN") return false;
  if (request.date !== calendarDate) return false;
  if (request.location?.parkId !== parkId) return false;
  if (request.location?.area !== area) return false;

  return true;
}

function upsertRequest(requests, nextRequest, filters) {
  const withoutCurrent = requests.filter((request) => request.id !== nextRequest.id);

  if (!isRequestVisibleInCalendar(nextRequest, filters)) {
    return withoutCurrent;
  }

  return [...withoutCurrent, nextRequest].sort((a, b) => {
    const aKey = `${a.date}T${a.start}`;
    const bKey = `${b.date}T${b.start}`;
    return aKey.localeCompare(bKey);
  });
}

function LoadingLocationCards() {
  return (
    <div className="choice-grid">
      {[0, 1, 2].map((index) => (
        <div key={index} className="choice-card skeleton-card" aria-hidden="true" />
      ))}
    </div>
  );
}

export default function Locations() {
  const q = useQuery();
  const initialParkId = q.get("park") || "animal_kingdom";

  const [parkId, setParkId] = useState(initialParkId);
  const [parks, setParks] = useState([]);
  const [parksLoading, setParksLoading] = useState(false);

  const [area, setArea] = useState("Merch");
  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);

  const [activeView, setActiveView] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const [role, setRole] = useState("");
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [calendarDate, setCalendarDate] = useState(todayISO());

  const [formError, setFormError] = useState("");
  const [editingRequestId, setEditingRequestId] = useState(null);

  const [requestsForDay, setRequestsForDay] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const { user } = useAuth();
  const calendarFilters = { parkId, area, calendarDate };
  const skipNextCalendarFetchRef = useRef(false);

  const locs = useMemo(() => {
    return locations.filter((locationItem) => locationItem.parkId === parkId && locationItem.area === area);
  }, [locations, parkId, area]);

  const selectedPark = useMemo(() => {
    return parks.find((park) => park.id === parkId) || null;
  }, [parks, parkId]);

  const fetchParks = useCallback(async () => {
    if (!user) return;

    try {
      setParksLoading(true);
      const data = await getParks();
      setParks(data);

      if (!parkId && data.length > 0) {
        setParkId(data[0].id);
      }
    } catch (err) {
      console.error("FETCH PARKS ERROR:", err);
      setParks([]);
    } finally {
      setParksLoading(false);
    }
  }, [parkId, user]);

  const fetchLocations = useCallback(async () => {
    if (!user || !parkId) return;

    try {
      setLocationsLoading(true);
      const data = await getLocations({ parkId, area });
      setLocations(data);
    } catch (err) {
      console.error("FETCH LOCATIONS ERROR:", err);
      setLocations([]);
    } finally {
      setLocationsLoading(false);
    }
  }, [area, parkId, user]);

  const fetchRequests = useCallback(async () => {
    if (!user || !parkId) return;

    try {
      setLoadingRequests(true);
      const data = await getRequests({ parkId, area, date: calendarDate });
      setRequestsForDay(data);
    } catch (err) {
      console.error("FETCH REQUESTS ERROR:", err);
      setRequestsForDay([]);
    } finally {
      setLoadingRequests(false);
    }
  }, [area, calendarDate, parkId, user]);

  useEffect(() => {
    fetchParks();
  }, [fetchParks]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    if (activeView !== "calendar") return;
    if (skipNextCalendarFetchRef.current) {
      skipNextCalendarFetchRef.current = false;
      return;
    }
    fetchRequests();
  }, [activeView, fetchRequests]);

  const resetForm = () => {
    setRole("");
    setDate(todayISO());
    setStart("");
    setEnd("");
    setFormError("");
    setEditingRequestId(null);
  };

  const onOpenCreate = (locationItem) => {
    setSelectedLocation(locationItem);
    resetForm();
    setActiveView("create");
  };

  const onOpenCalendar = () => {
    setSelectedLocation(null);
    setActiveView("calendar");
  };

  const onClosePanel = () => {
    setActiveView(null);
    setSelectedLocation(null);
    setFormError("");
    setEditingRequestId(null);
  };

  const onCreateRequest = async (e) => {
    e.preventDefault();

    if (!selectedLocation) return;

    if (!date) {
      setFormError("Please select a date.");
      return;
    }

    if (!role) {
      setFormError("Please select a role.");
      return;
    }

    if (!start) {
      setFormError("Please select a start time.");
      return;
    }

    if (!end) {
      setFormError("Please select an end time.");
      return;
    }

    if (start === end) {
      setFormError("Start time and end time cannot be the same.");
      return;
    }

    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);

    if (startMinutes === null || endMinutes === null) {
      setFormError("Please enter valid times.");
      return;
    }

    setFormError("");

    const payload = {
      role,
      date,
      start,
      end,
      locationId: selectedLocation.id,
    };

    try {
      let savedRequest;

      if (editingRequestId) {
        savedRequest = await updateRequest(editingRequestId, payload);
      } else {
        savedRequest = await createRequest(payload);
      }

      skipNextCalendarFetchRef.current = true;
      setRequestsForDay((current) => upsertRequest(current, savedRequest, calendarFilters));
      resetForm();
      setSelectedLocation(null);
      setActiveView("calendar");
    } catch (err) {
      console.error("SAVE REQUEST ERROR:", err);
      setFormError(err.message || "Failed to save request.");
    }
  };

  const onAccept = async (requestItem) => {
    if (!user?.id) return;
    if (requestItem.ownerId === user.id) return;

    try {
      const updatedRequest = await acceptRequest(requestItem.id);
      setRequestsForDay((current) => upsertRequest(current, updatedRequest, calendarFilters));
    } catch (err) {
      console.error("ACCEPT REQUEST ERROR:", err);

      if (err.status === 409) {
        alert("This shift is no longer available.");
        setRequestsForDay((current) =>
          current.filter((requestItemCurrent) => requestItemCurrent.id !== requestItem.id)
        );
        return;
      }

      alert(err.message || "Failed to accept request.");
    }
  };

  const onDelete = async (requestItem) => {
    if (!user?.id) return;
    if (requestItem.ownerId !== user.id) return;

    const ok = window.confirm("Delete this request?");
    if (!ok) return;

    try {
      await deleteRequest(requestItem.id);
      setRequestsForDay((current) =>
        current.filter((requestItemCurrent) => requestItemCurrent.id !== requestItem.id)
      );
    } catch (err) {
      console.error("DELETE REQUEST ERROR:", err);
    }
  };

  const onEdit = (requestItem) => {
    if (!user?.id) return;
    if (requestItem.ownerId !== user.id) return;

    const matchedLocation = locations.find((locationItem) => locationItem.id === requestItem.locationId);
    if (!matchedLocation) return;

    setSelectedLocation(matchedLocation);
    setRole(requestItem.role || "");
    setDate(requestItem.date || todayISO());
    setStart(requestItem.start || "");
    setEnd(requestItem.end || "");
    setFormError("");
    setEditingRequestId(requestItem.id);
    setActiveView("create");
  };

  return (
    <div className="page">
      <section className="hero-card">
        <div className="eyebrow">Locations Board</div>
        <h1>{selectedPark?.name || "Choose a park"} coverage board.</h1>
        <p className="hero-copy">
          Browse active locations, create a request in one tap, and switch to the
          calendar overlay when you want the full daily view.
        </p>

        <div className="metric-row">
          <div className="metric-card">
            <span className="metric-label">Active area</span>
            <strong>{area}</strong>
          </div>

          <div className="metric-card">
            <span className="metric-label">Locations</span>
            <strong>{locationsLoading ? "..." : locs.length}</strong>
          </div>

          <div className="metric-card">
            <span className="metric-label">Open on {calendarDate}</span>
            <strong>{loadingRequests ? "..." : requestsForDay.length}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <div className="eyebrow">Filters</div>
            <h2 className="section-title">Set the board context</h2>
          </div>

          <button className="ghost-btn" type="button" onClick={onOpenCalendar}>
            Open calendar
          </button>
        </div>

        <div className="control-grid">
          <label className="field-stack">
            <span className="label">Park</span>
            <select
              className="input"
              value={parkId}
              onChange={(e) => {
                setParkId(e.target.value);
                setActiveView(null);
                setSelectedLocation(null);
              }}
              disabled={parksLoading}
            >
              {parks.map((park) => (
                <option key={park.id} value={park.id}>
                  {park.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-stack">
            <span className="label">Area</span>
            <select
              className="input"
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setActiveView(null);
                setSelectedLocation(null);
              }}
            >
              <option value="Merch">Merch</option>
            </select>
          </label>
        </div>

        <div className="inline-banner">
          <div>
            <div className="eyebrow">Quick action</div>
            <div className="banner-title">
              {selectedLocation
                ? `${selectedLocation.name} is ready for a new request.`
                : "Pick a location card to create or edit a request."}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <div className="eyebrow">Available spots</div>
            <h2 className="section-title">Tap a location to compose a request</h2>
          </div>
        </div>

        {locationsLoading ? (
          <LoadingLocationCards />
        ) : locs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">No locations found.</div>
            <div className="muted">Try a different park or wait for the API to populate data.</div>
          </div>
        ) : (
          <div className="choice-grid">
            {locs.map((locationItem) => {
              const isActive = selectedLocation?.id === locationItem.id && activeView === "create";

              return (
                <button
                  key={locationItem.id}
                  className={`choice-card ${isActive ? "active" : ""}`}
                  type="button"
                  onClick={() => onOpenCreate(locationItem)}
                >
                  <div className="choice-kicker">{locationItem.area}</div>
                  <div className="choice-title">{locationItem.name}</div>
                  <div className="choice-meta">
                    {isActive ? "Composer open for this location." : "Open request composer."}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {activeView === "create" && selectedLocation && (
        <CreateRequestPanel
          selectedLocation={selectedLocation}
          role={role}
          setRole={setRole}
          date={date}
          setDate={setDate}
          start={start}
          setStart={setStart}
          end={end}
          setEnd={setEnd}
          onCreateRequest={onCreateRequest}
          onClosePanel={onClosePanel}
          formError={formError}
          isEditing={!!editingRequestId}
        />
      )}

      {activeView === "calendar" && (
        <CalendarPanel
          calendarDate={calendarDate}
          setCalendarDate={setCalendarDate}
          requestsForDay={requestsForDay}
          user={user}
          durationLabel={durationLabel}
          onAccept={onAccept}
          onDelete={onDelete}
          onEdit={onEdit}
          onClosePanel={onClosePanel}
          loading={loadingRequests}
        />
      )}
    </div>
  );
}

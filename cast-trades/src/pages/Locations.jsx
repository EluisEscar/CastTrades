import React, { useEffect, useMemo, useRef, useState } from "react";
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

function minutesFromHHMM(t) {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

function durationLabel(start, end) {
  let diff = minutesFromHHMM(end) - minutesFromHHMM(start);
  if (diff < 0) diff += 24 * 60;

  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;

  if (mins === 0) return `${hrs} hrs`;
  return `${hrs} hrs ${mins} min`;
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

  const { user, token } = useAuth();
  const calendarFilters = { parkId, area, calendarDate };
  const skipNextCalendarFetchRef = useRef(false);

  const locs = useMemo(() => {
    return locations.filter((l) => l.parkId === parkId && l.area === area);
  }, [locations, parkId, area]);

  const fetchParks = async () => {
    if (!token) return;

    try {
      setParksLoading(true);
      const data = await getParks(token);
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
  };

  const fetchLocations = async () => {
    if (!token || !parkId) return;

    try {
      setLocationsLoading(true);
      const data = await getLocations({ parkId, area }, token);
      setLocations(data);
    } catch (err) {
      console.error("FETCH LOCATIONS ERROR:", err);
      setLocations([]);
    } finally {
      setLocationsLoading(false);
    }
  };

  const fetchRequests = async () => {
    if (!token || !parkId) return;

    try {
      setLoadingRequests(true);
      const data = await getRequests({ parkId, area, date: calendarDate }, token);
      setRequestsForDay(data);
    } catch (err) {
      console.error("FETCH REQUESTS ERROR:", err);
      setRequestsForDay([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchParks();
  }, [token]);

  useEffect(() => {
    fetchLocations();
  }, [token, parkId, area]);

  useEffect(() => {
    if (activeView !== "calendar") return;
    if (skipNextCalendarFetchRef.current) {
      skipNextCalendarFetchRef.current = false;
      return;
    }
    fetchRequests();
  }, [token, parkId, area, calendarDate, activeView]);

  const resetForm = () => {
    setRole("");
    setDate(todayISO());
    setStart("");
    setEnd("");
    setFormError("");
    setEditingRequestId(null);
  };

  const onOpenCreate = (location) => {
    setSelectedLocation(location);
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
        savedRequest = await updateRequest(editingRequestId, payload, token);
      } else {
        savedRequest = await createRequest(payload, token);
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

  const onAccept = async (req) => {
    if (!user?.id || !token) return;
    if (req.ownerId === user.id) return;

    try {
      const updatedRequest = await acceptRequest(req.id, token);
      setRequestsForDay((current) => upsertRequest(current, updatedRequest, calendarFilters));
    } catch (err) {
      console.error("ACCEPT REQUEST ERROR:", err);

      if (err.status === 409) {
        alert("This shift is no longer available.");
        setRequestsForDay((current) => current.filter((request) => request.id !== req.id));
        return;
      }

      alert(err.message || "Failed to accept request.");
    }
  };

  const onDelete = async (req) => {
    if (!user?.id || !token) return;
    if (req.ownerId !== user.id) return;

    const ok = window.confirm("Delete this request?");
    if (!ok) return;

    try {
      await deleteRequest(req.id, token);
      setRequestsForDay((current) => current.filter((request) => request.id !== req.id));
    } catch (err) {
      console.error("DELETE REQUEST ERROR:", err);
    }
  };

  const onEdit = (req) => {
    if (!user?.id) return;
    if (req.ownerId !== user.id) return;

    const loc = locations.find((l) => l.id === req.locationId);
    if (!loc) return;

    setSelectedLocation(loc);
    setRole(req.role || "");
    setDate(req.date || todayISO());
    setStart(req.start || "");
    setEnd(req.end || "");
    setFormError("");
    setEditingRequestId(req.id);
    setActiveView("create");
  };

  return (
    <div className="page">
      <h1>Locations</h1>

      <div className="card">
        <div className="row">
          <div>
            <div className="label">Park</div>
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
          </div>

          <div>
            <div className="label">Area</div>
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
          </div>
        </div>

        <div className="list">
          {locationsLoading ? (
            <div className="list-sub">Loading locations...</div>
          ) : locs.length === 0 ? (
            <div className="list-sub">No locations found.</div>
          ) : (
            locs.map((l) => (
              <button
                key={l.id}
                className="list-item"
                type="button"
                onClick={() => onOpenCreate(l)}
              >
                <div className="list-title">{l.name}</div>
                <div className="list-sub">Tap to create request</div>
              </button>
            ))
          )}
        </div>

        <button className="btn" type="button" onClick={onOpenCalendar}>
          View Requests Calendar
        </button>
      </div>

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

import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { locations } from "../mockData.js";
import SheetSelect from "../components/SheetSelect.jsx";
import DateSheet from "../components/DateSheet.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { todayISO } from "../utils/dateUtils";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function CreateRequest() {
  const q = useQuery();
  const parkId = q.get("park") || "animal_kingdom";
  const area = q.get("area") || "Merch";
  const locationId = q.get("locationId") || "island_mercantile";
  const navigate = useNavigate();

  const loc = useMemo(() => locations.find((l) => l.id === locationId), [locationId]);

  const [role, setRole] = useState("");
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState("00:00");
  const [end, setEnd] = useState("00:00");
  const { user } = useAuth();

  const onSubmit = (e) => {
    e.preventDefault();

      const newReq = {
      id: crypto?.randomUUID?.() || String(Date.now()),
      parkId,
      area,
      date,
      start,
      end,
      role,
      locationId,
      locationName: loc?.name || locationId,
      createdByName: `${user?.name ?? "User"} ${user?.lastName?.charAt(0)?.toUpperCase() ?? ""}`,
      ownerId: user?.uid,            
      status: "OPEN",
      createdAt: new Date().toISOString(),
    };

    const key = "casttrades_requests";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    existing.push(newReq);
    localStorage.setItem(key, JSON.stringify(existing));
    navigate(`/calendar?park=${parkId}&area=${area}`);
  };

  return (
    <div className="page">
      <h1>Create Request</h1>

      <form className="card" onSubmit={onSubmit}>
        <div className="label">Locación</div>
        <div className="pill">{loc?.name || locationId}</div>

      <SheetSelect
        label="Rol"
        title="Select Role"
        value={role}
        options={[
          { value: "", label: "Select role..." },
          { value: "Floorstock", label: "Floorstock" }
        ]}
        onChange={setRole}
      />

        <div className="row">
          <div style={{ flex: 1 }}>
            <DateSheet
              label="Fecha"
              title="Select Date"
              value={date}
              onChange={setDate}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div className="label">Inicio</div>
            <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="label">Fin</div>
            <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        <button className="btn publish" type="submit">Publish</button>
      </form>
    </div>
  );
}

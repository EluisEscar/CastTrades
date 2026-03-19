import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { locations } from "../mockData.js";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function Locations() {
  const q = useQuery();
  const parkId = q.get("park") || "animal_kingdom";
  const [area, setArea] = useState("Merch");
  const navigate = useNavigate();

  const locs = useMemo(
    () => locations.filter((l) => l.parkId === parkId && l.area === area),
    [parkId, area]
  );

  return (
    <div className="page">
      <h1>Locaciones</h1>

      <div className="card">
        <div className="row">
          <div>
            <div className="label">Parque</div>
            <div className="pill">{parkId}</div>
          </div>

          <div>
            <div className="label">Área</div>
            <select className="input" value={area} onChange={(e) => setArea(e.target.value)}>
              <option>Merch</option>
            </select>
          </div>
        </div>

        <div className="list">
          {locs.map((l) => (
            <button
              key={l.id}
              className="list-item"
              onClick={() =>
                navigate(`/create?park=${parkId}&area=${area}&locationId=${l.id}`)
              }
            >
              <div className="list-title">{l.name}</div>
              <div className="list-sub">Tap para crear request</div>
            </button>
          ))}
        </div>

        <button className="btn" onClick={() => navigate(`/calendar?park=${parkId}&area=${area}`)}>
          Ver Calendar de Requests
        </button>
      </div>
    </div>
  );
}

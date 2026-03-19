import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parks } from "../mockData.js";

export default function Home() {
  const [selectedPark, setSelectedPark] = useState("animal_kingdom");
  const navigate = useNavigate();

  return (
    <div className="page">
      <h1>Selecciona Parque</h1>

      <div className="card">
        <label className="label">Parque</label>
        <select
          className="input"
          value={selectedPark}
          onChange={(e) => setSelectedPark(e.target.value)}
        >
          {parks.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <button
          className="btn primary"
          onClick={() => navigate(`/locations?park=${selectedPark}`)}
        >
          Ver áreas y locaciones
        </button>
      </div>

      <div className="hint">
        Tip iPhone: abre en Safari → Share → “Add to Home Screen”.
      </div>
    </div>
  );
}

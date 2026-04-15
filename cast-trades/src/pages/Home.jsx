import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getParks } from "../api/parks.js";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Home() {
  const [parks, setParks] = useState([]);
  const [selectedPark, setSelectedPark] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { token } = useAuth();

  useEffect(() => {
    const fetchParks = async () => {
      if (!token) return;

      try {
        setLoading(true);
        const data = await getParks(token);
        setParks(data);

        if (data.length > 0) {
          setSelectedPark(data[0].id);
        }
      } catch (err) {
        console.error("FETCH PARKS ERROR:", err);
        setParks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchParks();
  }, [token]);

  const handleContinue = () => {
    if (!selectedPark) return;
    navigate(`/locations?park=${selectedPark}`);
  };

  return (
    <div className="page">
      <h1>Choose Park</h1>

      <div className="card">
        <label className="label">Park</label>

        <select
          className="input"
          value={selectedPark}
          onChange={(e) => setSelectedPark(e.target.value)}
          disabled={loading || parks.length === 0}
        >
          {parks.length === 0 ? (
            <option value="">
              {loading ? "Loading parks..." : "No parks available"}
            </option>
          ) : (
            parks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))
          )}
        </select>

        <button
          className="btn primary"
          onClick={handleContinue}
          disabled={!selectedPark}
        >
          View locations
        </button>
      </div>

      <div className="hint">
        Tip: Safari → Share → “Add to Home Screen”.
      </div>
    </div>
  );
}
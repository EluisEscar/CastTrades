import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getParks } from "../api/parks.js";
import { useAuth } from "../auth/AuthContext.jsx";

function LoadingChoices() {
  return (
    <div className="choice-grid">
      {[0, 1, 2].map((index) => (
        <div key={index} className="choice-card skeleton-card" aria-hidden="true" />
      ))}
    </div>
  );
}

export default function Home() {
  const [parks, setParks] = useState([]);
  const [selectedPark, setSelectedPark] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchParks = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const data = await getParks();
        setParks(data);

        if (data.length > 0) {
          setSelectedPark((current) => current || data[0].id);
        }
      } catch (err) {
        console.error("FETCH PARKS ERROR:", err);
        setParks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchParks();
  }, [user]);

  const selectedParkData = useMemo(() => {
    return parks.find((park) => park.id === selectedPark) || null;
  }, [parks, selectedPark]);

  const handleContinue = () => {
    if (!selectedPark) return;
    navigate(`/locations?park=${selectedPark}`);
  };

  return (
    <div className="page">
      <section className="card">
        <div className="section-header park-selector-header">
          <div>
            <div className="eyebrow">Park Selector</div>
            <h2 className="section-title">Where are you picking up?</h2>
            <div className="choice-meta park-selector-meta">
              {selectedParkData
                ? `Open ${selectedParkData.name} and start managing requests.`
                : "Pick a park to continue."}
            </div>
          </div>

          <button
            className="btn primary"
            type="button"
            onClick={handleContinue}
            disabled={!selectedPark}
          >
            Open locations board
          </button>
        </div>

        {loading ? (
          <LoadingChoices />
        ) : parks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">No parks available.</div>
            <div className="muted">The board will appear here once the API responds.</div>
          </div>
        ) : (
          <div className="choice-grid">
            {parks.map((park) => {
              const isActive = park.id === selectedPark;

              return (
                <button
                  key={park.id}
                  type="button"
                  className={`choice-card ${isActive ? "active" : ""}`}
                  onClick={() => setSelectedPark(park.id)}
                >
                  <div className="choice-kicker">{isActive ? "Selected" : "Available"}</div>
                  <div className="choice-title">{park.name}</div>
                  <div className="choice-meta">
                    {isActive ? "Ready to open the locations board." : "Tap to focus this park."}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="hint-card">
        <div className="eyebrow">Mobile hint</div>
        <div className="muted">
          On iPhone, use Share then Add to Home Screen if you want this to feel more like an app.
        </div>
      </div>
    </div>
  );
}

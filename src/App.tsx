// src/App.tsx
import "./App.css";
import { db } from "./firebase";

function App() {
  console.log("Firestore instance:", db);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Multiplayer Card Game (WIP)</h1>
      <p>React + Firebase setup is done ✅</p>
    </div>
  );
}

export default App;

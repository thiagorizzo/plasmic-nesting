import React from "react";
import logo from "./logo.svg";
import "./App.css";
import { Canvas } from "./components/Canvas";

const App: React.FC = () => {
  return (
    <div className="App">
      <Canvas />
    </div>
  );
};

export default App;

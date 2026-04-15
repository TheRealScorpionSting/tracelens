import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route
} from "react-router-dom";

import Upload from "./components/Upload";
import PDFLab from "./components/PDFLab";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={<Upload />}
        />

        <Route
          path="/pdf-lab"
          element={<PDFLab />}
        />
      </Routes>
    </Router>
  );
}
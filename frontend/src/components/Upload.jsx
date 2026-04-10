import React from "react";

export default function Upload() {
  return (
    <div>
      <h2>Upload Log File</h2>
      <input type="file" />
      <button>Analyze</button>
    </div>
  );
}
import React, { useState } from "react";
import axios from "axios";

export default function Upload() {
  const [file, setFile] = useState(null);

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append("file", file);

    await axios.post("http://localhost:3001/upload", formData);
    alert("Uploaded!");
  };

  return (
    <div>
      <h2>Upload Log File</h2>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Analyze</button>
    </div>
  );
}
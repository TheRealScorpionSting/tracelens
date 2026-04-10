const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("TraceLens Backend Running");
});

app.listen(3001, () => {
  console.log("Server running on port 3001");
});

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("file"), (req, res) => {
  console.log(req.file);
  res.json({ message: "File uploaded successfully" });
});
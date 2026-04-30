const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = 3000;
const JWT_SECRET = "afnoghar-secret-key-2025";
const DB_PATH = "./server/db.json";

app.use(cors());
app.use(bodyParser.json());

const getDB = () => {
  const data = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(data);
};

const saveDB = (db) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
};

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token." });
  }
};

app.post("/login", (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const db = getDB();
    const user = db.users.find(
      (u) => u.email === email && u.password === password,
    );

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({ message: "Your account has been deactivated." });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error during login." });
  }
});

app.post("/register", (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const db = getDB();
    const existingUser = db.users.find((u) => u.email === email);

    if (existingUser) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const newUser = {
      id: db.users.length + 1,
      name,
      email,
      password,
      role: role || "buyer",
      phone,
      avatar: "",
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    db.users.push(newUser);
    saveDB(db);

    const token = jwt.sign(
      { id: newUser.id, role: newUser.role, email: newUser.email },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      success: true,
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error during registration." });
  }
});

// Public endpoint for fetching agents (for home page)
app.get("/agents", (req, res) => {
  try {
    const db = getDB();
    const agents = db.users
      .filter(u => u.role === 'seller' && u.isActive)
      .map(({ password, ...user }) => user);
    res.json(agents);
  } catch (error) {
    res.status(500).json({ message: "Error fetching agents." });
  }
});

app.get("/users", verifyToken, (req, res) => {
  try {
    const db = getDB();
    const users = db.users.map(({ password, ...u }) => u);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users." });
  }
});

app.patch("/users/:id", verifyToken, (req, res) => {
  try {
    const db = getDB();
    const index = db.users.findIndex((u) => u.id === Number(req.params.id));

    if (index === -1) {
      return res.status(404).json({ message: "User not found." });
    }

    db.users[index] = { ...db.users[index], ...req.body };
    saveDB(db);

    const { password: _, ...userWithoutPassword } = db.users[index];
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ message: "Error updating user." });
  }
});

app.get("/properties", (req, res) => {
  try {
    const db = getDB();
    res.json(db.properties);
  } catch (error) {
    res.status(500).json({ message: "Error fetching properties." });
  }
});

app.get("/properties/:id", (req, res) => {
  try {
    const db = getDB();
    const property = db.properties.find((p) => p.id === Number(req.params.id));

    if (!property) {
      return res.status(404).json({ message: "Property not found." });
    }

    res.json(property);
  } catch (error) {
    res.status(500).json({ message: "Error fetching property." });
  }
});

app.post("/properties", verifyToken, (req, res) => {
  try {
    const db = getDB();

    const newProperty = {
      id: db.properties.length + 1,
      ...req.body,
      sellerId: req.user.id,
      status: "pending",
      isFeatured: false,
      createdAt: new Date().toISOString(),
    };

    db.properties.push(newProperty);
    saveDB(db);

    res.status(201).json(newProperty);
  } catch (error) {
    res.status(500).json({ message: "Error creating property." });
  }
});

app.patch("/properties/:id", verifyToken, (req, res) => {
  try {
    const db = getDB();
    const index = db.properties.findIndex(
      (p) => p.id === Number(req.params.id),
    );

    if (index === -1) {
      return res.status(404).json({ message: "Property not found." });
    }

    db.properties[index] = { ...db.properties[index], ...req.body };
    saveDB(db);

    res.json(db.properties[index]);
  } catch (error) {
    res.status(500).json({ message: "Error updating property." });
  }
});

app.delete("/properties/:id", verifyToken, (req, res) => {
  try {
    const db = getDB();
    const index = db.properties.findIndex(
      (p) => p.id === Number(req.params.id),
    );

    if (index === -1) {
      return res.status(404).json({ message: "Property not found." });
    }

    db.properties.splice(index, 1);
    saveDB(db);

    res.json({ message: "Property deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error deleting property." });
  }
});

app.get("/appointments", verifyToken, (req, res) => {
  try {
    const db = getDB();
    res.json(db.appointments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching appointments." });
  }
});

app.post("/appointments", verifyToken, (req, res) => {
  try {
    const db = getDB();

    const newAppointment = {
      id: db.appointments.length + 1,
      ...req.body,
      buyerId: req.user.id,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    db.appointments.push(newAppointment);
    saveDB(db);

    res.status(201).json(newAppointment);
  } catch (error) {
    res.status(500).json({ message: "Error creating appointment." });
  }
});

app.patch("/appointments/:id", verifyToken, (req, res) => {
  try {
    const db = getDB();
    const index = db.appointments.findIndex(
      (a) => a.id === Number(req.params.id),
    );

    if (index === -1) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    db.appointments[index] = { ...db.appointments[index], ...req.body };
    saveDB(db);

    res.json(db.appointments[index]);
  } catch (error) {
    res.status(500).json({ message: "Error updating appointment." });
  }
});

app.get("/favorites", verifyToken, (req, res) => {
  try {
    const db = getDB();
    const { buyerId } = req.query;

    const requestedBuyerId = buyerId ? Number(buyerId) : req.user.id;

    if (Number.isNaN(requestedBuyerId)) {
      return res.status(400).json({ message: "Invalid buyer id." });
    }

    if (req.user.role !== "admin" && requestedBuyerId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Cannot access another user's favorites." });
    }

    res.json(db.favorites.filter((f) => f.buyerId === requestedBuyerId));
  } catch (error) {
    res.status(500).json({ message: "Error fetching favorites." });
  }
});

app.post("/favorites", verifyToken, (req, res) => {
  try {
    const db = getDB();
    const propertyId = Number(req.body.propertyId);

    if (!propertyId || Number.isNaN(propertyId)) {
      return res.status(400).json({ message: "Property id is required." });
    }

    const propertyExists = db.properties.some((p) => p.id === propertyId);

    if (!propertyExists) {
      return res.status(404).json({ message: "Property not found." });
    }

    const existingFavorite = db.favorites.find(
      (f) => f.buyerId === req.user.id && f.propertyId === propertyId,
    );

    if (existingFavorite) {
      return res.json(existingFavorite);
    }

    const nextId =
      db.favorites.reduce(
        (max, favorite) => Math.max(max, favorite.id || 0),
        0,
      ) + 1;

    const newFavorite = {
      id: nextId,
      buyerId: req.user.id,
      propertyId,
      createdAt: new Date().toISOString(),
    };

    db.favorites.push(newFavorite);
    saveDB(db);

    res.status(201).json(newFavorite);
  } catch (error) {
    res.status(500).json({ message: "Error adding to favorites." });
  }
});

app.delete("/favorites/:id", verifyToken, (req, res) => {
  try {
    const db = getDB();
    const index = db.favorites.findIndex((f) => f.id === Number(req.params.id));

    if (index === -1) {
      return res.status(404).json({ message: "Favorite not found." });
    }

    const favorite = db.favorites[index];

    if (req.user.role !== "admin" && favorite.buyerId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Cannot remove another user's favorite." });
    }

    db.favorites.splice(index, 1);
    saveDB(db);

    res.json({ message: "Removed from favorites." });
  } catch (error) {
    res.status(500).json({ message: "Error removing favorite." });
  }
});

app.listen(PORT, () => {
  console.log(`Afnoghar Server running at http://localhost:${PORT}`);
});

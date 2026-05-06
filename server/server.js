const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { GoogleGenAI, Type } = require("@google/genai");

const app = express();
const PORT = 3000;
const JWT_SECRET = "afnoghar-secret-key-2025";
const DB_PATH = path.join(__dirname, "db.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const ASSETS_DIR = path.join(PUBLIC_DIR, "assets");
const PROPERTY_ASSETS_DIR = path.join(ASSETS_DIR, "properties");
const AVATAR_ASSETS_DIR = path.join(ASSETS_DIR, "avatars");
const PUBLIC_ASSET_BASE_URL = "http://localhost:3000";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

fs.mkdirSync(PROPERTY_ASSETS_DIR, { recursive: true });
fs.mkdirSync(AVATAR_ASSETS_DIR, { recursive: true });

app.use(cors());
app.use(bodyParser.json());
app.use("/assets", express.static(ASSETS_DIR));

const getDB = () => {
  const data = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(data);
};

const saveDB = (db) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
};

const toPublicAssetUrl = (relativeUrl) =>
  `${PUBLIC_ASSET_BASE_URL}${relativeUrl}`;

const isManagedPropertyImage = (imageUrl = "") => {
  if (typeof imageUrl !== "string") return false;

  return (
    imageUrl.startsWith("/assets/properties/") ||
    imageUrl.startsWith(`${PUBLIC_ASSET_BASE_URL}/assets/properties/`)
  );
};

const imageUrlToFilePath = (imageUrl) => {
  if (!isManagedPropertyImage(imageUrl)) return null;

  const relativeUrl = imageUrl.replace(PUBLIC_ASSET_BASE_URL, "");
  const relativePath = relativeUrl.replace(/^\/assets\/properties\//, "");
  const filePath = path.normalize(path.join(PROPERTY_ASSETS_DIR, relativePath));

  if (!filePath.startsWith(PROPERTY_ASSETS_DIR)) return null;
  return filePath;
};

const deleteManagedImage = (imageUrl) => {
  const filePath = imageUrlToFilePath(imageUrl);
  if (!filePath || !fs.existsSync(filePath)) return;
  fs.unlinkSync(filePath);
};

const isManagedAvatar = (avatarUrl = "") => {
  if (typeof avatarUrl !== "string") return false;

  return (
    avatarUrl.startsWith("/assets/avatars/") ||
    avatarUrl.startsWith(`${PUBLIC_ASSET_BASE_URL}/assets/avatars/`)
  );
};

const avatarUrlToFilePath = (avatarUrl) => {
  if (!isManagedAvatar(avatarUrl)) return null;

  const relativeUrl = avatarUrl.replace(PUBLIC_ASSET_BASE_URL, "");
  const relativePath = relativeUrl.replace(/^\/assets\/avatars\//, "");
  const filePath = path.normalize(path.join(AVATAR_ASSETS_DIR, relativePath));

  if (!filePath.startsWith(AVATAR_ASSETS_DIR)) return null;
  return filePath;
};

const deleteManagedAvatar = (avatarUrl) => {
  const filePath = avatarUrlToFilePath(avatarUrl);
  if (!filePath || !fs.existsSync(filePath)) return;
  fs.unlinkSync(filePath);
};

const deleteRemovedManagedImages = (oldImages = [], newImages = []) => {
  const next = new Set(newImages);
  oldImages
    .filter((imageUrl) => isManagedPropertyImage(imageUrl))
    .filter((imageUrl) => !next.has(imageUrl))
    .forEach(deleteManagedImage);
};

const deletePropertyAssetFolder = (propertyId) => {
  const folderPath = path.join(PROPERTY_ASSETS_DIR, String(propertyId));
  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true });
  }
};

const holdsAppointmentSlot = (status) =>
  !["cancelled", "declined", "completed"].includes(status);

const isAppointmentParticipant = (appointment, user) =>
  appointment &&
  user &&
  (Number(appointment.buyerId || appointment.userId) === Number(user.id) ||
    Number(appointment.sellerId) === Number(user.id));

const canAccessAppointment = (appointment, user) =>
  user?.role === "admin" || isAppointmentParticipant(appointment, user);

const getVisibleAppointments = (appointments, user) => {
  if (user?.role === "admin") return appointments;

  return appointments.filter((appointment) =>
    isAppointmentParticipant(appointment, user),
  );
};

const findAppointmentSlotConflict = (
  appointments,
  { propertyId, sellerId, date, time, excludeId },
) =>
  appointments.find((appointment) => {
    const sameProperty = Number(appointment.propertyId) === Number(propertyId);
    const sameSeller =
      sellerId != null && Number(appointment.sellerId) === Number(sellerId);

    return (
      (sameProperty || sameSeller) &&
      appointment.date === date &&
      appointment.time === time &&
      holdsAppointmentSlot(appointment.status) &&
      Number(appointment.id) !== Number(excludeId)
    );
  });

const notifyAdminsOfPropertySubmission = (db, property, messagePrefix) => {
  const nextNotificationId =
    db.notifications.reduce((max, n) => Math.max(max, n.id || 0), 0) + 1;
  const admins = db.users.filter((u) => u.role === "admin");

  admins.forEach((admin, index) => {
    db.notifications.push({
      id: nextNotificationId + index,
      userId: admin.id,
      type: "property_submitted",
      title: messagePrefix,
      message: `${messagePrefix}: "${property.title}" is ready for review.`,
      propertyId: property.id,
      propertyTitle: property.title,
      read: false,
      createdAt: new Date().toISOString(),
    });
  });
};

const requirePropertyAccess = (req, res, next) => {
  const db = getDB();
  const index = db.properties.findIndex((p) => p.id === Number(req.params.id));

  if (index === -1) {
    return res.status(404).json({ message: "Property not found." });
  }

  if (
    req.user.role !== "admin" &&
    db.properties[index].sellerId !== req.user.id
  ) {
    return res
      .status(403)
      .json({ message: "Not allowed to manage this property." });
  }

  req.db = db;
  req.propertyIndex = index;
  req.property = db.properties[index];
  next();
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const propertyFolder = path.join(
      PROPERTY_ASSETS_DIR,
      String(req.params.id),
    );
    fs.mkdirSync(propertyFolder, { recursive: true });
    cb(null, propertyFolder);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase() || ".jpg";
    const safeName = path
      .basename(file.originalname, extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    cb(null, `${Date.now()}-${safeName || "property"}${extension}`);
  },
});

const uploadPropertyImages = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 12,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed."));
      return;
    }
    cb(null, true);
  },
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AVATAR_ASSETS_DIR);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase() || ".jpg";
    const safeName = path
      .basename(file.originalname, extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    cb(
      null,
      `user-${req.user.id}-${Date.now()}-${safeName || "avatar"}${extension}`,
    );
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed."));
      return;
    }
    cb(null, true);
  },
});

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

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  next();
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
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login." });
  }
});

app.post("/register", (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    const requestedRole = role || "buyer";

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (!["buyer", "seller"].includes(requestedRole)) {
      return res.status(400).json({ message: "Invalid registration role." });
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
      role: requestedRole,
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

app.get("/agents", (req, res) => {
  try {
    const db = getDB();
    const agents = db.users
      .filter((u) => u.role === "seller" && u.isActive)
      .map(({ password, ...user }) => user);
    res.json(agents);
  } catch (error) {
    res.status(500).json({ message: "Error fetching agents." });
  }
});

app.get("/users", verifyToken, requireAdmin, (req, res) => {
  try {
    const db = getDB();
    const users = db.users.map(({ password, ...u }) => u);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users." });
  }
});

app.patch("/users/me", verifyToken, (req, res) => {
  try {
    const db = getDB();
    const index = db.users.findIndex((u) => u.id === req.user.id);

    if (index === -1) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = db.users[index];
    const { name, phone, password, currentPassword } = req.body;

    if (password) {
      if (!currentPassword) {
        return res.status(400).json({
          message: "Current password is required to change password.",
        });
      }
      if (currentPassword !== user.password) {
        return res
          .status(401)
          .json({ message: "Current password is incorrect." });
      }
    }

    const updatedUser = {
      ...user,
      ...(name && { name: name.trim() }),
      ...(phone && { phone: phone.trim() }),
      ...(password && { password }),
    };

    db.users[index] = updatedUser;
    saveDB(db);

    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ message: "Error updating profile." });
  }
});

app.post(
  "/users/me/avatar",
  verifyToken,
  uploadAvatar.single("avatar"),
  (req, res) => {
    try {
      const db = getDB();
      const index = db.users.findIndex((u) => u.id === req.user.id);

      if (index === -1) {
        return res.status(404).json({ message: "User not found." });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No avatar file uploaded." });
      }

      const avatarUrl = toPublicAssetUrl(
        `/assets/avatars/${req.file.filename}`,
      );

      deleteManagedAvatar(db.users[index].avatar);
      db.users[index].avatar = avatarUrl;
      saveDB(db);

      const { password: _, ...userWithoutPassword } = db.users[index];
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Error uploading avatar." });
    }
  },
);

app.delete("/users/me/avatar", verifyToken, (req, res) => {
  try {
    const db = getDB();
    const index = db.users.findIndex((u) => u.id === req.user.id);

    if (index === -1) {
      return res.status(404).json({ message: "User not found." });
    }

    deleteManagedAvatar(db.users[index].avatar);
    db.users[index].avatar = "";
    saveDB(db);

    const { password: _, ...userWithoutPassword } = db.users[index];
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ message: "Error removing avatar." });
  }
});

app.delete("/users/me", verifyToken, (req, res) => {
  try {
    const db = getDB();
    const index = db.users.findIndex((u) => u.id === req.user.id);

    if (index === -1) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = db.users[index];

    if (user.role === "admin") {
      const otherAdmins = db.users.filter(
        (u) => u.role === "admin" && u.id !== user.id,
      );
      if (otherAdmins.length === 0) {
        return res.status(400).json({
          message: "Cannot delete the last admin account.",
        });
      }
    }

    db.users.splice(index, 1);

    db.favorites = db.favorites.filter((f) => f.buyerId !== req.user.id);

    db.properties = db.properties.map((p) => {
      if (p.sellerId === req.user.id) {
        return { ...p, isActive: false };
      }
      return p;
    });

    saveDB(db);

    res.json({ message: "Account deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error deleting account." });
  }
});

app.patch("/users/:id", verifyToken, requireAdmin, (req, res) => {
  try {
    const db = getDB();
    const index = db.users.findIndex((u) => u.id === Number(req.params.id));

    if (index === -1) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = db.users[index];
    const nextRole = req.body.role ?? user.role;
    const nextIsActive = req.body.isActive ?? user.isActive;
    const { password, ...safeUpdates } = req.body;

    if (!["buyer", "seller", "admin"].includes(nextRole)) {
      return res.status(400).json({ message: "Invalid user role." });
    }

    if (user.id === req.user.id && nextIsActive === false) {
      return res
        .status(400)
        .json({ message: "You cannot deactivate your own admin account." });
    }

    db.users[index] = {
      ...user,
      ...safeUpdates,
      role: nextRole,
      isActive: nextIsActive,
    };
    saveDB(db);

    const { password: _, ...userWithoutPassword } = db.users[index];
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ message: "Error updating user." });
  }
});

app.delete("/users/:id", verifyToken, requireAdmin, (req, res) => {
  try {
    const db = getDB();
    const id = Number(req.params.id);
    const index = db.users.findIndex((u) => u.id === id);

    if (index === -1) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = db.users[index];

    if (user.id === req.user.id) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own account." });
    }

    if (user.role === "admin") {
      const otherAdmins = db.users.filter(
        (u) => u.role === "admin" && u.id !== user.id,
      );
      if (otherAdmins.length === 0) {
        return res
          .status(400)
          .json({ message: "Cannot delete the last admin account." });
      }
    }

    db.users.splice(index, 1);

    db.favorites = db.favorites.filter((f) => f.buyerId !== user.id);

    db.properties = db.properties.map((p) => {
      if (p.sellerId === user.id) {
        return { ...p, isActive: false };
      }
      return p;
    });

    saveDB(db);

    res.json({ message: "User deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error deleting user." });
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
    notifyAdminsOfPropertySubmission(
      db,
      newProperty,
      "New Property Submission",
    );

    saveDB(db);

    res.status(201).json(newProperty);
  } catch (error) {
    res.status(500).json({ message: "Error creating property." });
  }
});

app.post(
  "/properties/:id/images",
  verifyToken,
  requirePropertyAccess,
  uploadPropertyImages.array("images", 12),
  (req, res) => {
    try {
      const db = req.db;
      const index = req.propertyIndex;
      const propertyId = Number(req.params.id);
      const uploadedImages = (req.files || []).map((file) =>
        toPublicAssetUrl(`/assets/properties/${propertyId}/${file.filename}`),
      );

      db.properties[index] = {
        ...db.properties[index],
        images: [...(db.properties[index].images || []), ...uploadedImages],
      };
      saveDB(db);

      res.json(db.properties[index]);
    } catch (error) {
      res.status(500).json({ message: "Error uploading property images." });
    }
  },
);

app.patch("/properties/:id", verifyToken, (req, res) => {
  try {
    const db = getDB();
    const index = db.properties.findIndex(
      (p) => p.id === Number(req.params.id),
    );

    if (index === -1) {
      return res.status(404).json({ message: "Property not found." });
    }

    if (
      req.user.role !== "admin" &&
      db.properties[index].sellerId !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "Not allowed to update this property." });
    }

    const oldProperty = db.properties[index];
    const oldStatus = oldProperty.status;
    const newStatus = req.body.status;
    const isSellerResubmission =
      req.user.role === "seller" && oldStatus === "rejected";

    if (Array.isArray(req.body.images)) {
      deleteRemovedManagedImages(db.properties[index].images, req.body.images);
    }

    db.properties[index] = {
      ...db.properties[index],
      ...req.body,
      ...(isSellerResubmission && {
        status: "pending",
        resubmittedAt: new Date().toISOString(),
      }),
    };

    if (
      req.user.role === "admin" &&
      newStatus &&
      newStatus !== oldStatus &&
      (newStatus === "approved" || newStatus === "rejected")
    ) {
      const sellerId = db.properties[index].sellerId;
      const propertyTitle = db.properties[index].title;
      const nextNotificationId =
        db.notifications.reduce((max, n) => Math.max(max, n.id || 0), 0) + 1;

      db.notifications.push({
        id: nextNotificationId,
        userId: sellerId,
        type:
          newStatus === "approved" ? "property_approved" : "property_rejected",
        title:
          newStatus === "approved" ? "Property Approved" : "Property Rejected",
        message:
          newStatus === "approved"
            ? `Your property "${propertyTitle}" has been approved and is now live.`
            : `Your property "${propertyTitle}" has been rejected. Please review and resubmit.`,
        propertyId: db.properties[index].id,
        propertyTitle: propertyTitle,
        read: false,
        createdAt: new Date().toISOString(),
      });

      saveDB(db);
    } else if (isSellerResubmission) {
      notifyAdminsOfPropertySubmission(
        db,
        db.properties[index],
        "Property Resubmitted",
      );
      saveDB(db);
    } else {
      saveDB(db);
    }

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

    if (
      req.user.role !== "admin" &&
      db.properties[index].sellerId !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "Not allowed to delete this property." });
    }

    deleteRemovedManagedImages(db.properties[index].images, []);
    deletePropertyAssetFolder(db.properties[index].id);

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
    const { propertyId, date } = req.query;

    if (propertyId && date) {
      const requestedPropertyId = Number(propertyId);

      if (Number.isNaN(requestedPropertyId)) {
        return res.status(400).json({ message: "Invalid property id." });
      }

      const unavailableSlots = db.appointments
        .filter(
          (appointment) =>
            Number(appointment.propertyId) === requestedPropertyId &&
            appointment.date === date &&
            holdsAppointmentSlot(appointment.status),
        )
        .map(({ id, propertyId, sellerId, date, time, status }) => ({
          id,
          propertyId,
          sellerId,
          date,
          time,
          status,
        }));

      return res.json(unavailableSlots);
    }

    res.json(getVisibleAppointments(db.appointments, req.user));
  } catch (error) {
    res.status(500).json({ message: "Error fetching appointments." });
  }
});

app.get("/appointments/:id", verifyToken, (req, res) => {
  try {
    const db = getDB();
    const appointment = db.appointments.find(
      (a) => a.id === Number(req.params.id),
    );

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    if (!canAccessAppointment(appointment, req.user)) {
      return res
        .status(403)
        .json({ message: "Not allowed to access this appointment." });
    }

    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: "Error fetching appointment." });
  }
});

app.post("/appointments", verifyToken, (req, res) => {
  try {
    const db = getDB();
    const property = db.properties.find(
      (item) => item.id === Number(req.body.propertyId),
    );

    if (!property) {
      return res.status(404).json({ message: "Property not found." });
    }

    if (req.user.role !== "buyer" && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only buyers can book appointments." });
    }

    const sellerId = Number(property.sellerId);
    const conflict = findAppointmentSlotConflict(db.appointments, {
      propertyId: req.body.propertyId,
      sellerId,
      date: req.body.date,
      time: req.body.time,
    });

    if (conflict) {
      return res.status(409).json({
        message: "This time slot is already full. Please choose another time.",
      });
    }

    const newAppointment = {
      id: db.appointments.length + 1,
      ...req.body,
      userId: req.user.id,
      buyerId: req.user.id,
      sellerId,
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

    const appointment = db.appointments[index];
    if (!canAccessAppointment(appointment, req.user)) {
      return res
        .status(403)
        .json({ message: "Not allowed to update this appointment." });
    }

    const {
      id,
      propertyId,
      buyerId,
      userId,
      sellerId,
      createdAt,
      ...allowedUpdates
    } = req.body;
    const nextAppointment = { ...appointment, ...allowedUpdates };
    const sellerApprovingOwnReschedule =
      req.user.role !== "admin" &&
      appointment.rescheduledBy === "seller" &&
      appointment.sellerId === req.user.id &&
      ["accepted", "confirmed"].includes(req.body.status);

    if (sellerApprovingOwnReschedule) {
      return res.status(400).json({
        message:
          "Buyer confirmation is required before this rescheduled appointment can be accepted.",
      });
    }

    if (
      holdsAppointmentSlot(nextAppointment.status) &&
      findAppointmentSlotConflict(db.appointments, {
        propertyId: nextAppointment.propertyId,
        sellerId: nextAppointment.sellerId,
        date: nextAppointment.date,
        time: nextAppointment.time,
        excludeId: nextAppointment.id,
      })
    ) {
      return res.status(409).json({
        message: "This time slot is already full. Please choose another time.",
      });
    }

    db.appointments[index] = {
      ...appointment,
      ...allowedUpdates,
    };
    saveDB(db);

    res.json(db.appointments[index]);
  } catch (error) {
    res.status(500).json({ message: "Error updating appointment." });
  }
});

app.get("/notifications", verifyToken, (req, res) => {
  try {
    const db = getDB();
    const notifications = db.notifications
      .filter((n) => n.userId === req.user.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
    res.json(notifications);
  } catch {
    res.status(500).json({ message: "Error fetching notifications." });
  }
});

app.post("/notifications", verifyToken, (req, res) => {
  try {
    const db = getDB();
    let targetUserId = Number(req.body.userId);

    if (!targetUserId || Number.isNaN(targetUserId)) {
      return res
        .status(400)
        .json({ message: "Notification user id is required." });
    }

    if (req.user.role !== "admin") {
      const appointment = db.appointments.find(
        (a) => a.id === Number(req.body.appointmentId),
      );

      if (!appointment || !isAppointmentParticipant(appointment, req.user)) {
        return res
          .status(403)
          .json({ message: "Not allowed to create this notification." });
      }

      const buyerId = Number(appointment.buyerId || appointment.userId);
      const sellerId = Number(appointment.sellerId);
      const senderId = Number(req.user.id);
      const expectedTargetId =
        senderId === buyerId
          ? sellerId
          : senderId === sellerId
            ? buyerId
            : null;

      if (!expectedTargetId || targetUserId !== expectedTargetId) {
        return res.status(403).json({
          message:
            "Notifications can only be sent to the other appointment participant.",
        });
      }

      targetUserId = expectedTargetId;
    }

    const targetUser = db.users.find((u) => u.id === targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "Notification user not found." });
    }

    const nextId =
      db.notifications.reduce((max, n) => Math.max(max, n.id || 0), 0) + 1;

    const notification = {
      id: nextId,
      ...req.body,
      userId: targetUserId,
      createdAt: new Date().toISOString(),
      read: false,
    };

    db.notifications.push(notification);
    saveDB(db);

    res.status(201).json(notification);
  } catch {
    res.status(500).json({ message: "Error creating notification." });
  }
});

app.patch("/notifications/:id", verifyToken, (req, res) => {
  try {
    const db = getDB();

    const index = db.notifications.findIndex(
      (n) => n.id === Number(req.params.id),
    );

    if (index === -1) {
      return res.status(404).json({ message: "Not found." });
    }

    if (
      req.user.role !== "admin" &&
      db.notifications[index].userId !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "Not allowed to update this notification." });
    }

    db.notifications[index] = {
      ...db.notifications[index],
      ...req.body,
    };

    saveDB(db);
    res.json(db.notifications[index]);
  } catch {
    res.status(500).json({ message: "Error updating notification." });
  }
});

app.get("/favorites", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "buyer" && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only buyers can access favorites." });
    }

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

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: error.message });
  }

  if (error?.message === "Only image files are allowed.") {
    return res.status(400).json({ message: error.message });
  }

  next(error);
});

app.post("/ai/buyer-chat", verifyToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
Extract real estate search filters from this buyer message.

Buyer message:
"${message}"

Return JSON only.

Rules:
- 1 lakh = 100000
- 80 lakhs = 8000000
- 1 crore = 10000000
- If user says "under", use maxPrice.
- If user says "above", use minPrice.
- If unknown, return null.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            location: { type: Type.STRING, nullable: true },
            minPrice: { type: Type.NUMBER, nullable: true },
            maxPrice: { type: Type.NUMBER, nullable: true },
            bedrooms: { type: Type.NUMBER, nullable: true },
            propertyType: { type: Type.STRING, nullable: true },
            parking: { type: Type.BOOLEAN, nullable: true },
          },
          required: [
            "location",
            "minPrice",
            "maxPrice",
            "bedrooms",
            "propertyType",
            "parking",
          ],
        },
      },
    });

    const filters = JSON.parse(response.text);

    const db = getDB();
    let properties = db.properties || [];

    properties = properties.filter((p) => {
      if (p.status !== "approved") return false;

      const city = String(p.location?.city || "").toLowerCase();
      const district = String(p.location?.district || "").toLowerCase();
      const address = String(p.location?.address || "").toLowerCase();
      const locationText = `${city} ${district} ${address}`;

      if (
        filters.location &&
        !locationText.includes(filters.location.toLowerCase())
      ) {
        return false;
      }

      if (filters.minPrice && Number(p.price) < filters.minPrice) {
        return false;
      }

      if (filters.maxPrice && Number(p.price) > filters.maxPrice) {
        return false;
      }

      if (filters.bedrooms && Number(p.bedrooms || 0) < filters.bedrooms) {
        return false;
      }

      if (
        filters.propertyType &&
        String(p.type || "").toLowerCase() !==
          filters.propertyType.toLowerCase()
      ) {
        return false;
      }

      const amenitiesText = Array.isArray(p.amenities)
        ? p.amenities.join(" ").toLowerCase()
        : String(p.amenities || "").toLowerCase();

      if (filters.parking === true && !amenitiesText.includes("parking")) {
        return false;
      }

      return true;
    });

    res.json({
      reply: properties.length
        ? `I found ${properties.length} matching properties.`
        : "I couldn't find exact matches. Try changing location, budget, or bedrooms.",
      filters,
      properties: properties.slice(0, 6),
    });
  } catch (error) {
    console.error("AI buyer assistant error:", error);
    res.status(500).json({ message: "AI buyer assistant failed" });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Afnoghar Server running at http://localhost:${PORT}`);
});

server.on("error", (error) => {
  console.error("Unable to start Afnoghar server:", error.message);
});

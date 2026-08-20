const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_FILE = path.join(ROOT, "data", "app-data.json");
const PORT = Number(process.env.PORT || 3000);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

const learningCards = [
  {
    title: "What Is Meter Reading?",
    body: "A meter reading is the number shown on the electricity meter. Units consumed are calculated by subtracting the previous reading from the current reading.",
    formula: "Units = Current Reading - Previous Reading"
  },
  {
    title: "How Bill Amount Is Calculated",
    body: "The selected tariff slab gives the rate per unit, fixed charge, and tax percentage. The app uses the connection type and consumed units to choose the slab.",
    formula: "Total = Energy Charge + Fixed Charge + Tax"
  },
  {
    title: "What Is A Defaulter?",
    body: "A consumer becomes a defaulter when a bill remains unpaid after its due date. The defaulter list helps officers follow up quickly.",
    formula: "Defaulter = Status is Overdue"
  }
];

function money(value) {
  return Number(Number(value).toFixed(2));
}

async function readDb() {
  return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
}

async function writeDb(db) {
  await fs.writeFile(DATA_FILE, `${JSON.stringify(db, null, 2)}\n`);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendError(res, status, message, details = []) {
  sendJson(res, status, { error: message, details });
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON request body.");
    error.statusCode = 400;
    throw error;
  }
}

function validateText(value, label, { required = true, max = 80 } = {}) {
  const text = String(value || "").trim();
  if (required && !text) return `${label} is required.`;
  if (text.length > max) return `${label} must be ${max} characters or less.`;
  if (text && !/^[A-Za-z0-9 .,#/-]+$/.test(text)) {
    return `${label} can use letters, numbers, spaces, comma, period, hyphen, slash, or # only.`;
  }
  return "";
}

function validatePhone(value) {
  const text = String(value || "").trim();
  if (!/^[0-9]{10,15}$/.test(text)) {
    return "Phone must contain 10 to 15 digits.";
  }
  return "";
}

function getTariffForUnits(db, connectionType, units) {
  return db.tariffs.find((tariff) => {
    return tariff.connectionType === connectionType
      && units >= tariff.minUnits
      && units <= tariff.maxUnits;
  });
}

function calculateBill(db, { consumerId, currentReading, previousReading, connectionType }) {
  const consumer = db.consumers.find((item) => item.id === Number(consumerId));
  const type = connectionType || consumer?.connectionType;
  const current = Number(currentReading);
  const previous = Number(previousReading);

  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return { error: "Current and previous readings must be valid numbers." };
  }

  if (current < previous) {
    return { error: "Current reading cannot be lower than previous reading." };
  }

  const units = money(current - previous);
  const tariff = getTariffForUnits(db, type, units);
  if (!tariff) {
    return { error: "No tariff slab found for this connection type and unit range." };
  }

  const energyCharge = money(units * tariff.rate);
  const fixedCharge = money(tariff.fixedCharge);
  const tax = money((energyCharge + fixedCharge) * (tariff.taxPercent / 100));

  return {
    consumer,
    connectionType: type,
    unitsConsumed: units,
    slab: tariff,
    energyCharge,
    fixedCharge,
    tax,
    totalAmount: money(energyCharge + fixedCharge + tax)
  };
}

function withConsumerDetails(db, bill) {
  const consumer = db.consumers.find((item) => item.id === bill.consumerId);
  return {
    ...bill,
    consumerName: consumer?.name || "Unknown",
    place: consumer?.place || "",
    meterId: consumer?.meterId || "",
    connectionType: consumer?.connectionType || ""
  };
}

function buildSummary(db) {
  const dueBills = db.bills.filter((bill) => bill.status !== "Paid");
  return {
    consumers: db.consumers.length,
    activeMeters: db.consumers.filter((consumer) => consumer.meterId).length,
    pendingRequests: db.connectionRequests.filter((request) => request.status !== "Approved").length,
    defaulters: db.bills.filter((bill) => bill.status === "Overdue").length,
    dueAmount: money(dueBills.reduce((sum, bill) => sum + bill.totalAmount, 0)),
    lastReadingUnits: money(db.meterReadings.reduce((sum, reading) => sum + reading.unitsConsumed, 0))
  };
}

async function handleApi(req, res, pathname) {
  const db = await readDb();

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    sendJson(res, 200, {
      summary: buildSummary(db),
      consumers: db.consumers,
      meterReadings: db.meterReadings,
      bills: db.bills.map((bill) => withConsumerDetails(db, bill)),
      tariffs: db.tariffs,
      connectionTypes: db.connectionTypes,
      connectionRequests: db.connectionRequests,
      feedback: db.feedback,
      learningCards
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/summary") {
    sendJson(res, 200, buildSummary(db));
    return;
  }

  if (req.method === "GET" && pathname === "/api/consumers") {
    sendJson(res, 200, db.consumers);
    return;
  }

  if (req.method === "GET" && pathname === "/api/tariffs") {
    sendJson(res, 200, db.tariffs);
    return;
  }

  if (req.method === "GET" && pathname === "/api/bills") {
    sendJson(res, 200, db.bills.map((bill) => withConsumerDetails(db, bill)));
    return;
  }

  if (req.method === "GET" && pathname === "/api/defaulters") {
    sendJson(res, 200, db.bills
      .filter((bill) => bill.status === "Overdue")
      .map((bill) => withConsumerDetails(db, bill)));
    return;
  }

  if (req.method === "POST" && pathname === "/api/login") {
    const body = await parseBody(req);
    const user = db.users.find((item) => {
      return item.username === body.username && item.password === body.password;
    });

    if (!user) {
      sendError(res, 401, "Invalid username or password.");
      return;
    }

    sendJson(res, 200, {
      username: user.username,
      role: user.role,
      message: "Login successful."
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/calculate") {
    const result = calculateBill(db, await parseBody(req));
    if (result.error) {
      sendError(res, 400, result.error);
      return;
    }

    sendJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && pathname === "/api/connections") {
    const body = await parseBody(req);
    const errors = [
      validateText(body.applicantName, "Applicant name", { max: 50 }),
      validateText(body.place, "Place", { max: 60 }),
      validateText(body.address, "Address", { max: 120 }),
      validatePhone(body.phone)
    ].filter(Boolean);
    const loadKw = Number(body.loadKw);

    if (!db.connectionTypes.includes(body.connectionType)) {
      errors.push("Connection type is invalid.");
    }

    if (!Number.isFinite(loadKw) || loadKw <= 0) {
      errors.push("Load must be greater than zero.");
    }

    if (errors.length) {
      sendError(res, 400, "Please fix the highlighted fields.", errors);
      return;
    }

    const request = {
      id: Math.max(0, ...db.connectionRequests.map((item) => item.id)) + 1,
      applicantName: body.applicantName.trim(),
      place: body.place.trim(),
      address: body.address.trim(),
      phone: body.phone.trim(),
      connectionType: body.connectionType,
      loadKw: money(loadKw),
      status: "Submitted",
      createdAt: new Date().toISOString().slice(0, 10)
    };

    db.connectionRequests.push(request);
    await writeDb(db);
    sendJson(res, 201, request);
    return;
  }

  if (req.method === "POST" && pathname === "/api/feedback") {
    const body = await parseBody(req);
    const errors = [
      validateText(body.place, "Place", { max: 60 }),
      validateText(body.message, "Feedback", { max: 250 })
    ].filter(Boolean);
    const consumerId = Number(body.consumerId || 0);

    if (body.consumerId && !db.consumers.some((consumer) => consumer.id === consumerId)) {
      errors.push("Consumer ID was not found.");
    }

    if (errors.length) {
      sendError(res, 400, "Please fix the highlighted fields.", errors);
      return;
    }

    const feedback = {
      id: Math.max(0, ...db.feedback.map((item) => item.id)) + 1,
      consumerId: consumerId || null,
      place: body.place.trim(),
      message: body.message.trim(),
      createdAt: new Date().toISOString().slice(0, 10)
    };

    db.feedback.push(feedback);
    await writeDb(db);
    sendJson(res, 201, feedback);
    return;
  }

  const consumerMatch = pathname.match(/^\/api\/consumers\/(\d+)$/);
  if (req.method === "PATCH" && consumerMatch) {
    const consumer = db.consumers.find((item) => item.id === Number(consumerMatch[1]));
    if (!consumer) {
      sendError(res, 404, "Consumer not found.");
      return;
    }

    const body = await parseBody(req);
    const errors = [
      validateText(body.name, "Customer name", { max: 50 }),
      validateText(body.place, "Place", { max: 60 }),
      validateText(body.address, "Address", { max: 120 }),
      validatePhone(body.phone)
    ].filter(Boolean);

    if (!db.connectionTypes.includes(body.connectionType)) {
      errors.push("Connection type is invalid.");
    }

    if (errors.length) {
      sendError(res, 400, "Please fix the highlighted fields.", errors);
      return;
    }

    consumer.name = body.name.trim();
    consumer.place = body.place.trim();
    consumer.address = body.address.trim();
    consumer.phone = body.phone.trim();
    consumer.connectionType = body.connectionType;
    await writeDb(db);
    sendJson(res, 200, consumer);
    return;
  }

  sendError(res, 404, "API route not found.");
}

async function serveStatic(req, res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, "Forbidden.");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": MIME_TYPES[ext] || "application/octet-stream",
      "cache-control": "no-store"
    });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      res.writeHead(302, { location: "/" });
      res.end();
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
    } else {
      await serveStatic(req, res, url.pathname);
    }
  } catch (error) {
    const status = error.statusCode || 500;
    sendError(res, status, status === 500 ? "Unexpected server error." : error.message);
    if (status === 500) {
      console.error(error);
    }
  }
});

server.listen(PORT, () => {
  console.log(`Electrical Building Generator running at http://localhost:${PORT}`);
});

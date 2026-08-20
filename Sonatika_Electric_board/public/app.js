const state = {
  view: "dashboard",
  data: null,
  selectedConsumerId: 1,
  billResult: null,
  notice: ""
};

const viewTitles = {
  dashboard: "Dashboard",
  bills: "Check Bill",
  connections: "New Connection",
  consumers: "Update Details",
  tariffs: "Tariff & Learning",
  defaulters: "Defaulters",
  feedback: "Feedback"
};

const view = document.querySelector("#view");
const pageTitle = document.querySelector("#page-title");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function rupees(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload.details?.length
      ? payload.details.join(" ")
      : payload.error || "Request failed.";
    throw new Error(message);
  }
  return payload;
}

async function load() {
  state.data = await api("/api/bootstrap");
  state.selectedConsumerId = state.data.consumers[0]?.id || 1;
  render();
}

function statusBadge(status) {
  const className = `status-${String(status).toLowerCase().replaceAll(" ", "-")}`;
  return `<span class="badge ${className}">${escapeHtml(status)}</span>`;
}

function consumerOptions(selectedId) {
  return state.data.consumers.map((consumer) => {
    const selected = Number(selectedId) === consumer.id ? "selected" : "";
    return `<option value="${consumer.id}" ${selected}>${escapeHtml(consumer.name)} - ${escapeHtml(consumer.meterId)}</option>`;
  }).join("");
}

function typeOptions(selectedType) {
  return state.data.connectionTypes.map((type) => {
    const selected = selectedType === type ? "selected" : "";
    return `<option value="${escapeHtml(type)}" ${selected}>${escapeHtml(type)}</option>`;
  }).join("");
}

function renderStats() {
  const summary = state.data.summary;
  const stats = [
    ["Consumers", summary.consumers],
    ["Active meters", summary.activeMeters],
    ["Pending requests", summary.pendingRequests],
    ["Defaulters", summary.defaulters],
    ["Due amount", rupees(summary.dueAmount)],
    ["Units this cycle", summary.lastReadingUnits]
  ];

  return `
    <section class="stat-grid" aria-label="Summary">
      ${stats.map(([label, value]) => `
        <div class="stat">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `).join("")}
    </section>
  `;
}

function renderSchematic() {
  return `
    <section class="panel schematic" aria-label="Electrical supply schematic">
      <svg viewBox="0 0 760 270" role="img" aria-label="Power plant to meter to building flow">
        <rect x="28" y="32" width="136" height="172" rx="8" fill="#ffffff" stroke="#c8d5ce"/>
        <path d="M56 174 L84 104 L112 174 Z" fill="#f6c85f" stroke="#9a6400"/>
        <rect x="72" y="174" width="52" height="18" fill="#17202a"/>
        <text x="46" y="226" fill="#61707f" font-size="18" font-weight="700">Power Plant</text>
        <line x1="164" y1="118" x2="278" y2="118" stroke="#1769aa" stroke-width="6"/>
        <circle cx="286" cy="118" r="18" fill="#1769aa"/>
        <rect x="320" y="58" width="108" height="120" rx="8" fill="#ffffff" stroke="#c8d5ce"/>
        <text x="346" y="116" fill="#1f2933" font-size="22" font-weight="800">Meter</text>
        <text x="348" y="145" fill="#197b54" font-size="18">kWh</text>
        <line x1="428" y1="118" x2="548" y2="118" stroke="#197b54" stroke-width="6"/>
        <rect x="568" y="72" width="140" height="106" rx="8" fill="#ffffff" stroke="#c8d5ce"/>
        <path d="M568 72 L638 24 L708 72" fill="#dfeefe" stroke="#1769aa" stroke-width="4"/>
        <rect x="594" y="118" width="28" height="60" fill="#fff1d2" stroke="#b26b00"/>
        <rect x="650" y="104" width="30" height="28" fill="#dcefe5" stroke="#197b54"/>
        <text x="592" y="216" fill="#61707f" font-size="18" font-weight="700">Building</text>
      </svg>
    </section>
  `;
}

function billsTable(bills) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Bill</th>
            <th>Consumer</th>
            <th>Type</th>
            <th>Units</th>
            <th>Total</th>
            <th>Due Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${bills.map((bill) => `
            <tr>
              <td>#${bill.id}<br><span class="subtle">${escapeHtml(bill.billMonth)}</span></td>
              <td>${escapeHtml(bill.consumerName)}<br><span class="subtle">${escapeHtml(bill.place)}</span></td>
              <td>${escapeHtml(bill.connectionType)}</td>
              <td>${bill.unitsConsumed}</td>
              <td>${rupees(bill.totalAmount)}</td>
              <td>${escapeHtml(bill.dueDate)}</td>
              <td>${statusBadge(bill.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderDashboard() {
  const latestBills = state.data.bills.slice(0, 5);
  return `
    ${renderStats()}
    <div class="grid two-col">
      ${renderSchematic()}
      <section class="panel">
        <h2>Workflow Snapshot</h2>
        <div class="stack">
          <div class="card"><strong>Login</strong><p class="subtle">Officer access is available with admin/admin123 for the local demo.</p></div>
          <div class="card"><strong>Check the bill</strong><p class="subtle">Search consumer records, verify readings, and view calculated bill amount.</p></div>
          <div class="card"><strong>Manage connections</strong><p class="subtle">Submit new connection requests and update existing consumer details.</p></div>
        </div>
      </section>
    </div>
    <section class="panel" style="margin-top:18px">
      <h2>Recent Bills</h2>
      ${billsTable(latestBills)}
    </section>
  `;
}

function renderBills() {
  const selected = state.data.consumers.find((consumer) => consumer.id === Number(state.selectedConsumerId)) || state.data.consumers[0];
  const reading = state.data.meterReadings.find((item) => item.consumerId === selected?.id);
  const result = state.billResult;

  return `
    <div class="grid two-col">
      <section class="panel">
        <h2>Generate Bill</h2>
        <form id="bill-form" class="form-grid">
          <label class="wide">Consumer
            <select name="consumerId" id="bill-consumer">${consumerOptions(selected?.id)}</select>
          </label>
          <label>Previous reading
            <input name="previousReading" type="number" step="0.01" value="${reading ? reading.previousReading : 0}" required>
          </label>
          <label>Current reading
            <input name="currentReading" type="number" step="0.01" value="${reading ? reading.currentReading : 250}" required>
          </label>
          <button class="primary-button wide" type="submit">Calculate Bill</button>
        </form>
        ${state.notice ? `<div class="notice error">${escapeHtml(state.notice)}</div>` : ""}
      </section>

      <section class="panel">
        <h2>Calculated Result</h2>
        ${result ? `
          <div class="result-box">
            <span>${escapeHtml(result.connectionType)} - ${result.unitsConsumed} units</span>
            <strong>${rupees(result.totalAmount)}</strong>
            <p class="subtle">Energy ${rupees(result.energyCharge)} + fixed ${rupees(result.fixedCharge)} + tax ${rupees(result.tax)}</p>
            <p class="subtle">Slab rate: ${rupees(result.slab.rate)} per unit</p>
          </div>
        ` : `<p class="subtle">Choose a consumer and calculate the bill.</p>`}
      </section>
    </div>
    <section class="panel" style="margin-top:18px">
      <h2>Bill Register</h2>
      ${billsTable(state.data.bills)}
    </section>
  `;
}

function renderConnections() {
  return `
    <div class="grid two-col">
      <section class="panel">
        <h2>Apply New Connection</h2>
        <form id="connection-form" class="form-grid">
          <label>Applicant name
            <input name="applicantName" required maxlength="50">
          </label>
          <label>Phone
            <input name="phone" required inputmode="numeric" maxlength="15">
          </label>
          <label>Place
            <input name="place" required maxlength="60">
          </label>
          <label>Connection type
            <select name="connectionType">${typeOptions("Residential")}</select>
          </label>
          <label>Load KW
            <input name="loadKw" type="number" min="0.1" step="0.1" required>
          </label>
          <label class="wide">Address
            <textarea name="address" required maxlength="120"></textarea>
          </label>
          <button class="primary-button wide" type="submit">Submit Request</button>
        </form>
        ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ""}
      </section>
      <section class="panel">
        <h2>Request Queue</h2>
        <div class="stack">
          ${state.data.connectionRequests.map((request) => `
            <article class="card">
              <h3>${escapeHtml(request.applicantName)}</h3>
              <p class="subtle">${escapeHtml(request.place)} - ${escapeHtml(request.connectionType)} - ${request.loadKw} KW</p>
              ${statusBadge(request.status)}
            </article>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderConsumers() {
  const selected = state.data.consumers.find((consumer) => consumer.id === Number(state.selectedConsumerId)) || state.data.consumers[0];
  return `
    <div class="grid two-col">
      <section class="panel">
        <h2>Change Existing Details</h2>
        <form id="consumer-select-form" class="form-grid">
          <label class="wide">Consumer
            <select name="consumerId" id="consumer-select">${consumerOptions(selected?.id)}</select>
          </label>
        </form>
        <form id="consumer-form" class="form-grid">
          <label>Customer name
            <input name="name" value="${escapeHtml(selected.name)}" maxlength="50" required>
          </label>
          <label>Phone
            <input name="phone" value="${escapeHtml(selected.phone)}" maxlength="15" required>
          </label>
          <label>Place
            <input name="place" value="${escapeHtml(selected.place)}" maxlength="60" required>
          </label>
          <label>Connection type
            <select name="connectionType">${typeOptions(selected.connectionType)}</select>
          </label>
          <label class="wide">Address
            <textarea name="address" maxlength="120" required>${escapeHtml(selected.address)}</textarea>
          </label>
          <button class="primary-button wide" type="submit">Update Consumer</button>
        </form>
        ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ""}
      </section>
      <section class="panel">
        <h2>Consumer Directory</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Name</th><th>Meter</th><th>Place</th><th>Type</th></tr>
            </thead>
            <tbody>
              ${state.data.consumers.map((consumer) => `
                <tr>
                  <td>${consumer.id}</td>
                  <td>${escapeHtml(consumer.name)}</td>
                  <td>${escapeHtml(consumer.meterId)}</td>
                  <td>${escapeHtml(consumer.place)}</td>
                  <td>${escapeHtml(consumer.connectionType)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function renderTariffs() {
  return `
    <div class="grid two-col">
      <section class="panel">
        <h2>Tariff Slabs</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Type</th><th>Unit Range</th><th>Rate</th><th>Fixed</th><th>Tax</th></tr>
            </thead>
            <tbody>
              ${state.data.tariffs.map((tariff) => `
                <tr>
                  <td>${escapeHtml(tariff.connectionType)}</td>
                  <td>${tariff.minUnits} - ${tariff.maxUnits === 999999 ? "Above" : tariff.maxUnits}</td>
                  <td>${rupees(tariff.rate)}</td>
                  <td>${rupees(tariff.fixedCharge)}</td>
                  <td>${tariff.taxPercent}%</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel">
        <h2>Learning Notes</h2>
        <div class="stack">
          ${state.data.learningCards.map((card) => `
            <article class="card learning-card">
              <h3>${escapeHtml(card.title)}</h3>
              <p class="subtle">${escapeHtml(card.body)}</p>
              <span class="formula">${escapeHtml(card.formula)}</span>
            </article>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderDefaulters() {
  const defaulters = state.data.bills.filter((bill) => bill.status === "Overdue");
  return `
    ${renderStats()}
    <section class="panel">
      <h2>Bill Defaulters</h2>
      ${defaulters.length ? billsTable(defaulters) : `<p class="subtle">No overdue bills in the seed data.</p>`}
    </section>
  `;
}

function renderFeedback() {
  return `
    <div class="grid two-col">
      <section class="panel">
        <h2>Feedback</h2>
        <form id="feedback-form" class="form-grid">
          <label>Consumer ID
            <input name="consumerId" type="number" min="1">
          </label>
          <label>Place
            <input name="place" maxlength="60" required>
          </label>
          <label class="wide">Message
            <textarea name="message" maxlength="250" required></textarea>
          </label>
          <button class="primary-button wide" type="submit">Send Feedback</button>
        </form>
        ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ""}
      </section>
      <section class="panel">
        <h2>Recent Feedback</h2>
        <div class="stack">
          ${state.data.feedback.slice().reverse().map((item) => `
            <article class="card">
              <h3>${escapeHtml(item.place)}</h3>
              <p>${escapeHtml(item.message)}</p>
              <p class="subtle">${escapeHtml(item.createdAt)}${item.consumerId ? ` - Consumer #${item.consumerId}` : ""}</p>
            </article>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function render() {
  pageTitle.textContent = viewTitles[state.view];
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });

  const renderers = {
    dashboard: renderDashboard,
    bills: renderBills,
    connections: renderConnections,
    consumers: renderConsumers,
    tariffs: renderTariffs,
    defaulters: renderDefaulters,
    feedback: renderFeedback
  };

  view.innerHTML = renderers[state.view]();
  bindViewEvents();
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function bindViewEvents() {
  document.querySelector("#bill-consumer")?.addEventListener("change", (event) => {
    state.selectedConsumerId = Number(event.target.value);
    state.billResult = null;
    state.notice = "";
    render();
  });

  document.querySelector("#bill-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.notice = "";
    try {
      state.billResult = await api("/api/calculate", {
        method: "POST",
        body: JSON.stringify(formData(event.currentTarget))
      });
    } catch (error) {
      state.billResult = null;
      state.notice = error.message;
    }
    render();
  });

  document.querySelector("#connection-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/connections", {
        method: "POST",
        body: JSON.stringify(formData(event.currentTarget))
      });
      state.data = await api("/api/bootstrap");
      state.notice = "Connection request submitted.";
    } catch (error) {
      state.notice = error.message;
    }
    render();
  });

  document.querySelector("#consumer-select")?.addEventListener("change", (event) => {
    state.selectedConsumerId = Number(event.target.value);
    state.notice = "";
    render();
  });

  document.querySelector("#consumer-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api(`/api/consumers/${state.selectedConsumerId}`, {
        method: "PATCH",
        body: JSON.stringify(formData(event.currentTarget))
      });
      state.data = await api("/api/bootstrap");
      state.notice = "Consumer details updated.";
    } catch (error) {
      state.notice = error.message;
    }
    render();
  });

  document.querySelector("#feedback-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/feedback", {
        method: "POST",
        body: JSON.stringify(formData(event.currentTarget))
      });
      state.data = await api("/api/bootstrap");
      state.notice = "Feedback saved.";
    } catch (error) {
      state.notice = error.message;
    }
    render();
  });
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    state.notice = "";
    state.billResult = null;
    render();
    view.focus();
  });
});

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#login-status");
  try {
    const user = await api("/api/login", {
      method: "POST",
      body: JSON.stringify(formData(event.currentTarget))
    });
    status.textContent = user.role;
  } catch (error) {
    status.textContent = "Denied";
  }
});

load().catch((error) => {
  view.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
});

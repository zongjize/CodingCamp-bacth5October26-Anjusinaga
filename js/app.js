document.addEventListener("DOMContentLoaded", () => {
  // --- 1. Jam, Tanggal, Greeting & Custom Name ---
  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("date");
  const greetingEl = document.getElementById("greeting");
  const nameInput = document.getElementById("nameInput");
  const saveNameBtn = document.getElementById("saveNameBtn");

  let customName = localStorage.getItem("userName") || "";
  if (customName) nameInput.value = customName;

  function updateClockAndGreeting() {
    const now = new Date();
    
    // Format Waktu (HH:MM:SS)
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    clockEl.textContent = `${hours}:${minutes}:${seconds}`;

    // Format Tanggal
    const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    dateEl.textContent = now.toLocaleDateString("en-US", options);

    // Ucapan Salam Otomatis
    const currentHour = now.getHours();
    let greetingText = "Good Morning";
    if (currentHour >= 12 && currentHour < 18) {
      greetingText = "Good Afternoon";
    } else if (currentHour >= 18) {
      greetingText = "Good Evening";
    }

    greetingEl.textContent = customName ? `${greetingText}, ${customName}` : greetingText;
  }

  saveNameBtn.addEventListener("click", () => {
    customName = nameInput.value.trim();
    localStorage.setItem("userName", customName);
    updateClockAndGreeting();
  });

  setInterval(updateClockAndGreeting, 1000);
  updateClockAndGreeting();

  // --- 2. Focus Timer (Pomodoro) ---
  const timerDisplay = document.getElementById("timerDisplay");
  const startTimerBtn = document.getElementById("startTimerBtn");
  const stopTimerBtn = document.getElementById("stopTimerBtn");
  const resetTimerBtn = document.getElementById("resetTimerBtn");
  const customMinutesInput = document.getElementById("customMinutes");
  const setTimerBtn = document.getElementById("setTimerBtn");

  let timerInterval = null;
  let totalSeconds = 25 * 60; // Default 25 Menit

  function renderTimer() {
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const secs = String(totalSeconds % 60).padStart(2, "0");
    timerDisplay.textContent = `${mins}:${secs}`;
  }

  startTimerBtn.addEventListener("click", () => {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
      if (totalSeconds > 0) {
        totalSeconds--;
        renderTimer();
      } else {
        clearInterval(timerInterval);
        timerInterval = null;
        alert("Focus timer completed!");
      }
    }, 1000);
  });

  stopTimerBtn.addEventListener("click", () => {
    clearInterval(timerInterval);
    timerInterval = null;
  });

  resetTimerBtn.addEventListener("click", () => {
    clearInterval(timerInterval);
    timerInterval = null;
    const minutes = parseInt(customMinutesInput.value) || 25;
    totalSeconds = minutes * 60;
    renderTimer();
  });

  setTimerBtn.addEventListener("click", () => {
    clearInterval(timerInterval);
    timerInterval = null;
    const minutes = parseInt(customMinutesInput.value) || 25;
    totalSeconds = minutes * 60;
    renderTimer();
  });

  renderTimer();

  // --- 3. To-Do List (LocalStorage & Mencegah Duplikat) ---
  const taskForm = document.getElementById("taskForm");
  const taskInput = document.getElementById("taskInput");
  const taskList = document.getElementById("taskList");
  const taskError = document.getElementById("taskError");

  let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

  function saveAndRenderTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
    taskList.innerHTML = "";

    tasks.forEach((task, index) => {
      const li = document.createElement("li");
      li.className = "task-item";

      const leftDiv = document.createElement("div");
      leftDiv.className = `task-left ${task.completed ? "completed" : ""}`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.completed;
      checkbox.addEventListener("change", () => {
        tasks[index].completed = checkbox.checked;
        saveAndRenderTasks();
      });

      const span = document.createElement("span");
      span.textContent = task.text;

      leftDiv.appendChild(checkbox);
      leftDiv.appendChild(span);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn-delete";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        tasks.splice(index, 1);
        saveAndRenderTasks();
      });

      li.appendChild(leftDiv);
      li.appendChild(deleteBtn);
      taskList.appendChild(li);
    });
  }

  taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const taskText = taskInput.value.trim();
    if (!taskText) return;

    // Mencegah Tugas Duplikat
    const isDuplicate = tasks.some(t => t.text.toLowerCase() === taskText.toLowerCase());
    if (isDuplicate) {
      taskError.textContent = "Task already exists!";
      return;
    }

    taskError.textContent = "";
    tasks.push({ text: taskText, completed: false });
    taskInput.value = "";
    saveAndRenderTasks();
  });

  saveAndRenderTasks();

  // --- 4. Quick Links (LocalStorage) ---
  const linkForm = document.getElementById("linkForm");
  const linkNameInput = document.getElementById("linkNameInput");
  const linkUrlInput = document.getElementById("linkUrlInput");
  const quickLinksContainer = document.getElementById("quickLinksContainer");

  let defaultLinks = [
    { name: "Google", url: "https://www.google.com" },
    { name: "Gmail", url: "https://mail.google.com" },
    { name: "Calendar", url: "https://calendar.google.com" }
  ];

  let quickLinks = JSON.parse(localStorage.getItem("quickLinks")) || defaultLinks;

  function saveAndRenderLinks() {
    localStorage.setItem("quickLinks", JSON.stringify(quickLinks));
    quickLinksContainer.innerHTML = "";

    quickLinks.forEach((link, index) => {
      const a = document.createElement("a");
      a.className = "link-btn";
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = link.name + " ";

      const closeSpan = document.createElement("span");
      closeSpan.className = "close-link";
      closeSpan.textContent = "×";
      closeSpan.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        quickLinks.splice(index, 1);
        saveAndRenderLinks();
      });

      a.appendChild(closeSpan);
      quickLinksContainer.appendChild(a);
    });
  }

  linkForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = linkNameInput.value.trim();
    let url = linkUrlInput.value.trim();

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    quickLinks.push({ name, url });
    linkNameInput.value = "";
    linkUrlInput.value = "";
    saveAndRenderLinks();
  });

  saveAndRenderLinks();
});
